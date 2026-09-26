import assert from 'node:assert/strict';
import { interpolateTemplate, validateTemplatePlaceholders } from '../lib/notify/templateRenderer';

assert.doesNotThrow(() => validateTemplatePlaceholders('Hi {customer}, {{amount}} paid for {loan_code}.'));
assert.throws(() => validateTemplatePlaceholders('Hi {unknown_field}'), /Unsupported template placeholder/);
assert.equal(
  interpolateTemplate('Hi {customer}, {{amount}} paid.', { name: 'A', amount: '250' }),
  'Hi A, 250 paid.',
);

console.log('Notification template placeholders passed');
