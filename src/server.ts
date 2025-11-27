import { createApp } from './app';
import { config } from './config/env';
import { connectDB } from './database/sequelize';
import { initAssociations } from './models/associations';

async function startServer() {
  try {
    await connectDB();
    initAssociations();

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log('');
      console.log('🚀 Servidor iniciado com sucesso!');
      console.log(`📡 Rodando em: http://localhost:${config.port}`);
      console.log(`🌍 Ambiente: ${config.nodeEnv}`);
      console.log(`🤖 Provedor LLM: ${config.llm.provider}`);
      console.log('');
      console.log('📚 Endpoints disponíveis:');
      console.log(`  GET  http://localhost:${config.port}/`);
      console.log(`  GET  http://localhost:${config.port}/api/health`);
      console.log(`  GET  http://localhost:${config.port}/api/schema`);
      console.log(`  POST http://localhost:${config.port}/api/text-to-sql`);
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM recebido. Encerrando servidor...');
      server.close(() => {
        console.log('Servidor encerrado com sucesso');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\nSIGINT recebido. Encerrando servidor...');
      server.close(() => {
        console.log('Servidor encerrado com sucesso');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Erro ao iniciar o servidor:', err);
    process.exit(1);
  }
}

startServer();
