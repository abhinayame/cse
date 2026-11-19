/** Help centre: FAQs for readers and reporters (shown in the app and portal) + Reporter Academy progress. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { db, ok } from '../newsroom/api';
import { Kpi, NeedsBackend } from '../newsroom/ui';

interface Faq { id: string; audience: 'reporter' | 'reader'; category: string; category_te: string | null; question_te: string; answer_te: string; question_en: string; answer_en: string; sort: number; active: boolean }
interface Lesson { id: string; sort: number; title_en: string; title_te: string; active: boolean; quiz: unknown[] }
interface Row { user_id: string; full_name: string; district_id: string; status: string }

export default function HelpCentre() {
  if (!supabase) return <NeedsBackend kicker="Audience" title="Help centre" />;
  return <Inner />;
}

function Inner() {
  const { toast } = useStore();
  const [tab, setTab] = useState<'reporter' | 'reader' | 'academy'>('reporter');
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [edit, setEdit] = useState<Partial<Faq> | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<{ reporter: Row; passed: number }[]>([]);
  const load = useCallback(async () => {
    try {
      setFaqs(ok(await db().from('faqs').select('*').order('audience').order('sort')) as Faq[]);
      const ls = ok(await db().from('academy_lessons').select('id, sort, title_en, title_te, active, quiz').order('sort')) as Lesson[];
      setLessons(ls);
      const reps = ok(await db().from('reporter_profiles').select('user_id, full_name, district_id, status').order('created_at', { ascending: false }).limit(200)) as Row[];
      const pr = ok(await db().from('academy_progress').select('user_id, lesson_id, passed_at').not('passed_at', 'is', null)) as { user_id: string }[];
      setProgress(reps.map((r) => ({ reporter: r, passed: pr.filter((p) => p.user_id === r.user_id).length })));
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (f: Faq) => { try { ok(await db().from('faqs').update({ active: !f.active, updated_at: new Date().toISOString() }).eq('id', f.id)); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); } };
  const remove = async (f: Faq) => { if (!confirm('Delete this question?')) return; try { ok(await db().from('faqs').delete().eq('id', f.id)); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); } };
  const shown = faqs.filter((f) => f.audience === tab);
  const done = progress.filter((p) => p.passed >= lessons.filter((l) => l.active).length && lessons.length).length;
  return (
    <>
      <PageHead kicker="Audience" title="Help centre">
        <div className="tabs">{([['reporter', 'Reporter FAQ'], ['reader', 'Reader FAQ'], ['academy', 'Reporter Academy']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab !== 'academy' && <button className="btn primary" onClick={() => setEdit({ audience: tab, category: shown[0]?.category ?? '', category_te: shown[0]?.category_te ?? '', sort: (shown.at(-1)?.sort ?? 0) + 10, active: true })}>＋ New question</button>}
      </PageHead>
      {tab !== 'academy' ? (
        <>
          <div className="banner">These answers appear in the app ({tab === 'reporter' ? 'Reporter hub → Help, and the web portal' : 'Profile → Help & complaints'}) in Telugu and English. Keep them short and accurate; update them when a rule or amount changes.</div>
          <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
            <table><thead><tr><th>#</th><th>Section</th><th>Question (Telugu / English)</th><th>Shown</th><th /></tr></thead>
              <tbody>{shown.map((f) => (
                <tr key={f.id}>
                  <td className="faint">{f.sort}</td>
                  <td>{f.category}<div className="faint te-body" style={{ fontSize: 12 }}>{f.category_te}</div></td>
                  <td><div className="te-body">{f.question_te}</div><div className="faint" style={{ fontSize: 12.5 }}>{f.question_en}</div></td>
                  <td><label className="switch"><input type="checkbox" checked={f.active} onChange={() => toggle(f)} aria-label={`Shown: ${f.question_en}`} /></label></td>
                  <td className="row" style={{ gap: 4 }}><button className="btn sm ghost" onClick={() => setEdit(f)}>Edit</button><button className="btn sm ghost" onClick={() => remove(f)}>Delete</button></td>
                </tr>
              ))}</tbody></table>
          </div>
        </>
      ) : (
        <>
          <div className="banner">Five short lessons with quizzes, marked on the server (the app never receives the answers). Ask new reporters to finish the Academy before you activate them.</div>
          <div className="kpis">
            <Kpi label="Lessons" value={lessons.filter((l) => l.active).length} />
            <Kpi label="Reporters who finished" value={done} sub={`of ${progress.length}`} />
          </div>
          <div className="grid" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 16 }}>
            <div className="card table-wrap" style={{ padding: 8 }}>
              <h2 style={{ padding: '8px 10px' }}>Lessons</h2>
              <table><tbody>{lessons.map((l) => <tr key={l.id}><td className="faint">{l.sort}</td><td><div className="te-body">{l.title_te}</div><div className="faint" style={{ fontSize: 12.5 }}>{l.title_en}</div></td><td className="faint">{l.quiz.length} questions</td></tr>)}</tbody></table>
            </div>
            <div className="card table-wrap" style={{ padding: 8 }}>
              <h2 style={{ padding: '8px 10px' }}>Reporter progress</h2>
              <table><thead><tr><th>Reporter</th><th>Status</th><th>Lessons passed</th></tr></thead>
                <tbody>{progress.map(({ reporter: r, passed }) => (
                  <tr key={r.user_id}><td>{r.full_name}</td><td className="faint">{r.status.replace(/_/g, ' ')}</td>
                    <td><span className={`pill ${passed >= lessons.length ? 'green' : passed ? 'amber' : ''}`}>{passed} / {lessons.length}</span></td></tr>
                ))}</tbody></table>
            </div>
          </div>
        </>
      )}
      {edit && <FaqEditor faq={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function FaqEditor({ faq, onClose, onSaved }: { faq: Partial<Faq>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState(faq);
  const set = (k: keyof Faq) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'sort' ? Number(e.target.value) : e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const row = { audience: f.audience, category: f.category, category_te: f.category_te || null, question_te: f.question_te, answer_te: f.answer_te, question_en: f.question_en, answer_en: f.answer_en, sort: f.sort ?? 100, active: f.active ?? true, updated_at: new Date().toISOString() };
      ok(f.id ? await db().from('faqs').update(row).eq('id', f.id) : await db().from('faqs').insert(row));
      toast('Saved'); onSaved();
    } catch (er) { toast(`⚠ ${(er as Error).message}`); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal grid" style={{ gap: 10, maxWidth: 680 }} role="dialog" aria-modal="true" aria-label="FAQ" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{f.id ? 'Edit question' : 'New question'} · {f.audience}</h2>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
          <label className="field">Section (English)<input className="input" required value={f.category ?? ''} onChange={set('category')} /></label>
          <label className="field">Section (Telugu)<input className="input te-body" value={f.category_te ?? ''} onChange={set('category_te')} /></label>
          <label className="field">Order<input className="input" type="number" value={f.sort ?? 100} onChange={set('sort')} /></label>
        </div>
        <label className="field">Question (Telugu)<input className="input te-body" required value={f.question_te ?? ''} onChange={set('question_te')} /></label>
        <label className="field">Answer (Telugu)<textarea className="input te-body" required rows={4} value={f.answer_te ?? ''} onChange={set('answer_te')} /></label>
        <label className="field">Question (English)<input className="input" required value={f.question_en ?? ''} onChange={set('question_en')} /></label>
        <label className="field">Answer (English)<textarea className="input" required rows={4} value={f.answer_en ?? ''} onChange={set('answer_en')} /></label>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </div>
  );
}
