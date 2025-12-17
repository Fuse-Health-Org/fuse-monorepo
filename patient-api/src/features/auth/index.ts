// Export routes
export { default as authRoutes } from './routes/auth.routes';

// Initialize verification code cleanup
import { startVerificationCodeCleanup } from './utils/verification.utils';
startVerificationCodeCleanup();

