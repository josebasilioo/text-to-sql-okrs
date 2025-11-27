import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { TextToSqlService } from '../services/textToSqlService';

const textToSqlService = new TextToSqlService();

export class TextToSqlController {
  /**
   * POST /api/text-to-sql
   * Converte uma pergunta em SQL
   */
  async convertTextToSql(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question } = req.body;

      // Valida a pergunta
      const validation = textToSqlService.validateQuestion(question);
      if (!validation.valid) {
        throw new AppError(400, validation.error!);
      }

      // Converte para SQL
      const result = await textToSqlService.convertToSql({ question });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/health
   * Verifica status da API
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  }

  /**
   * GET /api/schema
   * Retorna o schema do banco de dados
   */
  async getSchema(req: Request, res: Response): Promise<void> {
    const schema = {
      table: 'employees',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, description: 'ID único do funcionário' },
        { name: 'name', type: 'VARCHAR(100)', description: 'Nome completo do funcionário' },
        {
          name: 'department',
          type: 'VARCHAR(50)',
          description: 'Departamento (Engineering, Sales, HR, Marketing, Finance)',
        },
        { name: 'salary', type: 'DECIMAL(10,2)', description: 'Salário mensal em reais' },
        { name: 'hire_date', type: 'DATE', description: 'Data de contratação' },
        { name: 'email', type: 'VARCHAR(100)', description: 'Email corporativo' },
        { name: 'is_active', type: 'BOOLEAN', description: 'Status de atividade do funcionário' },
      ],
    };

    res.status(200).json({
      success: true,
      data: schema,
    });
  }
}
