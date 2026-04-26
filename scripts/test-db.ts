import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const masked = url.replace(/:([^:@]+)@/, ':****@');
  console.log('🔍 Testing connection to:');
  console.log('  ', masked);
  console.log();

  try {
    const u = new URL(url);
    console.log('  protocol:', u.protocol);
    console.log('  username:', u.username);
    console.log('  host:    ', u.hostname);
    console.log('  port:    ', u.port);
    console.log('  database:', u.pathname.slice(1));
    console.log('  password length:', u.password.length, 'chars');
    console.log();
    if (!u.username.startsWith('postgres.')) {
      console.warn('⚠️  Username does not start with "postgres." — required for Supabase pooler');
    }
  } catch (e) {
    console.error('❌ Invalid URL format:', e);
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, ssl: 'require', max: 1, idle_timeout: 5 });

  try {
    const result = await sql`select now() as time, current_user as "user", current_database() as db`;
    console.log('✅ Connection OK');
    console.log('  result:', result[0]);

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `;
    console.log();
    console.log('📋 Tables in public schema:', tables.length);
    for (const t of tables) console.log('  -', t.table_name);
    if (tables.length === 0) {
      console.warn('⚠️  No tables — run the SQL schema in Supabase SQL Editor');
    }
  } catch (e) {
    console.error('❌ Query failed');
    if (e instanceof Error) {
      console.error('  message:', e.message);
      const code = (e as { code?: string }).code;
      if (code) console.error('  code:   ', code);
      if (e.cause) console.error('  cause:  ', e.cause);
    } else {
      console.error(e);
    }
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
