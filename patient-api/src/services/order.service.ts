import { listOrdersByClinic, listOrdersByUser } from "./db/order";
import { getUser } from "./db/user";
import { OrderService as PharmacyOrderService } from "./pharmacy";
import Order from "../models/Order";
import User from "../models/User";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import { OrderStatus } from "../models/Order";
import ShippingAddress from "../models/ShippingAddress";
import { StripeService } from "@fuse/stripe";
import Subscription, { PaymentStatus } from "../models/Subscription";
import TreatmentPlan from "../models/TreatmentPlan";
import Physician from "../models/Physician";
import PharmacyService from "./pharmacy.service";
import Treatment from "../models/Treatment";
import Payment from "../models/Payment";
import TenantProduct from "../models/TenantProduct";
import WebSocketService from "./websocket.service";
import PharmacyProduct from "../models/PharmacyProduct";
import Pharmacy from "../models/Pharmacy";
import PharmacyCoverage from "../models/PharmacyCoverage";
import Prescription from "../models/Prescription";
import PrescriptionProducts from "../models/PrescriptionProducts";
import Program from "../models/Program";
import { Op } from "sequelize";
import { AuditService } from "./audit.service";
import { AuditAction, AuditResourceType } from "../models/AuditLog";

interface ListOrdersByClinicResult {
  success: boolean;
  message: string;
  data?: {
    orders: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

interface ListOrdersByUserResult {
  success: boolean;
  message: string;
  data?: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

class OrderService {
  // Prepare pharmacy order data from database
  private pharmacyOrderService = new PharmacyOrderService();
  private stripeService = new StripeService();

  constructor() {
    this.pharmacyOrderService = new PharmacyOrderService();
    this.stripeService = new StripeService();
  }

  async listOrdersByClinic(
    clinicId: string,
    userId: string,
    paginationParams: PaginationParams = {}
  ): Promise<ListOrdersByClinicResult> {
    try {
      // Get user and validate they are a doctor
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User with the provided ID does not exist",
        };
      }

      if (!user.hasAnyRoleSync(["doctor", "brand"])) {
        return {
          success: false,
          message: "Access denied",
          error: "Only doctors and brand users can list clinic orders",
        };
      }

      // Verify the user belongs to the clinic
      if (user.clinicId !== clinicId) {
        return {
          success: false,
          message: "Forbidden",
          error: "User does not belong to the specified clinic",
        };
      }

      // Set default pagination values
      const page = Math.max(1, paginationParams.page || 1);
      const limit = Math.min(100, Math.max(1, paginationParams.limit || 10));

      // Get orders by clinic with pagination
      const result = await listOrdersByClinic(clinicId, { page, limit });

      return {
        success: true,
        message: `Successfully retrieved ${result.orders.length} orders`,
        data: {
          orders: result.orders,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
      };
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("Error listing orders by clinic:", error);
      } else {
        console.error("Error listing orders by clinic");
      }
      return {
        success: false,
        message: "Failed to retrieve orders",
        error: "An error occurred while retrieving orders",
      };
    }
  }

  async listOrdersByUser(
    userId: string,
    paginationParams: PaginationParams = {}
  ): Promise<ListOrdersByUserResult> {
    try {
      // Get user and validate they exist
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User with the provided ID does not exist",
        };
      }

      // Set default pagination values
      const page = Math.max(1, paginationParams.page || 1);
      const limit = Math.min(100, Math.max(1, paginationParams.limit || 10));

      // Get orders by user with pagination
      const result = await listOrdersByUser(userId, { page, limit });

      return {
        success: true,
        message: `Successfully retrieved ${result.orders.length} orders`,
        data: {
          orders: result.orders,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
      };
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("Error listing orders by user:", error);
      } else {
        console.error("Error listing orders by user");
      }
      return {
        success: false,
        message: "Failed to retrieve orders",
        error: "An error occurred while retrieving orders",
      };
    }
  }

  async approveOrder(orderId: string, prescriptionDays?: number, approvedByDoctorId?: string) {
    // TODO: this method might need to be expanded to create Order items depending on the information approved in the prescription
    // prescriptionDays: optional number of days for prescription validity (default: 30 days / 1 month)
    // approvedByDoctorId: optional userId of the doctor approving the order
    try {
      // Get order with all related data including shipping address
      const order = await Order.findOne({
        where: { id: orderId },
        include: [
          {
            model: User,
            as: "user",
            // HIPAA: Only fetch required fields for processing
            attributes: [
              "id",
              "firstName",
              "lastName",
              "email",
              "pharmacyPatientId",
              "clinicId",
              "address",
              "city",
              "state",
              "zipCode",
              "phoneNumber",
              "gender",
              "dob",
            ],
          },
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                attributes: [
                  "id",
                  "name",
                  "pharmacyProductId",
                  "placeholderSig",
                ],
              },
            ],
          },
          {
            model: ShippingAddress,
            as: "shippingAddress",
            attributes: [
              "id",
              "address",
              "apartment",
              "city",
              "state",
              "zipCode",
              "country",
            ],
          },
          {
            model: TreatmentPlan,
            as: "treatmentPlan",
            attributes: ["stripePriceId"],
          },
          {
            model: Treatment,
            as: "treatment",
            attributes: ["pharmacyProvider"],
          },
          {
            model: Physician,
            as: "physician",
            attributes: ["pharmacyPhysicianId"],
          },
          {
            model: Payment,
            as: "payment",
            required: false,
            attributes: ["id", "stripePaymentIntentId", "status", "amount"],
          },
          {
            model: TenantProduct,
            as: "tenantProduct",
            required: false,
            include: [
              {
                model: Product,
                as: "product",
                attributes: [
                  "id",
                  "name",
                  "pharmacyProvider",
                  "pharmacyProductId",
                  "placeholderSig",
                  "medicationSize",
                ],
              },
            ],
          },
          {
            model: Program,
            as: "program",
            required: false,
            attributes: ["id", "name"],
          },
        ],
      });

      if (!order) {
        return {
          success: false,
          message: "Order not found",
          error: "Order with the provided ID does not exist",
        };
      }

      // Validate doctor license for the order's state (if approvedByDoctorId is provided)
      if (approvedByDoctorId) {
        const orderState = order.shippingAddress?.state;
        
        if (orderState) {
          // Get doctor user to check license states coverage
          const doctor = await User.findByPk(approvedByDoctorId, {
            attributes: ['id', 'doctorLicenseStatesCoverage'],
          });

          if (!doctor) {
            return {
              success: false,
              message: `Doctor not found.`,
              error: "Doctor user not found",
            };
          }

          if (!doctor.doctorLicenseStatesCoverage || doctor.doctorLicenseStatesCoverage.length === 0) {
            return {
              success: false,
              message: `Doctor license information not found. Please update your license coverage before approving orders.`,
              error: "Doctor license states coverage not configured",
            };
          }

          // Normalize state codes for comparison (uppercase)
          const normalizedOrderState = orderState.toUpperCase();
          const licensedStates = doctor.doctorLicenseStatesCoverage.map((state: string) => state.toUpperCase());

          if (!licensedStates.includes(normalizedOrderState)) {
            return {
              success: false,
              message: `Doctor is not licensed to approve prescriptions in ${orderState}. Licensed states: ${licensedStates.join(', ')}.`,
              error: `Doctor not licensed in state: ${orderState}`,
            };
          }
        }
      }

      // Mark order as approved by doctor (if not already set by auto-approval)
      if (!order.approvedByDoctor) {
        const updateData: any = { approvedByDoctor: true };
        // Set approvedByDoctorId if provided and not already set
        if (approvedByDoctorId && !order.approvedByDoctorId) {
          updateData.approvedByDoctorId = approvedByDoctorId;
        }
        await order.update(updateData);
        console.log(
          `✅ Order marked as approved by doctor: ${order.orderNumber}${approvedByDoctorId ? ` (approved by doctor: ${approvedByDoctorId})` : ''}`
        );
      } else if (approvedByDoctorId && !order.approvedByDoctorId) {
        // If already approved but approvedByDoctorId is not set, update it
        await order.update({ approvedByDoctorId });
        console.log(
          `✅ Order approvedByDoctorId updated: ${order.orderNumber} (approved by doctor: ${approvedByDoctorId})`
        );
      }

      // Debug: Log order payment details (only in development, exclude PHI)
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 Order payment details:`, {
          orderNumber: order.orderNumber,
          status: order.status,
          hasPayment: !!order.payment,
          isProgramOrder: !!order.programId,
        });
      }

      // Check pharmacy coverage before proceeding
      const patientState = order.shippingAddress?.state || order.user?.state;
      
      // Check if this is a program order (has orderItems) or regular product order
      const isProgramOrder = order.programId && order.orderItems && order.orderItems.length > 0;

      if (!patientState) {
        console.error(
          `❌ No patient state found for order: ${order.orderNumber}`
        );
        return {
          success: false,
          message: "Patient state not found",
          error: "Cannot determine patient state for pharmacy order",
        };
      }

      // For program orders, get all product IDs from order items
      // For regular orders, get product ID from tenantProduct
      let productIds: string[] = [];
      
      if (isProgramOrder) {
        productIds = order.orderItems
          .filter((item: any) => item.product?.id)
          .map((item: any) => item.product.id);
        console.log(`📦 Program order with ${productIds.length} products`);
      } else if (order.tenantProduct?.product?.id) {
        productIds = [order.tenantProduct.product.id];
      }

      if (productIds.length === 0) {
        console.error(`❌ No products found for order: ${order.orderNumber}`);
        return {
          success: false,
          message: "Product not found",
          error: "Cannot determine product for pharmacy order",
        };
      }

      // Find ALL pharmacy coverages for all products in the patient's state
      const coverages = await PharmacyProduct.findAll({
        where: {
          productId: { [Op.in]: productIds },
          state: patientState,
        },
        include: [
          {
            model: Pharmacy,
            as: "pharmacy",
            attributes: ["id", "name", "slug", "isActive"],
          },
          {
            model: PharmacyCoverage,
            as: "pharmacyCoverage",
          },
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "placeholderSig"],
          },
        ],
      });

      // Filter out inactive pharmacies
      const activeCoverages = coverages.filter((c) => c.pharmacy?.isActive);

      if (activeCoverages.length === 0) {
        console.error(`❌ No active pharmacy coverage for product(s) in state`);
        return {
          success: false,
          message: `No pharmacy coverage for ${isProgramOrder ? 'program products' : 'this product'} in the patient's state`,
          error: "Pharmacy coverage not configured",
        };
      }

      console.log(`✅ Found ${activeCoverages.length} pharmacy coverage(s) for ${isProgramOrder ? 'program' : 'product'} order`);

      // Handle payment capture and pharmacy order creation based on order status
      if (order.status === OrderStatus.PAID) {
        // Order is already paid, send to ALL pharmacies
        console.log(
          `📦 [Approve] Order already paid, sending to ${activeCoverages.length} pharmacy(ies): ${order.orderNumber}`
        );

        // Create pharmacy orders for each coverage
        const successfulCoverages: any[] = [];
        for (const coverage of activeCoverages) {
          console.log(
            `🏥 [Approve] Processing pharmacy: ${coverage.pharmacy.name}`
          );
          try {
            const pharmacyService = new PharmacyService();
            const result = await pharmacyService.createPharmacyOrder(
              order,
              coverage.pharmacy.slug,
              coverage
            );
            if (result && result.success) {
              console.log(
                `✅ [Approve] Pharmacy order created successfully for ${coverage.pharmacy.name}`
              );
              successfulCoverages.push(coverage);
            } else {
              console.error(
                `⚠️ [Approve] Pharmacy order creation returned failure for ${coverage.pharmacy.name}`
              );
            }
          } catch (pharmacyError) {
            // HIPAA: Do not log detailed errors in production
            if (process.env.NODE_ENV === "development") {
              console.error(
                `❌ [Approve] Failed to create pharmacy order for ${coverage.pharmacy.name}:`,
                pharmacyError
              );
            } else {
              console.error(`❌ [Approve] Failed to create pharmacy order`);
            }
            // Don't fail the approval - order is already paid, continue with other pharmacies
          }
        }

        // Create prescription after successful pharmacy orders
        if (successfulCoverages.length > 0) {
          await this.createPrescriptionForOrder(order, successfulCoverages, prescriptionDays);
        }
      } else if (
        (order.status === OrderStatus.PENDING ||
          order.status === OrderStatus.PROCESSING ||
          order.status === OrderStatus.AMOUNT_CAPTURABLE_UPDATED) &&
        order.payment?.stripePaymentIntentId
      ) {
        // Get payment intent ID from Payment model (single source of truth)
        const paymentIntentId = order.payment.stripePaymentIntentId;

        if (!paymentIntentId) {
          console.log(
            `⚠️ Order has no payment intent ID in Payment model: ${order.orderNumber}`
          );
          return {
            success: false,
            message: "Order has no payment intent ID",
            error: "Cannot capture payment without payment intent ID",
          };
        }

        // Order has pending/authorized payment that needs to be captured
        console.log(
          `💳 [Approve] Capturing payment for order ${order.orderNumber} with status ${order.status}`
        );

        try {
          // Capture the payment
          const capturedPayment =
            await this.stripeService.capturePaymentIntent(paymentIntentId);

          // Get stripePriceId from either treatmentPlan or order directly (for product subscriptions)
          const stripePriceId =
            order?.treatmentPlan?.stripePriceId || order?.stripePriceId;

          // Create subscription after successful payment capture
          if (
            capturedPayment.payment_method &&
            capturedPayment.customer &&
            stripePriceId
          ) {
            try {
              // Create subscription with the captured payment method
              const subscription =
                await this.stripeService.createSubscriptionAfterPayment({
                  customerId: capturedPayment.customer as string,
                  priceId: stripePriceId,
                  paymentMethodId: capturedPayment.payment_method as string,
                  billingInterval: order.billingInterval, // Pass the billing interval from order
                  metadata: {
                    userId: order.userId,
                    orderId: order.id,
                    ...(order?.treatmentId && {
                      treatmentId: order?.treatmentId,
                    }),
                    initial_payment_intent_id: capturedPayment.id,
                  },
                });
              await Subscription.create({
                orderId: order.id,
                stripeSubscriptionId: subscription.id,
                status: PaymentStatus.PAID,
              });
              console.log(`✅ Subscription created and attached to order`);
            } catch (error) {
              // HIPAA: Do not log detailed errors in production
              if (process.env.NODE_ENV === "development") {
                console.error(
                  `❌ Failed to create subscription after payment capture:`,
                  error
                );
              } else {
                console.error(
                  `❌ Failed to create subscription after payment capture`
                );
              }
              // Don't fail the approval process, but log the error
            }
          } else {
            console.warn(`⚠️ Missing required data for subscription creation`);
          }

          console.log(
            `✅ [Approve] Payment captured successfully for order ${order.orderNumber}`
          );

          // Update order status to paid
          await order.updateStatus(OrderStatus.PAID);

          // Reload order to get updated status after payment capture
          await order.reload();

          // Send to ALL pharmacies after payment is captured
          console.log(
            `🏥 [Approve] Sending to ${activeCoverages.length} pharmacy(ies) after payment capture...`
          );

          const successfulCoverages: any[] = [];
          for (const coverage of activeCoverages) {
            console.log(
              `🏥 [Approve] Processing pharmacy: ${coverage.pharmacy.name}`
            );
            try {
              const pharmacyService = new PharmacyService();
              const result = await pharmacyService.createPharmacyOrder(
                order,
                coverage.pharmacy.slug,
                coverage
              );
              if (result && result.success) {
                console.log(
                  `✅ [Approve] Pharmacy order created successfully for ${coverage.pharmacy.name}`
                );
                successfulCoverages.push(coverage);
              } else {
                console.error(
                  `⚠️ [Approve] Pharmacy order creation returned failure for ${coverage.pharmacy.name}`
                );
              }
            } catch (pharmacyError) {
              // HIPAA: Do not log detailed errors in production
              if (process.env.NODE_ENV === "development") {
                console.error(
                  `❌ [Approve] Failed to create pharmacy order for ${coverage.pharmacy.name}:`,
                  pharmacyError
                );
              } else {
                console.error(`❌ [Approve] Failed to create pharmacy order`);
              }
              // Don't fail the approval - order is paid and approved, continue with other pharmacies
            }
          }

          // Create prescription after successful pharmacy orders
          if (successfulCoverages.length > 0) {
            await this.createPrescriptionForOrder(order, successfulCoverages, prescriptionDays);
          }
        } catch (error: any) {
          // HIPAA: Do not log detailed errors in production
          if (process.env.NODE_ENV === "development") {
            console.error(
              `❌ [Approve] Failed to capture payment for order ${order.orderNumber}:`,
              error
            );
          } else {
            console.error(`❌ [Approve] Failed to capture payment for order`);
          }

          // Check if payment was already captured (common during testing)
          const isAlreadyCaptured =
            error?.raw?.message?.includes("has already been captured") ||
            error?.message?.includes("has already been captured") ||
            error?.code === "charge_already_captured";

          if (isAlreadyCaptured) {
            console.log(
              `ℹ️ [Approve] Payment was already captured for order. Continuing with pharmacy order creation...`
            );

            // Fetch the payment intent to get details for subscription
            try {
              const paymentIntent =
                await this.stripeService.getPaymentIntent(paymentIntentId);
              const stripePriceId =
                order?.treatmentPlan?.stripePriceId || order?.stripePriceId;

              // Try to create subscription if not already exists
              if (
                paymentIntent.payment_method &&
                paymentIntent.customer &&
                stripePriceId
              ) {
                const existingSubscription = await Subscription.findOne({
                  where: { orderId: order.id },
                });

                if (!existingSubscription) {
                  try {
                    const subscription =
                      await this.stripeService.createSubscriptionAfterPayment({
                        customerId: paymentIntent.customer as string,
                        priceId: stripePriceId,
                        paymentMethodId: paymentIntent.payment_method as string,
                        billingInterval: order.billingInterval,
                        metadata: {
                          userId: order.userId,
                          orderId: order.id,
                          ...(order?.treatmentId && {
                            treatmentId: order?.treatmentId,
                          }),
                          initial_payment_intent_id: paymentIntent.id,
                        },
                      });
                    await Subscription.create({
                      orderId: order.id,
                      stripeSubscriptionId: subscription.id,
                      status: PaymentStatus.PAID,
                    });
                    console.log(
                      `✅ Subscription created for already-captured payment`
                    );
                  } catch (subError) {
                    // HIPAA: Do not log detailed errors in production
                    if (process.env.NODE_ENV === "development") {
                      console.error(
                        `❌ Failed to create subscription:`,
                        subError
                      );
                    } else {
                      console.error(`❌ Failed to create subscription`);
                    }
                  }
                }
              }

              // Update order to PAID
              await order.updateStatus(OrderStatus.PAID);
              await order.reload();

              // Send to ALL pharmacies
              console.log(
                `🏥 [Approve] Sending to ${activeCoverages.length} pharmacy(ies) (payment already captured)...`
              );

              for (const coverage of activeCoverages) {
                console.log(
                  `🏥 [Approve] Processing pharmacy: ${coverage.pharmacy.name}`
                );
                try {
                  const pharmacyService = new PharmacyService();
                  const result = await pharmacyService.createPharmacyOrder(
                    order,
                    coverage.pharmacy.slug,
                    coverage
                  );
                  if (result && result.success) {
                    console.log(
                      `✅ [Approve] Pharmacy order created successfully for ${coverage.pharmacy.name}`
                    );
                  } else {
                    console.error(
                      `⚠️ [Approve] Pharmacy order creation returned failure for ${coverage.pharmacy.name}`
                    );
                  }
                } catch (pharmacyError) {
                  // HIPAA: Do not log detailed errors in production
                  if (process.env.NODE_ENV === "development") {
                    console.error(
                      `❌ [Approve] Failed to create pharmacy order for ${coverage.pharmacy.name}:`,
                      pharmacyError
                    );
                  } else {
                    console.error(
                      `❌ [Approve] Failed to create pharmacy order`
                    );
                  }
                  // Don't fail the approval - order is paid, continue with other pharmacies
                }
              }
            } catch (retryError) {
              // HIPAA: Do not log detailed errors in production
              if (process.env.NODE_ENV === "development") {
                console.error(
                  `❌ [Approve] Failed to handle already-captured payment:`,
                  retryError
                );
              } else {
                console.error(
                  `❌ [Approve] Failed to handle already-captured payment`
                );
              }
            }
          } else {
            // Different error - don't fail the approval but log it
            console.log(
              `⚠️ [Approve] Order approved by doctor but payment capture failed. Will retry when payment is completed.`
            );
          }
        }
      } else {
        // Order is not paid yet - doctor approval is recorded but pharmacy order not created
        console.log(
          `⚠️ [Approve] Order approved by doctor but not paid yet. Status: ${order.status}. Pharmacy order will be created when payment is completed.`
        );
      }

      // Emit WebSocket event for order approval
      WebSocketService.emitOrderApproved({
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        clinicId: order.clinicId,
        status: order.status,
        autoApproved: order.autoApprovedByDoctor || false,
      });

      return {
        success: true,
        message: "Order successfully approved and sent to pharmacy",
      };
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("Error approving order:", error);
      } else {
        console.error("Error approving order");
      }
      return {
        success: false,
        message: "Failed to approve order",
        error: "An error occurred while approving the order",
      };
    }
  }

  async addDoctorNotes(orderId: string, doctorId: string, noteText: string) {
    try {
      const order = await Order.findByPk(orderId, {
        include: [{ model: User, as: "user", attributes: ["id"] }],
      });

      if (!order) {
        return {
          success: false,
          message: "Order not found",
          error: "Order with the provided ID does not exist",
        };
      }

      // Simply replace the note (single note, not array)
      await order.update({ doctorNotes: noteText });

      // Emit WebSocket event
      WebSocketService.emitDoctorNotesAdded({
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        clinicId: order.clinicId,
        doctorNotes: noteText,
      });

      return {
        success: true,
        message: "Doctor notes saved successfully",
        data: { note: noteText },
      };
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error("Error saving doctor notes:", error);
      } else {
        console.error("Error saving doctor notes");
      }
      return {
        success: false,
        message: "Failed to save doctor notes",
        error: "An error occurred while saving doctor notes",
      };
    }
  }

  /**
   * Create prescriptions for an approved order with pharmacy coverages
   * Creates ONE prescription per medication/coverage
   * @param order The approved order
   * @param coverages Array of successful pharmacy coverages
   * @param prescriptionDays Optional number of days for prescription validity (default: 30 days)
   */
  private async createPrescriptionForOrder(
    order: Order,
    coverages: any[],
    prescriptionDays?: number
  ): Promise<void> {
    try {
      // Default to 30 days (1 month) if not specified
      const daysValid = prescriptionDays || 30;

      console.log(
        `💊 [Prescription] Creating ${coverages.length} prescription(s) for order: ${order.orderNumber} (valid for ${daysValid} days)`
      );

      // Get doctor ID (physician) from order
      const doctorId = order.physicianId || order.user?.clinicId; // Fallback to clinic if no specific physician

      if (!doctorId) {
        console.warn(
          `⚠️ [Prescription] No doctor ID found for order, skipping prescription creation`
        );
        return;
      }

      // Set expiration date based on prescriptionDays
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysValid);

      // Create ONE prescription for EACH coverage (medication)
      for (const coverage of coverages) {
        try {
          // Get medication name from coverage
          const medicationName =
            coverage.pharmacyCoverage?.customName ||
            coverage.pharmacyProductName ||
            "Medication";

          // Create a prescription for this specific medication
          const prescription = await Prescription.create({
            name: `${medicationName} - ${order.orderNumber}`,
            expiresAt,
            writtenAt: new Date(),
            patientId: order.userId,
            doctorId,
          });

          console.log(
            `✅ [Prescription] Created prescription for ${medicationName}`
          );

          // Audit log: Prescription creation (PHI creation)
          await AuditService.log({
            userId: doctorId,
            action: AuditAction.CREATE,
            resourceType: AuditResourceType.PRESCRIPTION,
            resourceId: prescription.id,
            details: {
              operation: 'prescription_created',
              orderId: order.id,
              orderNumber: order.orderNumber,
              patientId: order.userId,
              medicationName,
              daysValid
            }
          });

          // Get product ID from coverage
          const productId =
            coverage.productId || order.tenantProduct?.productId;

          if (!productId) {
            console.warn(
              `⚠️ [Prescription] No product ID found for coverage, skipping product link`
            );
            continue;
          }

          // Create PrescriptionProducts entry for this medication
          await PrescriptionProducts.create({
            prescriptionId: prescription.id,
            productId,
            quantity: 1, // Default quantity
            pharmacyProductId: coverage.pharmacyProductId || coverage.id,
          });

          console.log(`✅ [Prescription] Linked product to prescription`);
        } catch (coverageError) {
          // HIPAA: Do not log detailed errors in production
          if (process.env.NODE_ENV === "development") {
            console.error(
              `❌ [Prescription] Failed to create prescription for coverage:`,
              coverageError
            );
          } else {
            console.error(
              `❌ [Prescription] Failed to create prescription for coverage`
            );
          }
          // Continue with other coverages
        }
      }

      console.log(
        `✅ [Prescription] Successfully created ${coverages.length} prescription(s) for order ${order.orderNumber}`
      );
    } catch (error) {
      // HIPAA: Do not log detailed errors in production
      if (process.env.NODE_ENV === "development") {
        console.error(
          `❌ [Prescription] Failed to create prescriptions for order:`,
          error
        );
      } else {
        console.error(
          `❌ [Prescription] Failed to create prescriptions for order`
        );
      }
      // Don't fail the approval process if prescription creation fails
    }
  }
}

export default OrderService;
export type {
  ListOrdersByClinicResult,
  ListOrdersByUserResult,
  PaginationParams,
};
