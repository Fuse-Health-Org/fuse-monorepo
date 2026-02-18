import { Op } from 'sequelize';
import TenantAnalyticsEvents from '../models/TenantAnalyticsEvents';
import User from '../models/User';
import Sequence from '../models/Sequence';
import SequenceRun from '../models/SequenceRun';
import Clinic from '../models/Clinic';
import { sequenceRunWorker } from '../endpoints/sequences/services/worker';

export interface AbandonedCartSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  productId: string;
  formId: string;
  clinicId: string;
  lastActivity: Date;
  dropOffStage?: string;
  metadata?: any;
}

export class AbandonedCartTriggerService {
  static async findAbandonedCarts(
    lookbackHours: number = 24,
    abandonmentThresholdHours: number = 1
  ): Promise<AbandonedCartSession[]> {
    try {
      console.log(`[Abandoned Cart] Scanning for abandoned carts from last ${lookbackHours} hours`);

      const now = new Date();
      const lookbackTime = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
      const abandonmentThreshold = new Date(now.getTime() - abandonmentThresholdHours * 60 * 60 * 1000);

      const viewEvents = await TenantAnalyticsEvents.findAll({
        where: {
          eventType: 'view',
          createdAt: {
            [Op.gte]: lookbackTime,
            [Op.lte]: abandonmentThreshold,
          },
          sessionId: {
            [Op.ne]: null,
          },
        },
        order: [['createdAt', 'DESC']],
      });

      console.log(`[Abandoned Cart] Found ${viewEvents.length} view events to process`);

      const sessionMap = new Map<string, AbandonedCartSession>();

      for (const viewEvent of viewEvents) {
        const sessionId = viewEvent.sessionId!;
        
        if (sessionMap.has(sessionId)) continue;

        const contactInfo = viewEvent.metadata?.contactInfo;
        
        if (!contactInfo || !contactInfo.email || !contactInfo.firstName || !contactInfo.lastName) {
          continue;
        }

        const conversionEvent = await TenantAnalyticsEvents.findOne({
          where: {
            sessionId,
            eventType: 'conversion',
          },
        });

        if (conversionEvent) continue;

        const existingRun = await SequenceRun.findOne({
          where: {
            triggerEvent: 'abandoned_cart',
            payload: {
              sessionId,
            },
          },
        });

        if (existingRun) continue;

        const dropoffEvent = await TenantAnalyticsEvents.findOne({
          where: {
            sessionId,
            eventType: 'dropoff',
          },
          order: [['createdAt', 'DESC']],
        });

        let clinicId: string | null = null;
        
        if (viewEvent.userId) {
          const user = await User.findByPk(viewEvent.userId, {
            include: [{ model: Clinic, as: 'clinic' }],
          });
          clinicId = user?.clinicId || null;
        }

        if (!clinicId && viewEvent.metadata?.clinicId) {
          clinicId = viewEvent.metadata.clinicId;
        }

        if (!clinicId) {
          const TenantProduct = (await import('../models/TenantProduct')).default;
          const tenantProduct = await TenantProduct.findByPk(viewEvent.productId);
          clinicId = tenantProduct?.clinicId || null;
        }

        if (!clinicId) {
          console.warn(`[Abandoned Cart] No clinic ID found for session ${sessionId}, skipping`);
          continue;
        }

        sessionMap.set(sessionId, {
          sessionId,
          userId: viewEvent.userId,
          userEmail: contactInfo.email,
          userName: `${contactInfo.firstName} ${contactInfo.lastName}`,
          productId: viewEvent.productId,
          formId: viewEvent.formId,
          clinicId,
          lastActivity: viewEvent.createdAt,
          dropOffStage: dropoffEvent?.dropOffStage,
          metadata: {
            ...viewEvent.metadata,
            contactInfo,
          },
        });
      }

      const abandonedCarts = Array.from(sessionMap.values());
      console.log(`[Abandoned Cart] Found ${abandonedCarts.length} abandoned carts with contact info`);

      return abandonedCarts;
    } catch (error) {
      console.error('[Abandoned Cart] Error finding abandoned carts:', error);
      throw error;
    }
  }

  static async triggerAbandonedCartSequences(abandonedCarts: AbandonedCartSession[]): Promise<number> {
    try {
      let triggeredCount = 0;

      for (const cart of abandonedCarts) {
        const allSequences = await Sequence.findAll({
          where: {
            clinicId: cart.clinicId,
            status: 'active',
            isActive: true,
          },
        });

        const sequences = allSequences.filter(sequence => {
          const triggerData = sequence.trigger as Record<string, unknown>;
          const triggerEvent = (triggerData.event || triggerData.eventKey || triggerData.type) as string | undefined;
          return triggerEvent === 'abandoned_cart';
        });

        if (sequences.length === 0) {
          console.log(`[Abandoned Cart] No active sequences found for clinic ${cart.clinicId}`);
          continue;
        }

        console.log(`[Abandoned Cart] Found ${sequences.length} active sequence(s) for abandoned_cart trigger`);

        for (const sequence of sequences) {
          const contactInfo = cart.metadata?.contactInfo || {};
          
          const sequenceRun = await SequenceRun.create({
            sequenceId: sequence.id,
            clinicId: cart.clinicId,
            triggerEvent: 'abandoned_cart',
            status: 'pending',
            payload: {
              sessionId: cart.sessionId,
              userId: cart.userId,
              userEmail: cart.userEmail,
              userName: cart.userName,
              firstName: contactInfo.firstName,
              lastName: contactInfo.lastName,
              email: contactInfo.email,
              phoneNumber: contactInfo.phoneNumber,
              productId: cart.productId,
              formId: cart.formId,
              dropOffStage: cart.dropOffStage,
              abandonedAt: cart.lastActivity,
              ...cart.metadata,
            },
          });

          console.log(`[Abandoned Cart] Created SequenceRun ${sequenceRun.id} for session ${cart.sessionId}`);

          if (sequenceRunWorker) {
            try {
              await sequenceRunWorker.enqueueRun(sequenceRun.id);
              console.log(`[Abandoned Cart] Enqueued SequenceRun ${sequenceRun.id}`);
            } catch (error) {
              console.error(`[Abandoned Cart] Error enqueueing run ${sequenceRun.id}:`, error);
            }
          } else {
            console.warn('[Abandoned Cart] Sequence run worker not initialized');
          }

          triggeredCount++;
        }
      }

      console.log(`[Abandoned Cart] Triggered ${triggeredCount} sequences`);
      return triggeredCount;
    } catch (error) {
      console.error('[Abandoned Cart] Error triggering sequences:', error);
      throw error;
    }
  }

  static async processAbandonedCarts(
    lookbackHours: number = 24,
    abandonmentThresholdHours: number = 1
  ): Promise<{ detected: number; triggered: number }> {
    try {
      console.log('[Abandoned Cart] Starting abandoned cart processing...');

      const abandonedCarts = await this.findAbandonedCarts(lookbackHours, abandonmentThresholdHours);
      const triggeredCount = await this.triggerAbandonedCartSequences(abandonedCarts);

      console.log('[Abandoned Cart] Processing complete', {
        detected: abandonedCarts.length,
        triggered: triggeredCount,
      });

      return {
        detected: abandonedCarts.length,
        triggered: triggeredCount,
      };
    } catch (error) {
      console.error('[Abandoned Cart] Error processing abandoned carts:', error);
      throw error;
    }
  }
}

export default AbandonedCartTriggerService;
