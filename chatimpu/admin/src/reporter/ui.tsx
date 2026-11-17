/** Small shared pieces for the reporter portal. */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { T } from './i18n';

const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="rp-toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

const tone: Record<string, string> = {
  draft: '', submitted: 'blue', ai_processing: 'blue', under_review: 'blue', on_hold: 'amber', correction_required: 'amber',
  approved: 'green', published: 'green', rejected: 'red',
  requested: 'blue', under_review_w: 'blue', processing: 'blue', paid: 'green', failed: 'red', reversed: 'red', cancelled: '',
  registered: '', verification_pending: 'amber', verified: 'blue', active: 'green', suspended: 'red',
  open: 'blue', assigned: 'amber', accepted: 'blue', completed: 'green',
};

export function SubmissionStatus({ s, t }: { s: string; t: T }) {
  return <span className={`rp-status ${tone[s] ?? ''}`}>{t(`s_${s}` as Parameters<T>[0]) ?? s}</span>;
}
export function WithdrawalStatus({ s, t }: { s: string; t: T }) {
  return <span className={`rp-status ${s === 'under_review' ? 'blue' : tone[s] ?? ''}`}>{t(`w_${s}` as Parameters<T>[0]) ?? s}</span>;
}
export function ReporterStatus({ s, t }: { s: string; t: T }) {
  return <span className={`rp-status ${tone[s] ?? ''}`}>{t(`st_${s}` as Parameters<T>[0]) ?? s}</span>;
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <div className="rp-banner bad" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null;
}

export const fmtDate = (iso: string | null, lang: string) =>
  iso ? new Date(iso).toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
