type ToastType = 'info' | 'error' | 'success'

let globalShow: ((msg: string, type?: ToastType) => void) | null = null

export function setGlobalToast(fn: (msg: string, type?: ToastType) => void) {
  globalShow = fn
}

export function showToast(message: string, type: ToastType = 'info') {
  if (globalShow) {
    try {
      globalShow(message, type)
    } catch (e) {
      // swallow errors in bridge
      console.warn('[toast bridge] showToast failed', e)
    }
  } else {
    // Fallback: console
    console.warn('[toast bridge] no toast provider registered:', message)
  }
}

export default showToast
