import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { pullBureauReport } from '@/lib/bureau/bureauService';

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const tenantId = (session?.user as any)?.tenantId;

  if (!userId || !role || !['admin', 'superadmin', 'developer'].includes(role)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const loanId = searchParams.get('loanId');
  const pullType = (searchParams.get('pullType') || 'hard') as 'hard' | 'soft';
  const consentObtained = searchParams.get('consentObtained') === 'true';
  const consentMethod = (searchParams.get('consentMethod') || 'verbal_recorded') as any;

  if (!customerId) {
    return new Response('customerId is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const requestIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

  (async () => {
    try {
      // 1. Notify client that pulling process has initialized
      writer.write(encoder.encode(`data: ${JSON.stringify({ status: 'fetching' })}\n\n`));

      // 2. Perform the credit check query
      const result = await pullBureauReport({
        customerId,
        tenantId,
        loanId,
        pullType,
        consentObtained,
        consentMethod,
        requestedByUserId: userId,
        requestIp,
      });

      // 3. Write final successful parsed payload
      writer.write(encoder.encode(`data: ${JSON.stringify({ status: 'success', data: result })}\n\n`));
    } catch (err: any) {
      // 4. Send error diagnostics
      writer.write(
        encoder.encode(
          `data: ${JSON.stringify({ status: 'error', message: err.message || 'Bureau pull failed' })}\n\n`
        )
      );
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
