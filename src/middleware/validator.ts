import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from './errorHandler';

/**
 * Middleware genérico para validar requests usando Zod
 */
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new AppError(400, `Validação falhou: ${messages.join(', ')}`);
      }
      next(error);
    }
  };
};

/**
 * Schema de validação para requisição Text-to-SQL
 */
export const textToSqlSchema = z.object({
  question: z
    .string()
    .min(5, 'A pergunta deve ter pelo menos 5 caracteres')
    .max(500, 'A pergunta deve ter no máximo 500 caracteres')
    .trim(),
});
