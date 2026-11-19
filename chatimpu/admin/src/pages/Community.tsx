/** Community board moderation + local info (helplines and daily prices) shown in the app's Local tab. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { district } from '../lib/format';
import { supabase } from '../lib/supabase';
import { db, ok, paise, rpc, when } from '../newsroom/api';
import { NeedsBackend, label, useReasonDialog } from '../newsroom/ui';

interface Post { id: string; code: string; kind: string; district_id: string; title: string; body: string; contact_phone: string | null; price_paise: number | null; status: string; reject_reason: string | null; created_at: string; expires_at: string }
interface Contact { id: string; district_id: string | null; kind: string; name_te: string; name_en: string; phone: string; address: string | null; sort: number; active: boolean; verified_at: string | null }
interface Price { id: string; district_id: string; item: string; price_paise: number; unit: string; price_date: string; source: string }
const ITEMS: [string, string][] = [['gold_22k', '10 g'], ['gold_24k', '10 g'], ['silver', '1 kg'], ['petrol', 'litre'], ['diesel', 'litre'], ['lpg', 'cylinder'], ['tomato', '1 kg'], ['onion', '1 kg'], ['potato', '1 kg'], ['chicken', '1 kg'], ['mutton', '1 kg'], ['egg', 'dozen'], ['paddy', 'quintal'], ['cotton', 'quintal'], ['chilli', 'quintal'], ['turmeric', 'quintal']];
const KINDS = ['emergency', 'police', 'ambulance', 'fire', 'hospital', 'women', 'child', 'cyber', 'electricity', 'water', 'municipal', 'collectorate', 'other'];
const istToday = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);

export default function Community() {
  if (!supabase) return <NeedsBackend kicker="Audience" title="Community & local info" />;
  return <Inner />;
}

function Inner() {
  const { session } = useStore();
  const [tab, setTab] = useState<'posts' | 'contacts' | 'prices'>('posts');
  const districts = session.districts.length ? DISTRICTS.filter((d) => session.districts.includes(d.id)) : DISTRICTS;
  const [dist, setDist] = useState(districts[0]?.id ?? 'hyd');
  return (
    <>
      <PageHead kicker="Audience" title="Community & local info">
        <select className="input" value={dist} onChange={(e) => setDist(e.target.value)} aria-label="District">{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <div className="tabs">{([['posts', 'Community board'], ['contacts', 'Helplines'], ['prices', 'Daily prices']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      </PageHead>
      {tab === 'posts' && <Posts dist={dist} />}
      {tab === 'contacts' && <Contacts dist={dist} />}
      {tab === 'prices' && <Prices dist={dist} />}
    </>
  );
}

function Posts({ dist }: { dist: string }) {
  const { toast } = useStore();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<Post[]>([]);
  const reason = useReasonDialog();
  const load = useCallback(async () => {
    try { setRows(ok(await db().from('community_posts').select('*').eq('district_id', dist).eq('status', status).order('created_at', { ascending: status === 'pending' }).limit(200)) as Post[]); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [dist, status, toast]);
  useEffect(() => { load(); }, [load]);
  const decide = async (p: Post, d: 'approved' | 'rejected' | 'removed') => {
    const why = d === 'approved' ? null : await reason.ask(d === 'rejected' ? 'Reason (sent to the person who posted)' : 'Why is this post removed?', { required: true });
    if (d !== 'approved' && !why) return;
    try { await rpc('moderate_community_post', { p_id: p.id, p_decision: d, p_reason: why }); toast(`${p.code}: ${d}`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  return (
    <>
      <div className="banner">Check every post before it goes live: no phone numbers or photos of people who did not agree, no fees asked in advance for jobs, no hate, nothing illegal to sell. Obituaries stay up 7 days, wishes 3, events 14, others 21.</div>
      <div className="tabs" style={{ margin: '12px 0' }}>{(['pending', 'approved', 'rejected'] as const).map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label(s)}</button>)}</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {rows.length === 0 ? <div className="card empty">Nothing here</div> : rows.map((p) => (
          <div key={p.id} className="card grid" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="pill">{label(p.kind)}</span><span className="faint" style={{ fontSize: 12 }}>{p.code} · {when(p.created_at)}</span></div>
            <b className="te-body">{p.title}</b>
            <div className="te-body" style={{ fontSize: 14 }}>{p.body}</div>
            {p.price_paise != null && <div>Price: <b>{paise(p.price_paise)}</b></div>}
            {p.contact_phone && <div className="faint">📞 {p.contact_phone} (public)</div>}
            {p.reject_reason && <div style={{ color: 'var(--red-deep)', fontSize: 13 }}>{p.reject_reason}</div>}
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {p.status === 'pending' && <><button className="btn sm primary" onClick={() => decide(p, 'approved')}>Approve</button><button className="btn sm ghost" onClick={() => decide(p, 'rejected')}>Reject</button></>}
              {p.status === 'approved' && <><span className="faint" style={{ fontSize: 12 }}>Until {when(p.expires_at)}</span><button className="btn sm ghost" onClick={() => decide(p, 'removed')}>Take down</button></>}
            </div>
          </div>
        ))}
      </div>
      {reason.dialog}
    </>
  );
}

function Contacts({ dist }: { dist: string }) {
  const { toast } = useStore();
  const [rows, setRows] = useState<Contact[]>([]);
  const [edit, setEdit] = useState<Partial<Contact> | null>(null);
  const load = useCallback(async () => {
    try { setRows(ok(await db().from('local_contacts').select('*').or(`district_id.is.null,district_id.eq.${dist}`).order('sort')) as Contact[]); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [dist, toast]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!edit) return;
    const row = { district_id: dist, kind: edit.kind, name_te: edit.name_te, name_en: edit.name_en, phone: edit.phone, address: edit.address || null, sort: edit.sort ?? 100, active: edit.active ?? true, verified_at: istToday() };
    try { ok(edit.id ? await db().from('local_contacts').update(row).eq('id', edit.id) : await db().from('local_contacts').insert(row)); setEdit(null); load(); } catch (er) { toast(`⚠ ${(er as Error).message}`); }
  };
  return (
    <>
      <div className="banner">National helplines (112, 100, 108, 101, 181, 1098, 1930) are built in. Add district numbers only after calling them to check they work; the date you save is shown as “verified”.</div>
      <div className="row" style={{ margin: '12px 0' }}><button className="btn primary" onClick={() => setEdit({ kind: 'hospital', sort: 100, active: true })}>＋ Add number for {district(dist)}</button></div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table><thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Area</th><th>Verified</th><th /></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
              <td><span className="te-body">{c.name_te}</span><div className="faint" style={{ fontSize: 12.5 }}>{c.name_en}{c.address ? ` · ${c.address}` : ''}</div></td>
              <td>{label(c.kind)}</td><td><b>{c.phone}</b></td><td>{c.district_id ? district(c.district_id) : 'All India'}</td>
              <td className="faint">{c.verified_at ?? '—'}</td>
              <td>{c.district_id && <button className="btn sm ghost" onClick={() => setEdit(c)}>Edit</button>}</td>
            </tr>
          ))}</tbody></table>
      </div>
      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <form className="modal grid" style={{ gap: 10, maxWidth: 520 }} role="dialog" aria-modal="true" aria-label="Contact" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{edit.id ? 'Edit number' : 'New number'} · {district(dist)}</h2>
            <label className="field">Type<select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></label>
            <label className="field">Name (Telugu)<input className="input te-body" required value={edit.name_te ?? ''} onChange={(e) => setEdit({ ...edit, name_te: e.target.value })} /></label>
            <label className="field">Name (English)<input className="input" required value={edit.name_en ?? ''} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></label>
            <label className="field">Phone<input className="input" required pattern="[0-9+ -]{3,20}" value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
            <label className="field">Address / area (optional)<input className="input" value={edit.address ?? ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></label>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Shown in the app</label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary">Save (I called and checked it)</button></div>
          </form>
        </div>
      )}
    </>
  );
}

function Prices({ dist }: { dist: string }) {
  const { toast } = useStore();
  const [day, setDay] = useState(istToday());
  const [rows, setRows] = useState<Price[]>([]);
  const [draft, setDraft] = useState<Record<string, { rupees: string; unit: string }>>({});
  const [source, setSource] = useState('');
  const load = useCallback(async () => {
    try {
      const r = ok(await db().from('daily_prices').select('*').eq('district_id', dist).eq('price_date', day)) as Price[];
      setRows(r); if (r[0]) setSource(r[0].source);
      setDraft(Object.fromEntries(ITEMS.map(([k, u]) => { const x = r.find((p) => p.item === k); return [k, { rupees: x ? String(x.price_paise / 100) : '', unit: x?.unit ?? u }]; })));
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [dist, day, toast]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const up = ITEMS.filter(([k]) => draft[k]?.rupees).map(([k]) => ({ district_id: dist, item: k, price_paise: Math.round(Number(draft[k].rupees) * 100), unit: draft[k].unit, price_date: day, source }));
    const del = rows.filter((r) => !draft[r.item]?.rupees).map((r) => r.id);
    try {
      if (up.length) ok(await db().from('daily_prices').upsert(up, { onConflict: 'district_id,item,price_date' }));
      if (del.length) ok(await db().from('daily_prices').delete().in('id', del));
      toast(`Saved ${up.length} prices for ${district(dist)}`); load();
    } catch (er) { toast(`⚠ ${(er as Error).message}`); }
  };
  return (
    <form onSubmit={save}>
      <div className="banner">Enter only prices you collected today from a named source (market yard, oil company rate, jewellers' association). Leave an item empty if you do not have it — the app never shows a guess.</div>
      <div className="card grid" style={{ marginTop: 12, gap: 10 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="field">Date<input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label className="field" style={{ flex: 1, minWidth: 260 }}>Source (shown to readers)<input className="input" required minLength={3} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Bowenpally market yard, 7 am" /></label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {ITEMS.map(([k]) => (
            <label key={k} className="field">{k === 'lpg' ? 'LPG cylinder' : label(k.replace('_22k', ' 22K').replace('_24k', ' 24K'))}
              <div className="row" style={{ gap: 6 }}>
                <input className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="₹" value={draft[k]?.rupees ?? ''} onChange={(e) => setDraft({ ...draft, [k]: { ...draft[k], rupees: e.target.value.replace(/[^0-9.]/g, '') } })} />
                <input className="input" style={{ width: 90 }} value={draft[k]?.unit ?? ''} onChange={(e) => setDraft({ ...draft, [k]: { ...draft[k], unit: e.target.value } })} aria-label={`${k} unit`} />
              </div>
            </label>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="faint">{rows.length} saved for {district(dist)} on {day}</span><button className="btn primary">Save prices</button></div>
      </div>
    </form>
  );
}
