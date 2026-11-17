import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { activeReporter, actor, approve, fails, must, service, submitStory, SUMMARY, verifiedMethod, wallet, type Actor } from './helpers.ts';

let admin: Actor, editor: Actor, moderatorWgl: Actor, finance: Actor, reader: Actor;

before(async () => {
  // shared settings may have been changed by an earlier interrupted run
  must(await service.from('contribution_rates').update({ min_paise: 500, max_paise: 500, active: true }).eq('code', 'text_news'));
  must(await service.from('app_settings').upsert({ key: 'withdrawal_threshold_paise', value: 30000 }));
  admin = await actor('admin', { role: 'super_admin' });
  editor = await actor('editor', { role: 'editor' });
  moderatorWgl = await actor('modwgl', { role: 'district_moderator', districts: ['wgl'] });
  finance = await actor('finance', { permissions: ['finance'] });
  reader = await actor('reader');
});

// ── Registration & verification ─────────────────────────────────────────────
test('registration → verification pending → verified → active, synced to profiles.verified_reporter', async () => {
  const r = await actor('newbie');
  await fails(r.db.rpc('register_reporter', { p_full_name: 'Newbie', p_email: null, p_district: 'hyd', p_mandal: null, p_locality: null, p_language: 'te', p_interests: [], p_intro: null, p_photo_path: null, p_accept_agreement: false }), /agreement/);
  const p = must(await r.db.rpc('register_reporter', { p_full_name: 'Newbie Reporter', p_email: 'n@example.com', p_district: 'hyd', p_mandal: 'hyd-amp', p_locality: 'SR Nagar', p_language: 'te', p_interests: ['civic'], p_intro: 'hi', p_photo_path: null, p_accept_agreement: true })) as { status: string };
  assert.equal(p.status, 'registered');
  // a registered (unverified) reporter can save drafts but cannot submit
  const draft = must(await r.db.from('citizen_reports').insert({ headline: 'Drain overflowing near the bus stand for three days', body: 'The drain near the bus stand has been overflowing for three days and residents are worried about disease.', lang: 'en', category_id: 'health', district_id: 'hyd', rights_confirmed: true }).select('id, status').single()) as { id: string; status: string };
  assert.equal(draft.status, 'draft');
  await fails(r.db.from('citizen_reports').update({ status: 'submitted' }).eq('id', draft.id), /verified before you can submit/);

  must(await r.db.rpc('submit_verification', { p_document_type: 'aadhaar_masked', p_last4: '1234', p_document_path: `${r.id}/aadhaar.jpg` }));
  assert.equal((must(await r.db.from('reporter_profiles').select('status').eq('user_id', r.id).single()) as { status: string }).status, 'verification_pending');
  await fails(reader.db.rpc('review_reporter', { p_user: r.id, p_decision: 'approve' }), /Not allowed/);
  await fails(moderatorWgl.db.rpc('review_reporter', { p_user: r.id, p_decision: 'approve' }), /Not allowed/); // other district
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'verify' }));
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'approve', p_category: 'verified_local_reporter' }));
  const prof = must(await service.from('profiles').select('verified_reporter').eq('id', r.id).single()) as { verified_reporter: boolean };
  assert.equal(prof.verified_reporter, true);
  await fails(editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'suspend' }), /reason is required/);
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'suspend', p_reason: 'Repeated unverified claims' }));
  assert.equal((must(await service.from('profiles').select('verified_reporter').eq('id', r.id).single()) as { verified_reporter: boolean }).verified_reporter, false);
  const notes = must(await r.db.from('notifications').select('kind')) as { kind: string }[];
  assert.ok(notes.filter((x) => x.kind === 'verification').length >= 3, 'verification notifications sent');
});

// ── Submission pipeline ─────────────────────────────────────────────────────
test('submission gets a unique ID, passes automated checks and lands under review with history', async () => {
  const r = await activeReporter('sub', editor);
  const s = await submitStory(r);
  assert.equal(s.status, 'under_review');
  assert.match(s.code, /^CHT-\d{4}-\d{6}$/);
  const hist = must(await r.db.from('editorial_reviews').select('action, to_status').eq('submission_id', s.id).order('id')) as { action: string; to_status: string }[];
  assert.deepEqual(hist.map((h) => h.to_status), ['submitted', 'ai_processing', 'under_review']);
  // reporter cannot edit while under review, nor touch protected fields
  await fails(r.db.from('citizen_reports').update({ headline: 'changed headline that is long enough' }).eq('id', s.id).select('id').single());
  // rights consent is mandatory
  const d = must(await r.db.from('citizen_reports').insert({ headline: 'Another new civic report from the colony', body: 'Garbage has not been collected for a week in the colony and residents want action.', lang: 'en', category_id: 'education', district_id: 'hyd' }).select('id').single()) as { id: string };
  await fails(r.db.from('citizen_reports').update({ status: 'submitted' }).eq('id', d.id), /consent/);
  // other reporters and readers cannot see it
  const other = await activeReporter('other', editor);
  assert.equal((must(await other.db.from('citizen_reports').select('id').eq('id', s.id)) as unknown[]).length, 0);
  assert.equal((must(await reader.db.from('citizen_reports').select('id').eq('id', s.id)) as unknown[]).length, 0);
});

test('duplicate detection flags a near-identical headline', async () => {
  const r = await activeReporter('dup', editor);
  const tag = Math.random().toString(36).slice(2, 8); // unique per run so earlier runs' rows don't crowd the top-5 list
  const a = await submitStory(r, { headline: `Kazipet railway gate ${tag} closed for repairs causing long traffic jams`, district_id: 'wgl', mandal_id: 'wgl-kzp' });
  const b = await submitStory(r, { headline: `Kazipet railway gate ${tag} closed for repair works causing long traffic jam`, district_id: 'wgl', mandal_id: 'wgl-kzp' });
  assert.ok(b.duplicate_candidates.some((d: { id: string }) => d.id === a.id), 'second submission lists the first as a duplicate candidate');
  assert.ok(b.ai_flags.includes('possible_duplicate'));
});

test('correction loop: editor requests correction with reason, reporter edits and resubmits', async () => {
  const r = await activeReporter('corr', editor);
  const s = await submitStory(r);
  await fails(editor.db.rpc('editorial_set_status', { p_id: s.id, p_status: 'correction_required' }), /reason/);
  must(await editor.db.rpc('editorial_set_status', { p_id: s.id, p_status: 'correction_required', p_note: 'Please add the ward number and a photo.' }));
  must(await r.db.from('citizen_reports').update({ body: s.body + ' It is ward number 7 near the water tank.' }).eq('id', s.id));
  const again = must(await r.db.from('citizen_reports').update({ status: 'submitted' }).eq('id', s.id).select('status, code').single()) as { status: string; code: string };
  assert.equal(again.status, 'under_review');
  assert.equal(again.code, s.code, 'submission ID is stable across resubmission');
  must(await editor.db.rpc('editorial_set_status', { p_id: s.id, p_status: 'on_hold', p_note: 'Waiting for municipal confirmation' }));
  must(await editor.db.rpc('editorial_set_status', { p_id: s.id, p_status: 'rejected', p_note: 'Could not be verified' }));
  // a rejected submission is no longer editable: the update matches no rows
  assert.equal((must(await r.db.from('citizen_reports').update({ status: 'submitted' }).eq('id', s.id).select('id')) as unknown[]).length, 0);
  assert.equal((must(await r.db.from('citizen_reports').select('status, rejection_reason').eq('id', s.id).single()) as { status: string }).status, 'rejected');
});

test('sensitive stories cannot be approved until a human verifies them', async () => {
  const r = await activeReporter('sens', editor);
  const s = await submitStory(r, { category_id: 'crime', headline: 'Man arrested for chain snatching near the market', body: 'Police arrested a man accused of chain snatching near the market on Tuesday evening, according to residents.' });
  assert.equal(s.is_sensitive, true);
  assert.ok(s.sensitivity_reasons.includes('crime'));
  await fails(editor.db.rpc('editorial_approve', { p_id: s.id, p_headline: 'Arrest in chain snatching case', p_summary: SUMMARY, p_contribution: 'text_news', p_amount_paise: 500 }), /human verification/);
  // reporters cannot self-verify
  await fails(r.db.rpc('editorial_update', { p_id: s.id, p_patch: { human_verified: true } }), /cannot review/);
  must(await editor.db.rpc('editorial_update', { p_id: s.id, p_patch: { human_verified: true, verification_notes: 'Confirmed with SHO by phone' } }));
  const res = await approve(editor, s.id, 'text_news', 500);
  assert.ok(res.story_id);
});

// ── Earnings ────────────────────────────────────────────────────────────────
test('approval credits the configured rate exactly once', async () => {
  const r = await activeReporter('earn', editor);
  const s = await submitStory(r);
  await fails(editor.db.rpc('editorial_approve', { p_id: s.id, p_headline: 'x headline', p_summary: SUMMARY, p_contribution: 'detailed_report', p_amount_paise: 20000 }), /between/);
  const res = await approve(editor, s.id, 'original_photo', 1000, false);
  assert.equal(res.earning?.amount_paise, 1000);
  assert.match(res.earning!.code, /^ERN-/);
  assert.equal((await wallet(r)).available_paise, 1000);
  // approving again (publish step) must not credit again
  await approve(editor, s.id, 'original_photo', 1000, true);
  assert.equal((await wallet(r)).available_paise, 1000);
  const earnings = must(await r.db.from('reporter_earnings').select('id, submission_id, contribution_code, amount_paise, approved_by, approved_at, status')) as Record<string, unknown>[];
  assert.equal(earnings.length, 1);
  assert.equal(earnings[0].approved_by, editor.id);
  // the published story carries a contributor byline, never contact details
  const story = (must(await service.rpc('get_feed', { p_lang: 'en', p_district: 'hyd', p_mandal: 'hyd-amp', p_limit: 100 })) as Record<string, any>[]).find((x) => x.id === res.story_id);
  assert.equal(story?.reporter?.label, 'Community Contributor');
  assert.equal(JSON.stringify(story).includes('@'), false);
});

test('rate card is configurable by finance only and drives approvals', async () => {
  await fails(editor.db.rpc('update_rate', { p_code: 'text_news', p_min: 700, p_max: 700, p_active: true }), /finance/);
  must(await finance.db.rpc('update_rate', { p_code: 'text_news', p_min: 700, p_max: 700, p_active: true }));
  const r = await activeReporter('rate', editor);
  const s = await submitStory(r);
  await fails(editor.db.rpc('editorial_approve', { p_id: s.id, p_headline: 'Approved headline', p_summary: SUMMARY, p_contribution: 'text_news', p_amount_paise: 500 }), /between/);
  await approve(editor, s.id, 'text_news', 700);
  assert.equal((await wallet(r)).available_paise, 700);
  must(await finance.db.rpc('update_rate', { p_code: 'text_news', p_min: 500, p_max: 500, p_active: true }));
});

test('assignment special payment is credited once', async () => {
  const r = await activeReporter('asg', editor);
  const a = must(await editor.db.from('reporter_assignments').insert({
    title: 'Cover the traffic issue near Kazipet railway station', description: 'Photos and quotes from commuters', district_id: 'hyd',
    assigned_reporter_id: r.id, status: 'assigned', special_amount_paise: 5000, media_required: ['photo'], deadline: new Date(Date.now() + 86400000).toISOString(),
  }).select('id').single()) as { id: string };
  must(await r.db.rpc('accept_assignment', { p_id: a.id }));
  const s1 = await submitStory(r, { assignment_id: a.id });
  assert.equal((must(await editor.db.from('reporter_assignments').select('status').eq('id', a.id).single()) as { status: string }).status, 'submitted');
  await approve(editor, s1.id, 'special_assignment', 0);
  assert.equal((await wallet(r)).available_paise, 5000);
  const s2 = await submitStory(r, { assignment_id: a.id });
  await fails(editor.db.rpc('editorial_approve', { p_id: s2.id, p_headline: 'Second take', p_summary: SUMMARY, p_contribution: 'special_assignment', p_amount_paise: 0 }), /already credited/);
  assert.ok((must(await r.db.from('notifications').select('kind').eq('kind', 'assignment')) as unknown[]).length >= 1);
});

// ── Mandatory financial test ────────────────────────────────────────────────
test('₹295 + ₹10 = ₹305 → withdraw ₹300 → ₹5 left; paid path and failed path reconcile exactly', async () => {
  const r = await activeReporter('money', editor);
  // ₹295 = 2 detailed reports (₹100) + 3 videos (₹25) + 4 text stories (₹5)
  for (const [code, amt] of [['detailed_report', 10000], ['detailed_report', 10000], ['original_video', 2500], ['original_video', 2500], ['original_video', 2500], ['text_news', 500], ['text_news', 500], ['text_news', 500], ['text_news', 500]] as const) {
    const s = await submitStory(r);
    await approve(editor, s.id, code, amt);
  }
  assert.equal((await wallet(r)).available_paise, 29500);
  const method = await verifiedMethod(r, finance);
  await fails(r.db.rpc('request_withdrawal', { p_amount_paise: 29500, p_method: method }), /Minimum balance for withdrawal is ₹300/);

  // editor approves a ₹10 photo → ₹305 available
  const photo = await submitStory(r);
  await approve(editor, photo.id, 'original_photo', 1000);
  assert.equal((await wallet(r)).available_paise, 30500);
  assert.ok((must(await r.db.from('notifications').select('kind').eq('kind', 'withdrawal_eligible')) as unknown[]).length === 1, 'eligibility notification sent once');

  // request ₹300 → reserved ₹300, ₹5 available
  await fails(r.db.rpc('request_withdrawal', { p_amount_paise: 29900, p_method: method }), /Minimum withdrawal is ₹300/);
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })) as { id: string; code: string; status: string };
  assert.equal(w.status, 'requested');
  let bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [500, 30000, 0]);
  // the same balance can't be requested twice
  await fails(r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method }), /Minimum balance|exceeds/);

  // only finance can approve; editors have no financial access
  await fails(editor.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }), /Finance permission/);
  assert.equal((must(await editor.db.from('wallet_accounts').select('reporter_id').eq('reporter_id', r.id)) as unknown[]).length, 0);
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));

  // payout sent (service role = payouts Edge Function), then provider confirms processed
  const txn = must(await service.from('payment_transactions').insert({ withdrawal_id: w.id, provider: 'mock', idempotency_key: `idem-${w.id}`, provider_payout_id: `pout_${w.id.slice(0, 8)}`, amount_paise: 30000, status: 'processing' }).select('id').single()) as { id: string };
  must(await service.rpc('mark_withdrawal_processing', { p_id: w.id, p_txn: txn.id, p_actor: finance.id }));
  // reporters cannot call internal functions
  await fails(r.db.rpc('apply_payout_status', { p_txn: txn.id, p_status: 'processed', p_utr: 'X', p_failure: null, p_fees: null, p_tax: null, p_response: null, p_source: 'hack' }), /permission denied/);
  assert.equal(must(await service.rpc('apply_payout_status', { p_txn: txn.id, p_status: 'processed', p_utr: 'UTR123', p_failure: null, p_fees: 0, p_tax: 0, p_response: {}, p_source: 'webhook' })), 'settled');
  // duplicate and out-of-order events change nothing
  assert.equal(must(await service.rpc('apply_payout_status', { p_txn: txn.id, p_status: 'processed', p_utr: 'UTR123', p_failure: null, p_fees: 0, p_tax: 0, p_response: {}, p_source: 'webhook' })), 'ignored');
  assert.equal(must(await service.rpc('apply_payout_status', { p_txn: txn.id, p_status: 'processing', p_utr: null, p_failure: null, p_fees: null, p_tax: null, p_response: {}, p_source: 'webhook' })), 'stale_event_ignored');
  bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [500, 0, 30000]);
  assert.equal((must(await r.db.from('withdrawal_requests').select('status').eq('id', w.id).single()) as { status: string }).status, 'paid');
  assert.deepEqual(must(await finance.db.rpc('ledger_check')), [], 'wallet equals ledger');
});

test('failed payout keeps ₹300 reserved until reconciliation, then restores it exactly once', async () => {
  const r = await activeReporter('fail', editor);
  const s1 = await submitStory(r); await approve(editor, s1.id, 'detailed_report', 10000);
  const s2 = await submitStory(r); await approve(editor, s2.id, 'detailed_report', 10000);
  const s3 = await submitStory(r); await approve(editor, s3.id, 'detailed_report', 10000);
  const s4 = await submitStory(r); await approve(editor, s4.id, 'original_photo', 1000);
  const method = await verifiedMethod(r, finance, 'bank');
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })) as { id: string };
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));
  const txn = must(await service.from('payment_transactions').insert({ withdrawal_id: w.id, provider: 'mock', idempotency_key: `idem-${w.id}`, provider_payout_id: `pout_f${w.id.slice(0, 8)}`, amount_paise: 30000, status: 'processing' }).select('id').single()) as { id: string };
  must(await service.rpc('mark_withdrawal_processing', { p_id: w.id, p_txn: txn.id, p_actor: finance.id }));
  assert.equal(must(await service.rpc('apply_payout_status', { p_txn: txn.id, p_status: 'failed', p_utr: null, p_failure: 'Beneficiary bank down', p_fees: null, p_tax: null, p_response: {}, p_source: 'webhook' })), 'failed_pending_reconciliation');
  let bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise], [1000, 30000], 'still reserved before reconciliation');
  await fails(editor.db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'failed', p_note: 'x' }), /Finance permission/);
  assert.equal(must(await finance.db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'failed', p_note: 'Confirmed failed on provider dashboard' })), 'restored');
  assert.equal(must(await finance.db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'failed', p_note: 'again' })), 'nothing_to_reconcile');
  bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [31000, 0, 0]);
  assert.deepEqual(must(await finance.db.rpc('ledger_check')), []);
});

test('reversal after payment restores the balance after reconciliation; rejection and cancellation release reservations', async () => {
  const r = await activeReporter('rev', editor);
  for (let i = 0; i < 6; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const method = await verifiedMethod(r, finance);
  // reporter cancels → released
  const c = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })) as { id: string };
  must(await r.db.rpc('cancel_withdrawal', { p_id: c.id }));
  assert.equal((await wallet(r)).available_paise, 60000);
  // finance rejects (reason required) → released
  const j = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })) as { id: string };
  await fails(finance.db.rpc('finance_review_withdrawal', { p_id: j.id, p_decision: 'reject' }), /reason/);
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: j.id, p_decision: 'reject', p_reason: 'Name mismatch on account' }));
  assert.equal((await wallet(r)).available_paise, 60000);
  // paid manually, then the bank reverses it
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })) as { id: string };
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));
  must(await finance.db.rpc('record_manual_payout', { p_id: w.id, p_utr: 'NEFT0001', p_note: 'Bank portal batch 12' }));
  let bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [30000, 0, 30000]);
  must(await finance.db.rpc('record_manual_failure', { p_id: w.id, p_status: 'reversed', p_reason: 'Returned by beneficiary bank' }));
  bal = await wallet(r);
  assert.equal(bal.paid_paise, 30000, 'not restored until reconciliation');
  must(await finance.db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'reversed', p_note: 'Reversal visible in bank statement' }));
  bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [60000, 0, 0]);
  assert.deepEqual(must(await finance.db.rpc('ledger_check')), []);
});

test('withdrawal threshold is configurable by finance, not editors', async () => {
  await fails(editor.db.rpc('set_setting', { p_key: 'withdrawal_threshold_paise', p_value: 50000 }), /permission/);
  must(await finance.db.rpc('set_setting', { p_key: 'withdrawal_threshold_paise', p_value: 50000 }));
  const r = await activeReporter('thr', editor);
  for (let i = 0; i < 4; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const method = await verifiedMethod(r, finance);
  await fails(r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method }), /Minimum balance for withdrawal is ₹500/);
  must(await finance.db.rpc('set_setting', { p_key: 'withdrawal_threshold_paise', p_value: 30000 }));
  const dash = must(await r.db.rpc('reporter_dashboard')) as Record<string, any>;
  assert.equal(dash.threshold_paise, 30000);
  assert.equal(dash.wallet.available_paise, 40000);
});

test('withdrawals need identity verification and a verified payout method', async () => {
  const r = await actor('noid');
  must(await r.db.rpc('register_reporter', { p_full_name: 'No ID', p_email: null, p_district: 'hyd', p_mandal: null, p_locality: null, p_language: 'te', p_interests: [], p_intro: null, p_photo_path: null, p_accept_agreement: true }));
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'approve' })); // active without ID verification
  for (let i = 0; i < 3; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const m = must(await service.from('payout_methods').insert({ reporter_id: r.id, kind: 'upi', holder_name: 'No ID', masked: 'no•••@ybl', fingerprint: `fp-${r.id}` }).select('id').single()) as { id: string };
  await fails(r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: m.id }), /identity verification/);
});

// ── Access control ──────────────────────────────────────────────────────────
test('financial data and secrets are protected', async () => {
  const r = await activeReporter('acl', editor);
  const other = await activeReporter('acl2', editor);
  await verifiedMethod(other, finance);
  assert.equal((must(await r.db.from('payout_methods').select('id').eq('reporter_id', other.id)) as unknown[]).length, 0, 'cannot see others’ payout methods');
  assert.equal((must(await r.db.from('wallet_ledger_entries').select('id').eq('reporter_id', other.id)) as unknown[]).length, 0);
  assert.equal((must(await finance.db.from('payout_method_secrets').select('method_id')) as unknown[]).length, 0, 'secrets unreadable even by finance');
  assert.equal((must(await editor.db.from('payout_methods').select('id')) as unknown[]).length, 0, 'editors have no financial access');
  await fails(reader.db.rpc('finance_summary'), /Finance permission/);
  await fails(r.db.rpc('ledger_check'), /Finance permission/);
  await fails(r.db.from('wallet_accounts').insert({ reporter_id: r.id, available_paise: 999999 }));
  await fails(r.db.rpc('credit_earning', { p_reporter: r.id, p_code: 'bonus', p_amount: 100000, p_submission: null, p_assignment: null, p_award: null, p_note: 'x' }), /permission denied/);
  await fails(r.db.rpc('ledger_post', { p_reporter: r.id, p_type: 'adjustment', p_available: 100000, p_reserved: 0, p_paid: 0, p_key: 'x' }), /permission denied/);
  await fails(r.db.rpc('reconcile_withdrawal', { p_id: '00000000-0000-0000-0000-000000000000', p_confirmed_status: 'failed', p_note: 'x' }), /Finance permission/);
  const summary = must(await finance.db.rpc('finance_summary')) as Record<string, number>;
  assert.ok(summary.paid_paise >= 0);
  // editors cannot change submission rows directly (only via audited functions)
  const s = await submitStory(r);
  const upd = must(await editor.db.from('citizen_reports').update({ status: 'published' }).eq('id', s.id).select('id')) as unknown[];
  assert.equal(upd.length, 0);
});

test('recognition: quality-weighted leaderboard and badges (bonus needs finance)', async () => {
  const r = await activeReporter('star', editor);
  for (let i = 0; i < 3; i++) { const s = await submitStory(r); await approve(editor, s.id, 'text_news', 500); }
  // quality beats volume: 4 approved + 4 rejected scores below 3 approved + 0 rejected
  const spam = await activeReporter('volume', editor);
  for (let i = 0; i < 8; i++) {
    const s = await submitStory(spam);
    if (i < 4) await approve(editor, s.id, 'text_news', 500);
    else must(await editor.db.rpc('editorial_set_status', { p_id: s.id, p_status: 'rejected', p_note: 'Unverifiable' }));
  }
  const scores = must(await r.db.rpc('reporter_scores')) as { reporter_id: string; score: number; accuracy: number }[];
  const star = scores.find((x) => x.reporter_id === r.id)!, vol = scores.find((x) => x.reporter_id === spam.id)!;
  assert.equal(star.accuracy, 1);
  assert.equal(vol.accuracy, 0.5);
  assert.ok(star.score > vol.score, `quality (${star.score}) should outrank volume (${vol.score})`);
  assert.ok((must(await r.db.rpc('leaderboard')) as unknown[]).length > 0);
  await fails(editor.db.rpc('award_badge', { p_reporter: r.id, p_badge: 'community_voice', p_period: null, p_reason: 'x', p_bonus_paise: 5000 }), /finance/);
  must(await editor.db.rpc('award_badge', { p_reporter: r.id, p_badge: 'community_voice', p_period: null, p_reason: 'Drainage series' }));
  must(await admin.db.rpc('award_badge', { p_reporter: r.id, p_badge: 'best_reporter_month', p_period: null, p_reason: 'Top score', p_bonus_paise: 10000 }));
  const dash = must(await r.db.rpc('reporter_dashboard')) as Record<string, any>;
  assert.equal(dash.badges.length, 2);
  assert.equal(dash.wallet.available_paise, 1500 + 10000);
  assert.equal(dash.counts.approved, 3);
});

test('concurrent withdrawal requests cannot spend the same balance', async () => {
  const r = await activeReporter('race', editor);
  for (let i = 0; i < 3; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const s = await submitStory(r); await approve(editor, s.id, 'original_photo', 1000); // ₹310
  must(await service.from('app_settings').upsert({ key: 'max_open_withdrawals', value: 5 }));
  const method = await verifiedMethod(r, finance);
  const results = await Promise.all(Array.from({ length: 5 }, () => r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: method })));
  must(await service.from('app_settings').upsert({ key: 'max_open_withdrawals', value: 2 }));
  assert.equal(results.filter((x) => !x.error).length, 1, 'exactly one of five simultaneous requests succeeds');
  const bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise], [1000, 30000]);
});
