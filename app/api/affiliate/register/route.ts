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

    // Generate a custom, unique code: APPNAME + BusinessName + Number
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const appPrefix = process.env.APP_NAME || 'LOANTRACK';
    
    // Clean up the name for the code
    const cleanName = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 10)
      .toUpperCase();

    while (!isUnique && attempts < 10) {
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      code = `${appPrefix}${cleanName}${randomNum}`;
      
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
    });
  } catch (error: any) {
    console.error('[API_AFFILIATE_REGISTER]', error);
    return apiError(error.message, 500);
  }
}
