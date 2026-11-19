-- ════════════════════════════════════════════════════════════════════════════
-- 0009 · Help centre, Reporter Academy, corrections & grievances, local info, community board
-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. FAQs (reporter + reader), editable in the CMS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists faqs (
  id text primary key default gen_random_uuid()::text,
  audience text not null check (audience in ('reporter', 'reader')),
  category text not null,                       -- English heading
  category_te text,                             -- Telugu heading
  question_te text not null, answer_te text not null,
  question_en text not null, answer_en text not null,
  sort int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table faqs enable row level security;
drop policy if exists faqs_read on faqs;
create policy faqs_read on faqs for select using (active or my_role() in ('super_admin', 'editor'));
drop policy if exists faqs_write on faqs;
create policy faqs_write on faqs for all using (my_role() in ('super_admin', 'editor')) with check (my_role() in ('super_admin', 'editor'));

insert into faqs (id, audience, category, sort, question_en, answer_en, question_te, answer_te) values
-- reporter: getting started
('r-join', 'reporter', 'Getting started', 10, 'Who can become a Chatimpu reporter?',
 'Anyone 18 or older who lives in the area they report on. Register in the app (Profile → Reporter hub) or at /reporter, add an identity document, and finish the Reporter Academy. An editor then activates your account.',
 'చాటింపు రిపోర్టర్ ఎవరు కావచ్చు?',
 '18 ఏళ్లు నిండి, తాము రిపోర్ట్ చేసే ప్రాంతంలో నివసించే ఎవరైనా. యాప్‌లో (ప్రొఫైల్ → రిపోర్టర్ హబ్) నమోదు చేసుకుని, గుర్తింపు పత్రం జోడించి, రిపోర్టర్ అకాడమీ పూర్తి చేయండి. తర్వాత ఎడిటర్ మీ ఖాతాను సక్రియం చేస్తారు.'),
('r-id', 'reporter', 'Getting started', 20, 'Which ID documents are accepted? Is my ID safe?',
 'Masked Aadhaar (only the last 4 digits visible), voter ID, PAN, driving licence, press or college ID. Documents are stored privately, seen only by verification staff, and the image is deleted 30 days after the decision.',
 'ఏ గుర్తింపు పత్రాలు అంగీకరిస్తారు? నా ఐడీ సురక్షితమేనా?',
 'మాస్క్ చేసిన ఆధార్ (చివరి 4 అంకెలు మాత్రమే), ఓటర్ ఐడీ, పాన్, డ్రైవింగ్ లైసెన్స్, ప్రెస్ లేదా కళాశాల ఐడీ. పత్రాలు గోప్యంగా ఉంటాయి, ధృవీకరణ సిబ్బంది మాత్రమే చూస్తారు, నిర్ణయం తర్వాత 30 రోజుల్లో చిత్రం తొలగించబడుతుంది.'),
('r-title', 'reporter', 'Getting started', 30, 'Am I a journalist with a press card?',
 'No. Contributor titles (Community Contributor, Area Correspondent…) describe your role on Chatimpu only. They are not press accreditation, and you must not use the Chatimpu name to seek privileges from police or officials.',
 'నేను ప్రెస్ కార్డు ఉన్న జర్నలిస్టునా?',
 'కాదు. కంట్రిబ్యూటర్ హోదాలు చాటింపులో మీ పాత్రను మాత్రమే తెలుపుతాయి. ఇవి ప్రెస్ అక్రిడిటేషన్ కాదు. పోలీసులు లేదా అధికారుల నుంచి ప్రత్యేక సౌకర్యాల కోసం చాటింపు పేరు ఉపయోగించకూడదు.'),
-- reporter: writing
('r-what', 'reporter', 'Sending news', 40, 'What kind of news should I send?',
 'Things that happened in your area that local people need to know: civic problems, accidents, schools, hospitals, farmers, jobs, events, government notices. Only send what you saw yourself or confirmed with a reliable source.',
 'ఎలాంటి వార్తలు పంపాలి?',
 'మీ ప్రాంతంలో జరిగిన, స్థానికులు తెలుసుకోవాల్సిన విషయాలు: పౌర సమస్యలు, ప్రమాదాలు, పాఠశాలలు, ఆసుపత్రులు, రైతులు, ఉద్యోగాలు, కార్యక్రమాలు, ప్రభుత్వ ప్రకటనలు. మీరు స్వయంగా చూసినవి లేదా నమ్మకమైన వ్యక్తితో నిర్ధారించుకున్నవి మాత్రమే పంపండి.'),
('r-never', 'reporter', 'Sending news', 50, 'What must I never send?',
 'Rumours, forwarded WhatsApp messages, other outlets'' photos or text, names or photos of victims of sexual offences or children in sensitive cases, hate speech, and anything that can inflame religious or caste tension. Fabricated news leads to suspension and loss of earnings.',
 'ఏవి ఎప్పుడూ పంపకూడదు?',
 'పుకార్లు, ఫార్వర్డ్ చేసిన వాట్సాప్ సందేశాలు, ఇతర పత్రికల ఫోటోలు లేదా వార్తలు, లైంగిక నేరాల బాధితులు లేదా సున్నితమైన కేసుల్లో పిల్లల పేర్లు, ఫోటోలు, ద్వేషపూరిత మాటలు, మత లేదా కుల ఉద్రిక్తతలు రేపే విషయాలు. కల్పిత వార్తలు పంపితే ఖాతా నిలిపివేసి ఆదాయం రద్దు చేస్తాం.'),
('r-dup', 'reporter', 'Sending news', 60, 'Someone else sent the same news. What happens?',
 'The earlier report is kept. If another reporter already sent the same incident from your district in the last 48 hours, yours is rejected automatically and you are told which report came first. Send fast, but only after checking the facts.',
 'అదే వార్తను మరొకరు పంపారు. ఏమవుతుంది?',
 'ముందు వచ్చిన వార్తనే పరిగణిస్తాం. గత 48 గంటల్లో మీ జిల్లా నుంచి అదే సంఘటనను మరో రిపోర్టర్ పంపితే, మీది ఆటోమేటిక్‌గా తిరస్కరించబడుతుంది, ఏది ముందు వచ్చిందో మీకు తెలియజేస్తాం. వేగంగా పంపండి, కానీ నిజాలు తనిఖీ చేశాకే.'),
('r-correct', 'reporter', 'Sending news', 70, 'An editor asked for a correction. What should I do?',
 'Open the story from My news, read the editor''s note, fix or add what was asked, and send it again. It goes back to the same editor.',
 'ఎడిటర్ సవరణ అడిగారు. ఏం చేయాలి?',
 '"నా వార్తలు"లో ఆ వార్తను తెరిచి, ఎడిటర్ సూచన చదివి, అడిగినది సరిచేసి లేదా జోడించి మళ్ళీ పంపండి. అది అదే ఎడిటర్ వద్దకు వెళ్తుంది.'),
('r-sources', 'reporter', 'Sending news', 80, 'Will my sources be published?',
 'Never. The private "Sources & evidence" box is seen only by editors and is never published or shared.',
 'నా సోర్సెస్ ప్రచురిస్తారా?',
 'ఎప్పుడూ ప్రచురించం. గోప్యమైన "ఆధారాలు" బాక్స్‌ను ఎడిటర్లు మాత్రమే చూస్తారు.'),
-- reporter: money
('r-pay', 'reporter', 'Earnings & payments', 90, 'How much do I earn?',
 'Only approved stories earn, at the current rate card (shown in Wallet → Earnings): for example text news, original photos, original videos and detailed reports have different amounts. Special assignments pay the amount shown on the assignment.',
 'ఎంత సంపాదిస్తాను?',
 'ఆమోదం పొందిన వార్తలకు మాత్రమే ప్రస్తుత రేట్ కార్డ్ ప్రకారం చెల్లిస్తాం (వాలెట్ → ఆదాయంలో చూడండి). వచన వార్త, అసలు ఫోటో, అసలు వీడియో, వివరణాత్మక కథనాలకు వేర్వేరు మొత్తాలు. ప్రత్యేక అసైన్‌మెంట్లకు అందులో చూపిన మొత్తం.'),
('r-withdraw', 'reporter', 'Earnings & payments', 100, 'When can I withdraw money?',
 'When your available balance reaches the minimum (₹300 unless changed). Add a UPI ID or bank account, wait for it to be verified, then request a withdrawal. Money for stories still under review is "pending" and cannot be withdrawn yet.',
 'డబ్బు ఎప్పుడు తీసుకోవచ్చు?',
 'అందుబాటు బ్యాలెన్స్ కనీస మొత్తానికి (మార్చకపోతే ₹300) చేరినప్పుడు. UPI ID లేదా బ్యాంక్ ఖాతా జోడించి, ధృవీకరణ కోసం వేచి ఉండి, ఉపసంహరణ అభ్యర్థించండి. పరిశీలనలో ఉన్న వార్తల మొత్తం "పెండింగ్", ఇంకా తీసుకోలేరు.'),
('r-failed', 'reporter', 'Earnings & payments', 110, 'My payment failed. Did I lose money?',
 'No. If the bank returns or fails a payment, our finance team checks it and the full amount comes back to your available balance. You can then request again.',
 'చెల్లింపు విఫలమైంది. డబ్బు పోయిందా?',
 'లేదు. బ్యాంకు చెల్లింపును తిరిగి పంపినా, విఫలమైనా ఫైనాన్స్ బృందం తనిఖీ చేసి పూర్తి మొత్తాన్ని మీ బ్యాలెన్స్‌కు తిరిగి జమ చేస్తుంది. తర్వాత మళ్ళీ అభ్యర్థించవచ్చు.'),
('r-tds', 'reporter', 'Earnings & payments', 120, 'Why was TDS deducted? Why do you need my PAN?',
 'When TDS is switched on and your payouts in a financial year cross the limit, tax is deducted and paid to the government in your name. With a verified PAN the rate is lower. Your PAN is encrypted and shown only masked.',
 'TDS ఎందుకు మినహాయించారు? నా PAN ఎందుకు?',
 'TDS అమలులో ఉండి, ఒక ఆర్థిక సంవత్సరంలో మీ చెల్లింపులు పరిమితి దాటితే, పన్ను మినహాయించి మీ పేరుతో ప్రభుత్వానికి చెల్లిస్తాం. ధృవీకరించిన PAN ఉంటే రేటు తక్కువ. మీ PAN ఎన్‌క్రిప్ట్ చేయబడి, మాస్క్ చేసి మాత్రమే చూపబడుతుంది.'),
('r-bribe', 'reporter', 'Ethics & safety', 130, 'Someone offered me money to publish or stop a story.',
 'Refuse and tell us at once from Help & support. Taking money or favours for news is not allowed and leads to removal. Your safety comes first: never put yourself in danger for a story.',
 'వార్త ప్రచురించడానికి లేదా ఆపడానికి ఎవరైనా డబ్బు ఇవ్వబోయారు.',
 'నిరాకరించి, వెంటనే సహాయం విభాగం ద్వారా మాకు తెలియజేయండి. వార్తల కోసం డబ్బు లేదా లాభాలు తీసుకోవడం నిషిద్ధం, అలా చేస్తే తొలగిస్తాం. మీ భద్రతే ముఖ్యం: వార్త కోసం ప్రమాదంలో పడకండి.'),
-- reader
('u-loc', 'reader', 'Using the app', 10, 'How do I see news from my village or mandal?',
 'Profile → Location. Choose your district and mandal; the feed and the Local tab then show news from your area first.',
 'నా గ్రామం లేదా మండలం వార్తలు ఎలా చూడాలి?',
 'ప్రొఫైల్ → ప్రాంతం. మీ జిల్లా, మండలం ఎంచుకోండి; ఫీడ్, లోకల్ ట్యాబ్ మీ ప్రాంత వార్తలను ముందుగా చూపిస్తాయి.'),
('u-lang', 'reader', 'Using the app', 20, 'How do I change the language?',
 'Profile → Language. Telugu, English, Hindi and other Indian languages are available.',
 'భాష ఎలా మార్చాలి?',
 'ప్రొఫైల్ → భాష. తెలుగు, ఇంగ్లీష్, హిందీ, ఇతర భారతీయ భాషలు అందుబాటులో ఉన్నాయి.'),
('u-wrong', 'reader', 'Trust & corrections', 30, 'I think a story is wrong. What can I do?',
 'Open the story and tap "Report this story". Choose what is wrong and add details. Editors review every report; if a story is corrected, a dated correction note is added.',
 'ఒక వార్త తప్పు అనిపిస్తోంది. ఏం చేయాలి?',
 'వార్తను తెరిచి "ఈ వార్తపై ఫిర్యాదు" నొక్కండి. ఏది తప్పో ఎంచుకుని వివరాలు రాయండి. ప్రతి ఫిర్యాదును ఎడిటర్లు పరిశీలిస్తారు; సవరిస్తే తేదీతో సవరణ నోట్ జోడిస్తాం.'),
('u-griev', 'reader', 'Trust & corrections', 40, 'How do I file a formal complaint (grievance)?',
 'Profile → Help → Grievance. We acknowledge within 24 hours and resolve within 15 days, as required for digital news publishers. You get a GRV code to track it.',
 'అధికారిక ఫిర్యాదు (గ్రీవెన్స్) ఎలా చేయాలి?',
 'ప్రొఫైల్ → సహాయం → ఫిర్యాదు. 24 గంటల్లో అందినట్లు తెలియజేసి, 15 రోజుల్లో పరిష్కరిస్తాం. ట్రాక్ చేయడానికి GRV కోడ్ వస్తుంది.'),
('u-tip', 'reader', 'Trust & corrections', 50, 'Can I send a news tip without becoming a reporter?',
 'Yes: post it on the Community board, or become a reporter to send full stories and earn money for approved news.',
 'రిపోర్టర్ కాకుండా వార్త సమాచారం పంపవచ్చా?',
 'అవును: కమ్యూనిటీ బోర్డులో పోస్ట్ చేయండి, లేదా రిపోర్టర్‌గా చేరి పూర్తి వార్తలు పంపి ఆమోదం పొందిన వార్తలకు డబ్బు పొందండి.'),
('u-community', 'reader', 'Community board', 60, 'How do I post an obituary, wishes, a job or something to sell?',
 'Local tab → Community board → Post. Every post is checked by our team before it appears and stays up for a limited time. Do not share other people''s phone numbers or photos without their consent.',
 'శ్రద్ధాంజలి, శుభాకాంక్షలు, ఉద్యోగం లేదా అమ్మకం ఎలా పోస్ట్ చేయాలి?',
 'లోకల్ ట్యాబ్ → కమ్యూనిటీ బోర్డు → పోస్ట్. ప్రతి పోస్ట్‌ను మా బృందం తనిఖీ చేశాకే కనిపిస్తుంది, కొంతకాలం మాత్రమే ఉంటుంది. ఇతరుల ఫోన్ నంబర్లు, ఫోటోలు వారి అనుమతి లేకుండా పెట్టకండి.'),
('u-privacy', 'reader', 'Privacy', 70, 'What data do you keep about me?',
 'Your mobile number (if you sign in), language, location and interests to personalise news, and what you read to improve recommendations. You can ask us to delete your account from Help & support.',
 'నా గురించి ఏ సమాచారం ఉంచుతారు?',
 'మీరు సైన్ ఇన్ చేస్తే మొబైల్ నంబర్, వార్తలను మీకు అనుగుణంగా చూపడానికి భాష, ప్రాంతం, ఆసక్తులు, సిఫార్సులు మెరుగుపరచడానికి మీరు చదివినవి. సహాయం విభాగం ద్వారా మీ ఖాతా తొలగించమని కోరవచ్చు.')
on conflict (id) do nothing;

update faqs set category_te = case category
  when 'Getting started' then 'ప్రారంభం' when 'Sending news' then 'వార్తలు పంపడం' when 'Earnings & payments' then 'ఆదాయం, చెల్లింపులు'
  when 'Ethics & safety' then 'నైతికత, భద్రత' when 'Using the app' then 'యాప్ వాడకం' when 'Trust & corrections' then 'నమ్మకం, సవరణలు'
  when 'Community board' then 'కమ్యూనిటీ బోర్డు' when 'Privacy' then 'గోప్యత' end
where category_te is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. REPORTER ACADEMY: short lessons + quizzes (answers are checked on the server)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists academy_lessons (
  id text primary key,
  sort int not null,
  title_te text not null, title_en text not null,
  body_te text not null, body_en text not null,     -- paragraphs separated by blank lines; lines starting "• " are bullets
  quiz jsonb not null default '[]',                 -- [{"q_te","q_en","options":[{"te","en"}],"answer":index}]
  active boolean not null default true
);
create table if not exists academy_progress (
  user_id uuid not null references profiles on delete cascade,
  lesson_id text not null references academy_lessons on delete cascade,
  score int not null, total int not null,
  passed_at timestamptz,
  attempts int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table academy_lessons enable row level security;
alter table academy_progress enable row level security;
-- lessons readable, but the quiz answers are not exposed: the app reads academy_public
drop policy if exists lessons_staff on academy_lessons;
create policy lessons_staff on academy_lessons for all using (my_role() in ('super_admin', 'editor')) with check (my_role() in ('super_admin', 'editor'));
drop policy if exists progress_read on academy_progress;
create policy progress_read on academy_progress for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor', 'district_moderator') or has_permission('reporter_admin'));

create or replace view academy_public with (security_invoker = false) as
  select id, sort, title_te, title_en, body_te, body_en,
         (select coalesce(jsonb_agg(q - 'answer'), '[]') from jsonb_array_elements(quiz) q) as quiz
  from academy_lessons where active order by sort;
grant select on academy_public to anon, authenticated;

/** Mark a quiz. Pass = all questions right. Returns which answers were wrong (not the right ones). */
create or replace function submit_lesson_quiz(p_lesson text, p_answers int[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare l academy_lessons; total int; score int := 0; wrong int[] := '{}'; i int; passed boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into l from academy_lessons where id = p_lesson and active;
  if l.id is null then raise exception 'Lesson not found'; end if;
  total := jsonb_array_length(l.quiz);
  for i in 0 .. total - 1 loop
    if coalesce(p_answers[i + 1], -1) = (l.quiz -> i ->> 'answer')::int then score := score + 1; else wrong := wrong || (i + 1); end if;
  end loop;
  passed := score = total;
  insert into academy_progress (user_id, lesson_id, score, total, passed_at)
  values (auth.uid(), p_lesson, score, total, case when passed then now() end)
  on conflict (user_id, lesson_id) do update set score = excluded.score, total = excluded.total, attempts = academy_progress.attempts + 1,
    passed_at = coalesce(academy_progress.passed_at, excluded.passed_at), updated_at = now();
  return jsonb_build_object('score', score, 'total', total, 'passed', passed, 'wrong', wrong,
    'completed', (select count(*) from academy_progress p join academy_lessons a on a.id = p.lesson_id where p.user_id = auth.uid() and p.passed_at is not null and a.active),
    'lessons', (select count(*) from academy_lessons where active));
end $$;

create or replace function academy_status(p_user uuid default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lessons', (select count(*) from academy_lessons where active),
    'passed', (select count(*) from academy_progress p join academy_lessons a on a.id = p.lesson_id where p.user_id = coalesce(p_user, auth.uid()) and p.passed_at is not null and a.active),
    'passed_ids', (select coalesce(jsonb_agg(p.lesson_id), '[]') from academy_progress p where p.user_id = coalesce(p_user, auth.uid()) and p.passed_at is not null))
  where p_user is null or p_user = auth.uid() or my_role() in ('super_admin', 'editor', 'district_moderator') or has_permission('reporter_admin')
$$;

insert into academy_lessons (id, sort, title_en, title_te, body_en, body_te, quiz) values
('l1-local-news', 1, 'What makes local news', 'స్థానిక వార్త అంటే ఏమిటి',
 E'A good local story answers six questions: who, what, where, when, why and how.\n\n• Write about something that affects people in your area.\n• Say exactly where it happened: village, ward, landmark.\n• Say when it happened.\n• Keep it short: a strong headline and 60–80 words are enough for a card.',
 E'మంచి స్థానిక వార్త ఆరు ప్రశ్నలకు జవాబిస్తుంది: ఎవరు, ఏమిటి, ఎక్కడ, ఎప్పుడు, ఎందుకు, ఎలా.\n\n• మీ ప్రాంత ప్రజలపై ప్రభావం చూపే విషయం గురించి రాయండి.\n• ఎక్కడ జరిగిందో ఖచ్చితంగా చెప్పండి: గ్రామం, వార్డు, గుర్తు.\n• ఎప్పుడు జరిగిందో చెప్పండి.\n• క్లుప్తంగా రాయండి: బలమైన శీర్షిక, 60–80 పదాలు చాలు.',
 '[{"q_en":"Which of these is the most important detail to include?","q_te":"వీటిలో తప్పనిసరిగా ఉండాల్సిన వివరం ఏది?","options":[{"en":"Exactly where and when it happened","te":"ఎక్కడ, ఎప్పుడు జరిగిందో ఖచ్చితంగా"},{"en":"Your personal opinion","te":"మీ వ్యక్తిగత అభిప్రాయం"},{"en":"A long introduction","te":"పెద్ద పరిచయం"}],"answer":0},
   {"q_en":"How long should a news card summary be?","q_te":"వార్త కార్డు సారాంశం ఎంత ఉండాలి?","options":[{"en":"About 60–80 words","te":"సుమారు 60–80 పదాలు"},{"en":"At least 500 words","te":"కనీసం 500 పదాలు"},{"en":"One word","te":"ఒక్క పదం"}],"answer":0}]'),
('l2-verify', 2, 'Check before you send', 'పంపే ముందు నిర్ధారించుకోండి',
 E'One wrong story can damage trust in all of us.\n\n• Send only what you saw yourself, or confirm it with an official or two independent people.\n• Never send forwarded WhatsApp messages or rumours.\n• Write how you checked it in the private "Sources & evidence" box. Editors read it; readers never see it.\n• Do not copy text or photos from TV, papers or other apps.',
 E'ఒక్క తప్పు వార్త మనందరిపై నమ్మకాన్ని దెబ్బతీస్తుంది.\n\n• మీరు స్వయంగా చూసినది లేదా అధికారి లేదా ఇద్దరు వేర్వేరు వ్యక్తులతో నిర్ధారించుకున్నది మాత్రమే పంపండి.\n• ఫార్వర్డ్ చేసిన వాట్సాప్ సందేశాలు, పుకార్లు ఎప్పుడూ పంపకండి.\n• ఎలా నిర్ధారించారో గోప్యమైన "ఆధారాలు" బాక్స్‌లో రాయండి. ఎడిటర్లు చదువుతారు; పాఠకులకు కనిపించదు.\n• టీవీ, పత్రికలు, ఇతర యాప్‌ల నుంచి వార్తలు, ఫోటోలు కాపీ చేయకండి.',
 '[{"q_en":"You received a shocking WhatsApp forward about your town. What do you do?","q_te":"మీ ఊరి గురించి ఆశ్చర్యకరమైన వాట్సాప్ ఫార్వర్డ్ వచ్చింది. ఏం చేస్తారు?","options":[{"en":"Send it to Chatimpu immediately","te":"వెంటనే చాటింపుకు పంపుతాను"},{"en":"Check it with an official or eyewitnesses first; send only if confirmed","te":"ముందు అధికారి లేదా ప్రత్యక్ష సాక్షులతో నిర్ధారించుకుని, నిజమైతేనే పంపుతాను"},{"en":"Post it on social media","te":"సోషల్ మీడియాలో పెడతాను"}],"answer":1},
   {"q_en":"Can you use a photo from a TV channel''s website?","q_te":"టీవీ ఛానెల్ వెబ్‌సైట్ నుంచి ఫోటో వాడవచ్చా?","options":[{"en":"Yes, if I credit them","te":"అవును, వారి పేరు రాస్తే"},{"en":"No, only my own photos or ones I have permission for","te":"కాదు, నా సొంత ఫోటోలు లేదా అనుమతి ఉన్నవి మాత్రమే"}],"answer":1}]'),
('l3-photos', 3, 'Photos and videos', 'ఫోటోలు, వీడియోలు',
 E'Your own photo makes a story trustworthy and earns more.\n\n• Hold the phone steady; for reels shoot vertical, for photos either way.\n• Show the place and the problem clearly; avoid blurry or dark shots.\n• Ask permission before filming people up close.\n• Never show faces of victims of sexual offences, children in sensitive situations, injured people in distress, or dead bodies.',
 E'మీ సొంత ఫోటో వార్తను నమ్మదగినదిగా చేస్తుంది, ఎక్కువ ఆదాయం ఇస్తుంది.\n\n• ఫోన్‌ను స్థిరంగా పట్టుకోండి; రీల్స్‌కు నిలువుగా, ఫోటోలకు ఎలాగైనా.\n• ప్రదేశం, సమస్య స్పష్టంగా కనిపించాలి; మసక లేదా చీకటి ఫోటోలు వద్దు.\n• వ్యక్తులను దగ్గరగా చిత్రీకరించే ముందు అనుమతి తీసుకోండి.\n• లైంగిక నేరాల బాధితులు, సున్నితమైన పరిస్థితుల్లో పిల్లలు, బాధలో ఉన్న గాయపడినవారు, మృతదేహాల ముఖాలు ఎప్పుడూ చూపకండి.',
 '[{"q_en":"Which photo must you never send?","q_te":"ఏ ఫోటో ఎప్పుడూ పంపకూడదు?","options":[{"en":"A pothole on the main road","te":"ప్రధాన రహదారిపై గుంత"},{"en":"The face of a child victim in a crime case","te":"నేర కేసులో బాధిత చిన్నారి ముఖం"},{"en":"A school building","te":"పాఠశాల భవనం"}],"answer":1},
   {"q_en":"How should you shoot a News Reel?","q_te":"న్యూస్ రీల్‌ను ఎలా చిత్రీకరించాలి?","options":[{"en":"Vertical (portrait), steady","te":"నిలువుగా, స్థిరంగా"},{"en":"Sideways while walking fast","te":"అడ్డంగా, వేగంగా నడుస్తూ"}],"answer":0}]'),
('l4-law', 4, 'Law, fairness and sensitive news', 'చట్టం, న్యాయం, సున్నితమైన వార్తలు',
 E'Some stories can hurt people or break the law if written carelessly.\n\n• Accusations against a named person: write only what police or courts said, and say "accused", never "culprit".\n• Crime, communal, caste, political and health stories are checked by an editor before publishing.\n• Do not identify victims of sexual offences (the law forbids it) or children in conflict with the law.\n• Write calmly: no insults, no guessing motives.',
 E'జాగ్రత్తగా రాయకపోతే కొన్ని వార్తలు వ్యక్తులను బాధిస్తాయి లేదా చట్టాన్ని ఉల్లంఘిస్తాయి.\n\n• పేరున్న వ్యక్తిపై ఆరోపణలు: పోలీసులు లేదా కోర్టులు చెప్పినదే రాయండి, "నిందితుడు" అనండి, "దోషి" అనకండి.\n• నేర, మత, కుల, రాజకీయ, ఆరోగ్య వార్తలను ఎడిటర్ తనిఖీ చేశాకే ప్రచురిస్తాం.\n• లైంగిక నేరాల బాధితుల గుర్తింపు (చట్టం నిషేధిస్తుంది), చట్టంతో సంఘర్షణలో ఉన్న పిల్లల గుర్తింపు బయటపెట్టకండి.\n• ప్రశాంతంగా రాయండి: తిట్లు, ఊహాగానాలు వద్దు.',
 '[{"q_en":"Police arrested a man in a theft case. How do you describe him?","q_te":"దొంగతనం కేసులో పోలీసులు ఒకరిని అరెస్ట్ చేశారు. అతన్ని ఎలా వర్ణిస్తారు?","options":[{"en":"The thief","te":"దొంగ"},{"en":"The accused, as per police","te":"పోలీసుల ప్రకారం నిందితుడు"}],"answer":1},
   {"q_en":"Can you publish the name of a sexual assault victim if the family agrees?","q_te":"కుటుంబం ఒప్పుకుంటే లైంగిక దాడి బాధితురాలి పేరు ప్రచురించవచ్చా?","options":[{"en":"Yes","te":"అవును"},{"en":"No, never identify the victim","te":"కాదు, బాధితురాలిని ఎప్పుడూ గుర్తించేలా రాయకూడదు"}],"answer":1}]'),
('l5-safety', 5, 'Your safety and honesty', 'మీ భద్రత, నిజాయితీ',
 E'No story is worth getting hurt.\n\n• Stay away from fights, fires, floods and crowds that turn violent; report from a safe place.\n• Never take money, gifts or favours to publish or stop a story; report such offers to us.\n• Do not use the Chatimpu name to demand anything from anyone.\n• If you are threatened because of a story, tell us through Help & support.',
 E'ఏ వార్తా మీ ప్రాణం కంటే విలువైనది కాదు.\n\n• గొడవలు, మంటలు, వరదలు, హింసాత్మకంగా మారే గుంపులకు దూరంగా ఉండండి; సురక్షిత ప్రదేశం నుంచి రిపోర్ట్ చేయండి.\n• వార్త ప్రచురించడానికి లేదా ఆపడానికి డబ్బు, బహుమతులు, లాభాలు ఎప్పుడూ తీసుకోకండి; అలాంటి ఆఫర్లను మాకు తెలియజేయండి.\n• ఎవరినీ ఏదీ డిమాండ్ చేయడానికి చాటింపు పేరు వాడకండి.\n• వార్త కారణంగా బెదిరింపులు వస్తే సహాయం విభాగం ద్వారా మాకు చెప్పండి.',
 '[{"q_en":"A shop owner offers ₹500 to publish good news about his shop. What do you do?","q_te":"ఒక దుకాణదారుడు తన దుకాణం గురించి మంచి వార్త రాయమని ₹500 ఇస్తానన్నాడు. ఏం చేస్తారు?","options":[{"en":"Accept, it is good news anyway","te":"తీసుకుంటాను, ఎలాగూ మంచి వార్తే"},{"en":"Refuse and inform Chatimpu","te":"నిరాకరించి చాటింపుకు తెలియజేస్తాను"}],"answer":1},
   {"q_en":"A crowd is turning violent. What is right?","q_te":"గుంపు హింసాత్మకంగా మారుతోంది. ఏది సరైనది?","options":[{"en":"Move to a safe place; report what you can safely","te":"సురక్షిత ప్రదేశానికి వెళ్ళి, సురక్షితంగా చేయగలిగినది రిపోర్ట్ చేయాలి"},{"en":"Go into the middle for the best video","te":"మంచి వీడియో కోసం మధ్యలోకి వెళ్ళాలి"}],"answer":0}]')
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CORRECTIONS & GRIEVANCES (IT Rules 2021: acknowledge within 24 h, dispose within 15 days)
-- ════════════════════════════════════════════════════════════════════════════
insert into app_settings (key, value) values
  ('grievance_officer', '{"name": "", "email": "", "phone": "", "address": ""}')   -- fill in before launch (CMS → Corrections & grievances)
on conflict (key) do nothing;

create table if not exists story_flags (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references stories on delete cascade,
  user_id uuid references profiles on delete set null default auth.uid(),
  reason text not null check (reason in ('wrong_facts', 'misleading', 'offensive', 'privacy', 'copyright', 'duplicate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'corrected', 'dismissed')),
  resolution text, resolved_by uuid references profiles, resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists story_flags_once on story_flags (story_id, user_id) where user_id is not null and status = 'open';
create index if not exists story_flags_open_idx on story_flags (status, created_at);

create sequence if not exists grievance_code_seq;
create table if not exists grievances (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('GRV-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('grievance_code_seq')::text, 5, '0')),
  user_id uuid references profiles on delete set null default auth.uid(),
  name text not null check (char_length(trim(name)) >= 2),
  contact text not null check (char_length(trim(contact)) >= 6),      -- phone or email, never shown publicly
  story_id text references stories on delete set null,
  category text not null check (category in ('content', 'defamation', 'privacy', 'copyright', 'reporter_conduct', 'other')),
  details text not null check (char_length(trim(details)) between 20 and 3000),
  status text not null default 'received' check (status in ('received', 'acknowledged', 'resolved', 'rejected')),
  ack_due_at timestamptz not null default now() + interval '24 hours',
  resolve_due_at timestamptz not null default now() + interval '15 days',
  acknowledged_at timestamptz, resolved_at timestamptz,
  resolution text, handled_by uuid references profiles,
  created_at timestamptz not null default now()
);
create index if not exists grievances_status_idx on grievances (status, created_at);

alter table story_flags enable row level security;
alter table grievances enable row level security;
drop policy if exists flags_staff on story_flags;
create policy flags_staff on story_flags for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor', 'district_moderator'));
drop policy if exists grievance_read on grievances;
create policy grievance_read on grievances for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor'));

/** Readers flag a story (signed-in or not; one open flag per signed-in user per story). */
create or replace function flag_story(p_story text, p_reason text, p_details text) returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if not exists (select 1 from stories where id = p_story and status = 'published') then raise exception 'Story not found'; end if;
  if auth.uid() is null and (select count(*) from story_flags where story_id = p_story and user_id is null and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many reports for this story right now; please try later';
  end if;
  insert into story_flags (story_id, user_id, reason, details) values (p_story, auth.uid(), p_reason, nullif(trim(p_details), ''))
  on conflict do nothing returning id into fid;
  if fid is null then raise exception 'You have already reported this story'; end if;
  if (select count(*) from story_flags where story_id = p_story and status = 'open') = 3 then
    perform notify(u, 'flags', 'Story reported 3 times', 'వార్తపై 3 ఫిర్యాదులు', p_story, null, '/corrections')
    from (select distinct id u from profiles where role in ('super_admin', 'editor')) x;
  end if;
  return fid;
end $$;
grant execute on function flag_story(text, text, text) to anon, authenticated;

create or replace function submit_grievance(p_name text, p_contact text, p_category text, p_details text, p_story text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g grievances;
begin
  if (select count(*) from grievances where contact = trim(p_contact) and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Too many complaints from this contact today';
  end if;
  insert into grievances (name, contact, category, details, story_id) values (trim(p_name), trim(p_contact), p_category, trim(p_details), p_story) returning * into g;
  perform notify(u, 'grievance', 'New grievance ' || g.code || ' — acknowledge within 24 h', 'కొత్త ఫిర్యాదు ' || g.code, left(g.details, 120), null, '/corrections')
  from (select distinct id u from profiles where role in ('super_admin', 'editor')) x;
  if g.user_id is not null then
    perform notify(g.user_id, 'grievance', 'Complaint received · ' || g.code, 'ఫిర్యాదు అందింది · ' || g.code,
      'We will acknowledge within 24 hours and resolve within 15 days.', '24 గంటల్లో స్పందించి, 15 రోజుల్లో పరిష్కరిస్తాం.', null);
  end if;
  return jsonb_build_object('code', g.code, 'ack_due_at', g.ack_due_at, 'resolve_due_at', g.resolve_due_at);
end $$;
grant execute on function submit_grievance(text, text, text, text, text) to anon, authenticated;

create or replace function handle_grievance(p_id uuid, p_status text, p_resolution text) returns grievances language plpgsql security definer set search_path = public as $$
declare g grievances;
begin
  if my_role() not in ('super_admin', 'editor') then raise exception 'Editors only' using errcode = '42501'; end if;
  if p_status not in ('acknowledged', 'resolved', 'rejected') then raise exception 'Unknown status'; end if;
  if p_status in ('resolved', 'rejected') and coalesce(trim(p_resolution), '') = '' then raise exception 'Write the outcome for the complainant'; end if;
  update grievances set status = p_status, handled_by = auth.uid(),
    acknowledged_at = coalesce(acknowledged_at, now()), resolved_at = case when p_status in ('resolved', 'rejected') then now() end,
    resolution = coalesce(nullif(trim(p_resolution), ''), resolution)
  where id = p_id returning * into g;
  if g.id is null then raise exception 'Grievance not found'; end if;
  perform audit('grievance_' || p_status, 'grievances', g.code, jsonb_build_object('resolution', p_resolution));
  if g.user_id is not null then
    perform notify(g.user_id, 'grievance', 'Complaint ' || g.code || ': ' || p_status, 'ఫిర్యాదు ' || g.code || ': ' || p_status, p_resolution, p_resolution, null);
  end if;
  return g;
end $$;

/** Resolve a story flag; "corrected" adds a dated correction note to the story (shown to readers). */
alter table stories add column if not exists correction_note text;
alter table stories add column if not exists corrected_at timestamptz;
create or replace function resolve_story_flag(p_id uuid, p_status text, p_note text) returns void language plpgsql security definer set search_path = public as $$
declare f story_flags; s stories;
begin
  select * into f from story_flags where id = p_id for update;
  if f.id is null then raise exception 'Report not found'; end if;
  select * into s from stories where id = f.story_id;
  if not moderates(s.district_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('corrected', 'dismissed') then raise exception 'Unknown status'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Add a note'; end if;
  update story_flags set status = p_status, resolution = p_note, resolved_by = auth.uid(), resolved_at = now()
  where story_id = f.story_id and status = 'open' and (id = p_id or p_status = 'corrected');
  if p_status = 'corrected' then
    update stories set correction_note = p_note, corrected_at = now() where id = f.story_id;
  end if;
  perform audit('story_flag_' || p_status, 'stories', f.story_id, jsonb_build_object('note', p_note));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. LOCAL INFO: emergency contacts + daily prices (entered by editors; never invented)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists local_contacts (
  id text primary key default gen_random_uuid()::text,
  district_id text references districts,               -- null = national / state helpline
  mandal_id text references mandals,
  kind text not null check (kind in ('emergency', 'police', 'ambulance', 'fire', 'hospital', 'women', 'child', 'cyber', 'electricity', 'water', 'municipal', 'collectorate', 'other')),
  name_te text not null, name_en text not null,
  phone text not null check (phone ~ '^[0-9+ -]{3,20}$'),
  address text,
  sort int not null default 100,
  verified_at date,
  active boolean not null default true
);
alter table local_contacts enable row level security;
drop policy if exists contacts_read on local_contacts;
create policy contacts_read on local_contacts for select using (active or my_role() in ('super_admin', 'editor', 'district_moderator'));
drop policy if exists contacts_write on local_contacts;
create policy contacts_write on local_contacts for all using (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)))
  with check (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)));
-- National helplines (Government of India numbers)
insert into local_contacts (id, kind, name_en, name_te, phone, sort) values
  ('in-112', 'emergency', 'Emergency (all services)', 'అత్యవసర సేవలు (అన్నీ)', '112', 1),
  ('in-100', 'police', 'Police', 'పోలీస్', '100', 2),
  ('in-108', 'ambulance', 'Ambulance', 'అంబులెన్స్', '108', 3),
  ('in-101', 'fire', 'Fire', 'అగ్నిమాపక', '101', 4),
  ('in-181', 'women', 'Women helpline', 'మహిళా హెల్ప్‌లైన్', '181', 5),
  ('in-1098', 'child', 'Childline', 'చైల్డ్‌లైన్', '1098', 6),
  ('in-1930', 'cyber', 'Cyber fraud helpline', 'సైబర్ మోసాల హెల్ప్‌లైన్', '1930', 7)
on conflict (id) do nothing;

create table if not exists daily_prices (
  id uuid primary key default gen_random_uuid(),
  district_id text not null references districts,
  item text not null check (item in ('gold_22k', 'gold_24k', 'silver', 'petrol', 'diesel', 'lpg', 'tomato', 'onion', 'potato', 'chicken', 'mutton', 'egg', 'paddy', 'cotton', 'chilli', 'turmeric')),
  price_paise bigint not null check (price_paise > 0),
  unit text not null,                                   -- e.g. "10 g", "1 kg", "litre", "quintal", "dozen"
  price_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  source text not null check (char_length(trim(source)) >= 3),   -- where the figure came from
  created_by uuid references profiles default auth.uid(),
  created_at timestamptz not null default now(),
  unique (district_id, item, price_date)
);
alter table daily_prices enable row level security;
drop policy if exists prices_read on daily_prices;
create policy prices_read on daily_prices for select using (true);
drop policy if exists prices_write on daily_prices;
create policy prices_write on daily_prices for all using (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)))
  with check (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)));

/** Latest price per item for a district, with the previous one for the up/down arrow. */
create or replace function latest_prices(p_district text) returns table (item text, price_paise bigint, unit text, price_date date, source text, previous_paise bigint)
language sql stable security definer set search_path = public as $$
  select distinct on (p.item) p.item, p.price_paise, p.unit, p.price_date, p.source,
    (select q.price_paise from daily_prices q where q.district_id = p.district_id and q.item = p.item and q.price_date < p.price_date order by q.price_date desc limit 1)
  from daily_prices p where p.district_id = p_district and p.price_date > (now() at time zone 'Asia/Kolkata')::date - 7
  order by p.item, p.price_date desc
$$;
grant execute on function latest_prices(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. COMMUNITY BOARD: obituaries, wishes, jobs, buy & sell, lost & found, events (moderated)
-- ════════════════════════════════════════════════════════════════════════════
insert into app_settings (key, value) values ('community_posts_per_day', '3') on conflict (key) do nothing;
create sequence if not exists community_code_seq;
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CMP-' || lpad(nextval('community_code_seq')::text, 6, '0')),
  kind text not null check (kind in ('obituary', 'wishes', 'job', 'buy_sell', 'lost_found', 'event', 'announcement')),
  district_id text not null references districts,
  mandal_id text references mandals,
  lang text not null default 'te' references languages,
  title text not null check (char_length(trim(title)) between 5 and 120),
  body text not null check (char_length(trim(body)) between 10 and 1000),
  photo_path text,
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9]{10}$'),
  price_paise bigint check (price_paise is null or price_paise >= 0),   -- buy & sell
  event_at timestamptz,                                                  -- events, funerals
  consent_confirmed boolean not null default false,                     -- consent of the people shown / named
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  reject_reason text,
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid not null references profiles default auth.uid(),
  reviewed_by uuid references profiles, reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_feed_idx on community_posts (district_id, status, created_at desc);
alter table community_posts enable row level security;
drop policy if exists community_read on community_posts;
create policy community_read on community_posts for select using (
  (status = 'approved' and expires_at > now()) or created_by = auth.uid() or moderates(district_id));
drop policy if exists community_insert on community_posts;
create policy community_insert on community_posts for insert with check (created_by = auth.uid() and status = 'pending' and consent_confirmed);
drop policy if exists community_own_delete on community_posts;
create policy community_own_delete on community_posts for delete using (created_by = auth.uid() and status = 'pending');

create or replace function community_post_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not moderates(new.district_id) then
    if (select count(*) from community_posts where created_by = auth.uid() and created_at > now() - interval '1 day') >= setting_int('community_posts_per_day', 3) then
      raise exception 'You can post % items a day', setting_int('community_posts_per_day', 3);
    end if;
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
    new.expires_at := now() + case new.kind when 'obituary' then interval '7 days' when 'wishes' then interval '3 days' when 'event' then interval '14 days' else interval '21 days' end;
  end if;
  return new;
end $$;
drop trigger if exists community_post_guard_trg on community_posts;
create trigger community_post_guard_trg before insert on community_posts for each row execute function community_post_guard();

create or replace function moderate_community_post(p_id uuid, p_decision text, p_reason text default null) returns community_posts
language plpgsql security definer set search_path = public as $$
declare c community_posts;
begin
  select * into c from community_posts where id = p_id for update;
  if c.id is null then raise exception 'Post not found'; end if;
  if not moderates(c.district_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'removed') then raise exception 'Unknown decision'; end if;
  if p_decision <> 'approved' and coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason'; end if;
  update community_posts set status = p_decision, reject_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id returning * into c;
  perform notify(c.created_by, 'community', case when p_decision = 'approved' then 'Your post is live · ' else 'Your post was not approved · ' end || c.code,
    case when p_decision = 'approved' then 'మీ పోస్ట్ ప్రచురించబడింది · ' else 'మీ పోస్ట్ ఆమోదించబడలేదు · ' end || c.code, coalesce(p_reason, c.title), coalesce(p_reason, c.title), null);
  return c;
end $$;
