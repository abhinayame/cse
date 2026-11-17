import { useState, type ReactNode } from 'react';
import { PageHead } from '../components/Layout';

const TONE: Record<string, string> = {
  submitted: 'blue', ai_processing: 'blue', under_review: 'blue', on_hold: 'amber', correction_required: 'amber', approved: 'green', published: 'green', rejected: 'red', draft: 'draft',
  requested: 'blue', processing: 'blue', paid: 'green', failed: 'red', reversed: 'red', cancelled: 'draft',
  registered: 'draft', verification_pending: 'amber', verified: 'blue', active: 'green', suspended: 'red',
  open: 'blue', assigned: 'amber', accepted: 'blue', completed: 'green', pending: 'amber', unverified: 'amber',
  urgent: 'red', high: 'amber', normal: 'draft', low: 'draft',
};
export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export function Status({ s }: { s: string }) { return <span className={`pill ${TONE[s] ?? ''}`}><span className="dot" style={{ background: 'currentColor' }} />{label(s)}</span>; }

export function NeedsBackend({ title, kicker }: { title: string; kicker: string }) {
  return (
    <>
      <PageHead kicker={kicker} title={title} />
      <div className="card empty">This module works on live data. Set <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> and run migrations 0001–0005 (docs/SUPABASE_SETUP.md).</div>
    </>
  );
}

export function Kpi({ label: l, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'green' }) {
  return <div className="kpi"><div className="label">{l}</div><div className="value" style={tone ? { color: tone === 'red' ? 'var(--red-deep)' : 'var(--green)' } : undefined}>{value}</div>{sub && <div className="sub">{sub}</div>}</div>;
}

/** Asks for a reason (required) or an optional note, then runs the action. */
export function useReasonDialog() {
  const [state, setState] = useState<{ title: string; hint?: string; required: boolean; extra?: ReactNode; resolve: (v: string | null) => void } | null>(null);
  const [text, setText] = useState('');
  const ask = (title: string, opts: { hint?: string; required?: boolean; initial?: string } = {}) =>
    new Promise<string | null>((resolve) => { setText(opts.initial ?? ''); setState({ title, hint: opts.hint, required: opts.required ?? true, resolve }); });
  const close = (v: string | null) => { state?.resolve(v); setState(null); };
  const dialog = state && (
    <div className="modal-bg" onClick={() => close(null)}>
      <div className="modal grid" style={{ gap: 12 }} role="dialog" aria-modal="true" aria-label={state.title} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20 }}>{state.title}</h2>
        {state.hint && <p className="muted" style={{ margin: 0 }}>{state.hint}</p>}
        <textarea className="input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => close(null)}>Cancel</button>
          <button className="btn dark" disabled={state.required && !text.trim()} onClick={() => close(text.trim())}>Confirm</button>
        </div>
      </div>
    </div>
  );
  return { ask, dialog };
}
