// executionMatch.ts
import { Client } from 'pg';

export async function executionMatch(gold: string, pred: string): Promise<boolean> {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
  });

  await client.connect();

  try {
    const goldRes = await client.query(gold);
    const predRes = await client.query(pred);

    const normalize = (rows: Record<string, unknown>[]) =>
      JSON.stringify(
        rows
          .map((r) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b))))
          .sort()
      );

    return normalize(goldRes.rows) === normalize(predRes.rows);
  } finally {
    await client.end();
  }
}
