import { Router, type Router as ExpressRouter } from 'express';
import { TextToSqlController } from '../controllers/textToSqlController';
import { textToSqlSchema, validateRequest } from '../middleware/validator';

const router: ExpressRouter = Router();
const textToSqlController = new TextToSqlController();

// Health check
router.get('/health', textToSqlController.healthCheck);

// Schema info
router.get('/schema', textToSqlController.getSchema);

// Text to SQL conversion
router.post('/text-to-sql', validateRequest(textToSqlSchema), (req, res, next) =>
  textToSqlController.convertTextToSql(req, res, next)
);

export default router;
