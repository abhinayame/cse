/**
 * Help, FAQ and the contributor policies. The legal texts here are a plain-language starting point
 * and MUST be reviewed by an Indian media / data-protection lawyer before launch (see docs/REPORTER_ECOSYSTEM.md).
 */
import { useLang, useT, rupees } from '../i18n';
import { useReporter } from '../ReporterApp';

export function ContributorAgreement() {
  const lang = useLang();
  if (lang === 'te') return (
    <div className="rp-body-text" style={{ fontSize: 14 }}>
      <p><b>1. మీ పాత్ర.</b> మీరు చాటింపుకు స్వతంత్ర కంట్రిబ్యూటర్‌గా సమాచారం పంపుతారు. మీరు ఉద్యోగి కారు. కంట్రిబ్యూటర్ హోదాలు ప్రెస్ అక్రిడిటేషన్ కావు; చాటింపు పేరుతో ప్రభుత్వ / పోలీస్ అనుమతులు కోరకూడదు.</p>
      <p><b>2. ఖచ్చితత్వం.</b> మీరు చూసిన లేదా నిర్ధారించిన విషయాలే పంపండి. ఊహాగానాలు, పుకార్లు, ద్వేషపూరిత లేదా మత / కుల వైషమ్యాలు రెచ్చగొట్టే విషయాలు పంపకూడదు.</p>
      <p><b>3. మీడియా హక్కులు.</b> ఫోటోలు / వీడియోలు మీవి అయి ఉండాలి లేదా అనుమతి ఉండాలి. ఒరిజినల్ కాపీ మీ వద్దే ఉంటుంది; చాటింపుకు ప్రచురించే, సవరించే, అనువదించే నాన్-ఎక్స్‌క్లూజివ్ హక్కు ఇస్తారు. ప్రచురించిన వార్తలో మీ పేరు ఉంటుంది.</p>
      <p><b>4. సమ్మతి & గోప్యత.</b> బాధితులు, పిల్లలు, లైంగిక నేరాల బాధితుల గుర్తింపు బయటపెట్టకూడదు. ప్రైవేట్ ప్రదేశాల్లో అనుమతి లేకుండా చిత్రీకరించకూడదు. మీ ఆధారాల (సోర్సెస్) వివరాలు ఎడిటర్లకు మాత్రమే కనిపిస్తాయి.</p>
      <p><b>5. ఎడిటోరియల్ నిర్ణయం.</b> ఏది ప్రచురించాలో ఎడిటర్లు నిర్ణయిస్తారు. ఆటోమేటిక్ (AI) తనిఖీలు సహాయం మాత్రమే — నిజానికి రుజువు కావు. సున్నితమైన ఆరోపణలు మానవ ధృవీకరణ లేకుండా ప్రచురించబడవు.</p>
      <p><b>6. చెల్లింపులు.</b> ఆమోదించిన, అర్హత గల కంట్రిబ్యూషన్లకు మాత్రమే రేట్ కార్డ్ ప్రకారం చెల్లిస్తాం. కనీస ఉపసంహరణ పరిమితి వర్తిస్తుంది. వర్తించే పన్నులు (TDS) చట్టప్రకారం మినహాయించబడవచ్చు.</p>
      <p><b>7. సవరణలు.</b> ప్రచురించిన వార్తలో పొరపాటు ఉంటే వెంటనే తెలపండి. అవసరమైతే సవరణ / ఉపసంహరణ నోట్‌తో అప్‌డేట్ చేస్తాం. మోసపూరిత కంటెంట్ పంపితే ఖాతా నిలిపివేయబడి, సంబంధిత ఆదాయం రద్దవుతుంది.</p>
    </div>
  );
  return (
    <div className="rp-body-text" style={{ fontSize: 14 }}>
      <p><b>1. Your role.</b> You contribute to Chatimpu as an independent contributor, not an employee. Contributor titles describe your role on Chatimpu and are <b>not press accreditation</b>; do not use Chatimpu's name to seek government or police privileges.</p>
      <p><b>2. Accuracy.</b> Send only what you saw or verified. Do not send rumours, speculation, hate speech or content that inflames religious or caste tensions.</p>
      <p><b>3. Media rights.</b> Photos, videos and audio must be yours or used with permission. You keep the original and grant Chatimpu a non-exclusive licence to publish, edit, translate and distribute it, with credit to you.</p>
      <p><b>4. Consent and privacy.</b> Never identify victims of sexual offences, children in sensitive situations, or patients without consent. Do not record in private places without permission. Your sources are visible only to editors and are never published.</p>
      <p><b>5. Editorial decisions.</b> Editors decide what is published. Automated (AI) checks only assist editors and are never proof that something is true. Sensitive allegations are never published without human verification.</p>
      <p><b>6. Payments.</b> Only approved, eligible contributions earn money, at the rates on the current rate card. A minimum withdrawal threshold applies. Taxes such as TDS may be deducted where the law requires.</p>
      <p><b>7. Corrections.</b> Tell us immediately if something published is wrong; we will update it with a correction note. Fabricated content leads to suspension and reversal of related earnings.</p>
    </div>
  );
}

const FAQ_EN: [string, string][] = [
  ['How do I get paid?', 'Each story an editor approves earns money according to the rate card. Once your available balance reaches the minimum, request a withdrawal to a verified UPI ID or bank account. The finance team approves it and pays you; you will see the UTR reference once the bank confirms it.'],
  ['Why is my money "pending"?', 'Stories still under review are pending. They only become available after an editor approves them. Rejected stories do not earn.'],
  ['My payout failed. Did I lose the money?', 'No. When a payout fails or is reversed by the bank, the finance team reconciles it and the full amount returns to your available balance.'],
  ['Why was my story not accepted?', 'Common reasons: not newsworthy locally, duplicate of another report, not verifiable, or a policy issue. The editor note explains the reason.'],
  ['What is a correction request?', 'The editor needs more details or a fix. Open the story, edit it and send it again.'],
  ['Who sees my sources?', 'Only editors. Source notes, ID documents and payment details are never shown publicly or to other reporters.'],
  ['Can I send the same story to other outlets?', 'You keep your original material; but each story can earn on Chatimpu only once, and copied content from others does not earn.'],
];
const FAQ_TE: [string, string][] = [
  ['నాకు డబ్బు ఎలా వస్తుంది?', 'ఎడిటర్ ఆమోదించిన ప్రతి వార్తకు రేట్ కార్డ్ ప్రకారం ఆదాయం జమ అవుతుంది. అందుబాటు బ్యాలెన్స్ కనీస పరిమితిని చేరాక, ధృవీకరించిన UPI / బ్యాంక్ ఖాతాకు ఉపసంహరణ అభ్యర్థించండి. ఫైనాన్స్ బృందం ఆమోదించి చెల్లిస్తుంది; బ్యాంక్ నిర్ధారించాక UTR నంబర్ కనిపిస్తుంది.'],
  ['నా డబ్బు "పరిశీలనలో" ఎందుకు ఉంది?', 'ఇంకా పరిశీలనలో ఉన్న వార్తల మొత్తం పెండింగ్‌లో ఉంటుంది. ఎడిటర్ ఆమోదించాకే అందుబాటులోకి వస్తుంది.'],
  ['చెల్లింపు విఫలమైంది. డబ్బు పోయిందా?', 'లేదు. చెల్లింపు విఫలమైనా, బ్యాంక్ వెనక్కి పంపినా ఫైనాన్స్ బృందం సరిచూసి పూర్తి మొత్తాన్ని మీ బ్యాలెన్స్‌కు తిరిగి జమ చేస్తుంది.'],
  ['నా వార్త ఎందుకు ఆమోదించబడలేదు?', 'స్థానిక ప్రాధాన్యత లేకపోవడం, నకిలీ / ఇప్పటికే వచ్చిన వార్త, నిర్ధారించలేకపోవడం లేదా విధాన సమస్య. ఎడిటర్ సూచనలో కారణం ఉంటుంది.'],
  ['సవరణ అభ్యర్థన అంటే?', 'ఎడిటర్‌కు మరిన్ని వివరాలు కావాలి. వార్తను తెరిచి సవరించి మళ్ళీ పంపండి.'],
  ['నా సోర్సెస్ ఎవరు చూస్తారు?', 'ఎడిటర్లు మాత్రమే. ఆధారాలు, గుర్తింపు పత్రాలు, చెల్లింపు వివరాలు బహిరంగంగా లేదా ఇతర రిపోర్టర్లకు ఎప్పుడూ కనిపించవు.'],
];

export default function Help() {
  const t = useT(); const lang = useLang();
  const { dash } = useReporter();
  const faq = lang === 'te' ? FAQ_TE : FAQ_EN;
  return (
    <>
      <h1 className="rp-section">{t('help')}</h1>
      <section className="rp-section rp-card">
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        <p className="rp-hint" style={{ marginTop: 12 }}>{t('threshold')}: {rupees(dash.threshold_paise)}</p>
      </section>
      <section className="rp-section rp-card">
        <details open={false}><summary>{t('agreement')}</summary><ContributorAgreement /></details>
        <details><summary>{lang === 'te' ? 'సవరణల విధానం' : 'Corrections policy'}</summary>
          <p>{lang === 'te' ? 'ప్రచురించిన వార్తలో పొరపాటు కనిపిస్తే ఎడిటర్లు సవరించి, తేదీతో కూడిన సవరణ నోట్ జోడిస్తారు. తీవ్రమైన పొరపాట్లకు వార్త ఉపసంహరించబడుతుంది. పాఠకులు యాప్‌లో "రిపోర్ట్" ద్వారా తెలపవచ్చు.' : 'When a published story contains an error, editors correct it and add a dated correction note. Serious errors lead to withdrawal of the story. Readers can flag errors with “Report” in the app.'}</p></details>
        <details><summary>{lang === 'te' ? 'గోప్యతా నోటీసు' : 'Privacy notice'}</summary>
          <p>{lang === 'te'
            ? 'మేము సేకరించేవి: పేరు, మొబైల్, ఈమెయిల్ (ఐచ్ఛికం), ప్రాంతం, ఫోటో, గుర్తింపు పత్రం (మాస్క్ చేసినది), చెల్లింపు వివరాలు (ఎన్‌క్రిప్ట్ చేసినవి). వీటిని కంట్రిబ్యూటర్ ధృవీకరణ, చెల్లింపులు, చట్టపరమైన బాధ్యతల కోసం మాత్రమే ఉపయోగిస్తాం. మీ డేటా యాక్సెస్, సవరణ, తొలగింపు కోసం సహాయం విభాగాన్ని సంప్రదించండి.'
            : 'We collect your name, mobile number, optional email, area, photo, a masked identity document and encrypted payment details. We use them only to verify contributors, pay you, and meet legal obligations (Digital Personal Data Protection Act, 2023). Ask support to access, correct or delete your data; payment records are kept as long as tax law requires.'}</p></details>
        <details><summary>{lang === 'te' ? 'పన్నులు' : 'Taxes'}</summary>
          <p>{lang === 'te' ? 'చట్టప్రకారం అవసరమైతే TDS మినహాయించి, ఫారం 16A అందిస్తాం. మీ PAN వివరాలు ఫైనాన్స్ బృందం అడగవచ్చు.' : 'Where the law requires, TDS may be deducted and a Form 16A issued. The finance team may ask for your PAN for this.'}</p></details>
      </section>
      <section className="rp-section rp-card">
        <h2 style={{ marginBottom: 8 }}>{lang === 'te' ? 'సంప్రదించండి' : 'Contact support'}</h2>
        <p className="rp-meta">{lang === 'te' ? 'మీ రిపోర్టర్ ID, సబ్మిషన్ / ఉపసంహరణ కోడ్ (ఉదా. CHT-…, WDR-…) తెలపండి. పాస్‌వర్డ్, OTP, పూర్తి ఖాతా నంబర్ ఎప్పుడూ అడగం.' : 'Quote your submission or withdrawal code (e.g. CHT-…, WDR-…). We will never ask for your OTP, PIN or full account number.'}</p>
        <a className="rp-btn dark block" style={{ marginTop: 10 }} href="mailto:reporters@chatimpu.com">reporters@chatimpu.com</a>
      </section>
    </>
  );
}
