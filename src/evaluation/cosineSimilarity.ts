// sc.ts
import { embedder } from '../services/embbderSerivce';

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  return dot / (magA * magB);
}

export async function computeSemanticSimilarity(
  sqlGenerated: string,
  sqlGold: string
): Promise<number> {
  const emb1 = await embedder(sqlGenerated);
  const emb2 = await embedder(sqlGold);

  return cosineSimilarity(emb1, emb2); // 0 → 1
}
