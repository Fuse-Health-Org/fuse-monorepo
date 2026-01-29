import { Router } from 'express';
import { authenticateJWT } from '../../../config/jwt';
import * as SequenceController from '../controllers/sequences.controller';

const router = Router();

// Sequence CRUD
router.get('/sequences', authenticateJWT, SequenceController.listSequences);
router.get('/sequences/:id', authenticateJWT, SequenceController.getSequence);
router.post('/sequences', authenticateJWT, SequenceController.createSequence);
router.put('/sequences/:id', authenticateJWT, SequenceController.updateSequence);
router.put('/sequences/:id/steps', authenticateJWT, SequenceController.updateSequenceSteps);

// Sequence triggers
router.post('/sequence-triggers/manual', authenticateJWT, SequenceController.triggerManual);
router.post('/sequence-triggers/checkout', SequenceController.triggerCheckout);

// Analytics
router.post('/sequences/:id/refresh-analytics', authenticateJWT, SequenceController.refreshAnalytics);

// Sequence runs
router.get('/sequence-runs', authenticateJWT, SequenceController.listSequenceRuns);
router.get('/sequence-runs/:id', authenticateJWT, SequenceController.getSequenceRun);

// Email tracking
router.get('/track/email/:runId/open', SequenceController.trackEmailOpen);

export default router;

