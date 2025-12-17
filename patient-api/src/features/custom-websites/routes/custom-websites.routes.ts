import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../../config/jwt';
import { isValidImageFile } from '../../../config/s3';
import * as CustomWebsitesController from '../controllers/custom-websites.controller';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP images are allowed."));
    }
  },
});

// Public routes
router.get('/custom-website/default', CustomWebsitesController.getDefault);
router.get('/custom-website/by-slug/:slug', CustomWebsitesController.getBySlug);

// Protected routes
router.get('/custom-website', authenticateJWT, CustomWebsitesController.get);
router.post('/custom-website', authenticateJWT, CustomWebsitesController.createOrUpdate);
router.post('/custom-website/toggle-active', authenticateJWT, CustomWebsitesController.toggleActive);
router.post('/custom-website/upload-logo', authenticateJWT, upload.single('logo'), CustomWebsitesController.uploadLogo);
router.post('/custom-website/upload-hero', authenticateJWT, upload.single('heroImage'), CustomWebsitesController.uploadHero);

export default router;

