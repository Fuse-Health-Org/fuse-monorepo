import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../../config/jwt';
import { isValidImageFile } from '../../../config/s3';
import * as ClinicsController from '../controllers/clinics.controller';

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
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images, and PDF files are allowed."
        )
      );
    }
  },
});

// Public routes
router.get('/clinic/by-slug/:slug', ClinicsController.getClinicBySlug);
router.get('/clinic/allow-custom-domain', ClinicsController.allowCustomDomain);
router.post('/clinic/by-custom-domain', ClinicsController.getClinicByCustomDomain);

// Protected routes
router.get('/clinic/:id', authenticateJWT, ClinicsController.getClinic);
router.put('/clinic/:id', authenticateJWT, ClinicsController.updateClinic);
router.post('/clinic/:id/upload-logo', authenticateJWT, upload.single('logo'), ClinicsController.uploadLogo);

export default router;

