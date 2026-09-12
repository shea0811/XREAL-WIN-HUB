import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
  tone?: 'success' | 'info';
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss(): void }) {
  return (
    <div className="toast" role="status">
      <span className="toast__icon" data-tone={toast.tone ?? 'success'}>
        {toast.tone === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
      </span>
      <span>
        <strong>{toast.title}</strong>
        {toast.detail ? <small>{toast.detail}</small> : null}
      </span>
      <button onClick={onDismiss} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}
