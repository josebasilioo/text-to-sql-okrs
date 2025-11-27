import { LLMRequest, LLMResponse } from './types';

/**
 * Interface abstrata para provedores de LLM
 * Permite trocar facilmente entre diferentes provedores (OpenAI, Anthropic, etc)
 */
export interface LLMProvider {
  /**
   * Nome do provedor
   */
  readonly name: string;

  /**
   * Gera uma resposta baseado nas mensagens fornecidas
   */
  generateCompletion(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Verifica se o provedor está configurado corretamente
   */
  isConfigured(): boolean;
}

