import dotenv from 'dotenv';
import { join } from 'path';

// Carrega o .env manualmente ANTES de qualquer outro módulo
const envPath = join(process.cwd(), '.env');
console.log('📁 Carregando .env de:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Erro ao carregar .env:', result.error);
} else {
  console.log('✅ Arquivo .env carregado com sucesso');
  // Debug: mostra se as chaves existem (não mostra o valor por segurança)
  console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ definida' : '✗ não definida');
  console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ definida' : '✗ não definida');
  console.log(
    '🔑 OPENROUTER_API_KEY:',
    process.env.OPENROUTER_API_KEY ? '✓ definida' : '✗ não definida'
  );
}

export {};
