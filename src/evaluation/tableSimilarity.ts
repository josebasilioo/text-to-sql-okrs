// st.ts
import { editDistance } from './editDistance';

export async function computeTableSimilarity(
  sqlGenerated: string,
  sqlGold: string,
  executeSQL: (sql: string) => Promise<string[][]>
): Promise<number> {
  console.log('[GERADO]', sqlGenerated);
  console.log('[ESPERADO]', sqlGold);
  // se o SQL for exatamente igual, ST = 1
  if (sqlGenerated.trim() === sqlGold.trim()) {
    return 1;
  }

  // Executa as queries - erros serão propagados para o código chamador
  const tableGen = await executeSQL(sqlGenerated);
  const tableGold = await executeSQL(sqlGold);

  const n = tableGen.length;
  const m = tableGold.length;

  if (n === 0 || m === 0) return 0;

  // determina a maior quantidade de linhas entre as tabelas
  const maxRows = Math.max(tableGen[0]?.length ?? 0, tableGold[0]?.length ?? 0);

  let total = 0;

  for (let i = 0; i < n; i++) {
    let best = Infinity;

    for (let j = 0; j < m; j++) {
      const d = editDistance(tableGen[i], tableGold[j]);
      const normalized = d / maxRows;
      best = Math.min(best, normalized);
    }

    total += best;
  }

  // fórmula do artigo
  const ST = 1 - total / Math.max(n, m);

  return Math.max(0, Math.min(1, ST));
}
