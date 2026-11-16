import type { Ad, CitizenSubmission, LocalAlert, Magazine, Poll, VideoStory } from './types';

const inH = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const agoH = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const pic = (seed: string, w = 900, h = 1400) => `https://picsum.photos/seed/chatimpu-${seed}/${w}/${h}`;

export const POLLS: Poll[] = [
  {
    id: 'poll-metro-night', category: 'politics', closesAt: inH(30),
    question: { en: 'Should city buses and metro run till 1 AM on weekends?', te: 'వీకెండ్‌లో సిటీ బస్సులు, మెట్రో రాత్రి 1 వరకు నడపాలా?' },
    options: [
      { id: 'yes', label: { en: 'Yes, every weekend', te: 'అవును, ప్రతి వీకెండ్' } },
      { id: 'fest', label: { en: 'Only during festivals', te: 'పండుగల సమయంలో మాత్రమే' } },
      { id: 'no', label: { en: 'No, not needed', te: 'అవసరం లేదు' } },
    ],
    votes: {
      national: { yes: 18420, fest: 6210, no: 3120 },
      hyd: { yes: 9200, fest: 2100, no: 900 },
      wgl: { yes: 1200, fest: 1400, no: 800 },
      vsp: { yes: 2400, fest: 1300, no: 600 },
    },
  },
  {
    id: 'poll-plastic', category: 'politics', closesAt: inH(54),
    question: { en: 'Will a ₹5,000 fine stop plastic on our beaches?', te: '₹5,000 జరిమానాతో బీచ్‌లలో ప్లాస్టిక్ ఆగుతుందా?' },
    options: [
      { id: 'yes', label: { en: 'Yes, strict fines work', te: 'అవును, కఠిన జరిమానాలు పనిచేస్తాయి' } },
      { id: 'aware', label: { en: 'Awareness matters more', te: 'అవగాహన ముఖ్యం' } },
      { id: 'both', label: { en: 'Need both', te: 'రెండూ అవసరం' } },
    ],
    votes: {
      national: { yes: 4200, aware: 3900, both: 9100 },
      hyd: { yes: 800, aware: 700, both: 1900 },
      wgl: { yes: 300, aware: 500, both: 700 },
      vsp: { yes: 2100, aware: 1400, both: 3800 },
    },
  },
  {
    id: 'poll-msp', category: 'agriculture', closesAt: inH(12),
    question: { en: 'Is the current cotton price fair for farmers?', te: 'ప్రస్తుత పత్తి ధర రైతులకు న్యాయమేనా?' },
    options: [
      { id: 'fair', label: { en: 'Fair', te: 'న్యాయమే' } },
      { id: 'low', label: { en: 'Still too low', te: 'ఇంకా తక్కువే' } },
      { id: 'unsure', label: { en: 'Not sure', te: 'చెప్పలేను' } },
    ],
    votes: {
      national: { fair: 2200, low: 8700, unsure: 1300 },
      hyd: { fair: 400, low: 900, unsure: 300 },
      wgl: { fair: 900, low: 4100, unsure: 400 },
      vsp: { fair: 300, low: 800, unsure: 200 },
    },
  },
];

export const MAGAZINES: Magazine[] = [
  {
    id: 'mag-travel', theme: 'travel', cover: pic('mag-travel', 900, 1200),
    title: { en: 'Weekend Escapes', te: 'వీకెండ్ విహారాలు' },
    subtitle: { en: 'Forts, beaches and hill roads within 200 km', te: '200 కి.మీ. లోపు కోటలు, బీచ్‌లు, ఘాట్ రోడ్లు' },
    storyIds: ['wgl-temple-lights', 'vsp-beach-marathon', 'vsp-simhachalam-darshan', 'wgl-kabaddi-league'],
  },
  {
    id: 'mag-health', theme: 'health', cover: pic('mag-health', 900, 1200),
    title: { en: 'Healthy Season', te: 'ఆరోగ్య సీజన్' },
    subtitle: { en: 'Monsoon fevers, eye care and staying fit', te: 'వర్షాకాలపు జ్వరాలు, కంటి సంరక్షణ, ఫిట్‌నెస్' },
    storyIds: ['wgl-dengue-drive', 'hyd-eye-camp', 'vsp-beach-marathon'],
  },
  {
    id: 'mag-finance', theme: 'finance', cover: pic('mag-finance', 900, 1200),
    title: { en: 'Money Matters', te: 'డబ్బు సంగతులు' },
    subtitle: { en: 'Jobs, crop prices and staying safe from scams', te: 'ఉద్యోగాలు, పంట ధరలు, మోసాల నుంచి రక్షణ' },
    storyIds: ['hyd-job-mela', 'vsp-it-campus', 'wgl-cotton-price', 'hyd-cyber-scam', 'vsp-port-record'],
  },
];

export const ALERTS: LocalAlert[] = [
  { id: 'al-1', kind: 'power', districtId: 'hyd', mandalId: 'hyd-amp', lat: 17.44, lng: 78.445, severity: 'warning', startsAt: inH(2), endsAt: inH(5),
    title: { en: 'Scheduled power cut: SR Nagar, Ameerpet', te: 'షెడ్యూల్డ్ కరెంట్ కోత: ఎస్‌ఆర్ నగర్, అమీర్‌పేట' },
    detail: { en: '10 AM – 1 PM for feeder maintenance', te: 'ఫీడర్ నిర్వహణ కోసం ఉదయం 10 – మధ్యాహ్నం 1' } },
  { id: 'al-2', kind: 'water', districtId: 'hyd', mandalId: 'hyd-sec', lat: 17.445, lng: 78.505, severity: 'info', startsAt: inH(20),
    title: { en: 'No water supply in Marredpally tomorrow', te: 'రేపు మారేడ్‌పల్లిలో నీటి సరఫరా ఉండదు' },
    detail: { en: 'Pipeline repair; tankers on request via 155313', te: 'పైప్‌లైన్ మరమ్మతు; 155313కు కాల్ చేస్తే ట్యాంకర్' } },
  { id: 'al-3', kind: 'traffic', districtId: 'hyd', mandalId: 'hyd-khr', lat: 17.41, lng: 78.46, severity: 'warning', startsAt: agoH(1),
    title: { en: 'Waterlogging at Panjagutta flyover', te: 'పంజాగుట్ట ఫ్లైఓవర్ వద్ద నీరు నిలిచింది' },
    detail: { en: 'Expect 25-min delays; use Somajiguda route', te: '25 నిమిషాల ఆలస్యం; సోమాజిగూడ మార్గం వాడండి' } },
  { id: 'al-4', kind: 'weather', districtId: 'vsp', mandalId: 'vsp-bhm', lat: 17.89, lng: 83.45, severity: 'critical', startsAt: agoH(2),
    title: { en: 'Cyclonic winds 55–65 km/h on the coast', te: 'తీరంలో గంటకు 55–65 కి.మీ. గాలులు' },
    detail: { en: 'Fishermen: do not venture out for 72 hours', te: 'మత్స్యకారులు 72 గంటలు వేటకు వెళ్లొద్దు' } },
  { id: 'al-5', kind: 'events', districtId: 'vsp', mandalId: 'vsp-msp', lat: 17.714, lng: 83.323, severity: 'info', startsAt: inH(60),
    title: { en: 'Beach Road closed for marathon (Sun)', te: 'మారథాన్ కోసం బీచ్ రోడ్ మూసివేత (ఆది)' },
    detail: { en: '4 AM – 10 AM. Use Siripuram route', te: 'ఉదయం 4 – 10. సిరిపురం మార్గం వాడండి' } },
  { id: 'al-6', kind: 'jobs', districtId: 'vsp', mandalId: 'vsp-msp', lat: 17.78, lng: 83.38, severity: 'info', startsAt: inH(300),
    title: { en: 'IT recruitment drive — 2,000 freshers', te: 'ఐటీ నియామక డ్రైవ్ — 2,000 ఫ్రెషర్లు' },
    detail: { en: 'Nov 28, Rushikonda IT Park', te: 'నవంబర్ 28, రుషికొండ ఐటీ పార్క్' } },
  { id: 'al-7', kind: 'power', districtId: 'wgl', mandalId: 'wgl-hnk', lat: 18.0, lng: 79.56, severity: 'info', startsAt: inH(26),
    title: { en: 'Power shutdown in Subedari', te: 'సుబేదారిలో విద్యుత్ నిలిపివేత' },
    detail: { en: 'Thu 9 AM – 12 PM, line shifting', te: 'గురు ఉదయం 9 – 12, లైన్ మార్పు' } },
  { id: 'al-8', kind: 'weather', districtId: 'wgl', mandalId: 'wgl-nsp', lat: 17.93, lng: 79.89, severity: 'warning', startsAt: agoH(3),
    title: { en: 'Dense fog on Narsampet highway', te: 'నర్సంపేట హైవేపై దట్టమైన పొగమంచు' },
    detail: { en: '5–8:30 AM, visibility < 50 m', te: 'ఉదయం 5–8:30, దృశ్యమానత 50 మీ. లోపు' } },
  { id: 'al-9', kind: 'events', districtId: 'wgl', mandalId: 'wgl-wgl', lat: 17.958, lng: 79.613, severity: 'info', startsAt: inH(40),
    title: { en: 'Kakatiya Kabaddi League opener', te: 'కాకతీయ కబడ్డీ లీగ్ ప్రారంభం' },
    detail: { en: 'Fri 6 PM, Fort grounds, free entry', te: 'శుక్ర సాయంత్రం 6, కోట మైదానం, ఉచితం' } },
];

export const ADS: Ad[] = [
  { id: 'ad-jewel', advertiser: 'Sri Lakshmi Jewellers', districtIds: ['hyd', 'wgl'], image: pic('ad-jewel'), status: 'active',
    headline: { en: 'Karthika gold festival', te: 'కార్తీక బంగారు ఉత్సవం' },
    body: { en: 'Zero making charges on temple jewellery till Sunday. Abids · Hanamkonda.', te: 'ఆదివారం వరకు టెంపుల్ జ్యువెలరీపై తయారీ ఛార్జీలు లేవు. ఆబిడ్స్ · హనుమకొండ.' },
    cta: { en: 'Get directions', te: 'దారి చూపించు' }, url: 'https://example.com/jewel', phone: '+914023456789',
    impressions: 182000, clicks: 4100, budgetInr: 150000 },
  { id: 'ad-coaching', advertiser: 'Vizag Academy', districtIds: ['vsp'], image: pic('ad-coaching'), status: 'active',
    headline: { en: 'Crack Group-2 in 120 days', te: '120 రోజుల్లో గ్రూప్-2 సాధించండి' },
    body: { en: 'Telugu-medium batches. Free demo class every Saturday at MVP Colony.', te: 'తెలుగు మీడియం బ్యాచ్‌లు. ప్రతి శనివారం ఎంవీపీ కాలనీలో ఉచిత డెమో.' },
    cta: { en: 'Call now', te: 'ఇప్పుడే కాల్ చేయండి' }, url: 'https://example.com/academy', phone: '+918912345678',
    impressions: 64000, clicks: 2300, budgetInr: 60000 },
  { id: 'ad-tractor', advertiser: 'Kisan Tractors', districtIds: 'all', image: pic('ad-tractor'), status: 'active',
    headline: { en: 'Own a tractor at ₹9,999 EMI', te: '₹9,999 ఈఎంఐతో ట్రాక్టర్ మీ సొంతం' },
    body: { en: 'Festive offer with free rotavator. Test drive at your nearest dealer.', te: 'ఉచిత రోటవేటర్‌తో పండుగ ఆఫర్. సమీప డీలర్ వద్ద టెస్ట్ డ్రైవ్.' },
    cta: { en: 'Book test drive', te: 'టెస్ట్ డ్రైవ్ బుక్ చేయండి' }, url: 'https://example.com/tractor',
    impressions: 240000, clicks: 3900, budgetInr: 300000 },
];

const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
export const VIDEOS: VideoStory[] = [
  { id: 'vid-1', storyId: 'vsp-depression-warning', uri: `${SAMPLE}/ForBiggerBlazes.mp4`, poster: pic('vid-1'), districtId: 'vsp', category: 'weather', durationSec: 15, likes: 8200, shares: 2100,
    caption: { en: 'Rough seas at Bheemunipatnam as the depression nears', te: 'వాయుగుండం సమీపిస్తుండటంతో భీమునిపట్నం వద్ద అల్లకల్లోలంగా సముద్రం' },
    subtitles: [
      { at: 0, text: { en: 'Waves up to 3 metres reported near the harbour', te: 'హార్బర్ వద్ద 3 మీటర్ల ఎత్తు అలలు' } },
      { at: 5, text: { en: 'Boats pulled ashore; 72-hour fishing ban', te: 'పడవలు ఒడ్డుకు; 72 గంటల వేట నిషేధం' } },
      { at: 10, text: { en: 'Relief centres open in 26 villages', te: '26 గ్రామాల్లో పునరావాస కేంద్రాలు' } },
    ] },
  { id: 'vid-2', storyId: 'wgl-temple-lights', uri: `${SAMPLE}/ForBiggerEscapes.mp4`, poster: pic('vid-2'), districtId: 'wgl', category: 'devotional', durationSec: 15, likes: 12400, shares: 5300,
    caption: { en: '10,000 lamps light up the Thousand Pillar Temple', te: '10 వేల దీపాల వెలుగులో వేయి స్తంభాల గుడి' },
    subtitles: [
      { at: 0, text: { en: 'Preparations begin at dawn', te: 'తెల్లవారుజాము నుంచే ఏర్పాట్లు' } },
      { at: 6, text: { en: 'Volunteers place lamps on every pillar', te: 'ప్రతి స్తంభంపై దీపాలు ఉంచుతున్న వాలంటీర్లు' } },
    ] },
  { id: 'vid-3', storyId: 'hyd-u19-cricket', uri: `${SAMPLE}/ForBiggerFun.mp4`, poster: pic('vid-3'), districtId: 'hyd', category: 'sports', durationSec: 60, likes: 6100, shares: 980,
    caption: { en: 'Last-ball six seals the U-19 title for Secunderabad', te: 'చివరి బంతికి సిక్సర్‌తో సికింద్రాబాద్‌కు అండర్-19 టైటిల్' },
    subtitles: [
      { at: 0, text: { en: '6 needed off the final ball…', te: 'చివరి బంతికి 6 పరుగులు కావాలి…' } },
      { at: 4, text: { en: 'And it sails over long-on!', te: 'లాంగ్-ఆన్ మీదుగా సిక్సర్!' } },
    ] },
  { id: 'vid-4', storyId: 'hyd-rain-alert', uri: `${SAMPLE}/ForBiggerJoyrides.mp4`, poster: pic('vid-4'), districtId: 'hyd', category: 'weather', durationSec: 15, likes: 9300, shares: 4100,
    caption: { en: 'Evening downpour floods Raj Bhavan Road', te: 'సాయంత్రం కుండపోత: రాజ్‌భవన్ రోడ్ జలమయం' },
    subtitles: [{ at: 0, text: { en: 'GHMC teams clearing drains', te: 'కాలువలు శుభ్రం చేస్తున్న జీహెచ్‌ఎంసీ బృందాలు' } }] },
  { id: 'vid-5', storyId: 'vsp-film-shoot', uri: `${SAMPLE}/ForBiggerMeltdowns.mp4`, poster: pic('vid-5'), districtId: 'vsp', category: 'cinema', durationSec: 15, likes: 15800, shares: 6200,
    caption: { en: 'Inside the 1940s harbour set built on Vizag coast', te: 'విశాఖ తీరంలో 1940ల నాటి హార్బర్ సెట్' },
    subtitles: [{ at: 0, text: { en: '600 locals are working on the set', te: 'సెట్‌లో 600 మంది స్థానికులు' } }] },
];

export const SUBMISSIONS: CitizenSubmission[] = [
  { id: 'sub-1', reporterName: 'Mahesh Goud', reporterPhone: '98480xxxxx', verified: true, lang: 'te', category: 'crime', districtId: 'hyd', mandalId: 'hyd-cha',
    headline: 'పాతబస్తీలో రాత్రి వేళ వీధి దీపాలు పనిచేయడం లేదు', body: 'పత్తర్‌గట్టి నుంచి గుల్జార్ హౌస్ వరకు గత పది రోజులుగా వీధి దీపాలు వెలగడం లేదు. రాత్రి వేళ మహిళలు, వృద్ధులు నడవడానికి భయపడుతున్నారు. జీహెచ్‌ఎంసీకి ఫిర్యాదు చేసినా స్పందన లేదు.',
    media: [pic('sub-1', 800, 600)], submittedAt: agoH(1), status: 'pending' },
  { id: 'sub-2', reporterName: 'Lakshmi Prasanna', reporterPhone: '90000xxxxx', verified: true, lang: 'en', category: 'education', districtId: 'wgl', mandalId: 'wgl-nsp',
    headline: 'Chennaraopet school gets its first science lab, built by alumni', body: 'Former students of the zilla parishad high school in Chennaraopet pooled ₹6 lakh to build a fully equipped science lab, which was inaugurated today by the headmaster. Around 420 students will now be able to do practicals on campus instead of travelling to Narsampet.',
    media: [pic('sub-2', 800, 600), pic('sub-2b', 800, 600)], submittedAt: agoH(3), status: 'pending' },
  { id: 'sub-3', reporterName: 'Unknown user', reporterPhone: '70000xxxxx', verified: false, lang: 'en', category: 'politics', districtId: 'vsp', mandalId: 'vsp-gjw',
    headline: 'SHOCKING!!! Leader caught on camera — share before deleted', body: 'Forward this to everyone. Video proof coming soon.',
    media: [], submittedAt: agoH(5), status: 'pending', aiFlags: ['clickbait', 'unverified claim', 'no media'] },
  { id: 'sub-4', reporterName: 'S. Venkat Rao', reporterPhone: '94400xxxxx', verified: true, lang: 'te', category: 'agriculture', districtId: 'vsp', mandalId: 'vsp-pdr',
    headline: 'పెందుర్తిలో వరి కోతలకు యంత్రాల కొరత', body: 'కోతల సీజన్ మొదలైనా పెందుర్తి మండలంలో హార్వెస్టర్లు దొరకడం లేదు. గంటకు ₹3,200 అడుగుతున్నారని, వర్షాలు వస్తే పంట నష్టపోతామని రైతులు ఆందోళన చెందుతున్నారు.',
    media: [pic('sub-4', 800, 600)], submittedAt: agoH(7), status: 'pending' },
];

/** 14-day analytics series for the CMS dashboard */
export const ANALYTICS = Array.from({ length: 14 }, (_, i) => {
  const base = 42000 + i * 1800;
  const wobble = Math.round(Math.sin(i * 1.3) * 5200);
  return {
    day: new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10),
    views: base + wobble,
    flips: Math.round((base + wobble) * 6.4),
    shares: Math.round((base + wobble) * 0.052),
    dau: Math.round((base + wobble) / 3.1),
    retentionD7: 0.34 + (i % 4) * 0.012,
  };
});

export const DISTRICT_STATS = [
  { districtId: 'hyd', views: 412000, flips: 2710000, shares: 23100, retention: 0.41, readers: 128000 },
  { districtId: 'vsp', views: 268000, flips: 1690000, shares: 19800, retention: 0.38, readers: 82000 },
  { districtId: 'wgl', views: 174000, flips: 1120000, shares: 11200, retention: 0.36, readers: 51000 },
];
