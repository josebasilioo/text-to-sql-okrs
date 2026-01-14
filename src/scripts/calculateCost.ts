// IMPORTANTE: Carrega o .env PRIMEIRO, antes de qualquer outro import
import './loadEnv';

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ========================================
// 🔧 CONFIGURAÇÃO VIA ARGUMENTOS
// ========================================
// Uso: tsx src/scripts/calculateCost.ts <modelo> <tipo-execucao>
// Exemplo: tsx src/scripts/calculateCost.ts gpt-4o-mini 2-shot
// Exemplo: tsx src/scripts/calculateCost.ts gemini-2.5-flash 1-shot
// Exemplo: tsx src/scripts/calculateCost.ts llama-3.1-8b no-linking

const MODEL_ARG = process.argv[2];
const EXECUTION_TYPE_ARG = process.argv[3];

if (!MODEL_ARG || !EXECUTION_TYPE_ARG) {
  console.error('❌ Uso: tsx src/scripts/calculateCost.ts <modelo> <tipo-execucao>');
  console.error('   Modelos: gpt-4o-mini | gemini-2.5-flash | llama-3.1-8b');
  console.error('   Tipos: 2-shot | 1-shot | no-linking');
  process.exit(1);
}

// Mapeia modelos para providers e configurações
// Gemini e Llama usam OpenRouter com a mesma API key, só muda o modelo
const MODEL_CONFIG: Record<string, { provider: 'openai' | 'openrouter'; modelName: string }> = {
  'gpt-4o-mini': { provider: 'openai', modelName: 'gpt-4o-mini' },
  'gemini-2.5-flash': { provider: 'openrouter', modelName: 'google/gemini-2.5-flash' },
  'llama-3.1-8b': { provider: 'openrouter', modelName: 'meta-llama/llama-3.1-8b-instruct' },
};

const EXECUTION_TYPES = ['2-shot', '1-shot', 'no-linking'] as const;
type ExecutionType = (typeof EXECUTION_TYPES)[number];

if (!MODEL_CONFIG[MODEL_ARG]) {
  console.error(
    `❌ Modelo "${MODEL_ARG}" não reconhecido. Use: gpt-4o-mini | gemini-2.5-flash | llama-3.1-8b`
  );
  process.exit(1);
}

if (!EXECUTION_TYPES.includes(EXECUTION_TYPE_ARG as ExecutionType)) {
  console.error(
    `❌ Tipo de execução "${EXECUTION_TYPE_ARG}" não reconhecido. Use: 2-shot | 1-shot | no-linking`
  );
  process.exit(1);
}

const MODEL = MODEL_ARG;
const EXECUTION_TYPE = EXECUTION_TYPE_ARG as ExecutionType;
const MODEL_INFO = MODEL_CONFIG[MODEL];

// Importa os providers
import { LLMProvider } from '../services/llm/LLMProvider';
import { OpenAIProvider } from '../services/llm/OpenAIProvider';
import { OpenRouterProvider } from '../services/llm/OpenRouterProvider';
import { LLMRequest } from '../services/llm/types';
import { schemaLinker } from '../services/schemaLinking';

// Preços por milhão de tokens (ajuste conforme necessário)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 }, // $0.15/$0.60 por 1M tokens
  'gemini-2.5-flash': { input: 0.075, output: 0.3 }, // $0.075/$0.30 por 1M tokens
  'llama-3.1-8b': { input: 0.055, output: 0.055 }, // OpenRouter pricing
};

interface CostInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface QuestionCost {
  question: string;
  costInfo: CostInfo;
  executionTimeMs: number;
  categoria?: string;
  complexidade?: string;
}

// Cria o provider diretamente baseado no modelo selecionado
function createProvider(): LLMProvider {
  const providerConfig = {
    temperature: 0.3,
    maxTokens: 500,
    timeout: 30000,
  };

  switch (MODEL_INFO.provider) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY não configurada no .env');
      }
      return new OpenAIProvider(
        {
          apiKey,
          model: MODEL_INFO.modelName,
          baseUrl: process.env.OPENAI_BASE_URL,
        },
        providerConfig
      );
    }
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY não configurada no .env');
      }
      return new OpenRouterProvider(
        {
          apiKey,
          model: MODEL_INFO.modelName,
          appName: process.env.OPENROUTER_APP_NAME,
          siteUrl: process.env.OPENROUTER_SITE_URL,
        },
        providerConfig
      );
    }
    default:
      throw new Error(`Provider não suportado: ${MODEL_INFO.provider}`);
  }
}

// Lê o schema do banco de dados
const loadDatabaseSchema = (): string => {
  try {
    const schemaJsonPath = join(__dirname, '../../database/schema.json');
    const schemaContent = readFileSync(schemaJsonPath, 'utf-8');
    return `
        Schema do Banco de Dados (PostgreSQL):

        ${schemaContent}

Notas importantes:
- Use PostgreSQL como dialeto SQL
- Respeite as foreign keys e constraints definidas no schema
- Para agregações, use funções SQL apropriadas (COUNT, AVG, SUM, MAX, MIN)
- Para filtros de data, use TIMESTAMP WITH TIME ZONE
- Para buscas por texto, use ILIKE para case-insensitive
- metric pode ser: 'PERC', 'NUMERIC', ou 'YES_NO'
- direction indica se o KR deve aumentar ou diminuir ('up' ou 'down')

Regras:
- resultados do SQL não devem vir com quebras de linha
`;
  } catch (error) {
    console.error('❌ Erro ao ler schema.json:', error);
    throw new Error('Não foi possível carregar o schema do banco de dados');
  }
};

const DATABASE_SCHEMA = loadDatabaseSchema();

// Carrega prompts
function loadPrompts() {
  const hints = readFileSync(join(__dirname, '../prompts/hints.txt'), 'utf-8');
  const chainOfThought = readFileSync(join(__dirname, '../prompts/CoT.txt'), 'utf-8');
  const fewShot = readFileSync(join(__dirname, '../prompts/few-shot.txt'), 'utf-8');

  // Divide few-shot em exemplos individuais
  const examples: string[] = [];
  const fewShotContent = fewShot.trim();

  // Divide por "Exemplo 2:" para separar os dois exemplos
  const parts = fewShotContent.split(/Exemplo\s+2:/i);

  if (parts.length >= 1 && parts[0].trim()) {
    examples.push(parts[0].trim());
  }

  if (parts.length >= 2 && parts[1].trim()) {
    examples.push('Exemplo 2:' + parts[1].trim());
  }

  return { hints, chainOfThought, examples, fullFewShot: fewShotContent };
}

async function loadPredictions(): Promise<string[]> {
  const predictPath = join(__dirname, '../../database/predict.json');
  const content = readFileSync(predictPath, 'utf-8');
  return JSON.parse(content);
}

// Função para fazer parse de CSV respeitando aspas
function parseCSVLine(line: string): string[] {
  const parts: string[] = [];
  let currentPart = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      parts.push(currentPart);
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  parts.push(currentPart);

  return parts;
}

// Carrega mapa de perguntas -> categoria/complexidade do dataset TCC
function loadQuestionMetadata(): Map<string, { categoria: string; complexidade: string }> {
  const datasetPath = join(__dirname, '../../database/TCC - Dataset.csv');
  const datasetContent = readFileSync(datasetPath, 'utf-8');
  const datasetLines = datasetContent.split('\n').slice(1); // Pular cabeçalho

  const questionMap = new Map<string, { categoria: string; complexidade: string }>();

  for (const line of datasetLines) {
    if (!line.trim()) continue;

    const parts = parseCSVLine(line);
    const texto = parts[0]?.trim() || '';
    const categoria = parts[1]?.trim() || '';
    const complexidade = parts[2]?.trim() || '';

    if (texto) {
      questionMap.set(texto, { categoria, complexidade });
    }
  }

  console.log(
    `📊 Carregadas ${questionMap.size} perguntas com categoria/complexidade do dataset TCC`
  );
  return questionMap;
}

function calculateCost(tokens: CostInfo, model: string): number {
  const pricing = PRICING[model];
  if (!pricing) {
    console.warn(`⚠️  Preço não encontrado para modelo ${model}, usando valores padrão`);
    return 0;
  }

  const inputCost = (tokens.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

async function processQuestion(
  question: string,
  index: number,
  total: number,
  llmProvider: LLMProvider
): Promise<QuestionCost> {
  console.log(`\n[${index + 1}/${total}] Processando: ${question.substring(0, 60)}...`);

  const startTime = Date.now();
  const { hints, chainOfThought, examples, fullFewShot } = loadPrompts();

  // Configura schema linking baseado no tipo de execução
  let linkedSchema: Record<string, Set<string>> = {};
  if (EXECUTION_TYPE !== 'no-linking') {
    linkedSchema = await schemaLinker(question);
  }

  // Configura few-shot baseado no tipo de execução
  let fewShotContent = '';
  if (EXECUTION_TYPE === '2-shot') {
    // Usa o conteúdo completo do few-shot.txt (que tem 2 exemplos)
    fewShotContent = fullFewShot;
  } else if (EXECUTION_TYPE === '1-shot' && examples.length >= 1) {
    // Usa apenas o primeiro exemplo
    fewShotContent = examples[0];
  }
  // Se for 'no-linking', fewShotContent fica vazio

  const systemPrompt = `
    Você é um especialista em SQL que converte perguntas em linguagem natural para queries SQL válidas.

    ${DATABASE_SCHEMA}

    ## DICAS PARA INFORMAÇÕES DO SISTEMA:
    ${hints}

    ${EXECUTION_TYPE !== 'no-linking' ? `## SCHEMA LINKING:\n${JSON.stringify(linkedSchema)}` : ''}

    ## CHAIN-OF-THOUGHT:
    ${chainOfThought}

    ${fewShotContent ? `## FEW-SHOT:\n${fewShotContent}` : ''}

    FORMATO DE RESPOSTA (JSON):
    {
      "sql": "SELECT ...",
      "complementaryText": "Esta query retorna..."
    }
`;

  const userPrompt = `Pergunta: ${question} Gere a resposta em JSON:`;

  const llmRequest: LLMRequest = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const llmResponse = await llmProvider.generateCompletion(llmRequest);
    const executionTimeMs = Date.now() - startTime;

    const costInfo: CostInfo = {
      promptTokens: llmResponse.usage?.promptTokens || 0,
      completionTokens: llmResponse.usage?.completionTokens || 0,
      totalTokens: llmResponse.usage?.totalTokens || 0,
      cost: 0,
    };

    costInfo.cost = calculateCost(costInfo, MODEL);

    console.log(
      `  ✅ Tokens: ${costInfo.promptTokens} input + ${costInfo.completionTokens} output = ${costInfo.totalTokens} total | Custo: $${costInfo.cost.toFixed(6)}`
    );

    return {
      question,
      costInfo,
      executionTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Erro: ${errorMessage}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Iniciando cálculo de custos...\n');
  console.log(`📌 Modelo: ${MODEL} (${MODEL_INFO.modelName})`);
  console.log(`📌 Tipo de execução: ${EXECUTION_TYPE}`);
  console.log(`📌 Provider: ${MODEL_INFO.provider}\n`);

  try {
    // Cria o provider diretamente
    const llmProvider = createProvider();
    console.log(`✅ Provider ${MODEL_INFO.provider} inicializado com sucesso!\n`);

    const questions = await loadPredictions();
    const questionMetadata = loadQuestionMetadata();
    console.log(`📚 Carregadas ${questions.length} perguntas do predict.json\n`);

    const results: QuestionCost[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = await processQuestion(question, i, questions.length, llmProvider);

      // Adiciona categoria e complexidade do dataset
      const metadata = questionMetadata.get(question);
      if (metadata) {
        result.categoria = metadata.categoria;
        result.complexidade = metadata.complexidade;
      }

      results.push(result);

      // Pequeno delay para não sobrecarregar a API
      if (i < questions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Calcula estatísticas
    const totalCost = results.reduce((sum, r) => sum + r.costInfo.cost, 0);
    const avgCost = totalCost / results.length;
    const totalPromptTokens = results.reduce((sum, r) => sum + r.costInfo.promptTokens, 0);
    const totalCompletionTokens = results.reduce((sum, r) => sum + r.costInfo.completionTokens, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.costInfo.totalTokens, 0);
    const avgPromptTokens = totalPromptTokens / results.length;
    const avgCompletionTokens = totalCompletionTokens / results.length;
    const avgTotalTokens = totalTokens / results.length;
    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    const avgExecutionTime = totalExecutionTime / results.length;

    // Gera relatório
    const report = {
      timestamp: new Date().toISOString(),
      model: MODEL,
      modelName: MODEL_INFO.modelName,
      executionType: EXECUTION_TYPE,
      provider: MODEL_INFO.provider,
      totalQuestions: results.length,
      costs: {
        total: totalCost,
        average: avgCost,
        min: Math.min(...results.map((r) => r.costInfo.cost)),
        max: Math.max(...results.map((r) => r.costInfo.cost)),
      },
      tokens: {
        prompt: {
          total: totalPromptTokens,
          average: avgPromptTokens,
        },
        completion: {
          total: totalCompletionTokens,
          average: avgCompletionTokens,
        },
        total: {
          total: totalTokens,
          average: avgTotalTokens,
        },
      },
      executionTime: {
        total: totalExecutionTime,
        average: avgExecutionTime,
      },
      details: results,
    };

    // Salva relatório
    const outputFilename = `${EXECUTION_TYPE}-${MODEL.replace('/', '-')}`;
    const resultsDir = join(__dirname, '../../costs');
    try {
      mkdirSync(resultsDir, { recursive: true });
    } catch (error) {
      // Diretório já existe
    }

    const reportJsonPath = join(resultsDir, `${outputFilename}.json`);
    writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n💾 Relatório JSON salvo em: ${reportJsonPath}`);

    // Gera relatório texto
    const reportText = `
${'='.repeat(80)}
💰 RELATÓRIO DE CUSTOS
${'='.repeat(80)}
Timestamp: ${report.timestamp}
Modelo: ${report.model} (${report.modelName})
Tipo de execução: ${report.executionType}
Provider: ${report.provider}
Total de perguntas: ${report.totalQuestions}

--- CUSTOS ---
Custo total: $${report.costs.total.toFixed(6)}
Custo médio por prompt: $${report.costs.average.toFixed(6)}
Custo mínimo: $${report.costs.min.toFixed(6)}
Custo máximo: $${report.costs.max.toFixed(6)}

--- TOKENS ---
Tokens de entrada (prompt):
  Total: ${report.tokens.prompt.total.toLocaleString()}
  Média por prompt: ${report.tokens.prompt.average.toFixed(2)}

Tokens de saída (completion):
  Total: ${report.tokens.completion.total.toLocaleString()}
  Média por prompt: ${report.tokens.completion.average.toFixed(2)}

Tokens totais:
  Total: ${report.tokens.total.total.toLocaleString()}
  Média por prompt: ${report.tokens.total.average.toFixed(2)}

--- TEMPO DE EXECUÇÃO ---
Tempo total: ${(report.executionTime.total / 1000).toFixed(2)}s
Tempo médio por prompt: ${report.executionTime.average.toFixed(2)}ms

${'='.repeat(80)}
`;

    const reportTxtPath = join(resultsDir, `${outputFilename}.txt`);
    writeFileSync(reportTxtPath, reportText, 'utf-8');
    console.log(`💾 Relatório TXT salvo em: ${reportTxtPath}`);

    // Gera relatório CSV
    const escapeCSV = (value: string | number | undefined | null): string => {
      if (value === undefined || value === null) {
        return '';
      }
      const str = String(value);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvHeaders = [
      'pergunta',
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
      'custo',
      'tempo_ms',
      'categoria',
      'complexidade',
    ];

    const csvRows = results.map((r) =>
      [
        escapeCSV(r.question),
        escapeCSV(r.costInfo.promptTokens),
        escapeCSV(r.costInfo.completionTokens),
        escapeCSV(r.costInfo.totalTokens),
        escapeCSV(r.costInfo.cost.toFixed(8)),
        escapeCSV(r.executionTimeMs),
        escapeCSV(r.categoria),
        escapeCSV(r.complexidade),
      ].join(',')
    );

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    const reportCsvPath = join(resultsDir, `${outputFilename}.csv`);
    writeFileSync(reportCsvPath, csvContent, 'utf-8');
    console.log(`💾 Relatório CSV salvo em: ${reportCsvPath}`);

    console.log(`\n✅ Cálculo de custos concluído!`);
    console.log(`\n📊 RESUMO:`);
    console.log(`   Custo médio por prompt: $${report.costs.average.toFixed(6)}`);
    console.log(`   Tokens médios por prompt: ${report.tokens.total.average.toFixed(2)}`);
    console.log(`   Tempo médio por prompt: ${report.executionTime.average.toFixed(2)}ms`);
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
