// embedder-local.ts
import { pipeline } from '@xenova/transformers';

let extractor: any = null;

// inicializa o modelo uma única vez
async function loadEmbedder() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

export async function embedder(text: string): Promise<number[]> {
  const model = await loadEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: false });
  return Array.from(output.data); // retorna um vetor de números
}
