// tableSimilarity.ts
function columnEditDistance(colA: any[], colB: any[]): number {
  // Ordena para ignorar a ordem das linhas (comportamento padrão order=False)
  // Converte para string para garantir ordenação consistente de null/undefined/numbers
  const l1 = [...colA].sort((a, b) => String(a).localeCompare(String(b)));
  const l2 = [...colB].sort((a, b) => String(a).localeCompare(String(b)));

  const len1 = l1.length;
  const len2 = l2.length;

  // Cria matriz de DP (len1+1) x (len2+1)
  const dp: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) {
    for (let j = 0; j <= len2; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else if (String(l1[i - 1]) === String(l2[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // Remove
            dp[i][j - 1], // Insert
            dp[i - 1][j - 1] // Replace
          );
      }
    }
  }

  return dp[len1][len2];
}

function transposeRowsToColumns(rows: any[][]): any[][] {
  if (!rows || rows.length === 0) return [];
  // Assume que todas as linhas têm o mesmo número de colunas
  const numCols = rows[0].length;
  const columns: any[][] = [];

  for (let c = 0; c < numCols; c++) {
    const colVector = rows.map((r) => r[c]);
    columns.push(colVector);
  }
  return columns;
}

export async function computeTableSimilarity(
  sqlGenerated: string,
  sqlGold: string,
  executeSQL: (sql: string) => Promise<any[][]>
): Promise<number> {
  console.log('V2 - computeTableSimilarity');
  if (sqlGenerated.trim() === sqlGold.trim()) {
    return 1;
  }

  try {
    const [rowsGen, rowsGold] = await Promise.all([executeSQL(sqlGenerated), executeSQL(sqlGold)]);

    const colsGen = transposeRowsToColumns(rowsGen);
    const colsGold = transposeRowsToColumns(rowsGold);

    const nGen = colsGen.length;
    const nGold = colsGold.length;

    const maxRows = Math.max(rowsGen.length, rowsGold.length);
    const maxCols = Math.max(nGen, nGold);

    if (maxCols === 0) return 1;
    if (nGen === 0 || nGold === 0) return 0;
    if (maxRows === 0) return 1;

    let totalNormalizedDistance = 0;

    for (let i = 0; i < maxCols; i++) {
      let minDistanceForThisCol = Infinity;

      if (i >= nGold) {
        minDistanceForThisCol = maxRows;
      } else {
        for (let j = 0; j < maxCols; j++) {
          let d: number;

          if (j >= nGen) {
            d = maxRows;
          } else {
            d = columnEditDistance(colsGold[i], colsGen[j]);
          }

          if (d < minDistanceForThisCol) {
            minDistanceForThisCol = d;
          }
        }
      }

      totalNormalizedDistance += minDistanceForThisCol / maxRows;
    }

    const score = 1 - totalNormalizedDistance / maxCols;

    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Erro ao calcular Table Similarity:', error);
    return 0;
  }
}
