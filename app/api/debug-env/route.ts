import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskPassword(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':****@');
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;
  const authUrl = process.env.AUTH_URL;

  const result: Record<string, unknown> = {
    DATABASE_URL_present: !!dbUrl,
    DATABASE_URL_length: dbUrl?.length ?? 0,
    AUTH_SECRET_present: !!authSecret,
    AUTH_SECRET_length: authSecret?.length ?? 0,
    AUTH_URL_present: !!authUrl,
    AUTH_URL_value: authUrl ?? null,
  };

  if (dbUrl) {
    result.DATABASE_URL_masked = maskPassword(dbUrl);
    result.DATABASE_URL_first_20 = dbUrl.slice(0, 20);
    result.DATABASE_URL_last_20 = dbUrl.slice(-20);
    result.DATABASE_URL_starts_with_https = dbUrl.startsWith('https');
    result.DATABASE_URL_starts_with_postgres = dbUrl.startsWith('postgres');
    try {
      const u = new URL(dbUrl);
      result.DATABASE_URL_parse = 'OK';
      result.DATABASE_URL_protocol = u.protocol;
      result.DATABASE_URL_host = u.hostname;
      result.DATABASE_URL_port = u.port;
      result.DATABASE_URL_username = u.username;
      result.DATABASE_URL_password_length = u.password.length;
    } catch (e) {
      result.DATABASE_URL_parse = 'FAILED';
      result.DATABASE_URL_parse_error = e instanceof Error ? e.message : String(e);
    }
  }

  if (authUrl) {
    try {
      new URL(authUrl);
      result.AUTH_URL_parse = 'OK';
    } catch (e) {
      result.AUTH_URL_parse = 'FAILED';
      result.AUTH_URL_parse_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(result, { status: 200 });
}
