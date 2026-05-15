/**
 * SMS & WhatsApp Notification Service
 * 
 * Supports sending transactional notifications to borrowers and staff.
 * Currently uses a mock provider. Integration with Twilio or MSG91 
 * requires adding API keys to environment variables.
 */

interface SendMessageOptions {
  to: string;
  message: string;
  channel?: 'sms' | 'whatsapp';
  tenantId: string;
}

export async function sendNotification({ to, message, channel = 'sms', tenantId }: SendMessageOptions) {
  // In production, you would use an external API like Twilio:
  // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await client.messages.create({ body: message, from: '...', to: to });

  console.log(`[${channel.toUpperCase()}] To: ${to} | Tenant: ${tenantId} | Msg: ${message}`);
  
  // Return success even in mock mode to prevent breaking flows
  return { success: true, provider: 'mock' };
}

export async function sendPaymentReceipt(to: string, amount: number, loanCode: string, tenantId: string) {
  const message = `LoanTrack: Payment of ${amount} received for loan ${loanCode}. Thank you!`;
  return sendNotification({ to, message, tenantId });
}

export async function sendOverdueAlert(to: string, amount: number, loanCode: string, tenantId: string) {
  const message = `LoanTrack ALERT: Your payment of ${amount} for loan ${loanCode} is overdue. Please pay immediately to avoid penalties.`;
  return sendNotification({ to, message, tenantId, channel: 'whatsapp' });
}
