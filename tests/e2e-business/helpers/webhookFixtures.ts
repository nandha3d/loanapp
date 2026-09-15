import crypto from 'node:crypto';
import { setSetting } from '../../../lib/tenant';

export function signedRazorpayPayload(payload: unknown, secret: string) {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return { rawBody, signature };
}

export async function configureTenantWebhookSecret(tenantId: string, secret: string) {
  await setSetting(tenantId, 'rzp_collections_enabled', 'false', 'payments');
  await setSetting(tenantId, 'rzp_collections_key_id', 'rzp_test_phase5', 'payments');
  await setSetting(tenantId, 'rzp_collections_key_secret', '', 'payments');
  // decryptField returns plaintext when no field-encryption prefix is present;
  // this keeps the test local and avoids the current enc:field parser bug.
  await setSetting(tenantId, 'rzp_collections_webhook_secret', secret, 'payments');
}

export function collectionPaidPayload(input: {
  runId: string;
  tenantId: string;
  token: string;
  providerRef: string;
  paymentId: string;
  amountPaise: number;
}) {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          amount: input.amountPaise,
          notes: {
            tenant_id: input.tenantId,
            token: input.token,
            run_id: input.runId,
          },
        },
      },
      payment_link: {
        entity: {
          id: input.providerRef,
          notes: {
            tenant_id: input.tenantId,
            token: input.token,
            run_id: input.runId,
          },
        },
      },
    },
  };
}

export function nachPayload(input: {
  runId: string;
  tenantId: string;
  event: 'payment.authorized' | 'payment.captured' | 'payment.failed';
  paymentId: string;
  orderId: string;
  amountPaise?: number;
  tokenId?: string;
}) {
  return {
    event: input.event,
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          order_id: input.orderId,
          amount: input.amountPaise,
          recurring: 1,
          token: input.tokenId ? { id: input.tokenId } : undefined,
          recurring_details: { type: 'emandate', failure_reason: 'test_failure' },
          error_code: input.event === 'payment.failed' ? 'TEST_FAILED' : undefined,
          error_description: input.event === 'payment.failed' ? 'Phase 5 signed failure fixture' : undefined,
          notes: {
            tenant_id: input.tenantId,
            run_id: input.runId,
          },
        },
      },
    },
  };
}
