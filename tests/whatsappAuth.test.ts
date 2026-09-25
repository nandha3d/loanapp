import assert from 'node:assert/strict';
import {
  normalisePhoneForWhatsApp,
  isSamuraiExcludedDomain,
  sendWhatsAppAuthOtp,
  verifyWhatsAppAuthOtp,
  DEFAULT_MSG91_AUTH_KEY,
} from '../lib/whatsappAuth';

async function runTests() {
  console.log('Running WhatsApp Auth tests...');

  // 1. Authkey confirmation
  assert.equal(
    DEFAULT_MSG91_AUTH_KEY,
    '463379AbmG58Zt6892f626P1',
    'DEFAULT_MSG91_AUTH_KEY must match the active authkey',
  );

  // 2. Phone normalisation
  const n1 = normalisePhoneForWhatsApp('9876543210');
  assert.equal(n1?.digits10, '9876543210');
  assert.equal(n1?.e164, '919876543210');

  const n2 = normalisePhoneForWhatsApp('+91 98765-43210');
  assert.equal(n2?.digits10, '9876543210');
  assert.equal(n2?.e164, '919876543210');

  const n3 = normalisePhoneForWhatsApp('12345');
  assert.equal(n3, null, 'Invalid phone numbers must return null');

  // 3. Strict Samurai Exclusion Guard
  // Assert loan.samuraibuiness.in is strictly blocked
  const isSamurai1 = await isSamuraiExcludedDomain({ host: 'loan.samuraibuiness.in' });
  assert.equal(isSamurai1, true, 'loan.samuraibuiness.in host must be excluded');

  const isSamurai2 = await isSamuraiExcludedDomain({ host: 'loan.samuraibuiness.in:3000' });
  assert.equal(isSamurai2, true, 'loan.samuraibuiness.in with port must be excluded');

  const isSamurai3 = await isSamuraiExcludedDomain({ tenantSlug: 'samurai' });
  assert.equal(isSamurai3, true, 'samurai slug must be excluded');

  const isSaaS = await isSamuraiExcludedDomain({ host: 'app.animazon.in', tenantSlug: 'default' });
  assert.equal(isSaaS, false, 'app.animazon.in must not be excluded');

  // Attempting to send OTP to loan.samuraibuiness.in must be rejected
  const blockedSend = await sendWhatsAppAuthOtp({
    phone: '9876543210',
    host: 'loan.samuraibuiness.in',
  });
  assert.equal(blockedSend.success, false);
  assert.match(blockedSend.error || '', /not permitted/i);

  // Attempting to verify OTP for loan.samuraibuiness.in must be rejected
  const blockedVerify = await verifyWhatsAppAuthOtp({
    phone: '9876543210',
    otp: '123456',
    challengeToken: 'dummy',
    host: 'loan.samuraibuiness.in',
  });
  assert.equal(blockedVerify.success, false);

  // 4. End-to-end OTP generation and verification for allowed domains
  const sendRes = await sendWhatsAppAuthOtp({
    phone: '9876543210',
    host: 'app.animazon.in',
    purpose: 'login',
  });

  assert.equal(sendRes.success, true);
  assert.ok(sendRes.challengeToken, 'challengeToken must be issued');
  assert.ok(sendRes.testOtp, 'testOtp must be present for test verification');

  // Verify with correct OTP
  const verifySuccess = await verifyWhatsAppAuthOtp({
    phone: '9876543210',
    otp: sendRes.testOtp!,
    challengeToken: sendRes.challengeToken!,
    host: 'app.animazon.in',
  });
  assert.equal(verifySuccess.success, true);
  assert.equal(verifySuccess.claims?.phone, '9876543210');
  assert.equal(verifySuccess.claims?.purpose, 'login');

  // Verify with incorrect OTP must fail
  const verifyFail = await verifyWhatsAppAuthOtp({
    phone: '9876543210',
    otp: '000000',
    challengeToken: sendRes.challengeToken!,
    host: 'app.animazon.in',
  });
  assert.equal(verifyFail.success, false);
  assert.match(verifyFail.error || '', /incorrect/i);

  // Verify with wrong phone number must fail
  const verifyWrongPhone = await verifyWhatsAppAuthOtp({
    phone: '9123456789',
    otp: sendRes.testOtp!,
    challengeToken: sendRes.challengeToken!,
    host: 'app.animazon.in',
  });
  assert.equal(verifyWrongPhone.success, false);

  console.log('All WhatsApp Auth tests passed successfully!');
}

runTests().catch((err) => {
  console.error('WhatsApp Auth tests failed:', err);
  process.exit(1);
});
