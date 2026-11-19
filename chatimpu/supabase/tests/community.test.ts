/** Help centre, Reporter Academy, corrections, grievances, local info, community board (migrations/0009_community.sql). */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { URL, ANON, activeReporter, actor, ageEarlierReports, approve, fails, must, submitStory, type Actor } from './helpers.ts';

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
let editor: Actor, mod: Actor, reader: Actor, reader2: Actor, rep: Actor, storyId: string;

before(async () => {
  ageEarlierReports();
  editor = await actor('ce', { role: 'editor' });
  mod = await actor('cm', { role: 'district_moderator', districts: ['hyd'] });
  reader = await actor('cr');
  reader2 = await actor('cr2');
  rep = await activeReporter('crep', editor);
  const s = await submitStory(rep);
  storyId = (await approve(editor, s.id, 'text_news', 500)).story_id;
});

test('FAQs: anyone reads active ones in both languages; only editors write', async () => {
  const rows = must(await anon.from('faqs').select('id, audience, question_te, answer_en').eq('active', true)) as { audience: string }[];
  assert.ok(rows.some((r) => r.audience === 'reporter') && rows.some((r) => r.audience === 'reader'));
  await fails(reader.db.from('faqs').insert({ audience: 'reader', category: 'x', question_te: 'q', answer_te: 'a', question_en: 'q', answer_en: 'a' }));
  const id = `t-${Date.now()}`;
  must(await editor.db.from('faqs').insert({ id, audience: 'reader', category: 'Test', question_te: 'ప్ర', answer_te: 'జ', question_en: 'Q', answer_en: 'A', active: false }));
  assert.equal((must(await anon.from('faqs').select('id').eq('id', id)) as unknown[]).length, 0, 'inactive FAQ hidden from readers');
});

test('Academy: answers are never sent to the app; quiz is marked on the server; progress counts', async () => {
  const lessons = must(await rep.db.from('academy_public').select('id, quiz')) as { id: string; quiz: Record<string, unknown>[] }[];
  assert.ok(lessons.length >= 5);
  for (const l of lessons) for (const q of l.quiz) assert.equal('answer' in q, false);
  await fails(rep.db.from('academy_lessons').select('quiz').limit(1).single());
  const wrong = must(await rep.db.rpc('submit_lesson_quiz', { p_lesson: 'l2-verify', p_answers: [0, 0] })) as { passed: boolean; wrong: number[]; score: number };
  assert.equal(wrong.passed, false);
  assert.deepEqual(wrong.wrong, [1, 2]);
  const right = must(await rep.db.rpc('submit_lesson_quiz', { p_lesson: 'l2-verify', p_answers: [1, 1] })) as { passed: boolean; completed: number };
  assert.equal(right.passed, true);
  assert.equal(right.completed, 1);
  // failing again later does not undo a pass
  must(await rep.db.rpc('submit_lesson_quiz', { p_lesson: 'l2-verify', p_answers: [0, 0] }));
  const st = must(await rep.db.rpc('academy_status', {})) as { passed: number; passed_ids: string[] };
  assert.equal(st.passed, 1);
  assert.deepEqual(st.passed_ids, ['l2-verify']);
  await fails(anon.rpc('submit_lesson_quiz', { p_lesson: 'l2-verify', p_answers: [1, 1] }), /Sign in/);
  // editors can see a reporter's progress, other users cannot
  assert.equal((must(await editor.db.rpc('academy_status', { p_user: rep.id })) as { passed: number }).passed, 1);
  assert.equal(must(await reader.db.rpc('academy_status', { p_user: rep.id })), null);
});

test('Story flags: one open report per reader; 3 reports alert editors; "corrected" adds a correction note', async () => {
  must(await reader.db.rpc('flag_story', { p_story: storyId, p_reason: 'wrong_facts', p_details: 'The date is wrong' }));
  await fails(reader.db.rpc('flag_story', { p_story: storyId, p_reason: 'other', p_details: '' }), /already reported/);
  must(await reader2.db.rpc('flag_story', { p_story: storyId, p_reason: 'misleading', p_details: null }));
  must(await anon.rpc('flag_story', { p_story: storyId, p_reason: 'wrong_facts', p_details: 'anon' }));
  const alert = must(await editor.db.from('notifications').select('title_en').eq('kind', 'flags')) as unknown[];
  assert.equal(alert.length, 1);
  // readers see only their own flags
  assert.equal((must(await reader.db.from('story_flags').select('id').eq('story_id', storyId)) as unknown[]).length, 1);
  const open = must(await mod.db.from('story_flags').select('id').eq('story_id', storyId).eq('status', 'open')) as { id: string }[];
  assert.equal(open.length, 3);
  await fails(reader.db.rpc('resolve_story_flag', { p_id: open[0].id, p_status: 'corrected', p_note: 'x' }), /Not allowed/);
  must(await mod.db.rpc('resolve_story_flag', { p_id: open[0].id, p_status: 'corrected', p_note: 'Corrected the date to 12 November.' }));
  assert.equal((must(await mod.db.from('story_flags').select('id').eq('story_id', storyId).eq('status', 'open')) as unknown[]).length, 0, 'all open flags on the story closed');
  const s = must(await anon.from('stories').select('correction_note, corrected_at').eq('id', storyId).single()) as { correction_note: string; corrected_at: string };
  assert.match(s.correction_note, /12 November/);
  assert.ok(s.corrected_at);
});

test('Grievances: code + 24 h / 15 day deadlines; only editors handle; outcome required; complainant notified', async () => {
  const g = must(await reader.db.rpc('submit_grievance', { p_name: 'Ravi Kumar', p_contact: '9876500000', p_category: 'content', p_details: 'The story about our ward names my father wrongly.', p_story: storyId })) as { code: string; ack_due_at: string; resolve_due_at: string };
  assert.match(g.code, /^GRV-\d{4}-\d{5}$/);
  const hrs = (Date.parse(g.ack_due_at) - Date.now()) / 36e5;
  const days = (Date.parse(g.resolve_due_at) - Date.now()) / 864e5;
  assert.ok(hrs > 23.9 && hrs <= 24, `ack in 24 h (${hrs})`);
  assert.ok(days > 14.99 && days <= 15);
  await fails(reader.db.rpc('submit_grievance', { p_name: 'R', p_contact: '9876500000', p_category: 'content', p_details: 'short' }));
  const row = must(await editor.db.from('grievances').select('id, status').eq('code', g.code).single()) as { id: string; status: string };
  assert.equal(row.status, 'received');
  assert.equal((must(await reader2.db.from('grievances').select('id').eq('code', g.code)) as unknown[]).length, 0, 'other users cannot read it');
  await fails(mod.db.rpc('handle_grievance', { p_id: row.id, p_status: 'acknowledged', p_resolution: null }), /Editors only/);
  must(await editor.db.rpc('handle_grievance', { p_id: row.id, p_status: 'acknowledged', p_resolution: null }));
  await fails(editor.db.rpc('handle_grievance', { p_id: row.id, p_status: 'resolved', p_resolution: ' ' }), /outcome/);
  const done = must(await editor.db.rpc('handle_grievance', { p_id: row.id, p_status: 'resolved', p_resolution: 'Name corrected in the story.' })) as { status: string; acknowledged_at: string; resolved_at: string };
  assert.equal(done.status, 'resolved');
  assert.ok(done.acknowledged_at && done.resolved_at);
  const n = must(await reader.db.from('notifications').select('title_en').eq('kind', 'grievance')) as { title_en: string }[];
  assert.ok(n.some((x) => /received/.test(x.title_en)) && n.some((x) => /resolved/.test(x.title_en)));
  // anonymous complaints are allowed too (no account needed)
  must(await anon.rpc('submit_grievance', { p_name: 'Anonymous reader', p_contact: 'reader@example.com', p_category: 'privacy', p_details: 'Please remove my photo from the story about the fair.' }));
});

test('Local info: national helplines seeded; prices only from editors/moderators with a source', async () => {
  const c = must(await anon.from('local_contacts').select('phone').is('district_id', null)) as { phone: string }[];
  for (const p of ['112', '100', '108', '101', '181', '1098', '1930']) assert.ok(c.some((x) => x.phone === p), p);
  assert.equal((must(await anon.from('daily_prices').select('id')) as unknown[]).length >= 0, true);
  await fails(reader.db.from('daily_prices').insert({ district_id: 'hyd', item: 'tomato', price_paise: 3000, unit: '1 kg', source: 'Market' }));
  await fails(mod.db.from('daily_prices').insert({ district_id: 'hyd', item: 'tomato', price_paise: 3000, unit: '1 kg', source: '' }));
  const yesterday = new Date(Date.now() - 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
  must(await mod.db.from('daily_prices').upsert({ district_id: 'hyd', item: 'onion', price_paise: 4000, unit: '1 kg', source: 'Test market committee', price_date: yesterday }, { onConflict: 'district_id,item,price_date' }));
  must(await mod.db.from('daily_prices').upsert({ district_id: 'hyd', item: 'onion', price_paise: 4500, unit: '1 kg', source: 'Test market committee' }, { onConflict: 'district_id,item,price_date' }));
  const latest = must(await anon.rpc('latest_prices', { p_district: 'hyd' })) as { item: string; price_paise: number; previous_paise: number }[];
  const onion = latest.find((x) => x.item === 'onion')!;
  assert.equal(Number(onion.price_paise), 4500);
  assert.equal(Number(onion.previous_paise), 4000);
  // a moderator cannot write prices for a district they do not moderate
  await fails(mod.db.from('daily_prices').insert({ district_id: 'wgl', item: 'onion', price_paise: 4000, unit: '1 kg', source: 'Test market' }));
});

test('Community board: consent required; pending until approved; daily limit; reasons on rejection', async () => {
  const base = { kind: 'wishes', district_id: 'hyd', title: 'Happy birthday Sravya', body: 'Wishing our daughter a very happy 10th birthday!' };
  await fails(reader.db.from('community_posts').insert({ ...base, consent_confirmed: false }));
  const p = must(await reader.db.from('community_posts').insert({ ...base, consent_confirmed: true, status: 'approved' } as never).select('id, status, expires_at').single()) as { id: string; status: string; expires_at: string };
  assert.equal(p.status, 'pending', 'readers cannot self-approve');
  assert.ok((Date.parse(p.expires_at) - Date.now()) / 864e5 < 3.01, 'wishes expire in 3 days');
  assert.equal((must(await anon.from('community_posts').select('id').eq('id', p.id)) as unknown[]).length, 0, 'not public while pending');
  await fails(reader2.db.rpc('moderate_community_post', { p_id: p.id, p_decision: 'approved' }), /Not allowed/);
  must(await mod.db.rpc('moderate_community_post', { p_id: p.id, p_decision: 'approved' }));
  assert.equal((must(await anon.from('community_posts').select('id').eq('id', p.id)) as unknown[]).length, 1, 'public once approved');
  must(await reader.db.from('community_posts').insert({ ...base, title: 'Second wishes post', consent_confirmed: true }));
  const third = must(await reader.db.from('community_posts').insert({ ...base, kind: 'job', title: 'Driver needed in Ameerpet', consent_confirmed: true, contact_phone: '9876543210' }).select('id').single()) as { id: string };
  await fails(reader.db.from('community_posts').insert({ ...base, title: 'Fourth post today', consent_confirmed: true }), /3 items a day/);
  await fails(mod.db.rpc('moderate_community_post', { p_id: third.id, p_decision: 'rejected' }), /reason/);
  must(await mod.db.rpc('moderate_community_post', { p_id: third.id, p_decision: 'rejected', p_reason: 'Please add the salary and working hours.' }));
  const n = must(await reader.db.from('notifications').select('title_en').eq('kind', 'community')) as { title_en: string }[];
  assert.ok(n.some((x) => /live/.test(x.title_en)) && n.some((x) => /not approved/.test(x.title_en)));
});
