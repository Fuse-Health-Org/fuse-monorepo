import crypto from 'crypto';
import Order, { OrderStatus } from '../../models/Order';
import OrderService from '../order.service';
import MDAuthService from './MDAuth.service';
import MDCaseService from './MDCase.service';
import MDClinicianService from './MDClinician.service';
import Physician from '../../models/Physician';
import PharmacyPhysicianService from '../pharmacy/physician';
import User from '../../models/User';


interface Product {
  id: string;
  ndc: string | null;
  otc: string | null;
  upc: string | null;
  name: string;
  title: string;
  refills: number;
  metadata: string | null;
  quantity: string;
  created_at: string;
  deleted_at: string | null;
  directions: string;
  updated_at: string;
  days_supply: number | null;
  is_obsolete: boolean | null;
  pharmacy_id: string | null;
  dispense_unit: string;
  pharmacy_name: string | null;
  effective_date: string | null;
  force_pharmacy: boolean;
  pharmacy_notes: string;
  dispense_unit_id: number;
  dosespot_supply_id: number;
}

interface Offering {
  id: string;
  case_offering_id: string;
  title: string;
  name: string;
  directions: string;
  is_additional_approval_needed: boolean;
  thank_you_note: string;
  clinical_note: string;
  status: string;
  status_details: string | null;
  order: number;
  is_important: boolean;
  offerable_type: string;
  offerable_id: string;
  order_status: string | null;
  order_date: string | null;
  order_details: string | null;
  order_updated: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  product: Product;
  product_id: string;
  product_type: string;
}

interface OfferingSubmittedEvent {
  timestamp: number;
  event_type: 'offering_submitted';
  case_id: string;
  metadata: string;
  offerings: Offering[];
}

interface IntroVideoRequestedEvent {
  event_type: 'intro_video_requested';
  access_link: string;
  patient_id: string;
  metadata: string;
}

interface DriversLicenseRequestedEvent {
  timestamp: number;
  event_type: 'drivers_license_requested';
  access_link: string;
  patient_id: string;
  metadata: string;
}

interface MessageCreatedEvent {
  timestamp: number;
  event_type: 'message_created';
  message_id: string;
  patient_id: string;
  user_type: string;
  channel: string;
}

interface CaseCompletedEvent {
  timestamp: number;
  event_type: 'case_completed';
  case_id: string;
  metadata?: string;
}

type GenericCaseEvent = {
  timestamp?: number;
  event_type: string;
  case_id?: string;
  encounter_id?: string;
  metadata?: string;
  [key: string]: any;
};

async function findOrderForEvent(eventData: GenericCaseEvent): Promise<Order | null> {
  // Try metadata orderId first
  const meta = eventData?.metadata as string | undefined;
  if (meta) {
    const match = meta.match(/orderId:\s*([0-9a-fA-F-]{36})/);
    if (match && match[1]) {
      const byId = await Order.findByPk(match[1]);
      if (byId) return byId;
    }
  }
  // Fallback to case_id mapping
  if (eventData.case_id) {
    const byCase = await Order.findOne({ where: { mdCaseId: eventData.case_id } });
    if (byCase) return byCase;
  }
  return null;
}

class MDWebhookService {
  public async resyncCaseDetails(caseId: string): Promise<void> {
    return this.fetchAndPersistCaseDetails(caseId);
  }
  private async fetchAndPersistCaseDetails(caseId: string): Promise<void> {
    try {
      const order = await Order.findOne({ where: { mdCaseId: caseId } });
      if (!order) {
        console.log('[MD-WH] ⚠️ fetchAndPersistCaseDetails: no order for case', { case_id: caseId });
        return;
      }

      const token = await MDAuthService.generateToken();
      const mdCase = await MDCaseService.getCase(caseId, token.access_token);
      // Fetch offerings explicitly (more reliable than relying on case embed)
      let offeringsFromEndpoint: any[] = [];
      try {
        offeringsFromEndpoint = await MDCaseService.getCaseOfferings(caseId, token.access_token);
      } catch (e) {
        console.warn('[MD-WH] ⚠️ getCaseOfferings failed, falling back to case payload', e);
      }

      const prescriptions = (mdCase as any)?.prescriptions ?? null;
      const offerings = (offeringsFromEndpoint && offeringsFromEndpoint.length > 0)
        ? offeringsFromEndpoint
        : (mdCase as any)?.offerings ?? (mdCase as any)?.case_offerings ?? (mdCase as any)?.services ?? null;

      const updatePayload: any = {};
      const incomingRxCount = Array.isArray(prescriptions) ? prescriptions.length : 0;
      const incomingOffCount = Array.isArray(offerings) ? offerings.length : 0;

      // Only overwrite if MD returns non-empty arrays; keep previously saved details otherwise
      if (incomingRxCount > 0) {
        updatePayload.mdPrescriptions = prescriptions;
      }
      if (incomingOffCount > 0) {
        updatePayload.mdOfferings = offerings;
      }

      if (Object.keys(updatePayload).length > 0) {
        await order.update(updatePayload);
      }

      const prescriptionsCount = incomingRxCount || ((order as any).mdPrescriptions?.length ?? 0);
      const offeringsCount = incomingOffCount || ((order as any).mdOfferings?.length ?? 0);

      console.log('[MD-WH] 📦 saved case details from MD', {
        orderNumber: order.orderNumber,
        case_id: caseId,
        prescriptions_count: prescriptionsCount,
        offerings_count: offeringsCount
      });

      if (Array.isArray(prescriptions)) {
        prescriptions.forEach((p: any, idx: number) => {
          console.log('[MD-WH] 💊 prescription', {
            idx,
            id: p?.id,
            title: p?.title ?? p?.name,
            directions: p?.directions,
            quantity: p?.quantity,
            refills: p?.refills,
            product_id: p?.product_id
          });
        });
      }

      if (Array.isArray(offerings)) {
        offerings.forEach((o: any, idx: number) => {
          console.log('[MD-WH] 🩺 offering', {
            idx,
            id: o?.id,
            case_offering_id: o?.case_offering_id,
            title: o?.title ?? o?.name,
            product_id: o?.product_id,
            product_type: o?.product_type,
            status: o?.status,
            order_status: o?.order_status
          });
        });
      }
    } catch (error) {
      console.error('[MD-WH] ❌ fetchAndPersistCaseDetails error', error);
      throw error;
    }
  }
  /**
   * Verify webhook signature using HMAC SHA256
   * Matches PHP: hash_hmac('sha256', json_encode(payload), secret)
   */
  verifyWebhookSignature(providedSignature: string, payload: any, secret: string): boolean {
    if (!providedSignature || !secret) {
      return false;
    }

    // Calculate expected signature: hash_hmac('sha256', json_encode(payload), secret)
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString, 'utf8')
      .digest('hex');

    // Compare signatures using timing-safe comparison
    try {
      const providedSignatureBuffer = Buffer.from(providedSignature, 'hex');
      const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

      return providedSignatureBuffer.length === expectedSignatureBuffer.length &&
        crypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer);
    } catch (error) {
      console.error('Error comparing webhook signatures:', error);
      return false;
    }
  }

  // This event will be dispatched when a treatment is approved and ready to be ordered, depending on the offering type:
  async handleOfferingSubmitted(eventData: OfferingSubmittedEvent): Promise<void> {
    console.log('[MD-WH] 🩺 offering_submitted start', { case_id: eventData.case_id, offerings_count: eventData.offerings?.length });

    try {
      // Find order by mdCaseId
      const order = await Order.findOne({
        where: { mdCaseId: eventData.case_id }
      });

      if (!order) {
        console.log('[MD-WH] ⚠️ no order for case', { case_id: eventData.case_id });
        return;
      }

      console.log('[MD-WH] processing order', { orderNumber: order.orderNumber, orderId: order.id });

      // Persist offerings from event payload immediately
      try {
        await order.update({ mdOfferings: eventData.offerings });
        console.log('[MD-WH] 📝 offerings saved on order from webhook payload', { orderNumber: order.orderNumber, offerings_count: eventData.offerings?.length || 0 });
      } catch (e) {
        console.warn('[MD-WH] ⚠️ failed to save offerings from payload', e);
      }

      // Approve the order with the assigned physician
      const orderService = new OrderService();
      await orderService.approveOrder(order.id);
      console.log('[MD-WH] ✅ order approved', { orderNumber: order.orderNumber });

    } catch (error) {
      console.error('[MD-WH] ❌ offering_submitted error', error);
      throw error;
    }
  }

  async handleIntroVideoRequested(eventData: IntroVideoRequestedEvent): Promise<void> {
    console.log('[MD-WH] 🎥 intro_video_requested start', { patient_id: eventData.patient_id });

    try {
      // Find user by mdPatientId
      const user = await User.findOne({
        where: { mdPatientId: eventData.patient_id }
      });

      if (!user) {
        console.log('[MD-WH] ⚠️ no user for patient', { patient_id: eventData.patient_id });
        return;
      }

      console.log('[MD-WH] processing intro video', { userId: user.id });

      console.log('[MD-WH] intro video details', {
        userId: user.id,
        patientId: eventData.patient_id,
        accessLink: eventData.access_link,
        metadata: eventData.metadata
      });

      // Try to find the order from metadata or get the most recent order with mdCaseId
      let order: Order | null = null;
      
      // Try to extract orderId from metadata
      const meta = eventData?.metadata as string | undefined;
      if (meta) {
        const match = meta.match(/orderId:\s*([0-9a-fA-F-]{36})/);
        if (match && match[1]) {
          order = await Order.findByPk(match[1]);
        }
      }
      
      // Fallback: find most recent order with mdCaseId for this user
      if (!order) {
        order = await Order.findOne({
          where: { 
            userId: user.id,
          },
          order: [['createdAt', 'DESC']]
        } as any);
      }

      if (order) {
        // Update the order with the pending action
        const currentPendingActions = (order as any).mdPendingActions || {};
        await order.update({
          mdPendingActions: {
            ...currentPendingActions,
            introVideo: {
              accessLink: eventData.access_link,
              requestedAt: new Date().toISOString(),
            }
          }
        });
        console.log('[MD-WH] ✅ saved intro video pending action', { 
          orderNumber: (order as any).orderNumber,
          accessLink: eventData.access_link 
        });
      } else {
        console.log('[MD-WH] ⚠️ no order found for intro video request', { userId: user.id });
      }

    } catch (error) {
      console.error('[MD-WH] ❌ intro_video_requested error', error);
      throw error;
    }
  }

  async handleDriversLicenseRequested(eventData: DriversLicenseRequestedEvent): Promise<void> {
    console.log('[MD-WH] 🆔 drivers_license_requested start', { patient_id: eventData.patient_id });

    try {
      // Find user by mdPatientId
      const user = await User.findOne({
        where: { mdPatientId: eventData.patient_id }
      });

      if (!user) {
        console.log('[MD-WH] ⚠️ no user for patient', { patient_id: eventData.patient_id });
        return;
      }

      console.log('[MD-WH] processing drivers license', { userId: user.id });

      console.log('[MD-WH] drivers license details', {
        userId: user.id,
        patientId: eventData.patient_id,
        accessLink: eventData.access_link,
        timestamp: eventData.timestamp,
        metadata: eventData.metadata
      });

      // Try to find the order from metadata or get the most recent order with mdCaseId
      let order: Order | null = null;
      
      // Try to extract orderId from metadata
      const meta = eventData?.metadata as string | undefined;
      if (meta) {
        const match = meta.match(/orderId:\s*([0-9a-fA-F-]{36})/);
        if (match && match[1]) {
          order = await Order.findByPk(match[1]);
        }
      }
      
      // Fallback: find most recent order with mdCaseId for this user
      if (!order) {
        order = await Order.findOne({
          where: { 
            userId: user.id,
          },
          order: [['createdAt', 'DESC']]
        } as any);
      }

      if (order) {
        // Update the order with the pending action
        const currentPendingActions = (order as any).mdPendingActions || {};
        await order.update({
          mdPendingActions: {
            ...currentPendingActions,
            driversLicense: {
              accessLink: eventData.access_link,
              requestedAt: new Date().toISOString(),
            }
          }
        });
        console.log('[MD-WH] ✅ saved drivers license pending action', { 
          orderNumber: (order as any).orderNumber,
          accessLink: eventData.access_link 
        });
      } else {
        console.log('[MD-WH] ⚠️ no order found for drivers license request', { userId: user.id });
      }

    } catch (error) {
      console.error('[MD-WH] ❌ drivers_license_requested error', error);
      throw error;
    }
  }

  async handleMessageCreated(eventData: MessageCreatedEvent): Promise<void> {
    console.log('[MD-WH] 💬 message_created start', { message_id: eventData.message_id });

    console.log('[MD-WH] message details', {
      patientId: eventData.patient_id,
      messageId: eventData.message_id,
      userType: eventData.user_type,
      channel: eventData.channel,
      timestamp: eventData.timestamp
    });

    try {

      if (eventData.user_type == 'clinician') {
        const user = await User.findOne({
          where: { mdPatientId: eventData.patient_id }
        });

        user?.update({
          newMessages: true
        })
        console.log('[MD-WH] processing message for user', { userId: user?.id });
      }


      // TODO: Send push notification to user about new message

    } catch (error) {
      console.error('[MD-WH] ❌ message_created error', error);
      throw error;
    }
  }

  async processMDWebhook(eventData: any): Promise<void> {
    switch (eventData.event_type) {
      case 'offering_submitted':
        await this.handleOfferingSubmitted(eventData as OfferingSubmittedEvent);
        break;

      case 'intro_video_requested':
        await this.handleIntroVideoRequested(eventData as IntroVideoRequestedEvent);
        break;

      case 'drivers_license_requested':
        await this.handleDriversLicenseRequested(eventData as DriversLicenseRequestedEvent);
        break;

      case 'message_created':
        await this.handleMessageCreated(eventData as MessageCreatedEvent);
        break;

      case 'case_completed':
        console.log('[MD-WH] ✅ case_completed received', { case_id: (eventData as CaseCompletedEvent).case_id });
        try {
          const order = await findOrderForEvent(eventData as GenericCaseEvent);
          if (!order) {
            console.log('[MD-WH] ⚠️ no order for completed case', { case_id: (eventData as CaseCompletedEvent).case_id });
            break;
          }
          // Mark order as processing (paid and being fulfilled)
          await order.updateStatus(OrderStatus.PROCESSING);
          console.log('[MD-WH] 🧾 order marked processing for completed case', { orderNumber: order.orderNumber });

          // Fetch and persist final case details (prescriptions/offerings)
          if ((eventData as CaseCompletedEvent).case_id) {
            await this.fetchAndPersistCaseDetails((eventData as CaseCompletedEvent).case_id);
          }
        } catch (e) {
          console.error('[MD-WH] ❌ error handling case_completed', e);
        }
        break;

      case 'case_created': {
        console.log('[MD-WH] 🆕 case_created received', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) {
          console.log('[MD-WH] ⚠️ no order for case_created', { case_id: eventData.case_id });
          break;
        }
        console.log('[MD-WH] case_created mapped to order', { orderNumber: order.orderNumber });
        break;
      }

      case 'case_assigned_to_clinician': {
        console.log('[MD-WH] 👨‍⚕️ case_assigned_to_clinician', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) break;
        await order.updateStatus(OrderStatus.PROCESSING);
        console.log('[MD-WH] order marked processing after assignment', { orderNumber: order.orderNumber });
        break;
      }

      case 'case_processing': {
        console.log('[MD-WH] 🔄 case_processing', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) break;
        await order.updateStatus(OrderStatus.PROCESSING);
        console.log('[MD-WH] order marked processing', { orderNumber: order.orderNumber });
        break;
      }

      case 'case_approved': {
        console.log('[MD-WH] ✅ case_approved', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) break;
        try {
          const orderService = new OrderService();
          await orderService.approveOrder(order.id);
          console.log('[MD-WH] order approval attempted after case_approved', { orderNumber: order.orderNumber });
        } catch (e) {
          console.error('[MD-WH] ❌ approve after case_approved failed', e);
        }
        break;
      }

      case 'prescription_submitted': {
        console.log('[MD-WH] 💊 prescription_submitted', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) break;
        await order.updateStatus(OrderStatus.PROCESSING);
        console.log('[MD-WH] order marked processing after prescription submission', { orderNumber: order.orderNumber });

        // Persist prescriptions/offerings from payload if present
        try {
          const payloadPrescriptions = (eventData as any)?.prescriptions;
          const payloadOfferings = (eventData as any)?.offerings ?? (eventData as any)?.services;
          if (payloadPrescriptions || payloadOfferings) {
            await order.update({
              mdPrescriptions: payloadPrescriptions ?? order.getDataValue('mdPrescriptions'),
              mdOfferings: payloadOfferings ?? order.getDataValue('mdOfferings')
            });
            console.log('[MD-WH] 📝 saved rx/offerings from webhook payload', {
              orderNumber: order.orderNumber,
              prescriptions_count: Array.isArray(payloadPrescriptions) ? payloadPrescriptions.length : 0,
              offerings_count: Array.isArray(payloadOfferings) ? payloadOfferings.length : 0
            });

            if (Array.isArray(payloadPrescriptions)) {
              payloadPrescriptions.forEach((p: any, idx: number) => {
                console.log('[MD-WH] 💊 prescription(payload)', {
                  idx,
                  id: p?.id,
                  title: p?.title ?? p?.name,
                  directions: p?.directions,
                  quantity: p?.quantity,
                  refills: p?.refills,
                  product_id: p?.product_id
                });
              });
            }
          }
        } catch (e) {
          console.warn('[MD-WH] ⚠️ failed to save rx/offerings from payload', e);
        }

        // Also fetch the case from MD to ensure we have the latest
        if ((eventData as any)?.case_id) {
          try {
            await this.fetchAndPersistCaseDetails((eventData as any).case_id);
          } catch (e) {
            console.warn('[MD-WH] ⚠️ fetch after prescription_submitted failed', e);
          }
        }
        break;
      }

      case 'partner_charged': {
        console.log('[MD-WH] 💵 partner_charged', { case_id: eventData.case_id, charge_type: eventData.charge_type });
        // No order status change; Stripe capture is our source of truth for payment
        break;
      }

      case 'case_waiting': {
        console.log('[MD-WH] ⏳ case_waiting', { case_id: eventData.case_id });
        const order = await findOrderForEvent(eventData as GenericCaseEvent);
        if (!order) break;
        await order.updateStatus(OrderStatus.PENDING);
        console.log('[MD-WH] order marked pending (waiting)', { orderNumber: order.orderNumber });
        break;
      }

      case 'patient_modified': {
        console.log('[MD-WH] 👤 patient_modified', { patient_id: eventData.patient_id });
        try {
          // Find user by mdPatientId
          const user = await User.findOne({
            where: { mdPatientId: eventData.patient_id }
          });

          if (!user) {
            console.log('[MD-WH] ⚠️ no user for patient_modified', { patient_id: eventData.patient_id });
            break;
          }

          // Fetch updated patient data from MD to check what was uploaded
          const MDPatientService = (await import('./MDPatient.service')).default;
          const tokenResponse = await MDAuthService.generateToken();
          const patientData = await MDPatientService.getPatient(eventData.patient_id, tokenResponse.access_token);

          console.log('[MD-WH] 👤 patient data after modification', {
            patient_id: eventData.patient_id,
            has_driver_license: !!patientData?.driver_license,
            has_intro_video: !!patientData?.intro_video,
          });

          // Find recent orders with pending actions and clear them if requirements are now met
          const orders = await Order.findAll({
            where: { userId: user.id },
            order: [['createdAt', 'DESC']],
            limit: 5, // Check last 5 orders
          } as any);

          for (const order of orders) {
            const pendingActions = (order as any).mdPendingActions;
            if (!pendingActions) continue;

            const updates: any = {};
            let shouldUpdate = false;

            // Clear driver's license pending action if now uploaded
            if (pendingActions.driversLicense && patientData?.driver_license) {
              updates.mdPendingActions = {
                ...pendingActions,
                driversLicense: null, // Clear since it's now uploaded
              };
              shouldUpdate = true;
              console.log('[MD-WH] ✅ clearing driversLicense pending action', { orderNumber: (order as any).orderNumber });
            }

            // Clear intro video pending action if now uploaded
            if (pendingActions.introVideo && patientData?.intro_video) {
              updates.mdPendingActions = {
                ...(updates.mdPendingActions || pendingActions),
                introVideo: null, // Clear since it's now uploaded
              };
              shouldUpdate = true;
              console.log('[MD-WH] ✅ clearing introVideo pending action', { orderNumber: (order as any).orderNumber });
            }

            if (shouldUpdate) {
              await order.update(updates);
              console.log('[MD-WH] ✅ updated order pending actions', { orderNumber: (order as any).orderNumber });
            }
          }
        } catch (e) {
          console.error('[MD-WH] ❌ error handling patient_modified', e);
        }
        break;
      }

      default:
        console.log(`[MD-WH] 🔍 unhandled event type: ${eventData.event_type}`);
    }
  }
}

export default new MDWebhookService();