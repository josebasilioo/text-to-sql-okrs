// qas.ts

/**
 * QAS = (1 - w) * SC + w * ST
 *
 * Onde:
 *  SC = semantic similarity ∈ [0, 1]
 *  ST = table similarity ∈ [0, 1]
 *  w  = peso (0 ≤ w ≤ 1)
 */
export function computeQAS(SC: number, ST: number, w: number = 0.5): number {
  const QAS = (1 - w) * SC + w * ST;

  // garante que o valor fique entre 0 e 1
  return Math.min(1, Math.max(0, QAS));
}
