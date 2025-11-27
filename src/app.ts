import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// 🔥 Middlewares de autenticação fake e AuthInfo
import { fakeAuth } from './middleware/fakeAuth';
import { authInfo } from './middleware/authInfo';

export function createApp(): Application {
  const app = express();

  // Segurança básica
  app.use(helmet());

  // CORS
  app.use(cors());

  // Parser de JSON e x-www-form-urlencoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Middleware FAKE de autenticação
  // 👉 substitui o Spring Security por enquanto
  app.use(fakeAuth);

  // Injeta req.auth (imitando AuthInfoImpl do Spring)
  app.use(authInfo);

  // Log de requests (somente em dev)
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`, req.body);
      next();
    });
  }

  // Rota raiz
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Node API + Sequelize + Auth Fake',
      user: req.user, // mostra usuário fake
      auth: req.auth, // mostra roles
    });
  });

  // Rotas da API
  app.use('/api', routes);

  // Handler 404
  app.use(notFoundHandler);

  // Handler global de erros
  app.use(errorHandler);

  return app;
}
