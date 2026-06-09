import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseAnonClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SCOPES = new Set(['project', 'experience', 'post', 'home']);

// Very lightweight in-memory rate limit: a visitor (fingerprint = ip+ua hash)
// can only bump the same ref_id once per ~60s. Resets every cold start; that
// is acceptable for the "tasteful counter" use-case.
type ViewRateGlobal = typeof globalThis & {
  __viewRate?: Map<string, number>;
};

const viewGlobal = globalThis as ViewRateGlobal;
const RATE = viewGlobal.__viewRate ?? (viewGlobal.__viewRate = new Map<string, number>());
const WINDOW_MS = 60_000;

function fingerprint(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  // not crypto: just a stable bucket
  let hash = 0;
  for (let i = 0; i < ua.length; i++) hash = (hash * 31 + ua.charCodeAt(i)) | 0;
  return `${ip}::${hash}`;
}

async function readCount(scope: string, id: string): Promise<number> {
  const sb = createSupabaseAnonClient();
  if (!sb) return 0;
  const { data } = await sb
    .from('views')
    .select('count')
    .eq('scope', scope)
    .eq('ref_id', id)
    .maybeSingle();
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scope: string; id: string }> },
) {
  const { scope, id } = await params;
  if (!ALLOWED_SCOPES.has(scope)) {
    return NextResponse.json({ error: 'unknown scope' }, { status: 400 });
  }
  const count = await readCount(scope, id);
  return NextResponse.json({ scope, ref_id: id, count });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scope: string; id: string }> },
) {
  const { scope, id } = await params;
  if (!ALLOWED_SCOPES.has(scope)) {
    return NextResponse.json({ error: 'unknown scope' }, { status: 400 });
  }

  const fp = `${scope}:${id}:${fingerprint(req)}`;
  const now = Date.now();
  const last = RATE.get(fp) ?? 0;
  if (now - last < WINDOW_MS) {
    // Soft no-op: return current count without bumping.
    const count = await readCount(scope, id);
    return NextResponse.json({ scope, ref_id: id, count, throttled: true });
  }
  RATE.set(fp, now);

  // Prefer service-role so the increment_view RPC can update even with strict
  // RLS; fall back to anon (RPC is granted to anon in the migration).
  const admin = createSupabaseAdminClient();
  const sb = admin ?? createSupabaseAnonClient();
  if (!sb) {
    return NextResponse.json({ scope, ref_id: id, count: 0, mocked: true });
  }

  const { data, error } = await sb.rpc('increment_view', {
    p_scope: scope,
    p_ref_id: id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    scope,
    ref_id: id,
    count: typeof data === 'number' ? data : 0,
  });
}
