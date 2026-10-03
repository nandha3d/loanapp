import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { approvalIdFromLink } from '../lib/notificationApprovalState';
import { renderNotificationText } from '../lib/notificationText';

const read = (p: string) => readFileSync(p, 'utf8');

// ── approvalIdFromLink: the id a notification row resolves its pending state from
assert.equal(approvalIdFromLink('/microlending/approvals?id=abc123'), 'abc123');
assert.equal(approvalIdFromLink('/microlending/approvals?foo=1&id=xyz'), 'xyz');
assert.equal(approvalIdFromLink('/microlending/approvals'), null, 'result notices carry no id → never actionable');
assert.equal(approvalIdFromLink('/microlending/loans?id=abc'), null, 'only approvals links count');
assert.equal(approvalIdFromLink(null), null);

// ── renderNotificationText: key + server params in the viewer's language, English fallback
const dict = { notifications: { staff_emi_due_today_msg: '{count} EMI(s) due today, total {amount}.' } };
assert.equal(
  renderNotificationText(dict, 'notif.staff.emi_due_today.msg', 'fallback', { count: '3', amount: '₹1,200' }),
  '3 EMI(s) due today, total ₹1,200.',
);
assert.equal(
  renderNotificationText(dict, 'notif.staff.emi_due_today.msg', 'fallback', '{"count":"1","amount":"₹5"}'),
  '1 EMI(s) due today, total ₹5.',
  'params may arrive as a JSON string (DB column / FCM data)',
);
assert.equal(renderNotificationText(dict, null, 'legacy text', null), 'legacy text', 'legacy rows keep their stored text');
assert.equal(renderNotificationText(dict, 'notif.staff.unknown.msg', 'fb', null), 'fb', 'unknown key falls back');

// ── Source guards (these shipped defects before: see ENGINEERING_REFERENCE NOTIF-14..17)
const push = read('lib/notify/channels/push.ts');
assert.match(push, /function validImageUrl/, 'FCM imageUrl must be a real https URL — an icon name made FCM reject the send and the token get pruned');
assert.doesNotMatch(push, /title\?\.toLowerCase\(\)\.includes\('approv'\)/, 'push must not infer "actionable" from the words in the text');
assert.match(push, /androidDataOnly/, 'Android pushes are data-only so the app draws the logo and Approve/Reject buttons');

const approvers = read('lib/notify/approvers.ts');
assert.match(approvers, /id=\$\{encodeURIComponent\(data\.approvalId\)\}/, 'approval links carry ?id= so the list can resolve pending state');

for (const f of [
  'app/api/v1/approvals/[id]/approve/route.ts',
  'app/api/v1/approvals/[id]/reject/route.ts',
  'lib/penalties.ts',
  'lib/gps/locationVerifier.ts',
]) {
  assert.doesNotMatch(read(f), /systemNotification\.create\(/, `${f}: in-app-only rows never pushed — go through notifyUser/notifyApprovers (NOTIF-14)`);
}

const route = read('app/api/v1/notifications/route.ts');
assert.match(route, /resolveApprovalStates/, 'notification list returns server-computed canAct/approvalStatus');

const schema = read('prisma/schema.prisma');
for (const col of ['titleKey', 'messageKey', 'params', 'dedupeKey']) {
  assert.match(schema, new RegExp(`${col}\\s+String\\?`), `SystemNotification.${col} is nullable (additive)`);
}

console.log('staff notification tests passed');
