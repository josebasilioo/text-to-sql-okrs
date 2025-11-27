import { config } from '../../config/env';
import { GeminiProvider } from './GeminiProvider';
import { LLMProvider } from './LLMProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OpenRouterProvider } from './OpenRouterProvider';

/**
 * Factory para criar instâncias de provedores de LLM
 * Baseado nas configurações de ambiente
 */
export class LLMFactory {
  private static instance: LLMProvider | null = null;

  /**
   * Retorna uma instância do provedor de LLM configurado
   */
  static getProvider(): LLMProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerConfig = {
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens,
      timeout: config.llm.timeout,
    };

    switch (config.llm.provider) {
      case 'openai':
        if (!config.llm.openai.apiKey) {
          throw new Error('OPENAI_API_KEY não configurada');
        }
        this.instance = new OpenAIProvider(
          {
            apiKey: config.llm.openai.apiKey,
            model: config.llm.openai.model,
            baseUrl: config.llm.openai.baseUrl,
          },
          providerConfig
        );
        break;

      case 'gemini':
        if (!config.llm.gemini.apiKey) {
          throw new Error('GEMINI_API_KEY não configurada');
        }
        this.instance = new GeminiProvider(
          {
            apiKey: config.llm.gemini.apiKey,
            model: config.llm.gemini.model,
          },
          providerConfig
        );
        break;

      case 'openrouter':
        if (!config.llm.openrouter.apiKey) {
          throw new Error('OPENROUTER_API_KEY não configurada');
        }
        this.instance = new OpenRouterProvider(
          {
            apiKey: config.llm.openrouter.apiKey,
            model: config.llm.openrouter.model,
            appName: config.llm.openrouter.appName,
            siteUrl: config.llm.openrouter.siteUrl,
          },
          providerConfig
        );
        break;

      default:
        throw new Error(`Provedor LLM desconhecido: ${config.llm.provider}`);
    }

    if (!this.instance.isConfigured()) {
      throw new Error(`Provedor ${this.instance.name} não está configurado corretamente`);
    }

    console.log(`✅ LLM Provider inicializado: ${this.instance.name}`);
    return this.instance;
  }

  /**
   * Reseta a instância (útil para testes)
   */
  static reset(): void {
    this.instance = null;
  }
}
