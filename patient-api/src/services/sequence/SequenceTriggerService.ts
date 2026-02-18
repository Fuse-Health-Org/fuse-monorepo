import Sequence from '../../models/Sequence';
import SequenceRun from '../../models/SequenceRun';
import { sequenceRunWorker } from '@endpoints/sequences/services/worker';

/**
 * Service to trigger sequences based on events
 * Supports: manual, checkout_completed, protocol_start, prescription_expired, abandoned_cart
 */
export default class SequenceTriggerService {
  /**
   * Trigger all active sequences for a specific event
   * @param eventName - The trigger event name
   * @param userId - Patient user ID
   * @param clinicId - Clinic ID
   * @param payload - Additional context data for the sequence
   * @returns Number of sequences triggered
   */
  async triggerSequencesForEvent(
    eventName: string,
    userId: string,
    clinicId: string,
    payload: Record<string, any> = {}
  ): Promise<number> {
    try {
      console.log(`🎯 Triggering sequences for event: ${eventName}, user: ${userId}`);

      // Find all active sequences for this clinic
      const allSequences = await Sequence.findAll({
        where: {
          clinicId,
          status: 'active',
          isActive: true
        }
      });

      // Filter sequences by trigger event (JSONB field)
      const sequences = allSequences.filter(sequence => {
        const triggerData = sequence.trigger as Record<string, unknown>;
        const triggerEvent = (triggerData.event || triggerData.eventKey || triggerData.type) as string | undefined;
        return triggerEvent === eventName;
      });

      if (sequences.length === 0) {
        console.log(`ℹ️ No active sequences found for trigger: ${eventName}`);
        return 0;
      }

      console.log(`✅ Found ${sequences.length} active sequence(s) for trigger: ${eventName}`);

      // Create sequence runs for each matching sequence
      const createdRuns: string[] = [];

      for (const sequence of sequences) {
        try {
          // Build complete payload with user info and event context
          const runPayload = {
            userId,
            triggerEvent: eventName,
            triggeredAt: new Date().toISOString(),
            ...payload
          };

          // Create sequence run
          const sequenceRun = await SequenceRun.create({
            sequenceId: sequence.id,
            clinicId,
            triggerEvent: eventName,
            status: 'pending',
            payload: runPayload
          });

          createdRuns.push(sequenceRun.id);

          console.log(`📤 Created SequenceRun ${sequenceRun.id} for sequence "${sequence.name}"`);
        } catch (error) {
          console.error(`❌ Error creating run for sequence ${sequence.id}:`, error);
        }
      }

      // Enqueue all runs in background (non-blocking)
      if (sequenceRunWorker && createdRuns.length > 0) {
        Promise.all(
          createdRuns.map(runId => sequenceRunWorker.enqueueRun(runId))
        ).catch(error => {
          console.error('❌ Error enqueueing sequence runs:', error);
        });

        console.log(`✅ Enqueued ${createdRuns.length} sequence run(s) in background`);
      }

      return createdRuns.length;
    } catch (error) {
      console.error(`❌ Error triggering sequences for event ${eventName}:`, error);
      return 0;
    }
  }

  /**
   * Trigger sequences for protocol start (when patient completes an order)
   */
  async triggerProtocolStart(
    userId: string,
    clinicId: string,
    orderNumber: string
  ): Promise<number> {
    return this.triggerSequencesForEvent('protocol_start', userId, clinicId, {
      orderNumber,
      orderDate: new Date().toISOString()
    });
  }

  /**
   * Trigger sequences for prescription expiration
   */
  async triggerPrescriptionExpired(
    userId: string,
    clinicId: string,
    prescriptionId: string,
    prescriptionName: string,
    expiresAt: Date,
    doctorName?: string,
    userDetails?: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
    }
  ): Promise<number> {
    return this.triggerSequencesForEvent('prescription_expired', userId, clinicId, {
      prescriptionId,
      prescriptionName,
      expiresAt: expiresAt.toISOString(),
      doctorName: doctorName || 'Your Doctor',
      ...(userDetails && {
        userDetails,
        patientFirstName: userDetails.firstName,
        patientName: `${userDetails.firstName} ${userDetails.lastName}`.trim()
      })
    });
  }
}

