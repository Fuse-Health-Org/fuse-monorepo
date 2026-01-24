import { Op } from 'sequelize';
import Prescription from '../../models/Prescription';
import User from '../../models/User';
import SequenceRun from '../../models/SequenceRun';
import SequenceTriggerService from './SequenceTriggerService';

/**
 * Service that checks for expired prescriptions
 * and triggers sequences for prescription_expired event
 * 
 * Cron schedule is managed by cronJobs/index.ts
 */
export default class PrescriptionExpirationWorker {
  private triggerService: SequenceTriggerService;

  constructor() {
    this.triggerService = new SequenceTriggerService();
  }

  /**
   * Check for expired prescriptions and trigger sequences
   * Called by cron job registry
   */
  async checkExpiredPrescriptions(): Promise<void> {

    try {
      console.log('🔍 Checking for expired prescriptions...');

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      // Find prescriptions that expired today or in the past
      // and haven't been processed yet
      const expiredPrescriptions = await Prescription.findAll({
        where: {
          expiresAt: {
            [Op.lte]: today
          }
        },
        include: [
          {
            model: User,
            as: 'patient',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'clinicId'],
            required: true
          },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName'],
            required: false
          }
        ]
      });

      if (expiredPrescriptions.length === 0) {
        console.log('✅ No expired prescriptions found');
        return;
      }

      console.log(`📋 Found ${expiredPrescriptions.length} expired prescription(s)`);

      let triggeredCount = 0;
      const processedPrescriptionIds = new Set<string>();

      for (const prescription of expiredPrescriptions) {
        try {
          // Skip if already processed (prevent duplicate triggers)
          if (processedPrescriptionIds.has(prescription.id)) {
            continue;
          }

          const patient = prescription.patient;
          const doctor = prescription.doctor;

          if (!patient || !patient.clinicId) {
            console.warn(`⚠️ Prescription ${prescription.id} has no valid patient or clinic`);
            continue;
          }

          // Check if a sequence has already been triggered for this prescription
          // Query JSONB payload for prescriptionId using Sequelize's literal syntax
          const existingRun = await SequenceRun.findOne({
            where: {
              triggerEvent: 'prescription_expired',
              clinicId: patient.clinicId,
              // Check if payload->>'prescriptionId' matches
              payload: {
                prescriptionId: prescription.id
              } as any
            }
          });

          if (existingRun) {
            console.log(
              `ℹ️ Skipping prescription ${prescription.name} - sequence already triggered (run: ${existingRun.id})`
            );
            continue;
          }

          const doctorName = doctor
            ? `${doctor.firstName} ${doctor.lastName}`
            : 'Your Doctor';

          console.log(
            `📤 Triggering prescription_expired for patient ${patient.firstName} ${patient.lastName} (${patient.email})`
          );

          // Trigger sequences for this expired prescription
          const sequencesTriggered = await this.triggerService.triggerPrescriptionExpired(
            patient.id,
            patient.clinicId,
            prescription.id,
            prescription.name,
            prescription.expiresAt,
            doctorName,
            {
              firstName: patient.firstName,
              lastName: patient.lastName,
              email: patient.email,
              phoneNumber: patient.phoneNumber
            }
          );

          if (sequencesTriggered > 0) {
            triggeredCount += sequencesTriggered;
            processedPrescriptionIds.add(prescription.id);

            console.log(
              `✅ Triggered ${sequencesTriggered} sequence(s) for prescription "${prescription.name}"`
            );
          } else {
            console.log(
              `ℹ️ No active sequences found for prescription_expired trigger (prescription: ${prescription.name})`
            );
          }
        } catch (error) {
          console.error(`❌ Error processing prescription ${prescription.id}:`, error);
        }
      }

      console.log(
        `✅ Prescription expiration check complete: ${triggeredCount} sequence(s) triggered for ${processedPrescriptionIds.size} prescription(s)`
      );
    } catch (error) {
      console.error('❌ Error checking expired prescriptions:', error);
      throw error; // Re-throw so cron registry can log it
    }
  }

  /**
   * Manually trigger a check (for testing or manual execution)
   */
  async triggerManualCheck(): Promise<void> {
    console.log('🔧 Manual prescription check triggered');
    await this.checkExpiredPrescriptions();
  }
}

