import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = postgres(url, {
    prepare: false,
    ssl: 'require',
    max: 1,
  });
  _db = drizzle(client, { schema, logger: process.env.NODE_ENV !== 'production' });
  return _db;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as Function).bind(real) : value;
  },
});

export type DB = PostgresJsDatabase<typeof schema>;
