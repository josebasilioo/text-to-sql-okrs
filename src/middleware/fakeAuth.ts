import { NextFunction, Request, Response } from 'express';

export function fakeAuth(req: Request, res: Response, next: NextFunction) {
  // Usuário fixo para dev
  req.user = {
    email: 'jose.basilio@gmail.com',
    login: 'jose.basilio',
    roles: ['partner', 'admin'], // ou oq vc quiser
  };

  next();
}
