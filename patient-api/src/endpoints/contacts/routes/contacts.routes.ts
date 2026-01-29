import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../../config/jwt';
import * as ContactsController from '../controllers/contacts.controller';

const router = Router();

// Configure multer for CSV uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Contacts CRUD
router.get('/contacts', authenticateJWT, ContactsController.listContacts);
router.post('/contacts', authenticateJWT, ContactsController.createContact);
router.post('/contacts/upload-csv', authenticateJWT, upload.single('csv'), ContactsController.uploadCSV);
router.get('/contacts/:id', authenticateJWT, ContactsController.getContact);
router.put('/contacts/:id', authenticateJWT, ContactsController.updateContact);
router.get('/contacts/:id/history', authenticateJWT, ContactsController.getContactHistory);

export default router;

