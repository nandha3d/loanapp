import assert from 'node:assert/strict';
import { interpolateTemplate, validateTemplatePlaceholders } from '../lib/notify/templateRenderer';
import { notifyEventSettingKey } from '../lib/notify/settingKey';

assert.doesNotThrow(() => validateTemplatePlaceholders('Hi {customer}, {{amount}} paid for {loan_code}.'));
assert.throws(() => validateTemplatePlaceholders('Hi {unknown_field}'), /Unsupported template placeholder/);
assert.equal(
  interpolateTemplate('Hi {customer}, {{amount}} paid.', { name: 'A', amount: '250' }),
  'Hi A, 250 paid.',
);

// NOT-02: the due-reminder switch is stored as notify_event_due_reminder.
assert.equal(notifyEventSettingKey('payment_due_reminder'), 'notify_event_due_reminder');
assert.equal(notifyEventSettingKey('loan_overdue'), 'notify_event_loan_overdue');

console.log('Notification template placeholders passed');
