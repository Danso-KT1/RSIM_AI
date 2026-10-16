/**
 * Toast Notification System
 * A lightweight, zero-dependency toast system that lives outside React tree.
 * 
 * Usage from anywhere:
 *   import { toast } from './Toast';
 *   toast.success('Document saved!');
 *   toast.error('Upload failed', { duration: 6000 });
 *   toast.info('AI is thinking...');
 *   toast.loading('Uploading...');  // returns an id to dismiss
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms; 0 = persistent
}

// Event bus for cross-component toast dispatch without Redux/context
const listeners = new Set<(items: ToastItem[]) => void>();
let _toasts: ToastItem[] = [];

function broadcast() {
  listeners.forEach((fn) => fn([..._toasts]));
}

function add(type: ToastType, message: string, duration = 4000): string {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  _toasts = [{ id, type, message, duration }, ..._toasts].slice(0, 5);
  broadcast();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  broadcast();
}

/** Singleton toast API — importable from anywhere */
export const toast = {
  success: (msg: string, opts?: { duration?: number }) => add('success', msg, opts?.duration ?? 4000),
  error:   (msg: string, opts?: { duration?: number }) => add('error',   msg, opts?.duration ?? 6000),
  info:    (msg: string, opts?: { duration?: number }) => add('info',    msg, opts?.duration ?? 4000),
  warning: (msg: string, opts?: { duration?: number }) => add('warning', msg, opts?.duration ?? 5000),
  loading: (msg: string) => add('loading', msg, 0), // persistent; call toast.dismiss() when done
  dismiss,
};

// ─── React Component ──────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />,
  error:   <XCircle      className="h-4.5 w-4.5 text-red-400 flex-shrink-0" />,
  info:    <Info         className="h-4.5 w-4.5 text-sky-400 flex-shrink-0" />,
  warning: <AlertTriangle className="h-4.5 w-4.5 text-amber-400 flex-shrink-0" />,
  loading: <Loader2      className="h-4.5 w-4.5 text-slate-300 flex-shrink-0 animate-spin" />,
};

const BORDER: Record<ToastType, string> = {
  success: 'border-emerald-500/30',
  error:   'border-red-500/30',
  info:    'border-sky-500/30',
  warning: 'border-amber-500/30',
  loading: 'border-slate-600/40',
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = memo(({ item, onDismiss }) => (
  <div
    className={`flex items-start gap-3 rounded-2xl border bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-2xl shadow-black/40 text-sm text-slate-100 min-w-[280px] max-w-sm animate-in slide-in-from-bottom-2 duration-200 ${BORDER[item.type]}`}
    role="alert"
  >
    {ICONS[item.type]}
    <span className="flex-1 leading-snug">{item.message}</span>
    {item.type !== 'loading' && (
      <button
        onClick={() => onDismiss(item.id)}
        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
));
ToastCard.displayName = 'ToastCard';

/**
 * Mount <ToastContainer /> once at the app root (inside App.tsx).
 * It positions itself in the bottom-right corner via a portal-like fixed div.
 */
export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  const handleDismiss = useCallback((id: string) => dismiss(id), []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onDismiss={handleDismiss} />
        </div>
      ))}
    </div>
  );
};
