/**
 * Core UI strings for Tamil, Kannada, Malayalam, Marathi, Bengali and Gujarati.
 * Keys not listed here fall back to English (see i18n/index.ts).
 * These should be reviewed by native-speaking editors before launch.
 */
import type { Strings } from './en';

type P = Partial<Strings>;

export const ta: P = {
  tagline: 'உங்கள் ஊர். உங்கள் நகரம். உங்கள் செய்தி.', continue: 'தொடரவும்', skip: 'தவிர்', next: 'அடுத்து', done: 'முடிந்தது', back: 'பின்', save: 'சேமி', cancel: 'ரத்து', seeAll: 'அனைத்தும்',
  chooseLanguage: 'உங்கள் மொழியைத் தேர்வுசெய்யவும்', chooseLanguageSub: 'செய்திகளும் முழு செயலியும் இந்த மொழியில் தோன்றும்.',
  locationTitle: 'உங்கள் பகுதி செய்திகள்', locationSub: 'உங்கள் மாவட்டம், வட்டம், கிராமச் செய்திகளைக் காட்ட இருப்பிடத்தைப் பயன்படுத்துகிறோம்.',
  useMyLocation: 'எனது இருப்பிடத்தைப் பயன்படுத்து', detecting: 'இருப்பிடம் கண்டறியப்படுகிறது…', pickManually: 'அல்லது நீங்களே தேர்வுசெய்க',
  state: 'மாநிலம்', district: 'மாவட்டம்', mandal: 'மண்டலம்', village: 'கிராமம் / வார்டு',
  interestsTitle: 'உங்களுக்கு எது முக்கியம்?', interestsSub: 'குறைந்தது 3 தலைப்புகளைத் தேர்ந்தெடுக்கவும்.', pickAtLeast: 'இன்னும் {n}',
  loginTitle: 'தொலைபேசி மூலம் உள்நுழைக', phoneNumber: 'கைபேசி எண்', sendOtp: 'OTP அனுப்பு', enterOtp: '6 இலக்க குறியீட்டை உள்ளிடவும்', verify: 'சரிபார்த்து தொடர்க', continueAsGuest: 'விருந்தினராகத் தொடர்க',
  tabFeed: 'ஊட்டம்', tabExplore: 'ஆராய்', tabVideos: 'வீடியோ', tabLocal: 'உள்ளூர்', tabProfile: 'சுயவிவரம்',
  forYou: 'உங்களுக்காக', local: 'உள்ளூர்', trending: 'பிரபலம்', breaking: 'பிரேக்கிங்', breakingNews: 'பிரேக்கிங்',
  listen: 'கேள்', stop: 'நிறுத்து', share: 'பகிர்', bookmark: 'சேமி', bookmarked: 'சேமிக்கப்பட்டது', sponsored: 'விளம்பரதாரர்', advertisement: 'விளம்பரம்',
  justNow: 'இப்போது', minAgo: '{n} நிமி. முன்', hrAgo: '{n} மணி முன்', dayAgo: '{n} நாள் முன்',
  categories: 'பிரிவுகள்', magazines: 'இதழ்கள்', topBuzz: 'டாப் பஸ்', polls: 'கருத்துக்கணிப்பு', votes: '{n} வாக்குகள்', nationwide: 'நாடு முழுவதும்', yourDistrict: 'உங்கள் மாவட்டம்',
  localAlerts: 'உள்ளூர் எச்சரிக்கைகள்', nearby: 'அருகில்', mapView: 'வரைபடம்', listView: 'பட்டியல்',
  bookmarks: 'புக்மார்க்குகள்', history: 'வாசிப்பு வரலாறு', language: 'மொழி', location: 'இருப்பிடம்', notifications: 'அறிவிப்புகள்', theme: 'தீம்', settings: 'அமைப்புகள்',
  citizenReporter: 'குடிமக்கள் நிருபர்', today60: 'இன்று 60 வினாடிகளில்', reportNews: 'செய்தி அனுப்பு', searchPlaceholder: 'செய்தி, இடங்கள், தலைப்புகள் தேடு',
  cat_politics: 'அரசியல்', cat_cinema: 'சினிமா', cat_sports: 'விளையாட்டு', cat_business: 'வணிகம்', cat_tech: 'தொழில்நுட்பம்', cat_jobs: 'வேலைகள்', cat_education: 'கல்வி', cat_devotional: 'ஆன்மிகம்', cat_agriculture: 'விவசாயம்', cat_health: 'சுகாதாரம்', cat_crime: 'குற்றம்', cat_weather: 'வானிலை',
  alert_power: 'மின்வெட்டு', alert_water: 'குடிநீர்', alert_traffic: 'போக்குவரத்து', alert_weather: 'வானிலை', alert_jobs: 'வேலைகள்', alert_events: 'நிகழ்வுகள்',
};

export const kn: P = {
  tagline: 'ನಿಮ್ಮ ಊರು. ನಿಮ್ಮ ನಗರ. ನಿಮ್ಮ ಸುದ್ದಿ.', continue: 'ಮುಂದುವರಿಸಿ', skip: 'ಬಿಡಿ', next: 'ಮುಂದೆ', done: 'ಮುಗಿದಿದೆ', back: 'ಹಿಂದೆ', save: 'ಉಳಿಸಿ', cancel: 'ರದ್ದು', seeAll: 'ಎಲ್ಲಾ ನೋಡಿ',
  chooseLanguage: 'ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ', chooseLanguageSub: 'ಸುದ್ದಿ ಮತ್ತು ಇಡೀ ಆ್ಯಪ್ ಈ ಭಾಷೆಯಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.',
  locationTitle: 'ನಿಮ್ಮ ಸುತ್ತಮುತ್ತಲಿನ ಸುದ್ದಿ', locationSub: 'ನಿಮ್ಮ ಜಿಲ್ಲೆ, ತಾಲ್ಲೂಕು, ಹಳ್ಳಿಯ ಸುದ್ದಿಗಾಗಿ ನಿಮ್ಮ ಸ್ಥಳ ಬಳಸುತ್ತೇವೆ.',
  useMyLocation: 'ನನ್ನ ಸ್ಥಳ ಬಳಸಿ', detecting: 'ಸ್ಥಳ ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತಿದೆ…', pickManually: 'ಅಥವಾ ನೀವೇ ಆಯ್ಕೆಮಾಡಿ',
  state: 'ರಾಜ್ಯ', district: 'ಜಿಲ್ಲೆ', mandal: 'ಮಂಡಲ', village: 'ಹಳ್ಳಿ / ವಾರ್ಡ್',
  interestsTitle: 'ನಿಮಗೆ ಯಾವುದು ಮುಖ್ಯ?', interestsSub: 'ಕನಿಷ್ಠ 3 ವಿಷಯಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.', pickAtLeast: 'ಇನ್ನೂ {n}',
  loginTitle: 'ಫೋನ್ ಮೂಲಕ ಸೈನ್ ಇನ್', phoneNumber: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', sendOtp: 'OTP ಕಳುಹಿಸಿ', enterOtp: '6 ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ', verify: 'ಪರಿಶೀಲಿಸಿ ಮುಂದುವರಿಸಿ', continueAsGuest: 'ಅತಿಥಿಯಾಗಿ ಮುಂದುವರಿಸಿ',
  tabFeed: 'ಫೀಡ್', tabExplore: 'ಅನ್ವೇಷಿಸಿ', tabVideos: 'ವೀಡಿಯೊ', tabLocal: 'ಸ್ಥಳೀಯ', tabProfile: 'ಪ್ರೊಫೈಲ್',
  forYou: 'ನಿಮಗಾಗಿ', local: 'ಸ್ಥಳೀಯ', trending: 'ಟ್ರೆಂಡಿಂಗ್', breaking: 'ಬ್ರೇಕಿಂಗ್', breakingNews: 'ಬ್ರೇಕಿಂಗ್',
  listen: 'ಕೇಳಿ', stop: 'ನಿಲ್ಲಿಸಿ', share: 'ಹಂಚಿ', bookmark: 'ಉಳಿಸಿ', bookmarked: 'ಉಳಿಸಲಾಗಿದೆ', sponsored: 'ಪ್ರಾಯೋಜಿತ', advertisement: 'ಜಾಹೀರಾತು',
  justNow: 'ಈಗಷ್ಟೇ', minAgo: '{n} ನಿಮಿಷ ಹಿಂದೆ', hrAgo: '{n} ಗಂಟೆ ಹಿಂದೆ', dayAgo: '{n} ದಿನ ಹಿಂದೆ',
  categories: 'ವಿಭಾಗಗಳು', magazines: 'ನಿಯತಕಾಲಿಕೆ', topBuzz: 'ಟಾಪ್ ಬಜ್', polls: 'ಸಮೀಕ್ಷೆ', votes: '{n} ಮತಗಳು', nationwide: 'ದೇಶಾದ್ಯಂತ', yourDistrict: 'ನಿಮ್ಮ ಜಿಲ್ಲೆ',
  localAlerts: 'ಸ್ಥಳೀಯ ಎಚ್ಚರಿಕೆಗಳು', nearby: 'ಹತ್ತಿರ', mapView: 'ನಕ್ಷೆ', listView: 'ಪಟ್ಟಿ',
  bookmarks: 'ಬುಕ್‌ಮಾರ್ಕ್', history: 'ಓದಿದ ಇತಿಹಾಸ', language: 'ಭಾಷೆ', location: 'ಸ್ಥಳ', notifications: 'ಅಧಿಸೂಚನೆಗಳು', theme: 'ಥೀಮ್', settings: 'ಸೆಟ್ಟಿಂಗ್ಸ್',
  citizenReporter: 'ನಾಗರಿಕ ವರದಿಗಾರ', today60: 'ಇಂದು 60 ಸೆಕೆಂಡುಗಳಲ್ಲಿ', reportNews: 'ಸುದ್ದಿ ಕಳುಹಿಸಿ', searchPlaceholder: 'ಸುದ್ದಿ, ಸ್ಥಳ, ವಿಷಯ ಹುಡುಕಿ',
  cat_politics: 'ರಾಜಕೀಯ', cat_cinema: 'ಸಿನಿಮಾ', cat_sports: 'ಕ್ರೀಡೆ', cat_business: 'ವ್ಯಾಪಾರ', cat_tech: 'ಟೆಕ್', cat_jobs: 'ಉದ್ಯೋಗ', cat_education: 'ಶಿಕ್ಷಣ', cat_devotional: 'ಭಕ್ತಿ', cat_agriculture: 'ಕೃಷಿ', cat_health: 'ಆರೋಗ್ಯ', cat_crime: 'ಅಪರಾಧ', cat_weather: 'ಹವಾಮಾನ',
  alert_power: 'ವಿದ್ಯುತ್ ಕಡಿತ', alert_water: 'ನೀರು ಪೂರೈಕೆ', alert_traffic: 'ಸಂಚಾರ', alert_weather: 'ಹವಾಮಾನ', alert_jobs: 'ಉದ್ಯೋಗ', alert_events: 'ಕಾರ್ಯಕ್ರಮಗಳು',
};

export const ml: P = {
  tagline: 'നിങ്ങളുടെ നാട്. നിങ്ങളുടെ നഗരം. നിങ്ങളുടെ വാർത്ത.', continue: 'തുടരുക', skip: 'ഒഴിവാക്കുക', next: 'അടുത്തത്', done: 'പൂർത്തിയായി', back: 'പിന്നോട്ട്', save: 'സേവ്', cancel: 'റദ്ദാക്കുക', seeAll: 'എല്ലാം കാണുക',
  chooseLanguage: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക', chooseLanguageSub: 'വാർത്തകളും ആപ്പ് മുഴുവനും ഈ ഭാഷയിൽ കാണാം.',
  locationTitle: 'നിങ്ങളുടെ പ്രദേശത്തെ വാർത്തകൾ', locationSub: 'ജില്ല, മണ്ഡലം, ഗ്രാമം എന്നിവിടങ്ങളിലെ വാർത്തകൾക്കായി ലൊക്കേഷൻ ഉപയോഗിക്കുന്നു.',
  useMyLocation: 'എന്റെ ലൊക്കേഷൻ ഉപയോഗിക്കുക', detecting: 'ലൊക്കേഷൻ കണ്ടെത്തുന്നു…', pickManually: 'അല്ലെങ്കിൽ സ്വയം തിരഞ്ഞെടുക്കുക',
  state: 'സംസ്ഥാനം', district: 'ജില്ല', mandal: 'മണ്ഡലം', village: 'ഗ്രാമം / വാർഡ്',
  interestsTitle: 'നിങ്ങൾക്ക് എന്താണ് പ്രധാനം?', interestsSub: 'കുറഞ്ഞത് 3 വിഷയങ്ങൾ തിരഞ്ഞെടുക്കുക.', pickAtLeast: '{n} കൂടി',
  loginTitle: 'ഫോൺ വഴി സൈൻ ഇൻ', phoneNumber: 'മൊബൈൽ നമ്പർ', sendOtp: 'OTP അയയ്ക്കുക', enterOtp: '6 അക്ക കോഡ് നൽകുക', verify: 'പരിശോധിച്ച് തുടരുക', continueAsGuest: 'അതിഥിയായി തുടരുക',
  tabFeed: 'ഫീഡ്', tabExplore: 'കണ്ടെത്തുക', tabVideos: 'വീഡിയോ', tabLocal: 'പ്രാദേശികം', tabProfile: 'പ്രൊഫൈൽ',
  forYou: 'നിങ്ങൾക്കായി', local: 'പ്രാദേശികം', trending: 'ട്രെൻഡിംഗ്', breaking: 'ബ്രേക്കിംഗ്', breakingNews: 'ബ്രേക്കിംഗ്',
  listen: 'കേൾക്കുക', stop: 'നിർത്തുക', share: 'പങ്കിടുക', bookmark: 'സേവ്', bookmarked: 'സേവ് ചെയ്തു', sponsored: 'സ്പോൺസർ ചെയ്തത്', advertisement: 'പരസ്യം',
  justNow: 'ഇപ്പോൾ', minAgo: '{n} മിനിറ്റ് മുമ്പ്', hrAgo: '{n} മണിക്കൂർ മുമ്പ്', dayAgo: '{n} ദിവസം മുമ്പ്',
  categories: 'വിഭാഗങ്ങൾ', magazines: 'മാഗസിനുകൾ', topBuzz: 'ടോപ് ബസ്', polls: 'പോളുകൾ', votes: '{n} വോട്ടുകൾ', nationwide: 'രാജ്യവ്യാപകം', yourDistrict: 'നിങ്ങളുടെ ജില്ല',
  localAlerts: 'പ്രാദേശിക അറിയിപ്പുകൾ', nearby: 'സമീപം', mapView: 'മാപ്പ്', listView: 'പട്ടിക',
  bookmarks: 'ബുക്ക്മാർക്കുകൾ', history: 'വായന ചരിത്രം', language: 'ഭാഷ', location: 'ലൊക്കേഷൻ', notifications: 'അറിയിപ്പുകൾ', theme: 'തീം', settings: 'ക്രമീകരണങ്ങൾ',
  citizenReporter: 'സിറ്റിസൺ റിപ്പോർട്ടർ', today60: 'ഇന്ന് 60 സെക്കൻഡിൽ', reportNews: 'വാർത്ത അയയ്ക്കുക', searchPlaceholder: 'വാർത്ത, സ്ഥലങ്ങൾ, വിഷയങ്ങൾ തിരയുക',
  cat_politics: 'രാഷ്ട്രീയം', cat_cinema: 'സിനിമ', cat_sports: 'കായികം', cat_business: 'ബിസിനസ്', cat_tech: 'ടെക്', cat_jobs: 'ജോലി', cat_education: 'വിദ്യാഭ്യാസം', cat_devotional: 'ആത്മീയം', cat_agriculture: 'കൃഷി', cat_health: 'ആരോഗ്യം', cat_crime: 'കുറ്റകൃത്യം', cat_weather: 'കാലാവസ്ഥ',
  alert_power: 'വൈദ്യുതി മുടക്കം', alert_water: 'ജലവിതരണം', alert_traffic: 'ഗതാഗതം', alert_weather: 'കാലാവസ്ഥ', alert_jobs: 'ജോലി', alert_events: 'പരിപാടികൾ',
};

export const mr: P = {
  tagline: 'तुमचं गाव. तुमचं शहर. तुमच्या बातम्या.', continue: 'पुढे चला', skip: 'वगळा', next: 'पुढे', done: 'झाले', back: 'मागे', save: 'जतन करा', cancel: 'रद्द करा', seeAll: 'सर्व पहा',
  chooseLanguage: 'तुमची भाषा निवडा', chooseLanguageSub: 'बातम्या आणि संपूर्ण ॲप या भाषेत दिसेल.',
  locationTitle: 'तुमच्या परिसरातील बातम्या', locationSub: 'तुमचा जिल्हा, तालुका आणि गावातील बातम्यांसाठी आम्ही लोकेशन वापरतो.',
  useMyLocation: 'माझे लोकेशन वापरा', detecting: 'लोकेशन शोधत आहे…', pickManually: 'किंवा स्वतः निवडा',
  state: 'राज्य', district: 'जिल्हा', mandal: 'तालुका', village: 'गाव / वॉर्ड',
  interestsTitle: 'तुम्हाला कशात रस आहे?', interestsSub: 'किमान 3 विषय निवडा.', pickAtLeast: 'आणखी {n}',
  loginTitle: 'फोनने साइन इन करा', phoneNumber: 'मोबाइल नंबर', sendOtp: 'OTP पाठवा', enterOtp: '6 अंकी कोड टाका', verify: 'पडताळा आणि पुढे चला', continueAsGuest: 'पाहुणे म्हणून पुढे चला',
  tabFeed: 'फीड', tabExplore: 'शोधा', tabVideos: 'व्हिडिओ', tabLocal: 'स्थानिक', tabProfile: 'प्रोफाइल',
  forYou: 'तुमच्यासाठी', local: 'स्थानिक', trending: 'ट्रेंडिंग', breaking: 'ब्रेकिंग', breakingNews: 'ब्रेकिंग',
  listen: 'ऐका', stop: 'थांबा', share: 'शेअर', bookmark: 'जतन', bookmarked: 'जतन केले', sponsored: 'प्रायोजित', advertisement: 'जाहिरात',
  justNow: 'आत्ताच', minAgo: '{n} मिनिटांपूर्वी', hrAgo: '{n} तासांपूर्वी', dayAgo: '{n} दिवसांपूर्वी',
  categories: 'विभाग', magazines: 'मासिके', topBuzz: 'टॉप बझ', polls: 'मतदान', votes: '{n} मते', nationwide: 'देशभर', yourDistrict: 'तुमचा जिल्हा',
  localAlerts: 'स्थानिक सूचना', nearby: 'जवळपास', mapView: 'नकाशा', listView: 'यादी',
  bookmarks: 'बुकमार्क', history: 'वाचन इतिहास', language: 'भाषा', location: 'लोकेशन', notifications: 'सूचना', theme: 'थीम', settings: 'सेटिंग्ज',
  citizenReporter: 'नागरिक वार्ताहर', today60: 'आज 60 सेकंदात', reportNews: 'बातमी पाठवा', searchPlaceholder: 'बातम्या, ठिकाणे, विषय शोधा',
  cat_politics: 'राजकारण', cat_cinema: 'सिनेमा', cat_sports: 'क्रीडा', cat_business: 'व्यवसाय', cat_tech: 'टेक', cat_jobs: 'नोकऱ्या', cat_education: 'शिक्षण', cat_devotional: 'भक्ती', cat_agriculture: 'शेती', cat_health: 'आरोग्य', cat_crime: 'गुन्हे', cat_weather: 'हवामान',
  alert_power: 'वीज खंडित', alert_water: 'पाणीपुरवठा', alert_traffic: 'वाहतूक', alert_weather: 'हवामान', alert_jobs: 'नोकऱ्या', alert_events: 'कार्यक्रम',
};

export const bn: P = {
  tagline: 'আপনার গ্রাম. আপনার শহর. আপনার খবর.', continue: 'এগিয়ে যান', skip: 'এড়িয়ে যান', next: 'পরবর্তী', done: 'সম্পন্ন', back: 'পিছনে', save: 'সংরক্ষণ', cancel: 'বাতিল', seeAll: 'সব দেখুন',
  chooseLanguage: 'আপনার ভাষা বেছে নিন', chooseLanguageSub: 'খবর ও পুরো অ্যাপ এই ভাষায় দেখাবে.',
  locationTitle: 'আপনার এলাকার খবর', locationSub: 'আপনার জেলা, ব্লক ও গ্রামের খবর দেখাতে আমরা লোকেশন ব্যবহার করি.',
  useMyLocation: 'আমার লোকেশন ব্যবহার করুন', detecting: 'লোকেশন খোঁজা হচ্ছে…', pickManually: 'অথবা নিজে বেছে নিন',
  state: 'রাজ্য', district: 'জেলা', mandal: 'ব্লক', village: 'গ্রাম / ওয়ার্ড',
  interestsTitle: 'আপনার আগ্রহ কীসে?', interestsSub: 'অন্তত 3টি বিষয় বেছে নিন.', pickAtLeast: 'আরও {n}টি',
  loginTitle: 'ফোন দিয়ে সাইন ইন করুন', phoneNumber: 'মোবাইল নম্বর', sendOtp: 'OTP পাঠান', enterOtp: '6 সংখ্যার কোড লিখুন', verify: 'যাচাই করে এগিয়ে যান', continueAsGuest: 'অতিথি হিসেবে চালিয়ে যান',
  tabFeed: 'ফিড', tabExplore: 'অন্বেষণ', tabVideos: 'ভিডিও', tabLocal: 'স্থানীয়', tabProfile: 'প্রোফাইল',
  forYou: 'আপনার জন্য', local: 'স্থানীয়', trending: 'ট্রেন্ডিং', breaking: 'ব্রেকিং', breakingNews: 'ব্রেকিং',
  listen: 'শুনুন', stop: 'থামান', share: 'শেয়ার', bookmark: 'সংরক্ষণ', bookmarked: 'সংরক্ষিত', sponsored: 'স্পনসর্ড', advertisement: 'বিজ্ঞাপন',
  justNow: 'এইমাত্র', minAgo: '{n} মিনিট আগে', hrAgo: '{n} ঘণ্টা আগে', dayAgo: '{n} দিন আগে',
  categories: 'বিভাগ', magazines: 'পত্রিকা', topBuzz: 'টপ বাজ', polls: 'ভোট', votes: '{n} ভোট', nationwide: 'দেশজুড়ে', yourDistrict: 'আপনার জেলা',
  localAlerts: 'স্থানীয় সতর্কতা', nearby: 'কাছাকাছি', mapView: 'মানচিত্র', listView: 'তালিকা',
  bookmarks: 'বুকমার্ক', history: 'পড়ার ইতিহাস', language: 'ভাষা', location: 'লোকেশন', notifications: 'বিজ্ঞপ্তি', theme: 'থিম', settings: 'সেটিংস',
  citizenReporter: 'নাগরিক সাংবাদিক', today60: 'আজ 60 সেকেন্ডে', reportNews: 'খবর পাঠান', searchPlaceholder: 'খবর, জায়গা, বিষয় খুঁজুন',
  cat_politics: 'রাজনীতি', cat_cinema: 'সিনেমা', cat_sports: 'খেলা', cat_business: 'ব্যবসা', cat_tech: 'প্রযুক্তি', cat_jobs: 'চাকরি', cat_education: 'শিক্ষা', cat_devotional: 'ভক্তি', cat_agriculture: 'কৃষি', cat_health: 'স্বাস্থ্য', cat_crime: 'অপরাধ', cat_weather: 'আবহাওয়া',
  alert_power: 'বিদ্যুৎ বিভ্রাট', alert_water: 'জল সরবরাহ', alert_traffic: 'যানজট', alert_weather: 'আবহাওয়া', alert_jobs: 'চাকরি', alert_events: 'অনুষ্ঠান',
};

export const gu: P = {
  tagline: 'તમારું ગામ. તમારું શહેર. તમારા સમાચાર.', continue: 'આગળ વધો', skip: 'છોડો', next: 'આગળ', done: 'થઈ ગયું', back: 'પાછળ', save: 'સાચવો', cancel: 'રદ કરો', seeAll: 'બધું જુઓ',
  chooseLanguage: 'તમારી ભાષા પસંદ કરો', chooseLanguageSub: 'સમાચાર અને આખી ઍપ આ ભાષામાં દેખાશે.',
  locationTitle: 'તમારા વિસ્તારના સમાચાર', locationSub: 'તમારા જિલ્લા, તાલુકા અને ગામના સમાચાર માટે અમે લોકેશન વાપરીએ છીએ.',
  useMyLocation: 'મારું લોકેશન વાપરો', detecting: 'લોકેશન શોધી રહ્યા છીએ…', pickManually: 'અથવા જાતે પસંદ કરો',
  state: 'રાજ્ય', district: 'જિલ્લો', mandal: 'તાલુકો', village: 'ગામ / વોર્ડ',
  interestsTitle: 'તમને શેમાં રસ છે?', interestsSub: 'ઓછામાં ઓછા 3 વિષય પસંદ કરો.', pickAtLeast: 'વધુ {n}',
  loginTitle: 'ફોનથી સાઇન ઇન કરો', phoneNumber: 'મોબાઇલ નંબર', sendOtp: 'OTP મોકલો', enterOtp: '6 અંકનો કોડ દાખલ કરો', verify: 'ચકાસો અને આગળ વધો', continueAsGuest: 'મહેમાન તરીકે ચાલુ રાખો',
  tabFeed: 'ફીડ', tabExplore: 'શોધો', tabVideos: 'વીડિયો', tabLocal: 'સ્થાનિક', tabProfile: 'પ્રોફાઇલ',
  forYou: 'તમારા માટે', local: 'સ્થાનિક', trending: 'ટ્રેન્ડિંગ', breaking: 'બ્રેકિંગ', breakingNews: 'બ્રેકિંગ',
  listen: 'સાંભળો', stop: 'બંધ કરો', share: 'શેર', bookmark: 'સાચવો', bookmarked: 'સાચવ્યું', sponsored: 'પ્રાયોજિત', advertisement: 'જાહેરાત',
  justNow: 'હમણાં', minAgo: '{n} મિનિટ પહેલાં', hrAgo: '{n} કલાક પહેલાં', dayAgo: '{n} દિવસ પહેલાં',
  categories: 'વિભાગો', magazines: 'મેગેઝિન', topBuzz: 'ટોપ બઝ', polls: 'મતદાન', votes: '{n} મત', nationwide: 'દેશભરમાં', yourDistrict: 'તમારો જિલ્લો',
  localAlerts: 'સ્થાનિક ચેતવણી', nearby: 'નજીકમાં', mapView: 'નકશો', listView: 'યાદી',
  bookmarks: 'બુકમાર્ક', history: 'વાંચન ઇતિહાસ', language: 'ભાષા', location: 'લોકેશન', notifications: 'સૂચનાઓ', theme: 'થીમ', settings: 'સેટિંગ્સ',
  citizenReporter: 'નાગરિક પત્રકાર', today60: 'આજ 60 સેકન્ડમાં', reportNews: 'સમાચાર મોકલો', searchPlaceholder: 'સમાચાર, સ્થળો, વિષયો શોધો',
  cat_politics: 'રાજકારણ', cat_cinema: 'સિનેમા', cat_sports: 'રમતગમત', cat_business: 'વ્યાપાર', cat_tech: 'ટેક', cat_jobs: 'નોકરી', cat_education: 'શિક્ષણ', cat_devotional: 'ભક્તિ', cat_agriculture: 'ખેતી', cat_health: 'આરોગ્ય', cat_crime: 'ગુનો', cat_weather: 'હવામાન',
  alert_power: 'વીજ કાપ', alert_water: 'પાણી પુરવઠો', alert_traffic: 'ટ્રાફિક', alert_weather: 'હવામાન', alert_jobs: 'નોકરી', alert_events: 'કાર્યક્રમો',
};
