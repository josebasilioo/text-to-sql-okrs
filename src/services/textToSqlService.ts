import { readFileSync } from 'fs';
import { join } from 'path';
import { LLMFactory } from './llm/LLMFactory';
import { LLMRequest } from './llm/types';
import { schemaLinker } from './schemaLinking';

// Lê o schema do banco de dados a partir do arquivo SQL
const loadDatabaseSchema = (): string => {
  try {
    // const schemaPath = join(__dirname, '../../database/schema.sql');
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
    console.error('❌ Erro ao ler schema.sql:', error);
    throw new Error('Não foi possível carregar o schema do banco de dados');
  }
};

const DATABASE_SCHEMA = loadDatabaseSchema();

/**
 * Normaliza SQL para uma única linha, removendo quebras de linha e espaços extras
 */
function normalizeSqlToSingleLine(sql: string): string {
  return sql
    .replace(/\r\n/g, ' ') // Remove CRLF
    .replace(/\n/g, ' ') // Remove LF
    .replace(/\r/g, ' ') // Remove CR
    .replace(/\t/g, ' ') // Remove tabs
    .replace(/\s+/g, ' ') // Normaliza múltiplos espaços para um único espaço
    .trim();
}

export interface TextToSqlRequest {
  question: string;
}

export interface TextToSqlResponse {
  question: string;
  sql: string;
  complementaryText: string;
  model: string;
  executionTimeMs: number;
  rawContent?: string; // Conteúdo bruto da resposta da LLM para debug
}

export class TextToSqlService {
  private llmProvider = LLMFactory.getProvider();

  /**
   * Converte uma pergunta em linguagem natural para SQL
   */
  async convertToSql(request: TextToSqlRequest): Promise<TextToSqlResponse> {
    const startTime = Date.now();
    const linkedSchema = await schemaLinker(request.question);
    const hints = readFileSync(join(__dirname, '../prompts/hints.txt'), 'utf-8');
    const chainOfThought = readFileSync(join(__dirname, '../prompts/CoT.txt'), 'utf-8');
    const fewShot = readFileSync(join(__dirname, '../prompts/few-shot.txt'), 'utf-8');

    const systemPrompt = `
    Você é um especialista em SQL que converte perguntas em linguagem natural para queries SQL válidas.

    ${DATABASE_SCHEMA}

    ## RECOMENDAÇÃO DO SCHEMA LINKING:
    ${JSON.stringify(linkedSchema)}

    ## DICAS PARA INFORMAÇÕES DO SISTEMA:
    ${hints}

    ## CHAIN-OF-THOUGHT:
    ${chainOfThought}

    ## EXEMPLOS
    ${fewShot}

    FORMATO DE RESPOSTA (JSON):
    {
      "sql": "SELECT ...",
      "complementaryText": "Esta query retorna..."
    }
`;
    const userPrompt = `Pergunta: ${request.question} Gere a resposta em JSON:`;

    const llmRequest: LLMRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    try {
      const llmResponse = await this.llmProvider.generateCompletion(llmRequest);

      const cleanedContent = llmResponse.content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      // Parse do JSON
      let parsed;
      let rawSql = '';

      try {
        parsed = JSON.parse(cleanedContent);
        rawSql = parsed.sql || '';
      } catch (parseError) {
        // Se não conseguir fazer parse, tenta extrair JSON do conteúdo
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];

          // Tenta sanitizar o JSON removendo escapes problemáticos antes de parsear
          try {
            // Remove escapes soltos que não são válidos em JSON
            const sanitized = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, ' ');
            parsed = JSON.parse(sanitized);
            rawSql = parsed.sql || '';
          } catch {
            // Se ainda falhar, tenta extrair SQL diretamente do JSON usando regex
            // Procura por "sql": "..." (suporta strings com escapes e múltiplas linhas)
            const sqlPattern = /"sql"\s*:\s*"((?:[^"\\]|\\.|\\\n|\\\r|\\\t)*)"/;
            const sqlMatch = jsonStr.match(sqlPattern);

            if (sqlMatch && sqlMatch[1]) {
              // Remove escapes de barra invertida e normaliza
              rawSql = sqlMatch[1]
                .replace(/\\n/g, ' ')
                .replace(/\\t/g, ' ')
                .replace(/\\r/g, ' ')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\(?!["\\/bfnrtu])/g, ' '); // Remove escapes inválidos
              parsed = {
                sql: rawSql,
                complementaryText: 'Query SQL gerada (formato inesperado).',
              };
            } else {
              const simplePattern = /"sql"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/;
              const simpleMatch = jsonStr.match(simplePattern);
              if (simpleMatch && simpleMatch[1]) {
                rawSql = simpleMatch[1]
                  .replace(/\\n/g, ' ')
                  .replace(/\\t/g, ' ')
                  .replace(/\\r/g, ' ')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .replace(/\\/g, ' '); // Remove outras barras invertidas
                parsed = {
                  sql: rawSql,
                  complementaryText: 'Query SQL gerada (formato inesperado).',
                };
              } else {
                // Último fallback: tenta extrair qualquer coisa entre "sql": e próxima chave/virgula
                const fallbackMatch = jsonStr.match(/"sql"\s*:\s*"([^"]+)"\s*,/);
                if (fallbackMatch && fallbackMatch[1]) {
                  rawSql = fallbackMatch[1].replace(/\\/g, ' ');
                  parsed = {
                    sql: rawSql,
                    complementaryText: 'Query SQL gerada (formato inesperado).',
                  };
                } else {
                  // Último fallback: assume que é só SQL
                  rawSql = cleanedContent;
                  parsed = {
                    sql: cleanedContent,
                    complementaryText: 'Query SQL gerada (formato inesperado).',
                  };
                }
              }
            }
          }
        } else {
          // Fallback: assume que é só SQL
          rawSql = cleanedContent;
          parsed = {
            sql: cleanedContent,
            complementaryText: 'Query SQL gerada com sucesso.',
          };
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Normaliza SQL para uma única linha
      const finalSql = normalizeSqlToSingleLine(parsed.sql || rawSql || '');

      return {
        question: request.question,
        sql: finalSql,
        complementaryText: parsed.complementaryText || '',
        model: llmResponse.model,
        executionTimeMs,
        rawContent: cleanedContent, // Conteúdo bruto para debug
      };
    } catch (error) {
      // Em caso de erro na chamada da LLM, ainda tenta retornar algo útil
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorWithContent = error as Error & { rawContent?: string };

      // Se tiver conteúdo bruto no erro, usa ele
      if (errorWithContent.rawContent) {
        const normalizedSql = normalizeSqlToSingleLine(errorWithContent.rawContent);
        return {
          question: request.question,
          sql: normalizedSql,
          complementaryText: 'Erro ao processar resposta da LLM.',
          model: 'unknown',
          executionTimeMs: Date.now() - startTime,
          rawContent: errorWithContent.rawContent,
        };
      }

      throw new Error(`Erro ao gerar SQL: ${errorMessage}`);
    }
  }

  /**
   * Valida se a pergunta é razoável
   */
  validateQuestion(question: string): { valid: boolean; error?: string } {
    if (!question || question.trim().length === 0) {
      return { valid: false, error: 'A pergunta não pode estar vazia' };
    }

    if (question.length < 5) {
      return { valid: false, error: 'A pergunta é muito curta' };
    }

    if (question.length > 500) {
      return { valid: false, error: 'A pergunta é muito longa (máximo 500 caracteres)' };
    }

    // Detecta tentativas de injection ou comandos perigosos
    const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE'];
    const upperQuestion = question.toUpperCase();

    for (const keyword of dangerousKeywords) {
      if (upperQuestion.includes(keyword)) {
        return {
          valid: false,
          error: `Pergunta contém palavra-chave não permitida: ${keyword}`,
        };
      }
    }

    return { valid: true };
  }
}
