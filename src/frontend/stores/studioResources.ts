/**
 * Organization resources the Design Studio panels share: plan limits,
 * brand kit, custom attributes, uploaded images, the Elements library and
 * gallery categories. Loaded once per visit, refreshed after changes.
 */
import type { BrandKitInfo, CustomAttribute, DesignAsset, DesignLimitsInfo } from '~/api/api-client'
import { defineStore } from 'pinia'
import { apiClient } from '~/api/api-client'

export const useStudioResourcesStore = defineStore('studioResources', {
  state: () => ({
    limits: null as DesignLimitsInfo | null,
    brand: null as BrandKitInfo | null,
    customAttributes: [] as CustomAttribute[],
    uploads: [] as DesignAsset[],
    elements: [] as DesignAsset[],
    categories: [] as Array<{ id: number, documentId: string, name: string, slug: string }>,
    loaded: { limits: false, brand: false, attributes: false, uploads: false, elements: false, categories: false },
  }),

  getters: {
    atLimit: s => !!s.limits && s.limits.limit != null && s.limits.used >= s.limits.limit,
    isPlatformAdmin: s => !!s.limits?.isPlatformAdmin,
    customKeys: s => s.customAttributes.map(a => a.key),
  },

  actions: {
    async loadAll(force = false) {
      await Promise.all([
        this.loadLimits(force),
        this.loadBrand(force),
        this.loadAttributes(force),
        this.loadUploads(force),
        this.loadElements(force),
        this.loadCategories(force),
      ])
    },
    async loadLimits(force = false) {
      if (this.loaded.limits && !force) {
        return
      }
      try {
        this.limits = (await apiClient.getDesignLimits()).data
        this.loaded.limits = true
      }
      catch {}
    },
    async loadBrand(force = false) {
      if (this.loaded.brand && !force) {
        return
      }
      try {
        this.brand = await apiClient.getBrandKit()
        this.loaded.brand = true
      }
      catch {}
    },
    async saveBrand(data: Partial<BrandKitInfo>) {
      this.brand = await apiClient.saveBrandKit(data)
      return this.brand
    },
    async loadAttributes(force = false) {
      if (this.loaded.attributes && !force) {
        return
      }
      try {
        this.customAttributes = await apiClient.listCustomAttributes()
        this.loaded.attributes = true
      }
      catch {}
    },
    async loadUploads(force = false) {
      if (this.loaded.uploads && !force) {
        return
      }
      try {
        this.uploads = await apiClient.listDesignAssets('upload')
        this.loaded.uploads = true
      }
      catch {}
    },
    async loadElements(force = false) {
      if (this.loaded.elements && !force) {
        return
      }
      try {
        this.elements = await apiClient.listDesignAssets('element')
        this.loaded.elements = true
      }
      catch {}
    },
    async loadCategories(force = false) {
      if (this.loaded.categories && !force) {
        return
      }
      try {
        this.categories = await apiClient.getDesignCategories()
        this.loaded.categories = true
      }
      catch {}
    },
    /** Brand kit in design-core's shape, for rendering. */
    brandForRender() {
      const b = this.brand
      if (!b) {
        return null
      }
      return {
        logo: b.logo,
        primary: b.primary,
        secondary: b.secondary,
        accent: b.accent,
        headingFont: b.headingFont,
        bodyFont: b.bodyFont,
        signers: b.signers,
      }
    },
  },
})
