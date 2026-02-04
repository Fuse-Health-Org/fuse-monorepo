import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../../config/jwt';
import * as TemplatesController from '../controllers/templates.controller';

const router = Router();
const upload = multer();

// Message templates CRUD
router.get('/message-templates', authenticateJWT, TemplatesController.listTemplates);
router.get('/message-templates/:id', authenticateJWT, TemplatesController.getTemplate);
router.post('/message-templates', authenticateJWT, TemplatesController.createTemplate);
router.put('/message-templates/:id', authenticateJWT, TemplatesController.updateTemplate);
router.delete('/message-templates/:id', authenticateJWT, TemplatesController.deleteTemplate);

// Template operations
router.post('/message-templates/:id/duplicate', authenticateJWT, TemplatesController.duplicateTemplate);
router.post('/message-templates/upload-image', 
  authenticateJWT, 
  upload.single('image'), 
  TemplatesController.uploadTemplateImage
);

export default router;

