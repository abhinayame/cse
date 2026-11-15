/**
 * Sample stories — 24 across Hyderabad, Warangal and Visakhapatnam, each in English and Telugu.
 * All events, people and figures are illustrative sample content, not real reporting.
 * Images use the picsum.photos placeholder CDN; production uses the image CDN (see README).
 */
import type { CategoryId, Story, StoryText } from './types';

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const img = (seed: string) => `https://picsum.photos/seed/vaarta-${seed}/900/1400`;

type Def = {
  id: string; cat: CategoryId; st: 'tg' | 'ap'; d: string; m: string; v?: string;
  lat: number; lng: number; src: string; min: number;
  en: StoryText; te: StoryText;
  breaking?: boolean; trending?: boolean; sponsor?: string;
  reporter?: Story['reporter']; r?: [number, number, number, number]; c?: number; sh?: number; vw?: number;
};

const mk = (x: Def): Story => ({
  id: x.id, category: x.cat, stateId: x.st, districtId: x.d, mandalId: x.m, villageId: x.v,
  lat: x.lat, lng: x.lng, image: img(x.id), source: x.src, publishedAt: ago(x.min),
  isBreaking: x.breaking, isTrending: x.trending, sponsor: x.sponsor, reporter: x.reporter,
  reactions: { like: x.r?.[0] ?? 120, wow: x.r?.[1] ?? 14, sad: x.r?.[2] ?? 3, angry: x.r?.[3] ?? 2 },
  comments: x.c ?? 18, shares: x.sh ?? 64, views: x.vw ?? 4200,
  content: { en: x.en, te: x.te },
});

export const STORIES: Story[] = [
  // ───────────────────────── HYDERABAD ─────────────────────────
  mk({
    id: 'hyd-rain-alert', cat: 'weather', st: 'tg', d: 'hyd', m: 'hyd-khr', v: 'v-bjh', lat: 17.414, lng: 78.448,
    src: 'Vaarta Desk', min: 12, breaking: true, trending: true, r: [842, 210, 96, 31], c: 146, sh: 1290, vw: 48200,
    en: {
      headline: 'Orange alert for Hyderabad as heavy rain is forecast through Tuesday night',
      summary: 'The weather department has issued an orange alert for Hyderabad, forecasting 80–110 mm of rain in parts of Khairatabad, Banjara Hills and Ameerpet until Tuesday night. GHMC has placed 160 monsoon emergency teams on standby and asked residents in low-lying colonies to avoid basements. Commuters are advised to plan for waterlogging near Raj Bhavan Road and Panjagutta. The helpline 040-2111-1111 will run round the clock.',
    },
    te: {
      headline: 'హైదరాబాద్‌కు ఆరెంజ్ అలర్ట్: మంగళవారం రాత్రి వరకు భారీ వర్షాలు',
      summary: 'మంగళవారం రాత్రి వరకు ఖైరతాబాద్, బంజారాహిల్స్, అమీర్‌పేట ప్రాంతాల్లో 80–110 మి.మీ. వర్షపాతం నమోదయ్యే అవకాశం ఉందని వాతావరణ శాఖ ఆరెంజ్ అలర్ట్ జారీ చేసింది. జీహెచ్‌ఎంసీ 160 మాన్సూన్ అత్యవసర బృందాలను సిద్ధంగా ఉంచింది. లోతట్టు కాలనీల ప్రజలు సెల్లార్లకు దూరంగా ఉండాలని సూచించింది. రాజ్‌భవన్ రోడ్, పంజాగుట్ట వద్ద నీరు నిలిచే అవకాశం ఉన్నందున ప్రయాణికులు ముందుగా ప్లాన్ చేసుకోవాలి. హెల్ప్‌లైన్ 040-2111-1111 ఇరవై నాలుగు గంటలు పనిచేస్తుంది.',
    },
  }),
  mk({
    id: 'hyd-job-mela', cat: 'jobs', st: 'tg', d: 'hyd', m: 'hyd-amp', v: 'v-srn', lat: 17.443, lng: 78.443,
    src: 'Telangana Employment Cell', min: 55, trending: true, r: [1530, 120, 8, 12], c: 312, sh: 2840, vw: 61000,
    en: {
      headline: 'Mega job mela in Ameerpet on Saturday with 4,200 openings across 65 companies',
      summary: 'A district employment fair at the SR Nagar community hall this Saturday will offer 4,200 vacancies from 65 companies in IT support, retail, banking, logistics and healthcare. Candidates aged 18 to 35 with SSC, intermediate, ITI, diploma or degree qualifications can attend from 9 AM. Bring five copies of your résumé, Aadhaar and certificates. Registration is free and spot offers will be issued for several roles.',
    },
    te: {
      headline: 'శనివారం అమీర్‌పేటలో మెగా జాబ్ మేళా: 65 కంపెనీల్లో 4,200 ఉద్యోగాలు',
      summary: 'ఈ శనివారం ఎస్‌ఆర్ నగర్ కమ్యూనిటీ హాల్‌లో జరిగే జిల్లా ఉపాధి మేళాలో ఐటీ సపోర్ట్, రిటైల్, బ్యాంకింగ్, లాజిస్టిక్స్, ఆరోగ్య రంగాలకు చెందిన 65 కంపెనీలు 4,200 ఖాళీలను భర్తీ చేయనున్నాయి. పదో తరగతి, ఇంటర్, ఐటీఐ, డిప్లొమా లేదా డిగ్రీ చదివిన 18 నుంచి 35 ఏళ్ల అభ్యర్థులు ఉదయం 9 గంటల నుంచి హాజరుకావచ్చు. ఐదు రెజ్యూమె ప్రతులు, ఆధార్, సర్టిఫికెట్లు తీసుకురావాలి. నమోదు ఉచితం, కొన్ని పోస్టులకు అక్కడికక్కడే ఆఫర్ లెటర్లు ఇస్తారు.',
    },
  }),
  mk({
    id: 'hyd-cyber-scam', cat: 'crime', st: 'tg', d: 'hyd', m: 'hyd-sec', v: 'v-mrd', lat: 17.448, lng: 78.507,
    src: 'Hyderabad City Police', min: 95, r: [640, 180, 70, 210], c: 88, sh: 1960,
    en: {
      headline: 'Cyber police warn of fake electricity-bill SMS after 37 residents lose ₹14 lakh',
      summary: 'Hyderabad cyber crime police have flagged a wave of fraudulent SMS messages claiming that power will be disconnected tonight unless an "overdue bill" is paid through a link. Thirty-seven residents of Secunderabad and Marredpally lost a combined ₹14 lakh after installing a remote-access app. Police said the power utility never sends payment links by SMS. Victims should call 1930 immediately or file a complaint on the national cyber crime portal.',
    },
    te: {
      headline: 'నకిలీ కరెంట్ బిల్లు ఎస్‌ఎంఎస్‌లతో జాగ్రత్త: 37 మంది ₹14 లక్షలు కోల్పోయారు',
      summary: '"బకాయి బిల్లు" చెల్లించకపోతే ఈ రాత్రి కరెంట్ కట్ అవుతుందంటూ లింక్‌తో వస్తున్న నకిలీ ఎస్‌ఎంఎస్‌లపై హైదరాబాద్ సైబర్ క్రైమ్ పోలీసులు హెచ్చరించారు. రిమోట్ యాక్సెస్ యాప్ ఇన్‌స్టాల్ చేసిన సికింద్రాబాద్, మారేడ్‌పల్లికి చెందిన 37 మంది మొత్తం ₹14 లక్షలు నష్టపోయారు. విద్యుత్ సంస్థ ఎప్పుడూ ఎస్‌ఎంఎస్ ద్వారా పేమెంట్ లింక్‌లు పంపదని పోలీసులు స్పష్టం చేశారు. బాధితులు వెంటనే 1930కు కాల్ చేయాలి లేదా జాతీయ సైబర్ క్రైమ్ పోర్టల్‌లో ఫిర్యాదు చేయాలి.',
    },
  }),
  mk({
    id: 'hyd-film-fest', cat: 'cinema', st: 'tg', d: 'hyd', m: 'hyd-khr', lat: 17.405, lng: 78.466,
    src: 'Vaarta Cinema', min: 180, r: [910, 140, 4, 3], c: 64, sh: 720,
    en: {
      headline: 'Telugu film heritage week opens at Ravindra Bharathi with restored black-and-white classics',
      summary: 'A week-long Telugu film heritage festival begins at Ravindra Bharathi on Friday, screening twelve digitally restored classics from the 1950s and 60s. Entry is free on a first-come basis, with shows at 3 PM and 6:30 PM daily. Film historians and veteran technicians will hold talks after the evening screenings on how songs were recorded live on set. Organisers expect over 8,000 visitors, including students from city film schools.',
    },
    te: {
      headline: 'రవీంద్రభారతిలో తెలుగు సినిమా వారసత్వ వారోత్సవం: పునరుద్ధరించిన క్లాసిక్స్ ప్రదర్శన',
      summary: 'శుక్రవారం నుంచి రవీంద్రభారతిలో వారం రోజుల తెలుగు సినిమా వారసత్వ ఉత్సవం ప్రారంభమవుతుంది. 1950, 60 దశకాలకు చెందిన పన్నెండు క్లాసిక్ చిత్రాలను డిజిటల్‌గా పునరుద్ధరించి ప్రదర్శిస్తారు. ప్రవేశం ఉచితం, ముందుగా వచ్చినవారికి ప్రాధాన్యం. రోజూ మధ్యాహ్నం 3, సాయంత్రం 6:30కు షోలు ఉంటాయి. సాయంత్రం ప్రదర్శనల తర్వాత సినీ చరిత్రకారులు, సీనియర్ సాంకేతిక నిపుణులు సెట్‌లోనే పాటలు ఎలా రికార్డ్ చేసేవారో వివరిస్తారు.',
    },
  }),
  mk({
    id: 'hyd-eye-camp', cat: 'health', st: 'tg', d: 'hyd', m: 'hyd-cha', v: 'v-pth', lat: 17.361, lng: 78.474,
    src: 'Citizen Reporter', min: 240, reporter: { name: 'Ayesha Fatima', verified: true, citizen: true }, r: [520, 30, 2, 1], c: 41, sh: 380,
    en: {
      headline: 'Free eye-screening camp near Charminar checks 1,100 elders; 140 referred for cataract surgery',
      summary: 'A two-day free eye camp organised by a local trust and the area primary health centre at Pathergatti screened over 1,100 senior citizens. Doctors found that 140 people needed cataract surgery, which will be performed free at a government hospital over the next three weeks. Volunteers also distributed 600 pairs of reading glasses. The organisers plan to hold the camp every quarter in different old-city neighbourhoods.',
    },
    te: {
      headline: 'చార్మినార్ వద్ద ఉచిత కంటి శిబిరం: 1,100 మంది వృద్ధులకు పరీక్షలు, 140 మందికి శస్త్రచికిత్స',
      summary: 'పత్తర్‌గట్టిలో స్థానిక ట్రస్ట్, ప్రాథమిక ఆరోగ్య కేంద్రం సంయుక్తంగా నిర్వహించిన రెండు రోజుల ఉచిత కంటి శిబిరంలో 1,100 మందికి పైగా వృద్ధులకు పరీక్షలు చేశారు. 140 మందికి క్యాటరాక్ట్ శస్త్రచికిత్స అవసరమని వైద్యులు గుర్తించారు. వచ్చే మూడు వారాల్లో ప్రభుత్వ ఆసుపత్రిలో ఉచితంగా ఆపరేషన్లు చేస్తారు. వాలంటీర్లు 600 జతల రీడింగ్ కళ్లద్దాలు కూడా పంపిణీ చేశారు. ప్రతి మూడు నెలలకు ఒకసారి పాతబస్తీలోని వేర్వేరు ప్రాంతాల్లో శిబిరం నిర్వహిస్తామని తెలిపారు.',
    },
  }),
  mk({
    id: 'hyd-u19-cricket', cat: 'sports', st: 'tg', d: 'hyd', m: 'hyd-sec', lat: 17.441, lng: 78.501,
    src: 'Vaarta Sports', min: 320, r: [700, 90, 10, 4], c: 52, sh: 410,
    en: {
      headline: 'Secunderabad girls clinch inter-district U-19 cricket title with last-ball six',
      summary: 'Secunderabad\'s under-19 girls team won the inter-district T20 championship at the Gymkhana Ground, chasing 148 against Warangal with a six off the final delivery. Opener Sravya Reddy top-scored with 61 from 44 balls, while left-arm spinner Nikhitha took three wickets. Four players from the squad have been shortlisted for the state camp next month. The association announced a cash award of ₹1 lakh for the team.',
    },
    te: {
      headline: 'చివరి బంతికి సిక్సర్: అంతర్ జిల్లా అండర్-19 క్రికెట్ టైటిల్ సికింద్రాబాద్ అమ్మాయిలదే',
      summary: 'జింఖానా మైదానంలో జరిగిన అంతర్ జిల్లా టీ20 ఛాంపియన్‌షిప్ ఫైనల్లో సికింద్రాబాద్ అండర్-19 బాలికల జట్టు వరంగల్‌పై 148 పరుగుల లక్ష్యాన్ని చివరి బంతికి సిక్సర్‌తో ఛేదించింది. ఓపెనర్ శ్రావ్య రెడ్డి 44 బంతుల్లో 61 పరుగులతో టాప్ స్కోరర్‌గా నిలిచింది. ఎడమచేతి స్పిన్నర్ నిఖిత మూడు వికెట్లు తీసింది. జట్టులోని నలుగురు క్రీడాకారిణులు వచ్చే నెల రాష్ట్ర శిబిరానికి ఎంపికయ్యారు. అసోసియేషన్ జట్టుకు ₹1 లక్ష నగదు బహుమతి ప్రకటించింది.',
    },
  }),
  mk({
    id: 'hyd-voice-farm', cat: 'tech', st: 'tg', d: 'hyd', m: 'hyd-amp', v: 'v-bkp', lat: 17.444, lng: 78.467,
    src: 'Vaarta Tech', min: 410, trending: true, r: [1210, 330, 2, 6], c: 97, sh: 1480,
    en: {
      headline: 'Begumpet startup\'s Telugu voice assistant answers crop questions for 60,000 farmers',
      summary: 'A Begumpet-based startup has built a Telugu voice assistant that lets farmers ask about pests, fertiliser doses and market prices by simply calling a toll-free number. More than 60,000 farmers across nine districts have used it since June, asking around 4,000 questions a day. The founders say answers are reviewed by agricultural scientists every week. They now plan to add Kannada and Marathi support before the rabi season.',
    },
    te: {
      headline: '60 వేల మంది రైతులకు బేగంపేట స్టార్టప్ తెలుగు వాయిస్ అసిస్టెంట్ సమాధానాలు',
      summary: 'టోల్‌ఫ్రీ నంబర్‌కు కాల్ చేసి పురుగులు, ఎరువుల మోతాదు, మార్కెట్ ధరల గురించి తెలుగులో అడిగే వాయిస్ అసిస్టెంట్‌ను బేగంపేటకు చెందిన ఓ స్టార్టప్ రూపొందించింది. జూన్ నుంచి తొమ్మిది జిల్లాల్లో 60 వేల మందికి పైగా రైతులు దీన్ని ఉపయోగించారు. రోజుకు సుమారు 4,000 ప్రశ్నలు వస్తున్నాయి. సమాధానాలను ప్రతి వారం వ్యవసాయ శాస్త్రవేత్తలు సమీక్షిస్తారని వ్యవస్థాపకులు చెప్పారు. రబీ సీజన్‌కు ముందే కన్నడ, మరాఠీ భాషలను జోడించాలని యోచిస్తున్నారు.',
    },
  }),
  mk({
    id: 'hyd-bakery-sponsored', cat: 'business', st: 'tg', d: 'hyd', m: 'hyd-amp', v: 'v-bkp', lat: 17.446, lng: 78.47,
    src: 'Sponsored', min: 460, sponsor: 'Irani Chai House, Begumpet', r: [210, 12, 0, 1], c: 9, sh: 75,
    en: {
      headline: 'A 1962 Begumpet Irani café reopens after restoration — with its original Osmania biscuit recipe',
      summary: 'Irani Chai House in Begumpet has reopened after a six-month restoration that preserved its bentwood chairs, marble tables and hand-painted signboard. The third-generation owners still bake Osmania biscuits and dil kush in the original wood-fired oven every morning at 5 AM. To celebrate, the café is offering a free biscuit with every chai until Sunday for readers who show this story at the counter.',
    },
    te: {
      headline: '1962 నాటి బేగంపేట ఇరానీ కేఫ్ పునఃప్రారంభం — అదే ఉస్మానియా బిస్కెట్ రుచితో',
      summary: 'ఆరు నెలల పునరుద్ధరణ తర్వాత బేగంపేటలోని ఇరానీ చాయ్ హౌస్ తిరిగి తెరుచుకుంది. పాత బెంట్‌వుడ్ కుర్చీలు, పాలరాతి టేబుళ్లు, చేతితో రాసిన బోర్డును అలాగే కాపాడారు. మూడో తరం యజమానులు ఇప్పటికీ ప్రతిరోజూ ఉదయం 5 గంటలకు అసలైన కట్టెల పొయ్యిలో ఉస్మానియా బిస్కెట్లు, దిల్‌ఖుష్ కాలుస్తారు. ఈ కథనాన్ని కౌంటర్‌లో చూపిన పాఠకులకు ఆదివారం వరకు ప్రతి చాయ్‌తో ఒక బిస్కెట్ ఉచితం.',
    },
  }),

  // ───────────────────────── WARANGAL ─────────────────────────
  mk({
    id: 'wgl-cotton-price', cat: 'agriculture', st: 'tg', d: 'wgl', m: 'wgl-wgl', lat: 17.97, lng: 79.6,
    src: 'Enumamula Market Committee', min: 30, trending: true, r: [980, 160, 20, 44], c: 133, sh: 1720, vw: 39000,
    en: {
      headline: 'Cotton touches ₹7,850 a quintal at Enumamula as arrivals fall after early rains',
      summary: 'Cotton prices at Warangal\'s Enumamula agricultural market rose to ₹7,850 per quintal on Monday, up ₹400 in a week, as arrivals dropped to about 9,000 bags after unseasonal rain delayed picking. Traders expect prices to stay firm until the end of the month. Market officials urged farmers to dry their produce well, since moisture above 12 percent attracts deductions, and to carry their registration cards for faster weighing.',
    },
    te: {
      headline: 'ఎనుమాముల మార్కెట్‌లో పత్తి క్వింటాల్‌కు ₹7,850: తగ్గిన రాక',
      summary: 'అకాల వర్షాలతో పత్తి తీత ఆలస్యం కావడంతో వరంగల్ ఎనుమాముల వ్యవసాయ మార్కెట్‌కు రాక సుమారు 9,000 బస్తాలకు పడిపోయింది. సోమవారం క్వింటాల్ ధర ₹7,850కు చేరింది — వారంలో ₹400 పెరుగుదల. నెలాఖరు వరకు ధరలు స్థిరంగా ఉంటాయని వ్యాపారులు అంచనా వేస్తున్నారు. తేమ 12 శాతం మించితే కోత పడుతుందని, పత్తిని బాగా ఆరబెట్టి తీసుకురావాలని, త్వరగా తూకం కోసం రిజిస్ట్రేషన్ కార్డులు వెంట తెచ్చుకోవాలని అధికారులు సూచించారు.',
    },
  }),
  mk({
    id: 'wgl-temple-lights', cat: 'devotional', st: 'tg', d: 'wgl', m: 'wgl-hnk', lat: 18.003, lng: 79.574,
    src: 'Vaarta Warangal', min: 140, r: [1600, 410, 1, 0], c: 120, sh: 2100,
    en: {
      headline: 'Thousand Pillar Temple to glow with 10,000 oil lamps for Karthika Pournami',
      summary: 'The Thousand Pillar Temple in Hanamkonda will be lit with 10,000 earthen oil lamps on Karthika Pournami evening, with special abhishekams from 5 AM. Temple authorities expect over 50,000 devotees and have arranged separate queues for senior citizens and differently-abled visitors. Parking will be available at the Arts College grounds, with shuttle autos every ten minutes. Classical dance performances are planned on the temple lawns from 7 PM.',
    },
    te: {
      headline: 'కార్తీక పౌర్ణమికి 10 వేల దీపాలతో వెలగనున్న వేయి స్తంభాల గుడి',
      summary: 'కార్తీక పౌర్ణమి సాయంత్రం హనుమకొండలోని వేయి స్తంభాల ఆలయాన్ని 10,000 మట్టి దీపాలతో అలంకరిస్తారు. ఉదయం 5 గంటల నుంచే ప్రత్యేక అభిషేకాలు జరుగుతాయి. 50 వేల మందికి పైగా భక్తులు వస్తారని అంచనా వేసిన అధికారులు వృద్ధులు, దివ్యాంగుల కోసం ప్రత్యేక క్యూలు ఏర్పాటు చేశారు. ఆర్ట్స్ కాలేజీ మైదానంలో పార్కింగ్, ప్రతి పది నిమిషాలకు షటిల్ ఆటోలు ఉంటాయి. రాత్రి 7 గంటల నుంచి ఆలయ ప్రాంగణంలో శాస్త్రీయ నృత్య ప్రదర్శనలు ఉంటాయి.',
    },
  }),
  mk({
    id: 'wgl-eamcet-coaching', cat: 'education', st: 'tg', d: 'wgl', m: 'wgl-kzp', v: 'v-mdk', lat: 17.976, lng: 79.51,
    src: 'District Education Office', min: 260, r: [760, 60, 1, 2], c: 58, sh: 940,
    en: {
      headline: 'Government junior colleges in Warangal start free evening EAMCET coaching for 1,800 students',
      summary: 'Twenty-two government junior colleges across Warangal district have begun free evening coaching for EAMCET and NEET aspirants, benefiting about 1,800 second-year intermediate students. Classes run from 4:30 to 7 PM on weekdays and include weekly mock tests modelled on the latest exam pattern. Subject experts from engineering colleges will take sessions on Saturdays. Students who need transport can apply for free bus passes at their college office.',
    },
    te: {
      headline: 'వరంగల్ ప్రభుత్వ జూనియర్ కాలేజీల్లో 1,800 మందికి ఉచిత సాయంత్రం ఎంసెట్ కోచింగ్',
      summary: 'వరంగల్ జిల్లాలోని 22 ప్రభుత్వ జూనియర్ కళాశాలల్లో ఎంసెట్, నీట్ అభ్యర్థులకు ఉచిత సాయంత్రం కోచింగ్ ప్రారంభమైంది. సుమారు 1,800 మంది ఇంటర్ ద్వితీయ సంవత్సరం విద్యార్థులు లబ్ధి పొందుతారు. వారం రోజుల్లో సాయంత్రం 4:30 నుంచి 7 గంటల వరకు తరగతులు, తాజా పరీక్ష విధానంలో ప్రతి వారం మాక్ టెస్టులు ఉంటాయి. శనివారాల్లో ఇంజనీరింగ్ కాలేజీ నిపుణులు సెషన్లు తీసుకుంటారు. రవాణా అవసరమైన విద్యార్థులు కాలేజీ కార్యాలయంలో ఉచిత బస్ పాస్‌కు దరఖాస్తు చేసుకోవచ్చు.',
    },
  }),
  mk({
    id: 'wgl-drainage-plan', cat: 'politics', st: 'tg', d: 'wgl', m: 'wgl-hnk', v: 'v-sbr', lat: 18.0, lng: 79.56,
    src: 'Vaarta Warangal', min: 380, r: [430, 70, 40, 95], c: 204, sh: 520,
    en: {
      headline: 'Warangal civic body clears ₹120-crore storm-water drain plan after heated council debate',
      summary: 'The Greater Warangal municipal council on Monday approved a ₹120-crore storm-water drainage plan covering 34 flood-prone colonies, after a four-hour debate in which opposition corporators sought a third-party audit of past works. The plan includes 48 km of new drains and desilting of the Bhadrakali tank inflow channels. The mayor said tenders will be floated within a month and work completed before next year\'s monsoon.',
    },
    te: {
      headline: 'వాడివేడి చర్చ తర్వాత ₹120 కోట్ల వరద నీటి కాలువల ప్రణాళికకు వరంగల్ కౌన్సిల్ ఆమోదం',
      summary: 'ముంపు ప్రభావిత 34 కాలనీలకు ₹120 కోట్ల వరద నీటి కాలువల ప్రణాళికను గ్రేటర్ వరంగల్ మున్సిపల్ కౌన్సిల్ సోమవారం ఆమోదించింది. గత పనులపై మూడో పక్ష ఆడిట్ జరపాలని ప్రతిపక్ష కార్పొరేటర్లు డిమాండ్ చేయడంతో నాలుగు గంటల పాటు చర్చ సాగింది. ప్రణాళికలో 48 కి.మీ. కొత్త కాలువలు, భద్రకాళి చెరువు ఇన్‌ఫ్లో కాలువల పూడికతీత ఉన్నాయి. నెలలోపు టెండర్లు పిలిచి వచ్చే వర్షాకాలానికి ముందే పనులు పూర్తి చేస్తామని మేయర్ తెలిపారు.',
    },
  }),
  mk({
    id: 'wgl-fog-advisory', cat: 'weather', st: 'tg', d: 'wgl', m: 'wgl-nsp', v: 'v-chn', lat: 17.93, lng: 79.89,
    src: 'Vaarta Weather', min: 70, r: [300, 40, 30, 4], c: 22, sh: 610,
    en: {
      headline: 'Dense fog advisory for Narsampet highway; minimum temperature drops to 13°C',
      summary: 'Warangal district officials have issued a dense-fog advisory for the Narsampet–Warangal highway between 5 and 8:30 AM for the rest of the week, as the minimum temperature fell to 13°C, the lowest this season. Visibility dropped below 50 metres near Chennaraopet on Monday. Truck and bus drivers are asked to use fog lamps and keep speeds under 40 km/h. Schools in the mandal have pushed morning assembly to 9:30 AM.',
    },
    te: {
      headline: 'నర్సంపేట హైవేపై దట్టమైన పొగమంచు హెచ్చరిక: కనిష్ఠ ఉష్ణోగ్రత 13°C',
      summary: 'ఈ సీజన్‌లోనే అత్యల్పంగా కనిష్ఠ ఉష్ణోగ్రత 13°Cకు పడిపోవడంతో ఈ వారమంతా ఉదయం 5 నుంచి 8:30 వరకు నర్సంపేట–వరంగల్ హైవేపై దట్టమైన పొగమంచు ఉంటుందని జిల్లా అధికారులు హెచ్చరించారు. సోమవారం చెన్నారావుపేట వద్ద దృశ్యమానత 50 మీటర్ల కంటే తక్కువకు పడిపోయింది. లారీ, బస్సు డ్రైవర్లు ఫాగ్ ల్యాంప్‌లు వాడాలని, వేగం గంటకు 40 కి.మీ. మించకూడదని సూచించారు. మండలంలోని పాఠశాలలు ఉదయం ప్రార్థనను 9:30కి మార్చాయి.',
    },
  }),
  mk({
    id: 'wgl-bikes-recovered', cat: 'crime', st: 'tg', d: 'wgl', m: 'wgl-kzp', lat: 17.975, lng: 79.505,
    src: 'Warangal Police Commissionerate', min: 520, r: [690, 120, 12, 60], c: 77, sh: 830,
    en: {
      headline: 'Kazipet police bust two-wheeler theft ring, return 41 stolen bikes to owners',
      summary: 'Kazipet police have arrested three men accused of stealing two-wheelers from railway station parking lots and hospital premises across Warangal and Karimnagar over eight months. Officers recovered 41 motorcycles and scooters worth about ₹28 lakh, most of which were returned to their owners at a ceremony on Monday. Police traced the gang using CCTV footage and number-plate recognition cameras, and urged riders to use wheel locks.',
    },
    te: {
      headline: 'బైక్ దొంగల ముఠా గుట్టు రట్టు: 41 వాహనాలు యజమానులకు అప్పగించిన కాజీపేట పోలీసులు',
      summary: 'ఎనిమిది నెలలుగా వరంగల్, కరీంనగర్‌లోని రైల్వే స్టేషన్ పార్కింగ్‌లు, ఆసుపత్రుల ప్రాంగణాల్లో ద్విచక్ర వాహనాలు దొంగిలిస్తున్న ముగ్గురిని కాజీపేట పోలీసులు అరెస్ట్ చేశారు. సుమారు ₹28 లక్షల విలువైన 41 బైకులు, స్కూటర్లను స్వాధీనం చేసుకుని, వాటిలో చాలా వరకు సోమవారం యజమానులకు అప్పగించారు. సీసీటీవీ ఫుటేజ్, నంబర్ ప్లేట్ గుర్తింపు కెమెరాల ద్వారా ముఠాను పట్టుకున్నామని, వీల్ లాక్‌లు వాడాలని పోలీసులు సూచించారు.',
    },
  }),
  mk({
    id: 'wgl-kabaddi-league', cat: 'sports', st: 'tg', d: 'wgl', m: 'wgl-wgl', v: 'v-ork', lat: 17.958, lng: 79.613,
    src: 'Vaarta Sports', min: 640, r: [540, 70, 3, 2], c: 35, sh: 300,
    en: {
      headline: 'Kakatiya Kabaddi League returns with 16 village teams and floodlit matches at the fort grounds',
      summary: 'The second season of the Kakatiya Kabaddi League starts on Friday at the Warangal Fort grounds, featuring 16 village teams from across the erstwhile district. Matches will be played under floodlights from 6 PM, with free entry and live commentary in Telugu. The winning team gets ₹3 lakh and the best raider a motorcycle. Scouts from professional kabaddi franchises are expected to attend the knockout rounds.',
    },
    te: {
      headline: 'కాకతీయ కబడ్డీ లీగ్ మళ్లీ వచ్చేసింది: 16 గ్రామ జట్లు, కోట మైదానంలో ఫ్లడ్‌లైట్ మ్యాచ్‌లు',
      summary: 'కాకతీయ కబడ్డీ లీగ్ రెండో సీజన్ శుక్రవారం వరంగల్ కోట మైదానంలో ప్రారంభం కానుంది. ఉమ్మడి జిల్లా నుంచి 16 గ్రామ జట్లు పోటీపడతాయి. సాయంత్రం 6 గంటల నుంచి ఫ్లడ్‌లైట్ల వెలుగులో మ్యాచ్‌లు, ఉచిత ప్రవేశం, తెలుగులో ప్రత్యక్ష వ్యాఖ్యానం ఉంటాయి. విజేత జట్టుకు ₹3 లక్షలు, ఉత్తమ రైడర్‌కు మోటార్‌సైకిల్ బహుమతి. నాకౌట్ దశకు ప్రొఫెషనల్ కబడ్డీ ఫ్రాంచైజీల స్కౌట్లు హాజరవుతారని భావిస్తున్నారు.',
    },
  }),
  mk({
    id: 'wgl-dengue-drive', cat: 'health', st: 'tg', d: 'wgl', m: 'wgl-hnk', lat: 18.01, lng: 79.55,
    src: 'District Medical & Health Office', min: 20, breaking: true, r: [380, 90, 160, 40], c: 66, sh: 1340,
    en: {
      headline: 'Dengue cases rise to 212 in Hanamkonda; door-to-door fogging begins in 40 colonies',
      summary: 'Hanamkonda has recorded 212 dengue cases this month, nearly double last year\'s figure, prompting health officials to launch door-to-door fogging and larva surveys in 40 colonies. Teams will check water tanks, coolers and flower pots for stagnant water. Officials urged residents to empty containers every Sunday and seek a free test at any primary health centre if fever lasts more than two days. Platelet transfusion units are on standby at MGM Hospital.',
    },
    te: {
      headline: 'హనుమకొండలో 212కు చేరిన డెంగీ కేసులు: 40 కాలనీల్లో ఇంటింటా ఫాగింగ్',
      summary: 'ఈ నెలలో హనుమకొండలో 212 డెంగీ కేసులు నమోదయ్యాయి — గతేడాదితో పోలిస్తే దాదాపు రెట్టింపు. దీంతో ఆరోగ్య అధికారులు 40 కాలనీల్లో ఇంటింటా ఫాగింగ్, లార్వా సర్వే ప్రారంభించారు. నీటి ట్యాంకులు, కూలర్లు, పూల కుండీల్లో నిలిచిన నీటిని బృందాలు తనిఖీ చేస్తాయి. ప్రతి ఆదివారం పాత్రలు ఖాళీ చేయాలని, రెండు రోజులకు మించి జ్వరం ఉంటే ఏ పీహెచ్‌సీలోనైనా ఉచిత పరీక్ష చేయించుకోవాలని సూచించారు. ఎంజీఎం ఆసుపత్రిలో ప్లేట్‌లెట్ యూనిట్లు సిద్ధంగా ఉన్నాయి.',
    },
  }),

  // ───────────────────────── VISAKHAPATNAM ─────────────────────────
  mk({
    id: 'vsp-depression-warning', cat: 'weather', st: 'ap', d: 'vsp', m: 'vsp-bhm', v: 'v-tgr', lat: 17.89, lng: 83.45,
    src: 'Vaarta Desk', min: 8, breaking: true, trending: true, r: [1120, 260, 220, 18], c: 188, sh: 3410, vw: 72000,
    en: {
      headline: 'Deep depression in Bay of Bengal: fishermen told not to venture out for 72 hours',
      summary: 'A deep depression over the southwest Bay of Bengal is likely to intensify and bring heavy rain to Visakhapatnam district from Wednesday, with winds of 55–65 km/h along the coast. Authorities have asked fishermen in Bheemunipatnam and nearby harbours not to venture into the sea for the next 72 hours. Twenty-six relief centres have been readied, and NDRF teams are stationed at Tagarapuvalasa. The control room number is 0891-259-0100.',
    },
    te: {
      headline: 'బంగాళాఖాతంలో తీవ్ర వాయుగుండం: 72 గంటలు చేపల వేటకు వెళ్లొద్దని హెచ్చరిక',
      summary: 'నైరుతి బంగాళాఖాతంలోని తీవ్ర వాయుగుండం మరింత బలపడి బుధవారం నుంచి విశాఖపట్నం జిల్లాలో భారీ వర్షాలు కురిసే అవకాశం ఉంది. తీరం వెంబడి గంటకు 55–65 కి.మీ. వేగంతో గాలులు వీస్తాయి. భీమునిపట్నం, సమీప హార్బర్ల మత్స్యకారులు రాబోయే 72 గంటలు సముద్రంలోకి వెళ్లొద్దని అధికారులు సూచించారు. 26 పునరావాస కేంద్రాలు సిద్ధం చేశారు, తగరపువలసలో ఎన్‌డీఆర్‌ఎఫ్ బృందాలు మోహరించాయి. కంట్రోల్ రూమ్ నంబర్ 0891-259-0100.',
    },
  }),
  mk({
    id: 'vsp-port-record', cat: 'business', st: 'ap', d: 'vsp', m: 'vsp-gjw', v: 'v-pdk', lat: 17.69, lng: 83.25,
    src: 'Vaarta Business', min: 200, r: [620, 110, 2, 5], c: 28, sh: 290,
    en: {
      headline: 'Visakhapatnam port handles record 7.4 million tonnes in October on steel and container surge',
      summary: 'Visakhapatnam port handled a record 7.4 million tonnes of cargo in October, up 11 percent from a year earlier, driven by higher steel exports and a jump in container traffic at the outer harbour. Officials credited faster berthing after the deepening of two channels. The port expects to cross 80 million tonnes this financial year. Gajuwaka transporters say the surge has added nearly 1,500 truck trips a day.',
    },
    te: {
      headline: 'అక్టోబర్‌లో రికార్డు స్థాయిలో 74 లక్షల టన్నుల సరుకు రవాణా చేసిన విశాఖ పోర్టు',
      summary: 'ఉక్కు ఎగుమతులు పెరగడం, ఔటర్ హార్బర్‌లో కంటైనర్ రాకపోకలు పుంజుకోవడంతో అక్టోబర్‌లో విశాఖపట్నం పోర్టు రికార్డు స్థాయిలో 74 లక్షల టన్నుల సరుకును నిర్వహించింది. ఇది గతేడాది కంటే 11 శాతం అధికం. రెండు ఛానళ్ల లోతు పెంచడంతో బెర్తింగ్ వేగవంతమైందని అధికారులు తెలిపారు. ఈ ఆర్థిక సంవత్సరంలో 8 కోట్ల టన్నులు దాటుతామని పోర్టు అంచనా. దీంతో రోజుకు దాదాపు 1,500 అదనపు లారీ ట్రిప్పులు పెరిగాయని గాజువాక ట్రాన్స్‌పోర్టర్లు చెబుతున్నారు.',
    },
  }),
  mk({
    id: 'vsp-simhachalam-darshan', cat: 'devotional', st: 'ap', d: 'vsp', m: 'vsp-pdr', v: 'v-sim', lat: 17.766, lng: 83.25,
    src: 'Simhachalam Devasthanam', min: 300, r: [1340, 150, 2, 4], c: 92, sh: 1980,
    en: {
      headline: 'Simhachalam temple extends darshan hours to 10 PM on Karthika Mondays',
      summary: 'The Sri Varaha Lakshmi Narasimha Swamy temple at Simhachalam will keep darshan open until 10 PM on all Karthika Mondays to manage heavy crowds. The free darshan queue will open at 4:30 AM, and ₹100 and ₹300 special darshan tickets can be booked online. Additional APSRTC buses will run from the RTC complex and Gajuwaka every 15 minutes. Devotees are asked to avoid carrying plastic up the ghat road.',
    },
    te: {
      headline: 'కార్తీక సోమవారాల్లో రాత్రి 10 వరకు సింహాచలం దర్శనం',
      summary: 'భక్తుల రద్దీ దృష్ట్యా కార్తీక సోమవారాలన్నింటిలో సింహాచలం శ్రీ వరాహ లక్ష్మీ నరసింహ స్వామి ఆలయంలో రాత్రి 10 గంటల వరకు దర్శనం కల్పిస్తారు. ఉచిత దర్శనం క్యూ ఉదయం 4:30కే తెరుస్తారు. ₹100, ₹300 ప్రత్యేక దర్శన టికెట్లను ఆన్‌లైన్‌లో బుక్ చేసుకోవచ్చు. ఆర్టీసీ కాంప్లెక్స్, గాజువాక నుంచి ప్రతి 15 నిమిషాలకు అదనపు ఏపీఎస్‌ఆర్టీసీ బస్సులు నడుస్తాయి. ఘాట్ రోడ్డుపై ప్లాస్టిక్ తీసుకెళ్లవద్దని భక్తులను కోరారు.',
    },
  }),
  mk({
    id: 'vsp-it-campus', cat: 'jobs', st: 'ap', d: 'vsp', m: 'vsp-msp', lat: 17.78, lng: 83.38,
    src: 'Vaarta Business', min: 430, trending: true, r: [1880, 240, 5, 30], c: 260, sh: 3100, vw: 54000,
    en: {
      headline: 'New Rushikonda IT campus to hire 2,000 freshers; first recruitment drive on November 28',
      summary: 'A global IT services company will open a 3.2-lakh-square-foot campus at the Rushikonda IT park early next year and plans to hire 2,000 freshers in the first phase. The first campus recruitment drive will be held on November 28 for 2025 and 2026 graduates in engineering, BSc and BCA. Starting salaries are expected between ₹3.6 and ₹4.5 lakh a year. Applications open on the company\'s careers portal this week.',
    },
    te: {
      headline: 'రుషికొండ కొత్త ఐటీ క్యాంపస్‌లో 2,000 మంది ఫ్రెషర్లకు ఉద్యోగాలు: 28న తొలి నియామక డ్రైవ్',
      summary: 'ఓ గ్లోబల్ ఐటీ సేవల సంస్థ వచ్చే ఏడాది ప్రారంభంలో రుషికొండ ఐటీ పార్క్‌లో 3.2 లక్షల చదరపు అడుగుల క్యాంపస్‌ను ప్రారంభించనుంది. తొలి దశలో 2,000 మంది ఫ్రెషర్లను నియమించుకోనుంది. 2025, 2026లో ఇంజనీరింగ్, బీఎస్సీ, బీసీఏ పూర్తి చేసిన వారి కోసం నవంబర్ 28న మొదటి నియామక డ్రైవ్ జరుగుతుంది. ప్రారంభ వేతనం ఏడాదికి ₹3.6 నుంచి ₹4.5 లక్షల వరకు ఉంటుందని అంచనా. ఈ వారమే కంపెనీ కెరీర్స్ పోర్టల్‌లో దరఖాస్తులు ప్రారంభమవుతాయి.',
    },
  }),
  mk({
    id: 'vsp-beach-marathon', cat: 'sports', st: 'ap', d: 'vsp', m: 'vsp-msp', v: 'v-rkb', lat: 17.714, lng: 83.323,
    src: 'Vaarta Sports', min: 560, r: [820, 95, 1, 2], c: 40, sh: 520,
    en: {
      headline: '12,000 runners register for RK Beach marathon; Beach Road closed from 4 AM Sunday',
      summary: 'Over 12,000 runners have registered for Sunday\'s Vizag Coastal Marathon, which will start at RK Beach and follow Beach Road to Rushikonda and back. Full and half marathon runners will be flagged off at 5 AM, followed by 10 km and 5 km fun runs. Beach Road will be closed to traffic from 4 AM to 10 AM; motorists should use the Siripuram–Maddilapalem route. Hydration points have been set up every two kilometres.',
    },
    te: {
      headline: 'ఆర్‌కే బీచ్ మారథాన్‌కు 12 వేల మంది నమోదు: ఆదివారం ఉదయం 4 నుంచి బీచ్ రోడ్ మూసివేత',
      summary: 'ఆదివారం జరిగే వైజాగ్ కోస్టల్ మారథాన్‌కు 12 వేల మందికి పైగా రన్నర్లు నమోదు చేసుకున్నారు. ఆర్‌కే బీచ్ నుంచి బీచ్ రోడ్ మీదుగా రుషికొండ వరకు వెళ్లి తిరిగి వస్తారు. ఫుల్, హాఫ్ మారథాన్‌లు ఉదయం 5 గంటలకు ప్రారంభమవుతాయి, తర్వాత 10 కి.మీ., 5 కి.మీ. ఫన్ రన్‌లు ఉంటాయి. ఉదయం 4 నుంచి 10 వరకు బీచ్ రోడ్‌పై వాహనాలను అనుమతించరు; సిరిపురం–మద్దిలపాలెం మార్గం వాడాలి. ప్రతి రెండు కిలోమీటర్లకు నీటి కేంద్రాలు ఉంటాయి.',
    },
  }),
  mk({
    id: 'vsp-plastic-ban', cat: 'politics', st: 'ap', d: 'vsp', m: 'vsp-msp', v: 'v-rkb', lat: 17.72, lng: 83.33,
    src: 'Citizen Reporter', min: 700, reporter: { name: 'K. Ravi Teja', verified: true, citizen: true }, r: [960, 120, 10, 70], c: 175, sh: 880,
    en: {
      headline: 'GVMC bans single-use plastic on Vizag beaches from December 1; ₹5,000 fine for vendors',
      summary: 'The Greater Visakhapatnam Municipal Corporation has passed a resolution banning single-use plastic bags, cups and straws along the 30-km beach stretch from RK Beach to Bheemunipatnam from December 1. Vendors found violating the rule will be fined ₹5,000 for a first offence. GVMC will distribute 50,000 cloth bags to stall owners and install water ATMs at eight points. Volunteers collected 3.8 tonnes of plastic at last week\'s cleanup drive.',
    },
    te: {
      headline: 'డిసెంబర్ 1 నుంచి విశాఖ బీచ్‌లలో సింగిల్ యూజ్ ప్లాస్టిక్ నిషేధం: వ్యాపారులకు ₹5,000 జరిమానా',
      summary: 'ఆర్‌కే బీచ్ నుంచి భీమునిపట్నం వరకు 30 కి.మీ. తీరంలో డిసెంబర్ 1 నుంచి సింగిల్ యూజ్ ప్లాస్టిక్ సంచులు, కప్పులు, స్ట్రాలను నిషేధిస్తూ జీవీఎంసీ తీర్మానం చేసింది. నిబంధన ఉల్లంఘించిన వ్యాపారులకు తొలిసారి ₹5,000 జరిమానా విధిస్తారు. స్టాల్ యజమానులకు 50 వేల గుడ్డ సంచులు పంపిణీ చేసి, ఎనిమిది చోట్ల వాటర్ ఏటీఎంలు ఏర్పాటు చేస్తారు. గత వారం శుభ్రత కార్యక్రమంలో వాలంటీర్లు 3.8 టన్నుల ప్లాస్టిక్ సేకరించారు.',
    },
  }),
  mk({
    id: 'vsp-cashew-unit', cat: 'agriculture', st: 'ap', d: 'vsp', m: 'vsp-bhm', lat: 17.88, lng: 83.43,
    src: 'Vaarta Agriculture', min: 860, r: [470, 60, 2, 3], c: 31, sh: 260,
    en: {
      headline: 'Women\'s cooperative opens cashew processing unit in Bheemunipatnam, doubling farm-gate income',
      summary: 'A cooperative of 340 women farmers in Bheemunipatnam mandal has opened its own cashew processing unit, allowing members to sell graded, packaged kernels instead of raw nuts to middlemen. The unit, set up with a ₹1.2-crore grant and bank loan, can process four tonnes a day. Members say their earnings per kilo have nearly doubled. The cooperative now plans to sell online and supply hotels in Visakhapatnam city.',
    },
    te: {
      headline: 'భీమునిపట్నంలో మహిళా సహకార సంఘం జీడిపప్పు ప్రాసెసింగ్ యూనిట్: రెట్టింపైన ఆదాయం',
      summary: 'భీమునిపట్నం మండలానికి చెందిన 340 మంది మహిళా రైతుల సహకార సంఘం సొంతంగా జీడిపప్పు ప్రాసెసింగ్ యూనిట్ ప్రారంభించింది. దీంతో దళారులకు పచ్చి గింజలు అమ్మకుండా, గ్రేడ్ చేసి ప్యాక్ చేసిన పప్పును నేరుగా విక్రయించగలుగుతున్నారు. ₹1.2 కోట్ల గ్రాంట్, బ్యాంక్ రుణంతో ఏర్పాటైన యూనిట్ రోజుకు నాలుగు టన్నులు ప్రాసెస్ చేయగలదు. కిలోకు ఆదాయం దాదాపు రెట్టింపైందని సభ్యులు చెబుతున్నారు. త్వరలో ఆన్‌లైన్ అమ్మకాలు, విశాఖ నగర హోటళ్లకు సరఫరా ప్రారంభించనున్నారు.',
    },
  }),
  mk({
    id: 'vsp-film-shoot', cat: 'cinema', st: 'ap', d: 'vsp', m: 'vsp-msp', lat: 17.73, lng: 83.34,
    src: 'Vaarta Cinema', min: 980, r: [1420, 330, 4, 8], c: 140, sh: 1650,
    en: {
      headline: 'Big-budget Telugu period drama begins 40-day shoot along Vizag coast, hiring 600 local extras',
      summary: 'A big-budget Telugu period drama set in the 1940s has begun a 40-day shooting schedule along the Visakhapatnam coast, with a full-scale replica of an old harbour built near Bheemunipatnam. The production is hiring around 600 local extras, carpenters and boat owners, paying ₹1,200 to ₹2,000 a day. Fans are requested not to crowd the set, and drones are prohibited within one kilometre of the location.',
    },
    te: {
      headline: 'విశాఖ తీరంలో భారీ బడ్జెట్ పీరియడ్ డ్రామా 40 రోజుల షూటింగ్: 600 మంది స్థానికులకు ఉపాధి',
      summary: '1940ల నేపథ్యంలో రూపొందుతున్న భారీ బడ్జెట్ తెలుగు పీరియడ్ డ్రామా విశాఖపట్నం తీరంలో 40 రోజుల షూటింగ్ షెడ్యూల్ ప్రారంభించింది. భీమునిపట్నం సమీపంలో పాత హార్బర్ నమూనాను పూర్తి స్థాయిలో నిర్మించారు. సుమారు 600 మంది స్థానిక ఎక్స్‌ట్రాలు, వడ్రంగులు, బోట్ యజమానులకు రోజుకు ₹1,200 నుంచి ₹2,000 చెల్లిస్తున్నారు. సెట్ వద్ద గుమిగూడవద్దని అభిమానులను కోరారు; లొకేషన్‌కు కిలోమీటర్ పరిధిలో డ్రోన్లు నిషేధం.',
    },
  }),
];

export const storyById = (id: string) => STORIES.find((s) => s.id === id);
