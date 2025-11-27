import axios, { AxiosInstance } from 'axios';
import { LLMProvider } from './LLMProvider';
import { LLMProviderConfig, LLMRequest, LLMResponse } from './types';

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  appName?: string; // Nome da aplicação (para tracking)
  siteUrl?: string; // URL do site (para tracking)
}

/**
 * Provider para OpenRouter
 * OpenRouter é um proxy que oferece acesso a múltiplos modelos de LLM
 * através de uma única API compatível com OpenAI
 */
export class OpenRouterProvider implements LLMProvider {
  readonly name = 'OpenRouter';
  private client: AxiosInstance;
  private model: string;
  private config: LLMProviderConfig;

  constructor(openRouterConfig: OpenRouterConfig, providerConfig: LLMProviderConfig) {
    this.model = openRouterConfig.model;
    this.config = providerConfig;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${openRouterConfig.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Headers opcionais para tracking e rankings no OpenRouter
    if (openRouterConfig.appName) {
      headers['HTTP-Referer'] = openRouterConfig.siteUrl || 'https://localhost';
      headers['X-Title'] = openRouterConfig.appName;
    }

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers,
      timeout: providerConfig.timeout,
    });
  }

  isConfigured(): boolean {
    return !!this.client.defaults.headers['Authorization'];
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      });

      const data = response.data;
      const choice = data.choices[0];

      return {
        content: choice.message.content.trim(),
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Erro OpenRouter: ${message}`);
      }
      throw error;
    }
  }
}
