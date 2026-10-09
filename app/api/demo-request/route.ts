import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, company, vertical, loanCapacity, agentCount, city } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone number are required.' },
        { status: 400 }
      );
    }

    // In a production environment, this can be saved to DB or emailed to sales team
    console.log('[ZoloFunds Demo Request]', {
      name: String(name).slice(0, 100),
      phone: String(phone).slice(0, 30),
      company: company ? String(company).slice(0, 100) : null,
      vertical: vertical ? String(vertical).slice(0, 50) : 'microlending',
      loanCapacity: loanCapacity ? String(loanCapacity).slice(0, 50) : null,
      agentCount: agentCount ? String(agentCount).slice(0, 50) : null,
      city: city ? String(city).slice(0, 100) : null,
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Demo request recorded successfully. Our team will contact you shortly.',
    });
  } catch (error) {
    console.error('[ZoloFunds Demo Request Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request.' },
      { status: 500 }
    );
  }
}
