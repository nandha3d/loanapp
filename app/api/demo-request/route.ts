import { NextResponse } from 'next/server';
import { createEnquiry, sendEnquiryEmailToSupport } from '@/lib/enquiries';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, company, vertical, loanCapacity, agentCount, city, source, message } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone number are required.' },
        { status: 400 }
      );
    }

    // 1. Save enquiry to database
    let enquiryId = '';
    try {
      enquiryId = await createEnquiry({
        name: String(name),
        phone: String(phone),
        company: company ? String(company) : null,
        vertical: vertical ? String(vertical) : 'microlending',
        loanCapacity: loanCapacity ? String(loanCapacity) : null,
        agentCount: agentCount ? String(agentCount) : null,
        city: city ? String(city) : null,
        source: source ? String(source) : 'website_demo',
        message: message ? String(message) : null,
      });
    } catch (dbErr) {
      console.error('[Demo Request DB Error]', dbErr);
    }

    // 2. Dispatch email to support@zolofunds.com
    try {
      await sendEnquiryEmailToSupport({
        name: String(name),
        phone: String(phone),
        company: company ? String(company) : null,
        vertical: vertical ? String(vertical) : 'microlending',
        city: city ? String(city) : null,
        source: source ? String(source) : 'website_demo',
        message: message ? String(message) : null,
      });
    } catch (mailErr) {
      console.error('[Demo Request Email Error]', mailErr);
    }

    console.log('[ZoloFunds Demo Request Saved]', {
      id: enquiryId,
      name,
      phone,
      company,
      vertical,
      city,
      source: source || 'website_demo',
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Demo request recorded successfully. Our team will contact you shortly.',
      id: enquiryId,
    });
  } catch (error) {
    console.error('[ZoloFunds Demo Request Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request.' },
      { status: 500 }
    );
  }
}
