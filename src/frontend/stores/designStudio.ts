/**
 * Design Studio editor state: the design being edited, selection, undo /
 * redo history, clipboard and view options. Components mutate the design
 * only through these actions so every change is undoable.
 */
import type { Design, DesignElement, Orientation, PagePreset } from '~/lib/design-core'
import { defineStore } from 'pinia'
import { newElementId, pageFor, resizeDesign } from '~/lib/design-core'

export interface DesignMeta {
  documentId: string | null
  name: string
  description: string | null
  system: boolean
  isPremium: boolean
  categoryId: number | null
  sortOrder: number
  canEdit: boolean
  updatedAt: string | null
}

const HISTORY_LIMIT = 100

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

export const useDesignStudioStore = defineStore('designStudio', {
  state: () => ({
    design: null as Design | null,
    meta: null as DesignMeta | null,
    selectedIds: [] as string[],
    editingTextId: null as string | null,
    past: [] as string[],
    future: [] as string[],
    savedSnapshot: '' as string,
    /** Coalesces rapid edits of the same property (typing, sliders) into one undo step. */
    lastRecord: { key: '', at: 0 },
    gestureOpen: false,
    clipboard: [] as DesignElement[],
    zoom: 1,
    showSampleData: false,
    sampleIndex: 0,
    /** Bumped on every change - the canvas re-renders when it moves. */
    revision: 0,
  }),

  getters: {
    elements: (s): DesignElement[] => s.design?.elements ?? [],
    selected(s): DesignElement[] {
      const ids = new Set(s.selectedIds)
      return (s.design?.elements ?? []).filter(e => ids.has(e.id))
    },
    single(): DesignElement | null {
      return this.selected.length === 1 ? this.selected[0] : null
    },
    dirty: s => !!s.design && JSON.stringify(s.design) !== s.savedSnapshot,
    canUndo: s => s.past.length > 0,
    canRedo: s => s.future.length > 0,
  },

  actions: {
    load(design: Design, meta: DesignMeta) {
      this.design = clone(design)
      this.meta = { ...meta }
      this.selectedIds = []
      this.editingTextId = null
      this.past = []
      this.future = []
      this.savedSnapshot = JSON.stringify(this.design)
      this.revision++
    },

    markSaved(meta?: Partial<DesignMeta>) {
      this.savedSnapshot = JSON.stringify(this.design)
      if (meta && this.meta) {
        Object.assign(this.meta, meta)
      }
    },

    /**
     * Record the current state for undo. Calls with the same `key` within
     * 700 ms merge into one step (typing in a field, dragging a slider).
     */
    record(key = '') {
      if (!this.design || this.gestureOpen) {
        return
      }
      const now = Date.now()
      if (key && key === this.lastRecord.key && now - this.lastRecord.at < 700) {
        this.lastRecord.at = now
        return
      }
      this.past.push(JSON.stringify(this.design))
      if (this.past.length > HISTORY_LIMIT) {
        this.past.shift()
      }
      this.future = []
      this.lastRecord = { key, at: now }
    },

    /** Start a drag/resize/rotate: one undo step for the whole gesture. */
    beginGesture() {
      this.record()
      this.gestureOpen = true
    },
    endGesture() {
      this.gestureOpen = false
      this.lastRecord = { key: '', at: 0 }
      // A click that opened a gesture without moving anything leaves no undo step.
      if (this.past.length && this.past[this.past.length - 1] === JSON.stringify(this.design)) {
        this.past.pop()
      }
      this.revision++
    },

    touch() {
      this.revision++
    },

    undo() {
      if (!this.design || !this.past.length) {
        return
      }
      this.future.push(JSON.stringify(this.design))
      this.design = JSON.parse(this.past.pop()!)
      this.selectedIds = this.selectedIds.filter(id => this.design!.elements.some(e => e.id === id))
      this.editingTextId = null
      this.lastRecord = { key: '', at: 0 }
      this.revision++
    },

    redo() {
      if (!this.design || !this.future.length) {
        return
      }
      this.past.push(JSON.stringify(this.design))
      this.design = JSON.parse(this.future.pop()!)
      this.selectedIds = this.selectedIds.filter(id => this.design!.elements.some(e => e.id === id))
      this.editingTextId = null
      this.lastRecord = { key: '', at: 0 }
      this.revision++
    },

    select(ids: string[] | string | null, additive = false) {
      const list = ids == null ? [] : Array.isArray(ids) ? ids : [ids]
      if (additive) {
        const set = new Set(this.selectedIds)
        for (const id of list) {
          if (set.has(id)) {
            set.delete(id)
          }
          else {
            set.add(id)
          }
        }
        this.selectedIds = [...set]
      }
      else {
        this.selectedIds = list
      }
      if (this.editingTextId && !this.selectedIds.includes(this.editingTextId)) {
        this.editingTextId = null
      }
    },

    element(id: string): DesignElement | undefined {
      return this.design?.elements.find(e => e.id === id)
    },

    /** Add an element; it is centred on the page unless x/y are given. */
    addElement(partial: Partial<DesignElement> & { type: DesignElement['type'] }, opts: { select?: boolean, at?: { x: number, y: number } } = {}) {
      if (!this.design) {
        return null
      }
      this.record()
      const page = this.design.page
      const w = partial.w ?? 200
      const h = partial.h ?? 80
      const el = {
        ...partial,
        id: newElementId(),
        w,
        h,
        x: opts.at ? opts.at.x - w / 2 : partial.x ?? (page.width - w) / 2,
        y: opts.at ? opts.at.y - h / 2 : partial.y ?? (page.height - h) / 2,
      } as DesignElement
      this.design.elements.push(el)
      if (opts.select !== false) {
        this.selectedIds = [el.id]
      }
      this.revision++
      return el
    },

    /** Add several elements as one undo step (text combinations). */
    addGroup(parts: Array<Partial<DesignElement> & { type: DesignElement['type'] }>, at?: { x: number, y: number }) {
      if (!this.design || !parts.length) {
        return
      }
      this.record()
      const minX = Math.min(...parts.map(p => p.x ?? 0))
      const minY = Math.min(...parts.map(p => p.y ?? 0))
      const maxX = Math.max(...parts.map(p => (p.x ?? 0) + (p.w ?? 0)))
      const maxY = Math.max(...parts.map(p => (p.y ?? 0) + (p.h ?? 0)))
      const cx = at?.x ?? this.design.page.width / 2
      const cy = at?.y ?? this.design.page.height / 2
      const dx = cx - (minX + maxX) / 2
      const dy = cy - (minY + maxY) / 2
      const ids: string[] = []
      for (const p of parts) {
        const el = { ...p, id: newElementId(), x: (p.x ?? 0) + dx, y: (p.y ?? 0) + dy } as DesignElement
        this.design.elements.push(el)
        ids.push(el.id)
      }
      this.selectedIds = ids
      this.revision++
    },

    updateElement(id: string, patch: Partial<DesignElement>, recordKey?: string | false) {
      const el = this.element(id)
      if (!el) {
        return
      }
      if (recordKey !== false) {
        this.record(recordKey ?? `${id}:${Object.keys(patch).join(',')}`)
      }
      Object.assign(el, patch)
      this.revision++
    },

    /** Apply the same patch to every selected element. */
    updateSelected(patch: Partial<DesignElement>, recordKey?: string) {
      if (!this.selected.length) {
        return
      }
      this.record(recordKey ?? `sel:${this.selectedIds.join(',')}:${Object.keys(patch).join(',')}`)
      for (const el of this.selected) {
        Object.assign(el, patch)
      }
      this.revision++
    },

    removeSelected() {
      if (!this.design || !this.selectedIds.length) {
        return
      }
      const locked = new Set(this.selected.filter(e => e.locked).map(e => e.id))
      const ids = new Set(this.selectedIds.filter(id => !locked.has(id)))
      if (!ids.size) {
        return
      }
      this.record()
      this.design.elements = this.design.elements.filter(e => !ids.has(e.id))
      this.selectedIds = [...locked]
      this.editingTextId = null
      this.revision++
    },

    duplicateSelected(offset = 16) {
      if (!this.design || !this.selectedIds.length) {
        return
      }
      this.record()
      const copies = this.selected.map(e => ({ ...clone(e), id: newElementId(), x: e.x + offset, y: e.y + offset, locked: false }))
      this.design.elements.push(...copies)
      this.selectedIds = copies.map(c => c.id)
      this.revision++
    },

    copy() {
      this.clipboard = clone(this.selected)
    },

    paste() {
      if (!this.design || !this.clipboard.length) {
        return
      }
      this.record()
      const copies = this.clipboard.map(e => ({ ...clone(e), id: newElementId(), x: e.x + 16, y: e.y + 16 }))
      this.design.elements.push(...copies)
      this.clipboard = clone(copies)
      this.selectedIds = copies.map(c => c.id)
      this.revision++
    },

    /** Move an element to a new paint position (0 = back). */
    moveTo(id: string, index: number) {
      if (!this.design) {
        return
      }
      const from = this.design.elements.findIndex(e => e.id === id)
      if (from < 0) {
        return
      }
      const to = Math.max(0, Math.min(this.design.elements.length - 1, index))
      if (from === to) {
        return
      }
      this.record()
      const [el] = this.design.elements.splice(from, 1)
      this.design.elements.splice(to, 0, el)
      this.revision++
    },

    arrange(mode: 'forward' | 'backward' | 'front' | 'back') {
      const el = this.single
      if (!el || !this.design) {
        return
      }
      const i = this.design.elements.indexOf(el)
      const last = this.design.elements.length - 1
      const to = mode === 'front' ? last : mode === 'back' ? 0 : mode === 'forward' ? i + 1 : i - 1
      this.moveTo(el.id, to)
    },

    /** Align selection: one element to the page, several to their joint bounds. */
    align(mode: AlignMode) {
      if (!this.design || !this.selected.length) {
        return
      }
      const els = this.selected.filter(e => !e.locked)
      if (!els.length) {
        return
      }
      this.record()
      const single = els.length === 1
      const box = single
        ? { x1: 0, y1: 0, x2: this.design.page.width, y2: this.design.page.height }
        : { x1: Math.min(...els.map(e => e.x)), y1: Math.min(...els.map(e => e.y)), x2: Math.max(...els.map(e => e.x + e.w)), y2: Math.max(...els.map(e => e.y + e.h)) }
      for (const e of els) {
        if (mode === 'left') {
          e.x = box.x1
        }
        if (mode === 'right') {
          e.x = box.x2 - e.w
        }
        if (mode === 'hcenter') {
          e.x = (box.x1 + box.x2 - e.w) / 2
        }
        if (mode === 'top') {
          e.y = box.y1
        }
        if (mode === 'bottom') {
          e.y = box.y2 - e.h
        }
        if (mode === 'vcenter') {
          e.y = (box.y1 + box.y2 - e.h) / 2
        }
      }
      this.revision++
    },

    /** Even spacing between 3+ selected elements. */
    distribute(axis: 'x' | 'y') {
      const els = this.selected.filter(e => !e.locked)
      if (els.length < 3) {
        return
      }
      this.record()
      const size = (e: DesignElement) => (axis === 'x' ? e.w : e.h)
      const pos = (e: DesignElement) => (axis === 'x' ? e.x : e.y)
      const sorted = [...els].sort((a, b) => pos(a) - pos(b))
      const start = pos(sorted[0])
      const end = pos(sorted[sorted.length - 1]) + size(sorted[sorted.length - 1])
      const gap = (end - start - sorted.reduce((s, e) => s + size(e), 0)) / (sorted.length - 1)
      let cursor = start
      for (const e of sorted) {
        if (axis === 'x') {
          e.x = cursor
        }
        else {
          e.y = cursor
        }
        cursor += size(e) + gap
      }
      this.revision++
    },

    nudge(dx: number, dy: number) {
      const els = this.selected.filter(e => !e.locked)
      if (!els.length) {
        return
      }
      this.record(`nudge:${this.selectedIds.join(',')}`)
      for (const e of els) {
        e.x += dx
        e.y += dy
      }
      this.revision++
    },

    setPage(preset: PagePreset, orientation: Orientation) {
      if (!this.design) {
        return
      }
      const page = pageFor(preset, orientation)
      if (page.width === this.design.page.width && page.height === this.design.page.height && page.preset === this.design.page.preset) {
        return
      }
      this.record()
      this.design = resizeDesign(this.design, page)
      this.revision++
    },

    setBackground(patch: Partial<Design['background']>, recordKey = 'background') {
      if (!this.design) {
        return
      }
      this.record(recordKey)
      this.design.background = { ...this.design.background, ...patch }
      this.revision++
    },

    /** Replace the whole design (apply a template), keeping it undoable. */
    replaceDesign(design: Design) {
      this.record()
      this.design = clone(design)
      this.selectedIds = []
      this.editingTextId = null
      this.revision++
    },
  },
})
