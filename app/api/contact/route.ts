import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ContactSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(160),
  topic: z.string().max(120).optional().default(''),
  message: z.string().min(4).max(4000),
  // Honeypot field: real users leave it blank.
  hp: z.string().optional(),
});

type ContactRateGlobal = typeof globalThis & {
  __contactRate?: Map<string, number>;
};

const contactGlobal = globalThis as ContactRateGlobal;
const RATE = contactGlobal.__contactRate ?? (contactGlobal.__contactRate = new Map<string, number>());
const WINDOW_MS = 60_000;

function fingerprint(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0';
  return ip;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = ContactSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'invalid payload',
      },
      { status: 400 },
    );
  }

  // Honeypot: silently 200 OK so bots think it worked.
  if (parsed.hp) {
    return NextResponse.json({ ok: true });
  }

  // Rate-limit (per IP) — 1 message per WINDOW_MS.
  const fp = fingerprint(req);
  const last = RATE.get(fp) ?? 0;
  if (Date.now() - last < WINDOW_MS) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  RATE.set(fp, Date.now());

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_INBOX || process.env.ADMIN_EMAIL_ALLOWLIST?.split(',')[0]?.trim();
  const from = process.env.CONTACT_FROM || 'hello@gutsyang.dev';

  if (!apiKey || !to) {
    // Without an email transport configured, log and return ok so the form
    // is still usable in development. The submission lives in server logs.
    console.info('[contact] (no transport configured)', parsed);
    return NextResponse.json({ ok: true, transport: 'log-only' });
  }

  const subject = parsed.topic
    ? `[hello-gutsyang] ${parsed.topic} — ${parsed.name}`
    : `[hello-gutsyang] message from ${parsed.name}`;
  const text = [
    `From: ${parsed.name} <${parsed.email}>`,
    parsed.topic ? `Topic: ${parsed.topic}` : '',
    '',
    parsed.message,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: parsed.email,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `resend ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'send_failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
