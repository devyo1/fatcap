import 'server-only';
import { neon } from '@neondatabase/serverless';

type Runner = (text: string, params: unknown[]) => Promise<unknown[]>;
let run: Runner | null = null;

async function runner(): Promise<Runner> {
  if (run) return run;
  // LOCAL_DB=./.localdb runs an in-process Postgres (PGlite) for development without Neon.
  if (process.env.LOCAL_DB && process.env.NODE_ENV !== 'production') {
    const { PGlite } = await import('@electric-sql/pglite');
    // One instance per process: dev mode loads this module more than once, and two
    // PGlite instances on the same folder corrupt each other.
    const g = globalThis as unknown as { __fcPglite?: InstanceType<typeof PGlite> };
    const pg = (g.__fcPglite ??= new PGlite(process.env.LOCAL_DB));
    return (run = async (text, params) => (await pg.query(text, params)).rows);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  return (run = async (text, params) => (await sql.query(text, params)) as unknown[]);
}

/** Run a parameterised query and get rows back. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await runner())(text, params)) as T[];
}

/** First row or null. */
export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
