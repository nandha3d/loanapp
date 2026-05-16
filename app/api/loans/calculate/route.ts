import { calculateInstalmentDates } from '@/lib/utils';
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
      startDate = new Date().toISOString()
    } = body;

    const p = Number(principal) || 0;
    const rate = Number(interestRate) || 0;
    const t = Number(tenure) || 1;

    let disbursedAmount = p;
    let totalPayable = p;
    let perInstalment = 0;
    let deduction = 0;

    switch (interestType) {
      case 'upfront_fixed':
        deduction = rate;
        disbursedAmount = p - deduction;
        totalPayable = p;
        perInstalment = t > 0 ? Math.round(p / t) : 0;
        break;

      case 'upfront_percentage':
        deduction = p * (rate / 100);
        disbursedAmount = p - deduction;
        totalPayable = p;
        perInstalment = t > 0 ? Math.round(p / t) : 0;
        break;

      case 'emi_flat':
        // Flat interest added to principal
        const interestAmount = p * (rate / 100);
        disbursedAmount = p;
        totalPayable = p + interestAmount;
        perInstalment = t > 0 ? Math.round(totalPayable / t) : 0;
        break;

      case 'emi_floating':
        // Amortized (reducing balance)
        // 'rate' is treated as Annual Percentage Rate (APR)
        let periodsPerYear = 12; // default monthly
        if (frequency === 'daily') periodsPerYear = 365;
        else if (frequency === 'weekly') periodsPerYear = 52;
        else if (frequency === 'biweekly') periodsPerYear = 26;

        const r = (rate / 100) / periodsPerYear;
        
        disbursedAmount = p;
        if (r === 0) {
          totalPayable = p;
          perInstalment = t > 0 ? Math.round(p / t) : 0;
        } else {
          // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
          const emi = p * r * Math.pow(1 + r, t) / (Math.pow(1 + r, t) - 1);
          perInstalment = Math.round(emi);
          totalPayable = perInstalment * t;
        }
        break;

      default:
        // Fallback to simple upfront
        disbursedAmount = p;
        totalPayable = p;
        perInstalment = t > 0 ? Math.round(p / t) : 0;
        break;
    }

    // Fix rounding discrepancies in totalPayable for EMI flat/floating
    if (interestType === 'emi_flat' || interestType === 'emi_floating') {
        totalPayable = perInstalment * t;
    }

    // Generate Schedule
    const instalmentDates = calculateInstalmentDates(new Date(startDate), frequency, t);
    const schedule = instalmentDates.map((date, index) => ({
      instalmentNo: index + 1,
      dueDate: date,
      dueAmount: perInstalment
    }));

    return NextResponse.json({
      success: true,
      data: {
        principal: p,
        disbursedAmount,
        totalPayable,
        perInstalment,
        deduction, // helpful to know if upfront
        schedule
      }
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
