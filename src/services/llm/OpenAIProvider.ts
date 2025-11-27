import axios, { AxiosInstance } from 'axios';
import { LLMProvider } from './LLMProvider';
import { LLMRequest, LLMResponse, LLMProviderConfig } from './types';

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'OpenAI';
  private client: AxiosInstance;
  private model: string;
  private config: LLMProviderConfig;

  constructor(openaiConfig: OpenAIConfig, providerConfig: LLMProviderConfig) {
    this.model = openaiConfig.model;
    this.config = providerConfig;

    const baseURL = openaiConfig.baseUrl || 'https://api.openai.com/v1';

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${openaiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
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
        throw new Error(`Erro OpenAI: ${message}`);
      }
      throw error;
    }
  }
}

