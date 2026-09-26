import prisma from '@/lib/db';
import { validateTemplatePlaceholders } from './templateRenderer';

export const managedTemplateEvents = [
  'payment_received', 'payment_due_reminder', 'loan_disbursed',
  'loan_overdue', 'loan_closed', 'penalty_accrued',
];

export type TemplateActor = { tenantId: string; userId: string; role: string };
export type TemplateInput = {
  name: string;
  channel: string;
  lang: string;
  subject?: string | null;
  body: string;
  isActive?: boolean;
};

export class TemplateError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function requireManager(actor: TemplateActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) throw new TemplateError('Forbidden', 403);
}

export async function listNotificationTemplates(actor: TemplateActor) {
  requireManager(actor);
  return prisma.notificationTemplate.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: [{ name: 'asc' }, { lang: 'asc' }, { channel: 'asc' }],
  });
}

export async function saveManagedNotificationTemplate(actor: TemplateActor, input: TemplateInput) {
  requireManager(actor);
  const name = String(input.name || '');
  const channel = String(input.channel || '');
  const lang = String(input.lang || '');
  const body = String(input.body || '').trim();
  const subject = input.subject == null ? null : String(input.subject).trim() || null;
  if (!managedTemplateEvents.includes(name) ||
      !['sms', 'whatsapp', 'push'].includes(channel) ||
      !['en', 'ta', 'hi', 'te', 'kn', 'ml'].includes(lang) ||
      !body || body.length > 4000 || (subject?.length ?? 0) > 200) {
    throw new TemplateError('Invalid notification template', 400);
  }
  try {
    validateTemplatePlaceholders(body);
    if (subject) validateTemplatePlaceholders(subject);
  } catch (error) {
    throw new TemplateError(error instanceof Error ? error.message : 'Invalid placeholders', 400);
  }
  return prisma.$transaction(async (tx) => {
    const template = await tx.notificationTemplate.upsert({
      where: { tenantId_name_channel_lang: { tenantId: actor.tenantId, name, channel, lang } },
      update: { subject, body, isActive: input.isActive ?? true },
      create: { tenantId: actor.tenantId, name, channel, lang, subject, body, isActive: input.isActive ?? true },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId, userId: actor.userId, action: 'update',
        entityType: 'notification_template', entityId: template.id,
        newValue: JSON.stringify({ name, channel, lang, isActive: template.isActive }),
      },
    });
    return template;
  });
}
