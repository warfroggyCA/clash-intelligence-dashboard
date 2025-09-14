// Simple toast event bus for client-side notifications
export type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'info', duration = 2500) {
  if (typeof window === 'undefined') return;
  const detail = { message, type, duration, id: Math.random().toString(36).slice(2) };
  window.dispatchEvent(new CustomEvent('app:toast', { detail }));
}

