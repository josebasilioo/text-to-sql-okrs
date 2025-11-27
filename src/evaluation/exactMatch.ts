// exactMatch.ts
export function exactMatch(q1: string, q2: string): boolean {
  const normalize = (q: string) =>
    q
      .trim()
      .replace(/;+\s*$/, '') // remove ponto e vírgula no final
      .replace(/\s+/g, ' ') // normaliza espaços
      .toLowerCase();

  return normalize(q1) === normalize(q2);
}
