import { NextFunction, Request, Response } from 'express';
import { AuthInfoFake } from '../auth/authInfoFake';

export function authInfo(req: Request, res: Response, next: NextFunction) {
  req.auth = new AuthInfoFake(req);
  next();
}
