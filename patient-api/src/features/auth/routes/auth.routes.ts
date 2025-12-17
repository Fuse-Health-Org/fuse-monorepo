import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

// Public routes
router.post('/auth/signup', AuthController.signup);
router.get('/auth/google/login', AuthController.googleLogin);
router.get('/auth/google/callback', AuthController.googleCallback);
router.post('/auth/google', AuthController.googleAuth);
router.post('/auth/signin', AuthController.signin);
router.post('/auth/mfa/verify', AuthController.verifyMfa);
router.post('/auth/mfa/resend', AuthController.resendMfa);
router.post('/auth/send-verification-code', AuthController.sendVerificationCode);
router.post('/auth/verify-code', AuthController.verifyCode);
router.get('/auth/verify-email', AuthController.verifyEmail);

// Protected routes
router.post('/auth/signout', authenticateJWT, AuthController.signout);
router.get('/auth/me', authenticateJWT, AuthController.getMe);
router.put('/auth/profile', authenticateJWT, AuthController.updateProfile);

export default router;

