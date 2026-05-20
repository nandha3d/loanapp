import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Restrict this endpoint to development environment for security
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    // Query a list of active loans to help developers log in instantly
    const activeLoans = await prisma.loan.findMany({
      where: {
        status: 'active',
        customer: {
          status: 'active',
        },
      },
      take: 6,
      select: {
        loanCode: true,
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    const accounts = activeLoans.map((item) => ({
      loanCode: item.loanCode,
      phone: item.customer.phone,
      name: item.customer.name,
    }));

    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    console.error('Error fetching test accounts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
