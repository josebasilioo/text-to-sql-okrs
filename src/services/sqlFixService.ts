import { readFileSync } from 'fs';
import { join } from 'path';
import { LLMFactory } from './llm/LLMFactory';
import { LLMRequest } from './llm/types';

// Lê o schema do banco de dados a partir do arquivo SQL
const loadDatabaseSchema = (): string => {
  try {
    const schemaPath = join(__dirname, '../../database/schema.sql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    return `
Schema do Banco de Dados (PostgreSQL):

${schemaContent}

Tabelas principais:
- collaborator: Colaboradores/usuários do sistema (id, name, email, login, active)
- initiative: Iniciativas/projetos (id, title, description, category, priority, start_date, end_date, owner_id)
- okr: Objetivos e Resultados-Chave (id, description, deadline, initiative_id)
- kr: Key Results/Resultados-Chave (id, title, metric, progress, target, direction, okr_id, bookmarked)
- kr_history: Histórico de atualizações dos KRs (id, kr_id, progress, target, date, collaborator_id)
- initiative_update: Atualizações das iniciativas (id, initiative_id, year_month, highlights, brutal_facts, next_steps)
- initiative_managers: Relação muitos-para-muitos entre iniciativas e seus gerentes

Notas importantes:
- Use PostgreSQL como dialeto SQL
- Respeite as foreign keys e constraints definidas no schema
- Para agregações, use funções SQL apropriadas (COUNT, AVG, SUM, MAX, MIN)
- Para filtros de data, use TIMESTAMP WITH TIME ZONE
- Para buscas por texto, use ILIKE para case-insensitive
- metric pode ser: 'PERC', 'NUMERIC', ou 'YES_NO'
- direction indica se o KR deve aumentar ou diminuir
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

export interface SqlFixRequest {
  originalQuestion: string;
  failedSql: string;
  errorMessage: string;
  attemptNumber: number;
}

export interface SqlFixResponse {
  fixedSql: string;
  explanation?: string;
  model: string;
  executionTimeMs: number;
}

export class SqlFixService {
  private llmProvider = LLMFactory.getProvider();

  /**
   * Corrige um SQL que falhou na execução usando a LLM
   */
  async fixSql(request: SqlFixRequest): Promise<SqlFixResponse> {
    const startTime = Date.now();

    const systemPrompt = `Você é um especialista em SQL que corrige queries SQL que falharam na execução.

${DATABASE_SCHEMA}

Instruções:
1. Analise cuidadosamente o SQL que falhou e a mensagem de erro
2. Identifique o problema no SQL (erro de sintaxe, nome de coluna/tabela incorreto, tipo de dado incorreto, etc.)
3. Gere uma versão corrigida do SQL que resolva o erro
4. Retorne a resposta em formato JSON com dois campos:
   - "sql": a query SQL corrigida e executável (sem markdown, sem \`\`\`)
   - "explanation": uma breve explicação do que foi corrigido
5. A query corrigida deve ser executável diretamente no PostgreSQL
6. Use boas práticas SQL (aliases, indentação clara)
7. Mantenha a intenção original da query, apenas corrija os erros

Formato de resposta (JSON):
{
  "sql": "SELECT ...",
  "explanation": "Corrigido: nome da coluna 'x' para 'y'..."
}`;

    const userPrompt = `Pergunta original: ${request.originalQuestion}

SQL que falhou (tentativa ${request.attemptNumber}):
${request.failedSql}

Mensagem de erro do PostgreSQL:
${request.errorMessage}

Gere o SQL corrigido em JSON:`;

    const llmRequest: LLMRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    try {
      const llmResponse = await this.llmProvider.generateCompletion(llmRequest);

      console.log(`🔧 Modelo utilizado para correção: ${llmResponse.model}`);

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

          try {
            // Remove escapes soltos que não são válidos em JSON
            const sanitized = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, ' ');
            parsed = JSON.parse(sanitized);
            rawSql = parsed.sql || '';
          } catch {
            // Tenta extrair SQL diretamente do JSON usando regex
            const sqlPattern = /"sql"\s*:\s*"((?:[^"\\]|\\.|\\\n|\\\r|\\\t)*)"/;
            const sqlMatch = jsonStr.match(sqlPattern);

            if (sqlMatch && sqlMatch[1]) {
              rawSql = sqlMatch[1]
                .replace(/\\n/g, ' ')
                .replace(/\\t/g, ' ')
                .replace(/\\r/g, ' ')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\(?!["\\/bfnrtu])/g, ' ');
              parsed = {
                sql: rawSql,
                explanation: 'SQL corrigido (formato inesperado).',
              };
            } else {
              // Fallback: assume que é só SQL
              rawSql = cleanedContent;
              parsed = {
                sql: cleanedContent,
                explanation: 'SQL corrigido.',
              };
            }
          }
        } else {
          // Fallback: assume que é só SQL
          rawSql = cleanedContent;
          parsed = {
            sql: cleanedContent,
            explanation: 'SQL corrigido.',
          };
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Normaliza SQL para uma única linha
      const finalSql = normalizeSqlToSingleLine(parsed.sql || rawSql || '');

      return {
        fixedSql: finalSql,
        explanation: parsed.explanation || '',
        model: llmResponse.model,
        executionTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao corrigir SQL: ${errorMessage}`);
    }
  }
}
