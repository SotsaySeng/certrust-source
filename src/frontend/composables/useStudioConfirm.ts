/**
 * Promise-based confirm dialog for the Design Studio (rendered by
 * components/design-studio/ConfirmDialog.vue). Native window.confirm is
 * avoided: it looks out of place and automation tools dismiss it.
 */
export interface StudioConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const state = reactive<{ open: boolean, options: StudioConfirmOptions | null, resolve: ((v: boolean) => void) | null }>({
  open: false,
  options: null,
  resolve: null,
})

export function useStudioConfirm() {
  function ask(options: StudioConfirmOptions): Promise<boolean> {
    state.resolve?.(false)
    state.options = options
    state.open = true
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }
  function answer(value: boolean) {
    state.open = false
    state.resolve?.(value)
    state.resolve = null
  }
  return { state, ask, answer }
}
