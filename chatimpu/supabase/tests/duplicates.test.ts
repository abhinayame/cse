/** Duplicate reports from different reporters (migrations/0008_content.sql §1): the earlier one wins. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { activeReporter, ageEarlierReports, actor, approve, fails, must, service, submitStory, type Actor } from './helpers.ts';

let editor: Actor, admin: Actor, a: Actor, b: Actor;
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
before(async () => {
  ageEarlierReports();
  editor = await actor('de', { role: 'editor' });
  admin = await actor('da', { role: 'super_admin' });
  a = await activeReporter('dupa', editor);
  b = await activeReporter('dupb', editor);
  must(await admin.db.rpc('set_setting', { p_key: 'duplicate_auto_reject', p_value: true }));
});
after(async () => { must(await service.from('app_settings').upsert({ key: 'duplicate_auto_reject', value: true })); });

// The same incident written by two people (Telugu): different wording, case endings and word order.
const te = (t: string) => [
  { headline: `అమీర్‌పేట ${t} మెట్రో దగ్గర రోడ్డు ప్రమాదం: ఇద్దరికి గాయాలు`, body: `అమీర్‌పేట ${t} మెట్రో స్టేషన్ దగ్గర ఆర్టీసీ బస్సు బైక్‌ను ఢీకొంది. ఇద్దరు యువకులకు తీవ్ర గాయాలు అయ్యాయి. వారిని గాంధీ ఆసుపత్రికి తరలించారు.`, lang: 'te' },
  { headline: `అమీర్‌పేట ${t} మెట్రో వద్ద బస్సు బైక్ ఢీ, ఇద్దరు యువకులకు గాయాలు`, body: `ఆర్టీసీ బస్సు అమీర్‌పేట ${t} మెట్రో స్టేషన్ దగ్గర బైక్‌ను ఢీకొట్టింది. బైక్‌పై ఉన్న ఇద్దరు యువకులు గాయపడ్డారు, గాంధీ ఆసుపత్రికి తరలించారు.`, lang: 'te' },
];

test('second reporter, same incident: auto-rejected with the earlier code; reporter is told; it can never earn', async () => {
  const [x, y] = te(tag());
  const first = await submitStory(a, x);
  const second = await submitStory(b, y);
  assert.equal(first.status, 'under_review');
  assert.equal(second.status, 'rejected');
  assert.equal(second.duplicate_of, first.id);
  assert.ok(Number(second.duplicate_score) >= 0.4);
  assert.match(second.rejection_reason, new RegExp(first.code));
  assert.ok(second.ai_flags.includes('auto_rejected_duplicate'));
  const hist = must(await b.db.from('editorial_reviews').select('action, to_status').eq('submission_id', second.id).order('id')) as { action: string; to_status: string }[];
  assert.deepEqual(hist.map((h) => h.to_status), ['submitted', 'rejected'], 'reporter sees the decision in their history');
  const note = must(await b.db.from('notifications').select('title_en').eq('kind', 'rejected').order('created_at', { ascending: false }).limit(1).single()) as { title_en: string };
  assert.match(note.title_en, /Already reported/);
  await fails(editor.db.rpc('editorial_approve', { p_id: second.id, p_headline: 'x'.repeat(20), p_summary: 'y', p_contribution: 'text_news', p_amount_paise: 500 }), /under review can be approved/);
  // the earlier report is unaffected and can be approved and paid as usual
  if (first.is_sensitive) must(await editor.db.rpc('editorial_update', { p_id: first.id, p_patch: { human_verified: true, verification_notes: 'Confirmed with traffic police' } }));
  const res = await approve(editor, first.id, 'text_news', 500);
  assert.ok(res.earning);
});

test('not duplicates: different incident, same reporter twice, different district, outside the time window', async () => {
  const t = tag();
  await submitStory(a, { headline: `${t} బస్సు బైక్ ఢీ అమీర్‌పేట మెట్రో దగ్గర ఇద్దరికి గాయాలు`, body: `అమీర్‌పేట మెట్రో స్టేషన్ దగ్గర ${t} ఆర్టీసీ బస్సు బైక్‌ను ఢీకొంది. ఇద్దరు యువకులకు గాయాలు.`, lang: 'te' });
  const other = await submitStory(b, { headline: `అమీర్‌పేటలో ${t} కొత్త గ్రంథాలయం ప్రారంభం`, body: `అమీర్‌పేట ప్రభుత్వ పాఠశాలలో ${t} కొత్త గ్రంథాలయాన్ని ఎమ్మెల్యే ప్రారంభించారు. 1200 పుస్తకాలు అందుబాటులో ఉన్నాయి.`, lang: 'te' });
  assert.equal(other.status, 'under_review', 'different incident in the same area');

  const [x, y] = te(tag());
  await submitStory(a, x);
  const self = await submitStory(a, y);
  assert.equal(self.status, 'under_review', 'the same reporter sending twice is left to editors (flagged only)');
  assert.ok(self.ai_flags.includes('possible_duplicate'));

  const [x2, y2] = te(tag());
  await submitStory(a, x2);
  const elsewhere = await submitStory(b, { ...y2, district_id: 'wgl', mandal_id: 'wgl-kzp' });
  assert.equal(elsewhere.status, 'under_review', 'different district');

  const [x3, y3] = te(tag());
  const old = await submitStory(a, x3);
  ageEarlierReports(); // the first report is now 30 days old (outside the 48 h window)
  const late = await submitStory(b, y3);
  assert.equal(late.status, 'under_review', 'outside the time window');
  void old;
});

test('setting: editors can switch auto-reject off (then reports are only flagged); reporters cannot', async () => {
  await fails(a.db.rpc('set_setting', { p_key: 'duplicate_auto_reject', p_value: false }), /permission/);
  await fails(editor.db.rpc('set_setting', { p_key: 'duplicate_match_percent', p_value: 10 }), /between 30% and 95%/);
  must(await editor.db.rpc('set_setting', { p_key: 'duplicate_auto_reject', p_value: false }));
  const [x, y] = te(tag());
  await submitStory(a, x);
  const second = await submitStory(b, y);
  assert.equal(second.status, 'under_review');
  assert.ok(second.ai_flags.includes('possible_duplicate'), 'still flagged for the editor');
  must(await editor.db.rpc('set_setting', { p_key: 'duplicate_auto_reject', p_value: true }));
});

test('editors can reinstate an auto-rejected report with a reason; reporters cannot', async () => {
  const [x, y] = te(tag());
  await submitStory(a, x);
  const second = await submitStory(b, y);
  assert.equal(second.status, 'rejected');
  await fails(b.db.rpc('reinstate_duplicate', { p_id: second.id, p_note: 'mine is different' }));
  await fails(editor.db.rpc('reinstate_duplicate', { p_id: second.id, p_note: '' }), /different incident/);
  const back = must(await editor.db.rpc('reinstate_duplicate', { p_id: second.id, p_note: 'Second accident on the same road an hour later' })) as { status: string; duplicate_of: string | null };
  assert.deepEqual([back.status, back.duplicate_of], ['under_review', null]);
});
