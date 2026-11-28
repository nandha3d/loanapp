import { NextRequest, NextResponse } from 'next/server';
import { loadEnvConfig } from '@next/env';
import { auth } from '@/lib/auth';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import {
  clampBidVoiceSpeed,
  normalizeBidVoiceProfile,
  type BidVoiceProfileId,
} from '@/lib/chits/bidVoiceAnnouncer';

type VoiceSpec = { languageCode: string; name: string };

const VOICE_MATRIX: Record<BidVoiceProfileId, Record<string, VoiceSpec>> = {
  MALE_CLASSIC: {
    en: { languageCode: 'en-IN', name: process.env.GOOGLE_TTS_VOICE_EN || 'en-IN-Wavenet-B' },
    ta: { languageCode: 'ta-IN', name: process.env.GOOGLE_TTS_VOICE_TA || 'ta-IN-Wavenet-B' },
    ml: { languageCode: 'ml-IN', name: process.env.GOOGLE_TTS_VOICE_ML || 'ml-IN-Wavenet-B' },
    hi: { languageCode: 'hi-IN', name: process.env.GOOGLE_TTS_VOICE_HI || 'hi-IN-Wavenet-B' },
    te: { languageCode: 'te-IN', name: process.env.GOOGLE_TTS_VOICE_TE || 'te-IN-Standard-B' },
    kn: { languageCode: 'kn-IN', name: process.env.GOOGLE_TTS_VOICE_KN || 'kn-IN-Wavenet-B' },
  },
  FEMALE_CLASSIC: {
    en: { languageCode: 'en-IN', name: 'en-IN-Wavenet-A' },
    ta: { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-A' },
    ml: { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-A' },
    hi: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-A' },
    te: { languageCode: 'te-IN', name: 'te-IN-Standard-A' },
    kn: { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-A' },
  },
  MALE_WARM: {
    en: { languageCode: 'en-IN', name: 'en-IN-Neural2-C' },
    ta: { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-D' },
    ml: { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-D' },
    hi: { languageCode: 'hi-IN', name: 'hi-IN-Neural2-C' },
    te: { languageCode: 'te-IN', name: 'te-IN-Standard-D' },
    kn: { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-D' },
  },
  FEMALE_NATURAL: {
    en: { languageCode: 'en-IN', name: 'en-IN-Neural2-D' },
    ta: { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-C' },
    ml: { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-C' },
    hi: { languageCode: 'hi-IN', name: 'hi-IN-Neural2-D' },
    te: { languageCode: 'te-IN', name: 'te-IN-Standard-C' },
    kn: { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-C' },
  },
};

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildGoogleTtsInput(text: string, langCode: string): { ssml: string } {
  let escaped = escapeXml(text)
    .replace(/\s*[,—]\s*/g, ', <break time="220ms"/>')
    .replace(/!\s+/g, '! <break time="260ms"/>');
  if (langCode === 'en') {
    escaped = escaped.replace(
      /\blakh\b/gi,
      '<phoneme alphabet="ipa" ph="lʌk">lakh</phoneme>',
    );
  }
  return { ssml: `<speak>${escaped}</speak>` };
}

function getGoogleTtsApiKey(): string | null {
  if (process.env.NODE_ENV !== 'production') {
    try {
      loadEnvConfig(process.cwd(), true, undefined, true);
    } catch {
      // Ignore reload errors outside writable workspace
    }
  }
  const key = (process.env.GOOGLE_TTS_API_KEY || '').trim();
  return key || null;
}

async function resolveTtsTenantContext(): Promise<{ authorized: boolean; tenantId: string | null }> {
  const [staffSession, borrowerSession] = await Promise.all([auth(), getBorrowerSession()]);
  if (!staffSession?.user?.id && !borrowerSession?.customerId) {
    return { authorized: false, tenantId: null };
  }
  const rawTenant =
    (staffSession?.user as { tenantId?: string | null } | undefined)?.tenantId ??
    borrowerSession?.tenantId ??
    (await getDefaultTenantId().catch(() => null));
  return { authorized: true, tenantId: rawTenant };
}

export async function GET() {
  const ctx = await resolveTtsTenantContext();
  if (!ctx.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const hasKey = Boolean(getGoogleTtsApiKey());
  return NextResponse.json(
    { configured: hasKey, provider: hasKey ? 'google' : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const ctx = await resolveTtsTenantContext();
  if (!ctx.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? '').trim().slice(0, 240);
  const langCode = String(body?.lang ?? 'en').toLowerCase().slice(0, 2);
  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  const apiKey = getGoogleTtsApiKey();
  if (!apiKey) {
    return NextResponse.json({ configured: false, error: 'GOOGLE_TTS_API_KEY is not configured' }, { status: 501 });
  }

  try {
    const [savedRate, savedProfile] = ctx.tenantId
      ? await Promise.all([
          getSetting(ctx.tenantId, 'chit_voice_speaking_rate', '0.88'),
          getSetting(ctx.tenantId, 'chit_voice_profile', 'MALE_CLASSIC'),
        ])
      : ['0.88', 'MALE_CLASSIC'];

    const speakingRate = clampBidVoiceSpeed(body?.speakingRate != null ? body.speakingRate : savedRate);
    const voiceProfile = normalizeBidVoiceProfile(body?.voiceProfile ? String(body.voiceProfile) : savedProfile);
    const profileMap = VOICE_MATRIX[voiceProfile] ?? VOICE_MATRIX.MALE_CLASSIC;
    const target = profileMap[langCode] ?? profileMap.en;
    const inputPayload = buildGoogleTtsInput(text, langCode);

    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputPayload,
          voice: {
            languageCode: target.languageCode,
            name: target.name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate,
          },
        }),
      },
    );
    if (!resp.ok) {
      return NextResponse.json({ error: `Google Cloud TTS error (${resp.status})` }, { status: 502 });
    }
    const data = (await resp.json()) as { audioContent?: string };
    if (!data?.audioContent) {
      return NextResponse.json({ error: 'Empty Google Cloud TTS response' }, { status: 502 });
    }
    const buf = Buffer.from(data.audioContent, 'base64');
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Google TTS failure' }, { status: 502 });
  }
}
