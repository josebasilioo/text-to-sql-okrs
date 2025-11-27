import { NextFunction, Request, Response } from 'express';

type PermissionChecker = (req: Request) => boolean;

export function requirePermission(checker: PermissionChecker) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const allowed = checker(req);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para realizar esta ação.',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
