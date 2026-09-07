import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* --------------------------------- Icon --------------------------------- */

export function Icon({ name, className = '', size = 20, fill = false, style }) {
  return (
    <span
      className={`icon ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

/* --------------------------------- Cards -------------------------------- */

export function Card({ title, action, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant/60">
          {typeof title === 'string' ? <h2 className="text-headline-md">{title}</h2> : title}
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'default' }) {
  const toneMap = {
    default: 'text-on-surface',
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    error: 'text-error',
    warning: 'text-warning',
  };
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body-sm text-on-surface-variant leading-snug">{label}</p>
        {icon && <Icon name={icon} size={18} className="text-on-surface-variant shrink-0" />}
      </div>
      <p className={`stat-value mt-2 ${toneMap[tone]}`}>{value}</p>
      {hint && <p className="mt-1.5 text-body-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/* -------------------------------- Severity ------------------------------- */

export function SeverityChip({ level }) {
  const map = {
    critical: ['chip-danger', 'Kritik'],
    high: ['chip-danger', 'Yuqori'],
    medium: ['chip-warn', 'O\u2018rta'],
    low: ['chip-neutral', 'Past'],
    info: ['chip-ai', 'Ma\u2019lumot'],
  };
  const [cls, text] = map[level] ?? map.info;
  return <span className={cls}>{text}</span>;
}

export function StatusDot({ tone = 'tertiary', pulse = false }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${pulse ? 'animate-pulse-ring' : ''}`}
      style={{ backgroundColor: `rgb(var(--${tone}))` }}
    />
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} card shadow-level3 animate-fade-up`}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60">
          <h2 className="text-headline-md">{title}</h2>
          <button className="btn-ghost btn-sm px-2" onClick={onClose} aria-label="Yopish">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-4 py-3 border-t border-outline-variant/60">{footer}</footer>}
      </div>
    </div>
  );
}

/* --------------------------------- Toast --------------------------------- */

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`card shadow-level2 px-4 py-3 text-body-md animate-fade-up flex items-start gap-2.5
              ${t.tone === 'error' ? 'border-error/50' : t.tone === 'success' ? 'border-tertiary/50' : ''}`}
          >
            <Icon
              name={t.tone === 'error' ? 'error' : t.tone === 'success' ? 'check_circle' : 'info'}
              size={18}
              className={t.tone === 'error' ? 'text-error' : t.tone === 'success' ? 'text-tertiary' : 'text-secondary'}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx) ?? (() => {});

/* ------------------------------ Empty & Load ----------------------------- */

export function EmptyState({ icon = 'inbox', title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-md bg-surface-container-high flex items-center justify-center mb-3">
        <Icon name={icon} size={24} className="text-on-surface-variant" />
      </div>
      <p className="text-headline-md">{title}</p>
      {hint && <p className="meta mt-1.5 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded bg-surface-container-high ${className}`} />;
}

export function Progress({ value = 0, tone = 'primary', className = '' }) {
  return (
    <div className={`h-1.5 rounded-full bg-surface-container-highest overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: `rgb(var(--${tone}))` }}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-body-md text-on-surface">{label}</span>
        {hint && <span className="block meta mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5
          ${checked ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'}`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all
            ${checked ? 'left-6 bg-on-primary' : 'left-1 bg-outline'}`}
        />
      </button>
    </label>
  );
}

export const fmt = {
  num: (n) => new Intl.NumberFormat('uz-UZ').format(Math.round(n ?? 0)),
  compact: (n) => new Intl.NumberFormat('uz-UZ', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0),
  bytes: (b) => {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), 3);
    return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
  },
  time: (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  },
  ago: (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'hozir';
    if (s < 3600) return `${Math.floor(s / 60)} daq oldin`;
    if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
    return `${Math.floor(s / 86400)} kun oldin`;
  },
};
