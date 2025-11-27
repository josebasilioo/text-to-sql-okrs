import axios, { AxiosInstance } from 'axios';
import { LLMProvider } from './LLMProvider';
import { LLMRequest, LLMResponse, LLMProviderConfig } from './types';

interface GeminiConfig {
  apiKey: string;
  model: string;
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'Google Gemini';
  private client: AxiosInstance;
  private model: string;
  private config: LLMProviderConfig;
  private apiKey: string;

  constructor(geminiConfig: GeminiConfig, providerConfig: LLMProviderConfig) {
    this.model = geminiConfig.model;
    this.config = providerConfig;
    this.apiKey = geminiConfig.apiKey;

    this.client = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: providerConfig.timeout,
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Gemini usa um formato diferente de mensagens
      const contents = this.formatMessages(request.messages);

      const url = `/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await this.client.post(url, {
        contents,
        generationConfig: {
          temperature: request.temperature ?? this.config.temperature,
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        },
      });

      const data = response.data;
      const candidate = data.candidates[0];
      const content = candidate.content.parts[0].text;

      return {
        content: content.trim(),
        model: this.model,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Erro Gemini: ${message}`);
      }
      throw error;
    }
  }

  private formatMessages(messages: LLMRequest['messages']) {
    // Gemini agrupa system messages no contexto e alterna user/model
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const contents = conversationMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Se houver system message, adiciona como primeira mensagem do user
    if (systemMessages.length > 0) {
      const systemPrompt = systemMessages.map(m => m.content).join('\n\n');
      if (contents.length > 0 && contents[0].role === 'user') {
        contents[0].parts[0].text = `${systemPrompt}\n\n${contents[0].parts[0].text}`;
      } else {
        contents.unshift({
          role: 'user',
          parts: [{ text: systemPrompt }],
        });
      }
    }

    return contents;
  }
}

