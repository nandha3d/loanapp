import { calculateLoanPreview } from '@/lib/loanCalculator';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      principal = 0, 
      interestType = 'upfront_fixed', 
      interestRate = 0, 
      tenure = 1, 
      frequency = 'daily',
      startDate = new Date().toISOString(),
      dueDay = null,
    } = body;

    const calculation = calculateLoanPreview({
      principal: Number(principal),
      interestType,
      interestRate: Number(interestRate),
      tenure: Number(tenure),
      frequency,
      startDate,
      dueDay,
    });

    return NextResponse.json({
      success: true,
      data: calculation,
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
