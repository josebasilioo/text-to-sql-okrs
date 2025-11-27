import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
// Importa config/env.ts que já carrega o dotenv automaticamente
import { Client } from 'pg';
import '../config/env';
import { componentMatchAccuracy } from '../evaluation/componentMatch';
import { computeSemanticSimilarity } from '../evaluation/cosineSimilarity';
import { exactMatch } from '../evaluation/exactMatch';
import { executionMatch } from '../evaluation/executionMatch';
import { computeQAS } from '../evaluation/queryAffinityScore';
import { SQLValidator } from '../evaluation/sqlValidator';
import { computeTableSimilarity } from '../evaluation/tableSimilarity_v2';
import { SqlFixService } from '../services/sqlFixService';
import { TextToSqlService } from '../services/textToSqlService';

// ========================================
// 🔧 CONFIGURAÇÃO DO PROVIDER
// ========================================
// Opções: 'gpt', 'gemini', 'llama'
const PROVIDER: 'gpt' | 'gemini' | 'llama' = 'gpt';

// Nome do arquivo de resultado (sem extensão)
const OUTPUT_FILENAME = '1-shot-4O-mini';
// ========================================

interface GoldEntry {
  question: string;
  gold: string;
}

interface RetryInfo {
  attempt: number;
  sql: string;
  error?: string;
  fixed?: boolean;
}

interface EvaluationResult {
  question: string;
  status: 'SUCCESS' | 'ERROR';
  predictedSql?: string;
  goldSql?: string;
  exactMatch?: boolean;
  componentMatch?: {
    componentMatches: Record<string, number>;
    CM: number;
  };
  executionMatch?: boolean;
  cosineSimilarity?: number;
  tableSimilarity?: number;
  queryAffinityScore?: number;
  executionTimeMs?: number;
  error?: string;
  retries?: RetryInfo[];
  finalSql?: string; // SQL final após todas as tentativas de correção
}

interface Report {
  timestamp: string;
  totalQuestions: number;
  successful: number;
  errors: number;
  retries: {
    totalWithRetries: number;
    totalRetryAttempts: number;
    averageRetriesPerQuestion: number;
    maxRetries: number;
    successfulAfterRetry: number;
    failedAfterRetry: number;
  };
  metrics: {
    exactMatch: {
      total: number;
      matches: number;
      accuracy: number;
    };
    componentMatch: {
      total: number;
      averageCM: number;
    };
    executionMatch: {
      total: number;
      matches: number;
      accuracy: number;
    };
    cosineSimilarity: {
      total: number;
      average: number;
    };
    tableSimilarity: {
      total: number;
      average: number;
    };
    queryAffinityScore: {
      total: number;
      average: number;
    };
  };
  results: EvaluationResult[];
}

async function loadPredictions(): Promise<string[]> {
  const predictPath = join(__dirname, '../../database/predict.json');
  const content = readFileSync(predictPath, 'utf-8');
  return JSON.parse(content);
}

async function loadGold(): Promise<GoldEntry[]> {
  const goldPath = join(__dirname, '../../database/gold.json');
  const content = readFileSync(goldPath, 'utf-8');
  return JSON.parse(content);
}

function findGoldSql(question: string, goldEntries: GoldEntry[]): string | undefined {
  const entry = goldEntries.find((e) => e.question.trim() === question.trim());
  return entry?.gold;
}

// Função auxiliar para executar SQL e retornar tabela
async function executeSQLForTable(sql: string): Promise<string[][]> {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
  });

  await client.connect();

  try {
    const result = await client.query(sql);

    // Converte resultado para array de arrays de strings
    const table: string[][] = result.rows.map((row) =>
      Object.values(row).map((val) => String(val ?? ''))
    );

    return table;
  } finally {
    await client.end();
  }
}

// Função auxiliar para executar SQL com retry e correção automática
async function executeSQLWithRetry(
  sql: string,
  originalQuestion: string,
  sqlFixService: SqlFixService,
  maxRetries: number = 3
): Promise<{ sql: string; retries: RetryInfo[]; error?: string }> {
  const retries: RetryInfo[] = [];
  let currentSql = sql;
  let lastError: string | undefined;

  // Primeira tentativa (sem retry ainda)
  retries.push({
    attempt: 1,
    sql: currentSql,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Tenta executar o SQL atual
      await executeSQLForTable(currentSql);

      // Se chegou aqui, o SQL executou com sucesso
      if (attempt > 1) {
        // Atualiza a última tentativa como bem-sucedida
        retries[retries.length - 1].fixed = true;
      }

      return { sql: currentSql, retries };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;

      // Atualiza a tentativa atual com o erro
      retries[retries.length - 1].error = errorMessage;

      // Se não é a última tentativa, tenta corrigir
      if (attempt < maxRetries) {
        try {
          console.log(`  🔧 Tentativa ${attempt} falhou. Tentando corrigir SQL...`);

          const fixResponse = await sqlFixService.fixSql({
            originalQuestion,
            failedSql: currentSql,
            errorMessage,
            attemptNumber: attempt,
          });

          currentSql = fixResponse.fixedSql;

          // Adiciona nova tentativa
          retries.push({
            attempt: attempt + 1,
            sql: currentSql,
            fixed: true,
          });

          console.log(
            `  ✅ SQL corrigido (tentativa ${attempt + 1}): ${fixResponse.explanation || 'Sem explicação'}`
          );
        } catch (fixError) {
          const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError);
          console.error(`  ❌ Erro ao corrigir SQL: ${fixErrorMessage}`);

          // Adiciona tentativa de correção que falhou
          retries.push({
            attempt: attempt + 1,
            sql: currentSql,
            error: `Erro ao corrigir: ${fixErrorMessage}`,
            fixed: false,
          });

          // Se não conseguiu corrigir, para o loop
          break;
        }
      } else {
        // Última tentativa falhou
        break;
      }
    }
  }

  // Todas as tentativas falharam
  return { sql: currentSql, retries, error: lastError };
}

async function evaluateQuestion(
  question: string,
  goldSql: string | undefined,
  textToSqlService: TextToSqlService,
  sqlFixService: SqlFixService,
  index: number,
  total: number
): Promise<EvaluationResult> {
  console.log(`\n[${index + 1}/${total}] Processando: ${question.substring(0, 60)}...`);

  const result: EvaluationResult = {
    question,
    status: 'ERROR',
    retries: [],
  };

  try {
    // Chama o serviço de text-to-sql
    let response;
    let rawSqlContent = '';

    try {
      response = await textToSqlService.convertToSql({ question });
      result.predictedSql = response.sql;
      result.executionTimeMs = response.executionTimeMs;
      rawSqlContent = response.rawContent || response.sql || '';
    } catch (serviceError) {
      // Mesmo com erro, tenta capturar o que foi gerado
      const errorMessage =
        serviceError instanceof Error ? serviceError.message : String(serviceError);
      result.error = errorMessage;

      // Tenta extrair SQL do erro ou conteúdo bruto se disponível
      if (serviceError && typeof serviceError === 'object' && 'rawContent' in serviceError) {
        const errorWithContent = serviceError as { rawContent?: string };
        rawSqlContent = errorWithContent.rawContent || '';
        result.predictedSql = rawSqlContent;
      }

      // Se não conseguiu SQL, salva mensagem de erro
      if (!result.predictedSql) {
        result.predictedSql = `[Erro ao gerar SQL: ${errorMessage}]`;
      }

      result.goldSql = goldSql;
      console.error(`  ❌ Erro ao gerar SQL: ${errorMessage}`);

      // Retorna com erro, mas com SQL salva se disponível
      return result;
    }

    result.predictedSql = response.sql;
    result.executionTimeMs = response.executionTimeMs;
    result.goldSql = goldSql;

    if (!goldSql) {
      result.error = 'SQL esperada não encontrada no gold.json';
      return result;
    }

    // Calcula exactMatch
    try {
      result.exactMatch = exactMatch(response.sql, goldSql);
    } catch (error) {
      console.error(`  ⚠️  Erro ao calcular exactMatch: ${error}`);
    }

    // Calcula componentMatch
    try {
      result.componentMatch = componentMatchAccuracy(response.sql, goldSql);
    } catch (error) {
      console.error(`  ⚠️  Erro ao calcular componentMatch: ${error}`);
    }

    // Calcula cosineSimilarity (Semantic Similarity)
    try {
      result.cosineSimilarity = await computeSemanticSimilarity(response.sql, goldSql);
    } catch (error) {
      console.error(`  ⚠️  Erro ao calcular cosineSimilarity: ${error}`);
    }

    // Valida SQL antes de executar
    const sqlValidator = new SQLValidator();
    let hasUnsupportedSyntax = false;
    try {
      sqlValidator.validate(response.sql);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'UNSUPPORTED SYNTAX ERROR') {
        hasUnsupportedSyntax = true;
        result.error = 'UNSUPPORTED SYNTAX ERROR';
        console.error(`  ⚠️  SQL contém comandos perigosos: ${errorMessage}`);
        // Não executa executionMatch quando há sintaxe não suportada
      } else {
        throw error;
      }
    }

    // Calcula executionMatch e tableSimilarity apenas se SQL for válida
    let hasExecutionError = false;
    let finalSql = response.sql; // SQL que será usado após retries

    if (!hasUnsupportedSyntax) {
      // Tenta executar SQL com retry e correção automática
      const retryResult = await executeSQLWithRetry(
        response.sql,
        question,
        sqlFixService,
        3 // máximo de 3 tentativas
      );

      // Atualiza informações de retry
      result.retries = retryResult.retries;
      finalSql = retryResult.sql;
      result.finalSql = finalSql;

      // Se houve erro após todas as tentativas
      if (retryResult.error) {
        hasExecutionError = true;
        result.error = `Erro de execução no banco após ${retryResult.retries.length} tentativa(s): ${retryResult.error}`;
        console.error(`  ⚠️  Erro após retries: ${retryResult.error}`);
      }

      // Calcula executionMatch apenas se não houver erro de execução
      if (!hasExecutionError) {
        try {
          result.executionMatch = await executionMatch(goldSql, finalSql);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ⚠️  Erro ao calcular executionMatch: ${errorMessage}`);
          result.executionMatch = false;
          hasExecutionError = true;
          if (!result.error) {
            result.error = `Erro de execução no banco (executionMatch): ${errorMessage}`;
          }
        }
      } else {
        result.executionMatch = false;
      }

      // Calcula tableSimilarity apenas se não houver erro de execução
      if (!hasExecutionError) {
        try {
          // Usa o SQL corrigido (finalSql) para calcular tableSimilarity
          const sqlWasFixed = finalSql !== response.sql;
          if (sqlWasFixed) {
            console.log(`  📊 Calculando tableSimilarity com SQL corrigido após retry...`);
            console.log(`     SQL original: ${response.sql.substring(0, 80)}...`);
            console.log(`     SQL corrigido: ${finalSql.substring(0, 80)}...`);
          } else {
            console.log(`  📊 Calculando tableSimilarity com SQL original...`);
          }

          result.tableSimilarity = await computeTableSimilarity(
            finalSql,
            goldSql,
            executeSQLForTable
          );

          console.log(
            `  📊 TableSimilarity calculado: ${result.tableSimilarity} ${sqlWasFixed ? '(após correção)' : ''}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ⚠️  Erro ao calcular tableSimilarity: ${errorMessage}`);
          hasExecutionError = true;
          if (!result.error) {
            result.error = `Erro de execução no banco (tableSimilarity): ${errorMessage}`;
          }
          // Define como undefined ao invés de 0 para indicar que não foi calculado
          result.tableSimilarity = undefined;
        }
      } else {
        // Se houve erro de execução, não calcula tableSimilarity
        console.log(`  ⚠️  TableSimilarity não calculado devido a erro de execução`);
        result.tableSimilarity = undefined;
      }

      // Calcula Query Affinity Score (QAS) se ambas as métricas estiverem disponíveis
      if (
        !hasExecutionError &&
        result.cosineSimilarity !== undefined &&
        result.tableSimilarity !== undefined
      ) {
        try {
          result.queryAffinityScore = computeQAS(result.cosineSimilarity, result.tableSimilarity);
        } catch (error) {
          console.error(`  ⚠️  Erro ao calcular queryAffinityScore: ${error}`);
        }
      }
    } else {
      // Se tem sintaxe não suportada, não executa
      result.executionMatch = false;
      result.tableSimilarity = undefined; // Não calculado devido a sintaxe não suportada
    }

    // Marca como sucesso apenas se não houver erro de sintaxe não suportada E não houver erro de execução
    // Caso contrário, mantém como ERROR (mas SQL já está salva)
    if (!hasUnsupportedSyntax && !hasExecutionError) {
      result.status = 'SUCCESS';
      const retryInfo =
        result.retries && result.retries.length > 1 ? ` (${result.retries.length} tentativas)` : '';
      console.log(
        `  ✅ Sucesso${retryInfo} - EM: ${result.exactMatch ? '✓' : '✗'}, CM: ${result.componentMatch?.CM.toFixed(3) || 'N/A'}, EX: ${result.executionMatch ? '✓' : '✗'}, CS: ${result.cosineSimilarity?.toFixed(3) || 'N/A'}, TS: ${result.tableSimilarity?.toFixed(3) || 'N/A'}, QAS: ${result.queryAffinityScore?.toFixed(3) || 'N/A'}`
      );
    } else {
      result.status = 'ERROR';
      const retryInfo =
        result.retries && result.retries.length > 1
          ? ` (${result.retries.length} tentativas de correção)`
          : '';
      console.log(
        `  ❌ Erro${retryInfo} - SQL salva para análise. Erro: ${result.error || 'Desconhecido'}`
      );
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`  ❌ Erro: ${result.error}`);
  }

  return result;
}

async function generateReport(results: EvaluationResult[]): Promise<Report> {
  const successful = results.filter((r) => r.status === 'SUCCESS');
  const errors = results.filter((r) => r.status === 'ERROR');

  // Estatísticas de Retries
  const resultsWithRetries = results.filter((r) => r.retries && r.retries.length > 1);
  const totalRetryAttempts = results.reduce((sum, r) => {
    return sum + (r.retries ? r.retries.length - 1 : 0); // -1 porque a primeira tentativa não conta como retry
  }, 0);
  const averageRetriesPerQuestion =
    resultsWithRetries.length > 0 ? totalRetryAttempts / resultsWithRetries.length : 0;
  const maxRetries = Math.max(...results.map((r) => (r.retries ? r.retries.length - 1 : 0)), 0);
  const successfulAfterRetry = resultsWithRetries.filter((r) => r.status === 'SUCCESS').length;
  const failedAfterRetry = resultsWithRetries.filter((r) => r.status === 'ERROR').length;

  // Exact Match
  const exactMatchResults = successful.filter((r) => r.exactMatch !== undefined);
  const exactMatchCount = exactMatchResults.filter((r) => r.exactMatch === true).length;

  // Component Match
  const componentMatchResults = successful.filter((r) => r.componentMatch !== undefined);
  const averageCM =
    componentMatchResults.length > 0
      ? componentMatchResults.reduce((sum, r) => sum + (r.componentMatch?.CM || 0), 0) /
        componentMatchResults.length
      : 0;

  // Execution Match
  const executionMatchResults = successful.filter((r) => r.executionMatch !== undefined);
  const executionMatchCount = executionMatchResults.filter((r) => r.executionMatch === true).length;

  // Cosine Similarity
  const cosineSimilarityResults = successful.filter((r) => r.cosineSimilarity !== undefined);
  const averageCS =
    cosineSimilarityResults.length > 0
      ? cosineSimilarityResults.reduce((sum, r) => sum + (r.cosineSimilarity || 0), 0) /
        cosineSimilarityResults.length
      : 0;

  // Table Similarity
  const tableSimilarityResults = successful.filter((r) => r.tableSimilarity !== undefined);
  const averageTS =
    tableSimilarityResults.length > 0
      ? tableSimilarityResults.reduce((sum, r) => sum + (r.tableSimilarity || 0), 0) /
        tableSimilarityResults.length
      : 0;

  // Query Affinity Score
  const queryAffinityScoreResults = successful.filter((r) => r.queryAffinityScore !== undefined);
  const averageQAS =
    queryAffinityScoreResults.length > 0
      ? queryAffinityScoreResults.reduce((sum, r) => sum + (r.queryAffinityScore || 0), 0) /
        queryAffinityScoreResults.length
      : 0;

  return {
    timestamp: new Date().toISOString(),
    totalQuestions: results.length,
    successful: successful.length,
    errors: errors.length,
    retries: {
      totalWithRetries: resultsWithRetries.length,
      totalRetryAttempts,
      averageRetriesPerQuestion: Number(averageRetriesPerQuestion.toFixed(2)),
      maxRetries,
      successfulAfterRetry,
      failedAfterRetry,
    },
    metrics: {
      exactMatch: {
        total: exactMatchResults.length,
        matches: exactMatchCount,
        accuracy: exactMatchResults.length > 0 ? exactMatchCount / exactMatchResults.length : 0,
      },
      componentMatch: {
        total: componentMatchResults.length,
        averageCM: Number(averageCM.toFixed(4)),
      },
      executionMatch: {
        total: executionMatchResults.length,
        matches: executionMatchCount,
        accuracy:
          executionMatchResults.length > 0 ? executionMatchCount / executionMatchResults.length : 0,
      },
      cosineSimilarity: {
        total: cosineSimilarityResults.length,
        average: Number(averageCS.toFixed(4)),
      },
      tableSimilarity: {
        total: tableSimilarityResults.length,
        average: Number(averageTS.toFixed(4)),
      },
      queryAffinityScore: {
        total: queryAffinityScoreResults.length,
        average: Number(averageQAS.toFixed(4)),
      },
    },
    results,
  };
}

function generateReportText(report: Report): string {
  let text = '';

  text += '='.repeat(80) + '\n';
  text += '📊 RELATÓRIO DE AVALIAÇÃO\n';
  text += '='.repeat(80) + '\n';
  text += `Timestamp: ${report.timestamp}\n`;
  text += `Total de perguntas: ${report.totalQuestions}\n`;
  text += `✅ Sucessos: ${report.successful}\n`;
  text += `❌ Erros: ${report.errors}\n`;
  text += '\n--- Retries ---\n';
  text += `Total de perguntas com retries: ${report.retries.totalWithRetries}\n`;
  text += `Total de tentativas de correção: ${report.retries.totalRetryAttempts}\n`;
  text += `Média de retries por pergunta (com retries): ${report.retries.averageRetriesPerQuestion}\n`;
  text += `Máximo de retries em uma pergunta: ${report.retries.maxRetries}\n`;
  text += `✅ Sucessos após retry: ${report.retries.successfulAfterRetry}\n`;
  text += `❌ Falhas após retry: ${report.retries.failedAfterRetry}\n`;
  text += '\n--- Métricas ---\n';

  text += `\nExact Match (EM):\n`;
  text += `  Total avaliado: ${report.metrics.exactMatch.total}\n`;
  text += `  Matches: ${report.metrics.exactMatch.matches}\n`;
  text += `  Acurácia: ${(report.metrics.exactMatch.accuracy * 100).toFixed(2)}%\n`;

  text += `\nComponent Match (CM):\n`;
  text += `  Total avaliado: ${report.metrics.componentMatch.total}\n`;
  text += `  CM médio: ${report.metrics.componentMatch.averageCM}\n`;

  text += `\nExecution Match (EX):\n`;
  text += `  Total avaliado: ${report.metrics.executionMatch.total}\n`;
  text += `  Matches: ${report.metrics.executionMatch.matches}\n`;
  text += `  Acurácia: ${(report.metrics.executionMatch.accuracy * 100).toFixed(2)}%\n`;

  text += `\nCosine Similarity (CS - Semantic Similarity):\n`;
  text += `  Total avaliado: ${report.metrics.cosineSimilarity.total}\n`;
  text += `  CS médio: ${report.metrics.cosineSimilarity.average}\n`;

  text += `\nTable Similarity (TS):\n`;
  text += `  Total avaliado: ${report.metrics.tableSimilarity.total}\n`;
  text += `  TS médio: ${report.metrics.tableSimilarity.average}\n`;

  text += `\nQuery Affinity Score (QAS):\n`;
  text += `  Total avaliado: ${report.metrics.queryAffinityScore.total}\n`;
  text += `  QAS médio: ${report.metrics.queryAffinityScore.average}\n`;

  text += '\n' + '='.repeat(80) + '\n';
  text += '\n📋 Detalhes por pergunta:\n\n';

  report.results.forEach((result, index) => {
    text += `${index + 1}. ${result.question}\n`;
    text += `   Status: ${result.status === 'SUCCESS' ? '✅ SUCCESS' : '❌ ERROR'}\n`;

    if (result.status === 'ERROR') {
      text += `   Erro: ${result.error}\n`;
      // Mostra SQL gerada mesmo em caso de erro
      if (result.predictedSql) {
        text += `\n   SQL Gerada (com erro):\n`;
        text += `   ${result.predictedSql.split('\n').join('\n   ')}\n`;
      }
    } else {
      text += `   Tempo de execução: ${result.executionTimeMs}ms\n`;

      // Mostra erro de execução se houver (mesmo com status SUCCESS)
      if (result.error && result.error.includes('Erro de execução no banco')) {
        text += `   ⚠️  Erro de execução: ${result.error}\n`;
      }

      text += `   Exact Match: ${result.exactMatch ? '✓' : '✗'}\n`;
      if (result.componentMatch) {
        text += `   Component Match: ${result.componentMatch.CM.toFixed(4)}\n`;
      }
      text += `   Execution Match: ${result.executionMatch !== undefined ? (result.executionMatch ? '✓' : '✗') : 'N/A'}\n`;
      if (result.cosineSimilarity !== undefined) {
        text += `   Cosine Similarity: ${result.cosineSimilarity.toFixed(4)}\n`;
      }
      if (result.tableSimilarity !== undefined) {
        text += `   Table Similarity: ${result.tableSimilarity.toFixed(4)}\n`;
      }
      if (result.queryAffinityScore !== undefined) {
        text += `   Query Affinity Score: ${result.queryAffinityScore.toFixed(4)}\n`;
      }

      // Mostra informações sobre retries se houver
      if (result.retries && result.retries.length > 1) {
        text += `   Tentativas de correção: ${result.retries.length}\n`;
        result.retries.forEach((retry) => {
          if (retry.error) {
            text += `     Tentativa ${retry.attempt}: ❌ ${retry.error.substring(0, 100)}\n`;
          } else if (retry.fixed) {
            text += `     Tentativa ${retry.attempt}: ✅ Corrigido\n`;
          }
        });
      }

      // Sempre mostra SQL gerada, mesmo se houver erro de execução
      if (result.predictedSql) {
        const sqlLabel =
          result.error && result.error.includes('Erro de execução no banco')
            ? 'SQL Gerada (erro ao executar no banco):'
            : result.finalSql && result.finalSql !== result.predictedSql
              ? 'SQL Gerada (original):'
              : 'SQL Gerada:';
        text += `\n   ${sqlLabel}\n`;
        text += `   ${result.predictedSql.split('\n').join('\n   ')}\n`;
      }

      // Se houve correção, mostra SQL final
      if (result.finalSql && result.finalSql !== result.predictedSql) {
        text += `\n   SQL Corrigida (final):\n`;
        text += `   ${result.finalSql.split('\n').join('\n   ')}\n`;
      }
    }

    if (result.goldSql) {
      text += `\n   SQL Esperada (Gold):\n`;
      text += `   ${result.goldSql.split('\n').join('\n   ')}\n`;
    }

    text += '\n';
  });

  return text;
}

function generateReportCSV(report: Report): string {
  // Cabeçalho do CSV
  const headers = [
    'pergunta',
    'qtd_retries',
    'em',
    'ex',
    'cs',
    'ts',
    'qas',
    'sql_esperado',
    'sql_final_executado',
  ];

  // Função para escapar valores CSV (trata vírgulas, quebras de linha e aspas)
  const escapeCSV = (value: string | number | boolean | undefined | null): string => {
    if (value === undefined || value === null) {
      return '';
    }
    const str = String(value);
    // Se contém vírgula, quebra de linha ou aspas, precisa ser envolvido em aspas
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      // Escapa aspas duplicando-as
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Cria as linhas do CSV
  const rows = report.results.map((result) => {
    const qtdRetries = result.retries ? Math.max(0, result.retries.length - 1) : 0;
    const em = result.exactMatch === true ? '1' : result.exactMatch === false ? '0' : '';
    const ex = result.executionMatch === true ? '1' : result.executionMatch === false ? '0' : '';
    const cs = result.cosineSimilarity !== undefined ? result.cosineSimilarity.toFixed(4) : '';
    const ts = result.tableSimilarity !== undefined ? result.tableSimilarity.toFixed(4) : '';
    const qas = result.queryAffinityScore !== undefined ? result.queryAffinityScore.toFixed(4) : '';
    const sqlEsperado = result.goldSql || '';
    const sqlFinalExecutado = result.finalSql || result.predictedSql || '';

    return [
      escapeCSV(result.question),
      escapeCSV(qtdRetries),
      escapeCSV(em),
      escapeCSV(ex),
      escapeCSV(cs),
      escapeCSV(ts),
      escapeCSV(qas),
      escapeCSV(sqlEsperado),
      escapeCSV(sqlFinalExecutado),
    ].join(',');
  });

  // Combina cabeçalho e linhas
  return [headers.join(','), ...rows].join('\n');
}

async function main() {
  console.log('🚀 Iniciando avaliação de predições...\n');
  console.log(`📌 Provider selecionado: ${PROVIDER.toUpperCase()}\n`);

  try {
    // Carrega dados
    const questions = await loadPredictions();
    const goldEntries = await loadGold();
    const textToSqlService = new TextToSqlService();
    const sqlFixService = new SqlFixService();

    console.log(`📚 Carregados ${questions.length} perguntas do predict.json`);
    console.log(`📚 Carregados ${goldEntries.length} entradas do gold.json\n`);

    // Processa cada pergunta
    const results: EvaluationResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const goldSql = findGoldSql(question, goldEntries);

      const result = await evaluateQuestion(
        question,
        goldSql,
        textToSqlService,
        sqlFixService,
        i,
        questions.length
      );
      results.push(result);

      // Pequeno delay para não sobrecarregar a API
      if (i < questions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Gera relatório
    const report = await generateReport(results);

    // Cria diretório results/<provider> se não existir
    const resultsDir = join(__dirname, '../../results', PROVIDER);
    try {
      mkdirSync(resultsDir, { recursive: true });
    } catch (error) {
      // Diretório já existe ou erro ao criar
    }

    // Salva relatório em arquivo JSON
    const reportJsonPath = join(resultsDir, `${OUTPUT_FILENAME}.json`);
    writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n💾 Relatório JSON salvo em: ${reportJsonPath}`);

    // Gera e salva relatório em arquivo TXT
    const reportText = generateReportText(report);
    const reportTxtPath = join(resultsDir, `${OUTPUT_FILENAME}.txt`);
    writeFileSync(reportTxtPath, reportText, 'utf-8');
    console.log(`💾 Relatório TXT salvo em: ${reportTxtPath}`);

    // Gera e salva relatório em arquivo CSV
    const reportCSV = generateReportCSV(report);
    const reportCsvPath = join(resultsDir, `${OUTPUT_FILENAME}.csv`);
    writeFileSync(reportCsvPath, reportCSV, 'utf-8');
    console.log(`💾 Relatório CSV salvo em: ${reportCsvPath}`);

    console.log(`\n✅ Avaliação concluída! Resultados salvos em: results/${PROVIDER}/`);
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executa o script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Erro não tratado:', error);
    process.exit(1);
  });
}
