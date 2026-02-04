import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as TagsController from '../controllers/tags.controller';

const router = Router();

// Tag CRUD
router.get('/tags', authenticateJWT, TagsController.listTags);
router.post('/tags', authenticateJWT, TagsController.createTag);
router.put('/tags/:id', authenticateJWT, TagsController.updateTag);
router.delete('/tags/:id', authenticateJWT, TagsController.deleteTag);

// Tag assignments
router.post('/tags/:id/assign', authenticateJWT, TagsController.assignTagToUser);
router.delete('/tags/:id/assign/:userId', authenticateJWT, TagsController.removeTagFromUser);

// Get users by tag
router.get('/tags/:id/users', authenticateJWT, TagsController.getUsersByTag);

export default router;

