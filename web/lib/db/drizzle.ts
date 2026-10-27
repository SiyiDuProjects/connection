import { drizzle } from 'drizzle-orm/postgres-js';
import { getDatabaseClient } from './client.mjs';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const connection = getDatabaseClient();
if (!connection) throw new Error('POSTGRES_URL environment variable is not set');
export const client = connection;
export const db = drizzle(client, { schema });
