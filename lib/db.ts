import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool: Pool };

// Strip sslmode from the connection string so pg-connection-string doesn't
// emit the "prefer/require/verify-ca alias" deprecation warning. SSL is
// controlled explicitly via the `ssl` option below instead.
function buildConnectionString(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    return parsed.toString();
  } catch {
    return url;
  }
}

const isRemote = (process.env.DATABASE_URL ?? "").includes("@") &&
  !(process.env.DATABASE_URL ?? "").includes("localhost") &&
  !(process.env.DATABASE_URL ?? "").includes("127.0.0.1");

export const pool =
  globalForPg.pool ||
  new Pool({
    connectionString: buildConnectionString(),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool;

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
