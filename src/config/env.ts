import dotenv from 'dotenv';
import { join } from 'path';
import { z } from 'zod';

// Carrega variáveis de ambiente tentando múltiplos caminhos
// Isso garante que funcione tanto quando executado diretamente quanto via tsx
const envPaths = [
  join(process.cwd(), '.env'), // Diretório atual de trabalho (mais comum)
  join(__dirname, '../../.env'), // Caminho relativo a partir do módulo compilado
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    break;
  }
}

// Se não encontrou em nenhum caminho específico, tenta o padrão
if (!envLoaded) {
  dotenv.config();
}

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // LLM Provider
  LLM_PROVIDER: z.enum(['openai', 'gemini', 'openrouter']).default('openai'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_BASE_URL: z.string().optional(),

  // Google Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4-turbo'),
  OPENROUTER_APP_NAME: z.string().optional(),
  OPENROUTER_SITE_URL: z.string().optional(),

  // LLM Settings
  LLM_TEMPERATURE: z.string().default('0.2'),
  LLM_MAX_TOKENS: z.string().default('500'),
  LLM_TIMEOUT: z.string().default('30000'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Erro ao validar variáveis de ambiente:');
    console.error(result.error.format());
    throw new Error('Configuração de ambiente inválida');
  }

  return result.data;
};

export const env = parseEnv();

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  llm: {
    provider: env.LLM_PROVIDER,
    temperature: parseFloat(env.LLM_TEMPERATURE),
    maxTokens: parseInt(env.LLM_MAX_TOKENS, 10),
    timeout: parseInt(env.LLM_TIMEOUT, 10),

    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      baseUrl: env.OPENAI_BASE_URL,
    },

    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
    },

    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      appName: env.OPENROUTER_APP_NAME,
      siteUrl: env.OPENROUTER_SITE_URL,
    },
  },
};
