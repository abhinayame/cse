/** Reporter Academy (web portal): same lessons and server-marked quizzes as the app (migrations/0009_community.sql). */
import { useCallback, useEffect, useState } from 'react';
import { db, ok } from '../api';
import { useLang } from '../i18n';

interface QuizQ { q_te: string; q_en: string; options: { te: string; en: string }[] }
interface Lesson { id: string; sort: number; title_te: string; title_en: string; body_te: string; body_en: string; quiz: QuizQ[] }
interface Result { score: number; total: number; passed: boolean; wrong: number[]; completed: number; lessons: number }

export default function Academy() {
  const lang = useLang(); const te = lang === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<Record<string, Result>>({});
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      setLessons(ok(await db().from('academy_public').select('*').order('sort')) as Lesson[]);
      setPassed((ok(await db().rpc('academy_status', {})) as { passed_ids: string[] }).passed_ids);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const check = async (l: Lesson) => {
    try {
      const r = ok(await db().rpc('submit_lesson_quiz', { p_lesson: l.id, p_answers: l.quiz.map((_, i) => answers[l.id]?.[i] ?? -1) })) as Result;
      setResult({ ...result, [l.id]: r }); if (r.passed) setPassed([...new Set([...passed, l.id])]);
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <h1 className="rp-section">{L('రిపోర్టర్ అకాడమీ', 'Reporter Academy')}</h1>
      <section className="rp-section rp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="rp-meta">{L('ప్రతి పాఠం చదివి, క్విజ్‌లో అన్ని జవాబులు సరిగా ఇవ్వండి.', 'Read each lesson and answer every quiz question correctly.')}</span>
          <b>{passed.length}/{lessons.length}</b>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-alt)', marginTop: 10 }}><div style={{ height: 6, borderRadius: 3, background: 'var(--red)', width: `${lessons.length ? (passed.length / lessons.length) * 100 : 0}%` }} /></div>
        {err && <p className="rp-hint" style={{ color: 'var(--red)' }}>{err}</p>}
      </section>
      {lessons.map((l, i) => {
        const r = result[l.id]; const done = passed.includes(l.id);
        return (
          <section key={l.id} className="rp-section rp-card">
            <button className="rp-btn ghost block" style={{ justifyContent: 'space-between' }} onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
              <span>{i + 1}. {te ? l.title_te : l.title_en}</span><span>{done ? '✓' : open === l.id ? '▴' : '▾'}</span>
            </button>
            {open === l.id && <div className="rp-body-text" style={{ marginTop: 12 }}>
              {(te ? l.body_te : l.body_en).split(/\n\n+/).map((b, j) => b.includes('• ')
                ? <ul key={j}>{b.split('\n').filter((x) => x.startsWith('• ')).map((x) => <li key={x}>{x.slice(2)}</li>)}</ul>
                : <p key={j}>{b}</p>)}
              <h3 style={{ marginTop: 16 }}>{L('క్విజ్', 'Quiz')}</h3>
              {l.quiz.map((q, qi) => (
                <fieldset key={qi} style={{ border: `1px solid ${r?.wrong.includes(qi + 1) ? 'var(--red)' : 'var(--border)'}`, borderRadius: 12, padding: 12, margin: '10px 0' }}>
                  <legend style={{ fontWeight: 700, padding: '0 6px' }}>{qi + 1}. {te ? q.q_te : q.q_en}</legend>
                  {q.options.map((o, oi) => (
                    <label key={oi} style={{ display: 'flex', gap: 8, padding: '6px 0', alignItems: 'flex-start' }}>
                      <input type="radio" name={`${l.id}-${qi}`} checked={answers[l.id]?.[qi] === oi} disabled={done && !!r?.passed}
                        onChange={() => { const a = [...(answers[l.id] ?? [])]; a[qi] = oi; setAnswers({ ...answers, [l.id]: a }); }} />
                      <span>{te ? o.te : o.en}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              {r && <p className="rp-hint" style={{ color: r.passed ? 'var(--green)' : 'var(--red)' }}>{r.passed ? L('అన్నీ సరైనవి! పాఠం పూర్తయింది.', 'All correct! Lesson completed.') : L(`${r.total}లో ${r.score} సరైనవి. మళ్ళీ ప్రయత్నించండి.`, `${r.score} of ${r.total} correct. Try again.`)}</p>}
              {!r?.passed && <button className="rp-btn primary block" disabled={(answers[l.id] ?? []).filter((x) => x !== undefined).length < l.quiz.length} onClick={() => check(l)}>{L('జవాబులు తనిఖీ చేయండి', 'Check answers')}</button>}
            </div>}
          </section>
        );
      })}
    </>
  );
}
