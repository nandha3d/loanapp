import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return apiError('Missing required fields: name and email are mandatory.', 400);
    }

    // Check if an affiliate with this email already exists
    const existing = await prisma.affiliate.findFirst({
      where: { email },
    });

    if (existing) {
      return apiSuccess({
        message: 'Affiliate already registered with this email.',
        affiliate: existing,
      });
    }

    // Generate a short, unique code
    let code = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = 'aff-' + Math.random().toString(36).substring(2, 10).toLowerCase();
      const existingCode = await prisma.affiliate.findUnique({ where: { code } });
      if (!existingCode) isUnique = true;
      attempts++;
    }

    const affiliate = await prisma.affiliate.create({
      data: {
        code,
        name,
        email,
        phone,
        userId: null,
        tenantId: null,
        status: 'active',
      },
    });

    return apiSuccess({
      message: 'Successfully registered as an affiliate.',
      affiliate,
    }, 201);
  } catch (error: any) {
    console.error('[API_AFFILIATE_REGISTER]', error);
    return apiError(error.message, 500);
  }
}
