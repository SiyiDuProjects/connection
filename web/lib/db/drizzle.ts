import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const localTest = process.env.REACHARD_LOCAL_TEST === '1' && process.env.NODE_ENV === 'development';
const testGlobal = globalThis as typeof globalThis & { reachardTestClient?: ReturnType<typeof postgres> };
export const client = localTest
  ? (testGlobal.reachardTestClient ||= postgres(process.env.POSTGRES_URL, { max: 1, prepare: false }))
  : postgres(process.env.POSTGRES_URL);
export const db = drizzle(client, { schema });
