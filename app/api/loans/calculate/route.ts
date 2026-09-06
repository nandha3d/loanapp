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
      // Term axis. Absent means 'scheduled' — what every caller sent before it
      // existed — so an older client keeps getting exactly what it got before.
      termType = 'scheduled',
      termDays = null,
    } = body;

    const calculation = calculateLoanPreview({
      principal: Number(principal),
      interestType,
      interestRate: Number(interestRate),
      tenure: Number(tenure),
      frequency,
      startDate,
      dueDay,
      termType,
      termDays: termDays == null ? null : Number(termDays),
    });

    return NextResponse.json({
      success: true,
      data: calculation,
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
