/** Automated intake (migrations/0008_content.sql §4 + functions/_shared/intake). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { activeReporter, ageEarlierReports, actor, fails, must, service, submitStory, type Actor } from './helpers.ts';
import { extractiveSummary, parseFeed, runIntake } from '../functions/_shared/intake/index.ts';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toUTCString();
const tag = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);

const rss = (t: string, items: { title: string; body: string; age: number; guid?: string }[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Feed ${t}</title>
${items.map((i, n) => `<item><title><![CDATA[${i.title}]]></title><link>https://press.example.gov.in/${t}/${n}</link><guid>${i.guid ?? `${t}-${n}`}</guid>
<pubDate>${hoursAgo(i.age)}</pubDate><description><![CDATA[<p>${i.body}</p>]]></description></item>`).join('\n')}
</channel></rss>`;
const atom = (t: string, title: string, body: string) => `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title>${title}</title><link href="https://agency.example.in/${t}"/><id>urn:${t}</id><updated>${new Date().toISOString()}</updated><summary type="html">&lt;b&gt;${body}&lt;/b&gt; &amp; more</summary></entry></feed>`;

let editor: Actor, mod: Actor;
const feeds = new Map<string, string>();
const fakeFetch = (async (url: string) => {
  const body = feeds.get(String(url));
  return body ? new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } }) : new Response('nope', { status: 503 });
}) as unknown as typeof fetch;

before(async () => {
  ageEarlierReports();
  editor = await actor('ie', { role: 'editor' });
  mod = await actor('im', { role: 'district_moderator', districts: ['hyd'] });
  must(await service.from('news_sources').update({ active: false }).neq('id', '00000000-0000-0000-0000-000000000000')); // only this run's sources
  must(await service.from('app_settings').upsert({ key: 'intake_enabled', value: true }));
});
after(async () => { must(await service.from('news_sources').update({ active: false }).neq('id', '00000000-0000-0000-0000-000000000000')); });

async function source(over: Record<string, unknown>) {
  return must(await editor.db.from('news_sources').insert({ name: `Src ${tag()}`, url: `https://feeds.example.in/${tag()}.xml`, trust: 'partner', district_id: 'hyd',
    language: 'te', licence_note: 'Government press release, public domain', ...over }).select('*').single()) as { id: string; url: string; name: string };
}

test('feed parser: RSS (CDATA, HTML) and Atom (href links, entities); extractive summary keeps whole sentences', () => {
  const r = parseFeed(rss('p', [{ title: 'హైదరాబాద్‌లో భారీ వర్షం హెచ్చరిక', body: 'వాతావరణ శాఖ <b>ఆరెంజ్</b> అలర్ట్ జారీ చేసింది.', age: 1 }]));
  assert.equal(r.length, 1);
  assert.equal(r[0].title, 'హైదరాబాద్‌లో భారీ వర్షం హెచ్చరిక');
  assert.equal(r[0].text, 'వాతావరణ శాఖ ఆరెంజ్ అలర్ట్ జారీ చేసింది.');
  assert.match(r[0].link!, /press\.example\.gov\.in/);
  const a = parseFeed(atom('x', 'Agency: water supply cut in Ameerpet', 'Pipeline repairs'));
  assert.equal(a[0].link, 'https://agency.example.in/x');
  assert.equal(a[0].text, 'Pipeline repairs & more');
  const s = extractiveSummary('One sentence here. Two sentence here. ' + 'Long words '.repeat(80) + '.', 10);
  assert.equal(s, 'One sentence here. Two sentence here.');
});

test('sources: editors manage them; moderators cannot; auto-publish only for official sources; licence note required', async () => {
  await fails(mod.db.from('news_sources').insert({ name: 'x', url: 'https://a.example/x.xml', district_id: 'hyd', licence_note: 'Government release' }).select().single());
  await fails(editor.db.from('news_sources').insert({ name: 'x', url: 'https://a.example/y.xml', district_id: 'hyd', licence_note: 'Government release', trust: 'partner', auto_publish: true }).select().single(), /auto_publish_official/);
  await fails(editor.db.from('news_sources').insert({ name: 'x', url: 'https://a.example/z.xml', district_id: 'hyd', licence_note: 'ok' }).select().single());
});

test('a run queues fresh items on the editorial desk, credits the source, skips old items, never repeats an item, records broken feeds', async () => {
  const t = tag();
  const s = await source({});
  feeds.set(s.url, rss(t, [
    { title: `అమీర్‌పేట ${t} ప్రభుత్వ పాఠశాలలో కొత్త ప్రయోగశాల`, body: `అమీర్‌పేట ${t} ప్రభుత్వ పాఠశాలలో విద్యార్థుల కోసం కొత్త సైన్స్ ప్రయోగశాలను ప్రారంభించారు. 400 మంది విద్యార్థులకు ఉపయోగం.`, age: 2 },
    { title: `పాత వార్త ${t} గత వారం జరిగిన కార్యక్రమం వివరాలు`, body: 'పాత కార్యక్రమం.', age: 72 },
  ]));
  const broken = await source({ url: `https://feeds.example.in/broken-${t}.xml` });
  const r1 = await runIntake(service, { fetchImpl: fakeFetch, edition: 'morning' }) as Record<string, any>;
  assert.equal(r1.queued, 1); assert.equal(r1.old, 1); assert.equal(r1.errors, 1);
  const item = must(await service.from('intake_items').select('status, submission_id').eq('source_id', s.id).single()) as { status: string; submission_id: string };
  const card = must(await editor.db.from('citizen_reports').select('status, body, source_notes, submission_type, ai_flags, code, category_id').eq('id', item.submission_id).single()) as Record<string, any>;
  assert.equal(card.status, 'under_review');
  assert.match(card.code, /^CHT-/);
  assert.equal(card.category_id, 'education', 'category guessed from the Telugu text');
  assert.match(card.body, new RegExp(`— ${s.name}`), 'source credited in the card');
  assert.ok(card.ai_flags.includes('auto_intake'));
  const b = must(await service.from('news_sources').select('last_error').eq('id', broken.id).single()) as { last_error: string };
  assert.match(b.last_error, /HTTP 503/);
  const r2 = await runIntake(service, { fetchImpl: fakeFetch, edition: 'evening' }) as Record<string, any>;
  assert.equal(r2.queued, 0); assert.equal(r2.seen, 1, 'the same item is not processed twice');
  const dash = must(await editor.db.rpc('intake_dashboard')) as { target: number; by_source: Record<string, number> };
  assert.equal(dash.target, 100);
  assert.ok(dash.by_source[s.name] >= 1);
});

test('official sources auto-publish to the next 06:00 / 18:00 edition — but never sensitive items', async () => {
  const t = tag();
  const s = await source({ trust: 'official', auto_publish: true, district_id: 'wgl', category_id: 'education' });
  feeds.set(s.url, rss(t, [
    { title: `వరంగల్ ${t} జిల్లాలో పాఠశాలలకు శుక్రవారం సెలవు`, body: `వరంగల్ ${t} జిల్లాలోని అన్ని ప్రభుత్వ, ప్రైవేటు పాఠశాలలకు శుక్రవారం సెలవు ప్రకటించారు. జిల్లా విద్యాశాఖ అధికారి ఈ మేరకు ఉత్తర్వులు జారీ చేశారు. శనివారం యథావిధిగా తరగతులు జరుగుతాయి. ఈ సెలవుకు బదులుగా వచ్చే నెల రెండో శనివారం పాఠశాలలు పనిచేస్తాయని అధికారులు తెలిపారు. తల్లిదండ్రులు గమనించాలని కోరారు.`, age: 1 },
    { title: `వరంగల్ ${t} పోలీసులు దొంగతనం కేసులో ఇద్దరిని అరెస్ట్ చేశారు`, body: `వరంగల్ ${t} లో దొంగతనం కేసులో ఇద్దరు నిందితులను పోలీసులు అరెస్ట్ చేశారు.`, age: 1 },
  ]));
  const r = await runIntake(service, { fetchImpl: fakeFetch }) as Record<string, any>;
  assert.equal(r.published, 1);
  assert.equal(r.queued, 1, 'the crime item waits for an editor');
  const pub = must(await service.from('intake_items').select('story_id').eq('source_id', s.id).eq('status', 'published').single()) as { story_id: string };
  const story = must(await service.from('stories').select('status, publish_at, source, source_url').eq('id', pub.story_id).single()) as { status: string; publish_at: string; source: string; source_url: string };
  assert.equal(story.status, 'scheduled');
  const ist = new Date(new Date(story.publish_at).getTime() + 5.5 * 3600e3);
  assert.ok([6, 18].includes(ist.getUTCHours()) && ist.getUTCMinutes() === 0, 'scheduled for an edition');
  assert.equal(story.source, s.name); assert.match(story.source_url, /press\.example/);
  const waiting = must(await service.from('intake_items').select('submission_id').eq('source_id', s.id).eq('status', 'queued').single()) as { submission_id: string };
  const crime = must(await service.from('citizen_reports').select('is_sensitive, status').eq('id', waiting.submission_id).single()) as { is_sensitive: boolean; status: string };
  assert.deepEqual([crime.is_sensitive, crime.status], [true, 'under_review']);
});

test('duplicates: the same event from two feeds keeps the earlier card; a reporter who filed first beats the feed', async () => {
  const t = tag();
  const s1 = await source({}); const s2 = await source({});
  const story = (n: number) => ({ title: `కూకట్‌పల్లి ${t} లో నీటి సరఫరా రెండు రోజులు బంద్${n ? ' అని అధికారులు' : ''}`, body: `పైపులైన్ మరమ్మతుల కారణంగా కూకట్‌పల్లి ${t} ప్రాంతంలో బుధ, గురువారాల్లో నీటి సరఫరా ఉండదని జలమండలి తెలిపింది.`, age: 1 });
  feeds.set(s1.url, rss(`${t}a`, [story(0)]));
  await runIntake(service, { fetchImpl: fakeFetch });
  feeds.set(s2.url, rss(`${t}b`, [story(1)]));
  const r = await runIntake(service, { fetchImpl: fakeFetch }) as Record<string, any>;
  assert.equal(r.duplicates, 1, 'second feed carrying the same event');

  const rep = await activeReporter('intrep', editor);
  const t2 = tag();
  const mine = await submitStory(rep, { headline: `బేగంపేట ${t2} ఫ్లైఓవర్ పై లైట్లు మళ్ళీ వెలిగాయి`, body: `బేగంపేట ${t2} ఫ్లైఓవర్ పై పది రోజులుగా ఆగిపోయిన వీధి దీపాలను జీహెచ్ఎంసీ సిబ్బంది మంగళవారం రాత్రి మరమ్మతు చేశారు.`, lang: 'te' });
  assert.equal(mine.status, 'under_review');
  const s3 = await source({});
  feeds.set(s3.url, rss(`${t2}c`, [{ title: `బేగంపేట ${t2} ఫ్లైఓవర్ పై వీధి దీపాలు మరమ్మతు`, body: `బేగంపేట ${t2} ఫ్లైఓవర్ పై వీధి దీపాలను జీహెచ్ఎంసీ సిబ్బంది మంగళవారం రాత్రి మరమ్మతు చేశారు.`, age: 1 }]));
  const r3 = await runIntake(service, { fetchImpl: fakeFetch }) as Record<string, any>;
  assert.equal(r3.duplicates, 1, 'the reporter was first, so the feed item is rejected');
});

test('switching intake off stops runs; editors can change it, moderators cannot', async () => {
  await fails(mod.db.rpc('set_setting', { p_key: 'intake_enabled', p_value: false }), /permission/);
  must(await editor.db.rpc('set_setting', { p_key: 'intake_enabled', p_value: false }));
  assert.deepEqual(await runIntake(service, { fetchImpl: fakeFetch }), { skipped: 'intake disabled' });
  must(await editor.db.rpc('set_setting', { p_key: 'intake_enabled', p_value: true }));
});
