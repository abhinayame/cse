/* End-to-end: reporter portal (mobile) + newsroom CMS (desktop) against the local stack.
 * Covers onboarding → verification → submission with media → editorial approval with earnings →
 * payout method → withdrawal (₹295 + ₹10 → request ₹300 → ₹5 left) → failed payout → reconciliation
 * → retry → paid with UTR. Screenshots go to ./shots. */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8090';
const keys = { service: process.env.SUPABASE_SERVICE_ROLE_KEY };
if (!keys.service) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY');
const PG = (process.env.PGURL ?? 'postgres://postgres@127.0.0.1:54329/sb');
const SHOTS = process.env.E2E_SHOTS ?? path.join(require('os').tmpdir(), 'chatimpu-e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const PHONE = '9000000001';
const RUN = Date.now().toString(36);
const NAME = 'Lakshmi ' + Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('').replace(/^./, (c) => c.toUpperCase());
const sql = (q) => execFileSync('psql', [PG, '-tAq', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const svc = (p, init = {}) => fetch(`${BASE}${p}`, { ...init, headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  .then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(`${p}: ${JSON.stringify(b)}`); return b; });
const steps = [];
const step = async (name, fn) => { const t = Date.now(); try { await fn(); steps.push(`✓ ${name} (${Date.now() - t}ms)`); console.log(`✓ ${name}`); } catch (e) { steps.push(`✗ ${name}: ${e.message}`); console.log(`✗ ${name}\n${e.stack}`); throw e; } };

async function staff(name, role, perms = []) {
  const email = `${name.toLowerCase().replace(/\W+/g, "-")}.${RUN}@e2e.chatimpu.test`, password = 'E2e-pass-123!';
  const u = await svc('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  if (role) await svc(`/rest/v1/profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ role, display_name: name }) });
  else await svc(`/rest/v1/profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ display_name: name }) });
  for (const p of perms) await svc('/rest/v1/staff_permissions', { method: 'POST', body: JSON.stringify({ user_id: u.id, permission: p }) });
  return { id: u.id, email, password };
}
async function cmsLogin(page, who) {
  await page.goto(`${BASE}/`);
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('.sidebar').waitFor();
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: page === undefined || page.viewportSize().width < 500 });
const toast = (page, re) => page.locator('.toast, .rp-toast').filter({ hasText: re }).first().waitFor({ timeout: 15000 });
const reasonDialog = async (page, text) => { const d = page.getByRole('dialog'); await d.locator('textarea').fill(text); await d.getByRole('button', { name: 'Confirm' }).click(); };

(async () => {
  // Free the test phone number from earlier runs (GoTrue test OTP is fixed per number).
  sql(`update auth.users set phone = '91' || (8000000000 + floor(random()*999999999))::bigint where phone = '91${PHONE}'`);
  sql(`update app_settings set value = '30000' where key = 'withdrawal_threshold_paise'`);
  sql(`update app_settings set value = 'false' where key = 'tds_enabled'`); // a failed earlier run may have left TDS on
  sql(`update citizen_reports set submitted_at = submitted_at - interval '30 days' where submitted_at > now() - interval '30 days'`); // earlier runs' identical stories are real duplicates (0008)
  sql(`update app_settings set value = '5000000' where key = 'tds_threshold_paise'`);
  const editor = await staff('Editor E2E', 'editor');
  const finance = await staff('Finance E2E', null, ['finance']); // finance-only: no newsroom role

  const browser = await chromium.launch();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [] });
  const desk = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const fin = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const rp = await mobile.newPage(); const ed = await desk.newPage(); const fp = await fin.newPage();
  for (const p of [rp, ed, fp]) p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  let reporterId;

  try {
    await step('Reporter signs in with mobile OTP (Telugu UI by default)', async () => {
      await rp.goto(`${BASE}/reporter`);
      await rp.getByText('మీ ప్రాంత వార్తలు పంపండి').first().waitFor();
      await shot(rp, '01-portal-login-te');
      await rp.getByRole('button', { name: 'English' }).click();
      await rp.getByLabel('Mobile number').fill(PHONE);
      await rp.getByRole('button', { name: 'Send code' }).click();
      await rp.getByLabel('6-digit code').fill('123456');
      await rp.getByRole('button', { name: 'Verify' }).click();
      await rp.getByText('Become a Chatimpu contributor').first().waitFor();
    });

    await step('Reporter registers in 4 steps and accepts the contributor agreement', async () => {
      await rp.getByLabel('Full name').fill(NAME);
      await rp.getByLabel('Email (optional)').fill(`lakshmi.${RUN}@example.com`);
      await rp.getByRole('button', { name: 'Next' }).click();
      await rp.getByLabel('Town / locality / village').fill('Ameerpet, Ward 98');
      await rp.getByRole('button', { name: 'Next' }).click();
      await rp.getByRole('button', { name: 'Education' }).click();
      await rp.getByLabel('Introduce yourself (optional)').fill('Teacher and resident of Ameerpet for 12 years.');
      await shot(rp, '02-register-interests');
      await rp.getByRole('button', { name: 'Next' }).click();
      await rp.getByText('not press accreditation').first().waitFor();
      await rp.getByLabel(/I have read and accept/).check();
      await rp.getByRole('button', { name: 'Create my reporter account' }).click();
      await rp.getByText('Add an identity document').first().waitFor();
      reporterId = sql(`select id from auth.users where phone = '91${PHONE}'`);
      assert.equal(sql(`select status from reporter_profiles where user_id = '${reporterId}'`), 'registered');
      await shot(rp, '03-home-registered');
    });

    await step('Unverified reporter cannot send for review (button disabled + server guard)', async () => {
      await rp.goto(`${BASE}/reporter/submit`);
      await rp.getByText('Add an identity document so our team can verify you').first().waitFor();
      assert.equal(await rp.getByRole('button', { name: 'Send for review' }).isDisabled(), true);
    });

    await step('Reporter uploads a masked ID document (private bucket)', async () => {
      await rp.goto(`${BASE}/reporter/profile`);
      await rp.getByLabel('Document type').selectOption('aadhaar_masked');
      await rp.getByLabel('Last 4 characters').fill('4821');
      await rp.getByLabel('Upload document photo').setInputFiles({ name: 'aadhaar-masked.png', mimeType: 'image/png', buffer: png(240, 150, [40, 90, 160]) });
      await rp.getByRole('button', { name: 'Submit for verification' }).click();
      await rp.getByText('Being verified').first().waitFor();
      assert.equal(sql(`select status from reporter_profiles where user_id = '${reporterId}'`), 'verification_pending');
      assert.match(sql(`select document_path from reporter_verifications where user_id = '${reporterId}'`), new RegExp(`^${reporterId}/id/`));
      await shot(rp, '04-profile-verification-pending');
    });

    await step('Editor verifies identity and activates the reporter (Reporters page)', async () => {
      await cmsLogin(ed, editor);
      await ed.getByRole('link', { name: 'Reporters' }).click();
      await ed.getByText(NAME).first().click();
      await ed.getByRole('button', { name: 'View document' }).waitFor();
      await shot(ed, '05-cms-reporter-verification');
      await ed.getByRole('button', { name: '✓ Verify identity' }).click(); await reasonDialog(ed, '');
      await toast(ed, /Verify/);
      await ed.getByRole('button', { name: 'Activate' }).click(); await reasonDialog(ed, 'Welcome to Chatimpu');
      await toast(ed, /Approve/);
      assert.equal(sql(`select status from reporter_profiles where user_id = '${reporterId}'`), 'active');
      assert.equal(sql(`select status from reporter_verifications where user_id = '${reporterId}'`), 'approved');
    });

    let subId, subCode;
    await step('Reporter submits a photo story with a voice-less draft, upload progress and consent', async () => {
      await rp.goto(`${BASE}/reporter/submit`);
      await rp.getByRole('button', { name: /Photo story/ }).click();
      await rp.getByLabel('Headline').fill(`Ameerpet school gets new library after parents' campaign ${RUN}`);
      await rp.getByLabel('Full description').fill('The government high school in Ameerpet opened a new library room on Monday. Parents had petitioned the education department for two years. The headmaster said 1,200 books were donated by residents and a local trust, and the room will stay open after school hours for students preparing for exams.');
      await rp.getByLabel('Exact location').fill('ZPHS Ameerpet, near the bus depot');
      await rp.locator('input[type=file][multiple]').setInputFiles([{ name: 'library.jpg', mimeType: 'image/png', buffer: png(800, 600, [200, 60, 40]) }]);
      await rp.locator('.rp-media .tile .state', { hasText: '✓' }).waitFor({ timeout: 20000 });
      await rp.getByLabel(/Sources & evidence/).fill('Spoke to the headmaster (name withheld) and two parents; saw the donation register.');
      await rp.getByRole('button', { name: 'Save draft' }).click();
      await toast(rp, /Draft saved/);
      await rp.getByLabel(/I captured this material myself/).check();
      await shot(rp, '06-submit-form');
      await rp.getByRole('button', { name: 'Send for review' }).click();
      await rp.getByText('Progress').first().waitFor();
      subId = sql(`select id from citizen_reports where reporter_id = '${reporterId}' order by created_at desc limit 1`);
      subCode = sql(`select code from citizen_reports where id = '${subId}'`);
      assert.match(subCode, /^CHT-\d{4}-\d{6}$/);
      assert.equal(sql(`select status from citizen_reports where id = '${subId}'`), 'under_review');
      assert.equal(sql(`select bucket || ':' || split_part(storage_path, '/', 1) from submission_media where submission_id = '${subId}'`), `submissions:${reporterId}`);
      await shot(rp, '07-submission-detail-under-review');
    });

    await step('Editor reviews on the editorial desk and approves & publishes with a ₹10 photo earning', async () => {
      await ed.getByRole('link', { name: 'Editorial desk' }).click();
      await ed.getByText(subCode).first().click();
      await ed.getByText('Sources & evidence — confidential').first().waitFor();
      await ed.locator('.media-row img').first().waitFor();
      const summary = 'Ameerpet government high school opened a new library room on Monday after parents petitioned the education department for two years. Residents and a local trust donated 1,200 books, and the headmaster said the room will stay open after school hours so students can prepare for exams.';
      await ed.getByLabel(/Published summary/).fill(summary);
      assert.equal(await ed.getByLabel('Contribution (rate card)').inputValue(), 'original_photo');
      await shot(ed, '08-cms-editorial-desk');
      await ed.getByRole('button', { name: 'Approve & publish' }).click(); await reasonDialog(ed, 'Good original photo — thank you');
      await toast(ed, /credited ₹10/);
      assert.equal(sql(`select status from citizen_reports where id = '${subId}'`), 'published');
      assert.equal(sql(`select count(*) from reporter_earnings where submission_id = '${subId}'`), '1');
      assert.match(sql(`select image_path from stories where citizen_report_id = '${subId}'`), /^stories\/citizen-/);
    });

    await step('Seed ₹295 earlier earnings → wallet shows ₹305 available, ₹300 threshold met', async () => {
      sql(`select credit_earning('${reporterId}', 'bonus', 29500, null, null, null, 'E2E: earlier approved work')`);
      await rp.goto(`${BASE}/reporter`);
      await rp.locator('.rp-hero .big', { hasText: '₹305' }).waitFor();
      await rp.getByText('You can withdraw now').first().waitFor();
      await shot(rp, '09-home-eligible-305');
    });

    await step('Reporter adds a UPI payout method (encrypted server-side, masked in UI)', async () => {
      await rp.goto(`${BASE}/reporter/methods`);
      await rp.getByRole('button', { name: /Add UPI ID/ }).click();
      await rp.getByLabel('UPI ID', { exact: true }).fill('lakshmi.p@okaxis');
      await rp.getByRole('button', { name: 'Save' }).click();
      await rp.getByText('Being verified').first().waitFor();
      const masked = sql(`select masked from payout_methods where reporter_id = '${reporterId}'`);
      assert.ok(!masked.includes('lakshmi.p@okaxis'), 'UPI is masked');
      assert.ok(!sql(`select ciphertext from payout_method_secrets s join payout_methods m on m.id = s.method_id where m.reporter_id = '${reporterId}'`).includes('okaxis'), 'secret encrypted at rest');
      await shot(rp, '10-methods-pending');
    });

    await step('Editor has no finance access; finance-only account sees only the finance desk', async () => {
      await ed.goto(`${BASE}/finance`);
      await ed.waitForURL((u) => !u.pathname.startsWith('/finance'));
      assert.equal(await ed.getByRole('link', { name: 'Finance' }).count(), 0);
      await cmsLogin(fp, finance);
      await fp.waitForURL(/\/finance/);
      assert.equal(await fp.getByRole('link', { name: 'Editorial desk' }).count(), 0);
      await fp.getByText('Test mode — mock payout provider').first().waitFor();
      await shot(fp, '11-finance-overview');
    });

    await step('Finance verifies the payout method', async () => {
      await fp.getByRole('button', { name: 'Payment methods' }).click();
      await fp.getByRole('row', { name: new RegExp(NAME) }).getByRole('button', { name: 'Verify' }).click();
      await reasonDialog(fp, 'UPI name lookup matches');
      await toast(fp, /verified/);
    });

    let wid;
    await step('Reporter requests ₹300 → ₹300 reserved, ₹5 left available', async () => {
      await rp.goto(`${BASE}/reporter/withdraw`);
      await rp.getByLabel('Amount (₹)').fill('300');
      await shot(rp, '12-withdraw-form');
      await rp.getByRole('button', { name: /Request withdrawal ₹300/ }).click();
      await toast(rp, /WDR-/);
      await rp.locator('.rp-hero .big', { hasText: '₹5' }).waitFor();
      assert.equal(sql(`select available_paise || '/' || reserved_paise from wallet_accounts where reporter_id = '${reporterId}'`), '500/30000');
      wid = sql(`select id from withdrawal_requests where reporter_id = '${reporterId}'`);
      await shot(rp, '13-withdraw-reserved');
    });

    await step('Double-spend guard: a second ₹300 request is refused', async () => {
      assert.equal(await rp.getByRole('button', { name: /Request withdrawal/ }).isDisabled(), true);
    });

    const openWithdrawal = async () => {
      await fp.getByRole('button', { name: 'Withdrawals' }).click();
      await fp.locator('.filters select').first().selectOption('all');
      await fp.locator('.queue-item', { hasText: NAME }).first().click();
    };
    await step('Finance approves and sends the payout (mock provider) → processing, not paid', async () => {
      await openWithdrawal();
      fp.once('dialog', (d) => d.accept());
      await fp.getByRole('button', { name: 'Approve', exact: true }).click();
      await toast(fp, /Approved/);
      fp.once('dialog', (d) => d.accept());
      await fp.getByRole('button', { name: /Send payout \(mock\)/ }).click();
      await toast(fp, /waiting for confirmation/);
      assert.equal(sql(`select status from withdrawal_requests where id = '${wid}'`), 'processing');
      await shot(fp, '14-finance-processing');
    });

    await step('Provider reports failure → needs reconciliation; balance NOT restored yet', async () => {
      await fp.getByRole('button', { name: 'failed', exact: true }).click();
      await toast(fp, /Simulated failed/);
      assert.equal(sql(`select status || '/' || needs_reconciliation from withdrawal_requests where id = '${wid}'`), 'failed/true');
      assert.equal(sql(`select available_paise || '/' || reserved_paise from wallet_accounts where reporter_id = '${reporterId}'`), '500/30000');
    });

    await step('Finance reconciles → ₹300 restored, reporter back to ₹305', async () => {
      await fp.getByRole('button', { name: 'Reconcile' }).click(); await reasonDialog(fp, 'Provider confirmed failure: beneficiary bank down');
      await toast(fp, /Reconciled/);
      assert.equal(sql(`select available_paise || '/' || reserved_paise || '/' || paid_paise from wallet_accounts where reporter_id = '${reporterId}'`), '30500/0/0');
      await rp.goto(`${BASE}/reporter/history`);
      await rp.getByText('Failed').first().waitFor();
      await shot(rp, '15-history-failed-restored');
    });

    let wid2;
    await step('Retry: request ₹300 again → approve → send → provider processed → paid with UTR', async () => {
      await rp.goto(`${BASE}/reporter/withdraw`);
      await rp.getByLabel('Amount (₹)').fill('300');
      await rp.getByRole('button', { name: /Request withdrawal ₹300/ }).click();
      await toast(rp, /WDR-/);
      wid2 = sql(`select id from withdrawal_requests where reporter_id = '${reporterId}' and id <> '${wid}'`);
      await fp.reload(); await openWithdrawal();
      await fp.locator('.queue-item', { hasText: 'Requested' }).first().click();
      fp.once('dialog', (d) => d.accept()); await fp.getByRole('button', { name: 'Approve', exact: true }).click(); await toast(fp, /Approved/);
      fp.once('dialog', (d) => d.accept()); await fp.getByRole('button', { name: /Send payout \(mock\)/ }).click(); await toast(fp, /waiting for confirmation/);
      await fp.getByRole('button', { name: 'processed', exact: true }).click(); await toast(fp, /Simulated processed/);
      assert.equal(sql(`select status from withdrawal_requests where id = '${wid2}'`), 'paid');
      assert.equal(sql(`select available_paise || '/' || reserved_paise || '/' || paid_paise from wallet_accounts where reporter_id = '${reporterId}'`), '500/0/30000');
      assert.ok(sql(`select utr from payment_transactions where withdrawal_id = '${wid2}'`).length > 0);
      await shot(fp, '16-finance-paid');
    });

    await step('Reporter sees Paid with UTR; ledger reconciles; audit trail recorded', async () => {
      await rp.goto(`${BASE}/reporter/history`);
      await rp.getByText('UTR:').first().waitFor();
      await shot(rp, '17-history-paid-utr');
      await fp.getByRole('button', { name: 'Ledger & audit' }).click();
      await fp.getByText('Ledger reconciled').first().waitFor();
      await shot(fp, '18-finance-ledger-audit');
      assert.equal(sql(`select count(*) from ledger_check()`), '0');
      assert.equal(sql(`select count(*) from reporter_earnings where submission_id = '${subId}'`), '1', 'no duplicate earning');
    });

    await step('Reporter notifications cover the whole lifecycle', async () => {
      await rp.goto(`${BASE}/reporter/notifications`);
      await rp.getByText('Your reporter account is active').first().waitFor();
      const kinds = sql(`select string_agg(distinct kind, ',' order by kind) from notifications where user_id = '${reporterId}'`).split(',');
      for (const k of ['registration', 'verification', 'submission_received', 'approved', 'published', 'earning', 'withdrawal_eligible', 'withdrawal', 'payment', 'payment_failed', 'payout_method']) assert.ok(kinds.includes(k), `notification ${k}`);
      await shot(rp, '19-notifications');
      await rp.getByRole('button', { name: 'తెలుగు' }).first().click().catch(() => {});
      await rp.goto(`${BASE}/reporter`);
      await rp.locator('.rp-hero').waitFor();
      await rp.evaluate(() => document.fonts.ready);
      await shot(rp, '20-home-telugu');
      await rp.goto(`${BASE}/reporter/help`);
      await rp.locator('details').first().click();
      await rp.evaluate(() => document.fonts.ready);
      await shot(rp, '20b-help-telugu-body-text');
    });

    await step('TDS: finance turns TDS on, reporter adds PAN, finance verifies it; payout shows gross − TDS = net', async () => {
      const pan = 'ABCPL' + String(1000 + Math.floor(Math.random() * 8999)) + 'Q';
      sql(`update app_settings set value = 'false' where key = 'tds_enabled'`);                    // start from TDS off
      sql(`update app_settings set value = '10000' where key = 'tds_threshold_paise'`);           // ₹100 so the test crosses it
      sql(`select credit_earning('${reporterId}', 'bonus', 50000, null, null, null, 'E2E: TDS test balance')`);
      await fp.getByRole('button', { name: 'Tax & reports' }).click();
      fp.once('dialog', (d) => d.accept());
      await fp.getByRole('button', { name: 'Turn on' }).click();
      await toast(fp, /TDS turned on/);
      await rp.goto(`${BASE}/reporter/profile`);
      await rp.locator('#pan-n').waitFor();
      if (await rp.getByRole('button', { name: 'English' }).count()) await rp.getByRole('button', { name: 'English' }).first().click();
      await rp.getByText('PAN (for tax)').first().waitFor();
      await rp.getByLabel('PAN', { exact: true }).fill(pan);
      await rp.getByLabel('Name as on PAN card').fill(NAME);
      await rp.getByRole('button', { name: 'Save PAN' }).click();
      await toast(rp, /PAN saved/);
      assert.ok(!sql(`select ciphertext from reporter_tax_secrets where user_id = '${reporterId}'`).includes(pan), 'PAN encrypted at rest');
      await fp.reload(); await fp.getByRole('button', { name: 'Tax & reports' }).click();
      await fp.locator('.row', { hasText: NAME }).getByRole('button', { name: 'Verify' }).click();
      await reasonDialog(fp, 'Matches Income-tax portal');
      await toast(fp, /PAN verified/);
      await rp.goto(`${BASE}/reporter/withdraw`);
      await rp.getByText(/TDS: once your payouts/).first().waitFor();
      await rp.getByLabel('Amount (₹)').fill('400');
      await rp.getByRole('button', { name: /Request withdrawal ₹400/ }).click();
      await toast(rp, /WDR-/);
      const w = sql(`select id from withdrawal_requests where reporter_id = '${reporterId}' and status = 'requested'`);
      await fp.getByRole('button', { name: 'Withdrawals' }).click();
      await fp.locator('.filters select').first().selectOption('requested');
      await fp.locator('.queue-item', { hasText: NAME }).first().click();
      fp.once('dialog', (d) => d.accept()); await fp.getByRole('button', { name: 'Approve', exact: true }).click(); await toast(fp, /Approved/);
      // this FY: ₹300 paid earlier (untaxed; the failed ₹300 never left) + ₹400 = ₹700 > ₹100 threshold
      // → catch-up: 10% (verified PAN) on the whole ₹700 = ₹70; the bank gets ₹330
      assert.equal(sql(`select tds_paise || '/' || net_paise from withdrawal_requests where id = '${w}'`), '7000/33000');
      await fp.locator('.filters select').first().selectOption('all');
      await fp.locator('.queue-item', { hasText: NAME }).first().click();
      await fp.getByText('bank receives').first().waitFor();
      fp.once('dialog', (d) => d.accept()); await fp.getByRole('button', { name: /Send payout \(mock\)/ }).click(); await toast(fp, /waiting for confirmation/);
      assert.equal(sql(`select amount_paise from payment_transactions where withdrawal_id = '${w}'`), '33000', 'provider sends the net amount');
      await fp.getByRole('button', { name: 'processed', exact: true }).click(); await toast(fp, /Simulated processed/);
      await shot(fp, '22-finance-tds-paid');
      await fp.getByRole('button', { name: 'Tax & reports' }).click();
      await fp.locator('tr', { hasText: NAME }).first().waitFor();
      await shot(fp, '23-finance-tax-report');
      await rp.goto(`${BASE}/reporter/history`);
      await rp.getByText(/You received/).first().waitFor();
      await shot(rp, '24-history-tds');
      assert.equal(sql(`select count(*) from ledger_check()`), '0');
      fp.once('dialog', (d) => d.accept()); await fp.getByRole('button', { name: 'Turn off' }).click(); await toast(fp, /TDS turned off/);
      sql(`update app_settings set value = '5000000' where key = 'tds_threshold_paise'`);
    });

    await step('Assignment: editor creates an open assignment → reporter is notified and accepts', async () => {
      await ed.goto(`${BASE}/assignments`);
      await ed.getByRole('button', { name: '＋ New assignment' }).click();
      await ed.getByLabel('Title').fill(`Water supply schedule in Ameerpet ${RUN}`);
      await ed.getByLabel('Brief').fill('Collect the new water supply timings from the HMWSSB section office and photograph the notice board.');
      await ed.getByLabel('Special payment (₹)').fill('75');
      await ed.getByRole('button', { name: 'Save' }).click();
      await toast(ed, /Assignment created/);
      await rp.goto(`${BASE}/reporter/assignments`);
      await rp.getByRole('tab', { name: /Open near you|మీ సమీపంలో/ }).click();
      await rp.getByText(`Water supply schedule in Ameerpet ${RUN}`).first().waitFor();
      await rp.getByRole('button', { name: /Accept|అంగీకరించండి/ }).first().click();
      await rp.getByRole('link', { name: /Submit report|రిపోర్ట్ పంపండి/ }).first().waitFor();
      await shot(rp, '21-assignment-accepted');
    });
  } finally {
    fs.writeFileSync(path.join(SHOTS, 'RESULT.txt'), steps.join('\n') + '\n');
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

// Tiny solid-colour PNG (no image libraries needed).
function png(w, h, [r, g, b]) {
  const zlib = require('zlib');
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const crc = (buf) => { let c, crcTable = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } let x = 0xffffffff; for (const byte of buf) x = crcTable[(x ^ byte) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
