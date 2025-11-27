import { pipeline } from '@xenova/transformers';

let extractor: any = null;

async function embed(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

const schema: Record<string, string[]> = {
  collaborator: ['id', 'name', 'email', 'login', 'active'],
  initiative: [
    'id',
    'owner_id',
    'title',
    'description',
    'category',
    'priority',
    'start_date',
    'end_date',
  ],
  okr: ['id', 'initiative_id', 'description', 'deadline'],
  kr: ['id', 'okr_id', 'title', 'metric', 'direction', 'progress', 'target'],
  kr_history: ['id', 'kr_id', 'collaborator_id', 'date', 'progress', 'target'],
  initiative_update: [
    'id',
    'initiative_id',
    'created_date',
    'last_modified_date',
    'brutal_facts',
    'created_by',
    'highlights',
    'last_modified_by',
    'next_steps',
    'year_month',
    'highlights',
    'brutal_facts',
    'next_steps',
  ],
};

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function schemaLinker(question: string) {
  const qEmb = await embed(question);

  const scored: { table: string; column: string; score: number }[] = [];

  for (const table of Object.keys(schema)) {
    for (const column of schema[table]) {
      const description = `${table}.${column}`;
      const colEmb = await embed(description);

      const score = cosine(qEmb, colEmb);

      scored.push({ table, column, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const TOP_K = 12;
  const selected = scored.slice(0, TOP_K);

  const grouped: Record<string, Set<string>> = {};

  for (const item of selected) {
    if (!grouped[item.table]) grouped[item.table] = new Set();
    grouped[item.table].add(item.column);
  }

  return grouped;
}
