"use client";

import React from 'react';

type Toast = { id: string; message: string; type: 'success'|'error'|'info'; duration: number };

export default function ToastHub() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as CustomEvent;
      const t = ce.detail as Toast;
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter(x => x.id !== t.id));
      }, t.duration || 2500);
    };
    window.addEventListener('app:toast', onToast as any);
    return () => window.removeEventListener('app:toast', onToast as any);
  }, []);

  const color = (type: Toast['type']) => {
    if (type === 'success') return 'bg-emerald-600';
    if (type === 'error') return 'bg-red-600';
    return 'bg-slate-700';
  };

  return (
    <div className="fixed top-3 right-3 z-[9999] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`text-white px-3 py-2 rounded shadow-lg ${color(t.type)} backdrop-blur-sm`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

