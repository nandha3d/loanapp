import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, businessName, ownerName, phone, email, step, status, plan, modules, addons } = body;

    if (!code) {
      return apiError('Missing referral code.', 400);
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { code },
    });

    if (!affiliate) {
      return apiError('Invalid affiliate code.', 404);
    }

    // Try to find an existing lead for this email or phone under this affiliate
    // Because they could be progressing through steps without an ID
    let lead = null;
    if (email) {
      lead = await prisma.referralLead.findFirst({
        where: { affiliateId: affiliate.id, email },
      });
    } else if (phone) {
      lead = await prisma.referralLead.findFirst({
        where: { affiliateId: affiliate.id, phone },
      });
    }

    if (lead) {
      lead = await prisma.referralLead.update({
        where: { id: lead.id },
        data: {
          businessName: businessName || lead.businessName,
          ownerName: ownerName || lead.ownerName,
          phone: phone || lead.phone,
          email: email || lead.email,
          lastStepReached: step || lead.lastStepReached,
          status: status || lead.status,
          metadata: {
            plan: plan || (lead.metadata as any)?.plan,
            modules: modules || (lead.metadata as any)?.modules,
            addons: addons || (lead.metadata as any)?.addons,
          }
        },
      });
    } else {
      // If we don't have enough to uniquely identify, but they gave at least businessName/ownerName
      if (businessName || ownerName || phone || email) {
        lead = await prisma.referralLead.create({
          data: {
            affiliateId: affiliate.id,
            businessName,
            ownerName,
            phone,
            email,
            lastStepReached: step || 'step_1_details',
            status: status || 'abandoned',
            metadata: {
              plan: plan || null,
              modules: modules || null,
              addons: addons || null,
            }
          },
        });
      }
    }

    return apiSuccess({
      message: 'Step tracked',
      leadId: lead?.id,
    });
  } catch (error: any) {
    console.error('[API_AFFILIATE_TRACK_STEP]', error);
    return apiError(error.message, 500);
  }
}
