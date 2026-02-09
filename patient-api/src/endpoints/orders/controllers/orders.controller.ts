import { getCurrentUser } from "@/config/jwt";
import Clinic from "@models/Clinic";
import Order from "@models/Order";
import OrderItem from "@models/OrderItem";
import Payment from "@models/Payment";
import Prescription from "@models/Prescription";
import PrescriptionExtension from "@models/PrescriptionExtension";
import PrescriptionProducts from "@models/PrescriptionProducts";
import Product from "@models/Product";
import ShippingAddress from "@models/ShippingAddress";
import ShippingOrder from "@models/ShippingOrder";
import Treatment from "@models/Treatment";
import User from "@models/User";
import UserRoles from "@models/UserRoles";
import { AuditAction, AuditResourceType, AuditService } from "@services/audit.service";
import OrderService from "@services/order.service";
import stripe from "@utils/useGetStripeClient";
import { useGlobalFees, getPlatformFeePercent } from "@utils/useGlobalFees";
import { createPaymentIntentSchema } from "@fuse/validators";
import { Request, Response } from 'express';
import { Op } from "sequelize";

const orderService = new OrderService();


export const createPaymentIntent = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        // Validate request body using createPaymentIntentSchema
        const validation = createPaymentIntentSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.error.errors,
            });
        }

        const {
            amount,
            currency,
            treatmentId,
            selectedProducts,
            selectedPlan,
            shippingInfo,
            questionnaireAnswers,
            affiliateId, // Optional: affiliate ID if order came from affiliate link
        } = validation.data;

        // Get treatment with products to validate order
        const treatment = await Treatment.findByPk(treatmentId, {
            include: [
                {
                    model: Product,
                    as: "products",
                    through: {
                        attributes: ["placeholderSig", "numberOfDoses", "nextDose"],
                    },
                },
            ],
        });

        if (!treatment) {
            return res.status(404).json({
                success: false,
                message: "Treatment not found",
            });
        }

        // Validate affiliateId if provided, or detect from hostname
        let validAffiliateId: string | undefined = undefined;

        // First, try to get affiliateId from request body
        if (affiliateId) {
            const affiliate = await User.findByPk(affiliateId, {
                include: [{ model: UserRoles, as: "userRoles", required: false }],
            });
            if (affiliate) {
                await affiliate.getUserRoles();
                if (affiliate.userRoles?.hasRole("affiliate")) {
                    validAffiliateId = affiliateId;
                }
            }
        }

        // If no affiliateId in body, try to detect from hostname
        if (!validAffiliateId) {
            const hostname = req.get("host") || req.hostname;
            if (hostname) {
                const parts = hostname.split(".");
                // Check for pattern: affiliateslug.brandslug.domain.extension
                // e.g., checktwo.limitless.fusehealth.com
                if (parts.length >= 4) {
                    const affiliateSlug = parts[0];
                    console.log("🔍 Detecting affiliate from hostname:", { hostname, affiliateSlug });

                    // Find affiliate by website (slug) field
                    const affiliateBySlug = await User.findOne({
                        where: {
                            website: affiliateSlug,
                        },
                        include: [
                            {
                                model: UserRoles,
                                as: "userRoles",
                                required: true,
                            },
                        ],
                    });

                    if (affiliateBySlug) {
                        await affiliateBySlug.getUserRoles();
                        if (affiliateBySlug.userRoles?.hasRole("affiliate")) {
                            validAffiliateId = affiliateBySlug.id;
                            console.log("✅ Found affiliate from hostname:", { affiliateId: validAffiliateId, slug: affiliateSlug });
                        }
                    }
                }
            }
        }

        // Create order
        const orderNumber = await Order.generateOrderNumber();
        const order = await Order.create({
            orderNumber,
            userId: currentUser.id,
            treatmentId,
            questionnaireId: null, // Will be updated if questionnaire is available
            status: "pending",
            billingPlan: selectedPlan,
            subtotalAmount: amount,
            discountAmount: 0,
            taxAmount: 0,
            shippingAmount: 0,
            totalAmount: amount,
            questionnaireAnswers,
            ...(validAffiliateId && { affiliateId: validAffiliateId }),
        });

        // Create order items
        const orderItems: any[] = [];
        for (const [productId, quantity] of Object.entries(selectedProducts)) {
            if (quantity && Number(quantity) > 0) {
                const product = treatment.products?.find((p) => p.id === productId);
                if (product) {
                    const orderItem = await OrderItem.create({
                        orderId: order.id,
                        productId: product.id,
                        quantity: Number(quantity),
                        unitPrice: product.price,
                        totalPrice: product.price * Number(quantity),
                        placeholderSig: product.placeholderSig,
                    });
                    orderItems.push(orderItem);
                }
            }
        }

        // Create shipping address if provided
        if (
            shippingInfo.address &&
            shippingInfo.city &&
            shippingInfo.state &&
            shippingInfo.zipCode
        ) {
            await ShippingAddress.create({
                orderId: order.id,
                address: shippingInfo.address,
                apartment: shippingInfo.apartment || null,
                city: shippingInfo.city,
                state: shippingInfo.state,
                zipCode: shippingInfo.zipCode,
                country: shippingInfo.country || "US",
            });
        }

        // Calculate distribution: platform fee (% of total), stripe fee, doctor flat, pharmacy wholesale, brand residual
        // If Clinic has a Stripe Connect account, we transfer only the brand residual to the clinic
        const fees = await useGlobalFees();
        
        // Get platform fee percent based on clinic's tier (or global fallback)
        const platformFeePercent = treatment.clinicId 
            ? await getPlatformFeePercent(treatment.clinicId)
            : fees.platformFeePercent;
        
        const stripeFeePercent = fees.stripeFeePercent;
        const doctorFlatUsd = fees.doctorFlatFeeUsd;

        let brandAmountUsd = 0;
        let pharmacyWholesaleTotal = 0;
        let platformFeeUsd = 0;
        let stripeFeeUsd = 0;
        try {
            // Sum wholesale cost from treatment products aligned with selectedProducts
            if (treatment.products && selectedProducts) {
                for (const [productId, qty] of Object.entries(
                    selectedProducts as Record<string, any>
                )) {
                    const product = treatment.products.find(
                        (p: any) => p.id === productId
                    );
                    if (!product) continue;
                    const quantity = Number(qty) || 0;
                    const wholesale = Number((product as any).pharmacyWholesaleCost || 0);
                    pharmacyWholesaleTotal += wholesale * quantity;
                }
            }
            const totalPaid = Number(amount) || 0;
            platformFeeUsd = Math.max(0, (platformFeePercent / 100) * totalPaid);
            stripeFeeUsd = Math.max(0, (stripeFeePercent / 100) * totalPaid);
            const doctorUsd = Math.max(0, doctorFlatUsd);
            brandAmountUsd = Math.max(
                0,
                totalPaid -
                platformFeeUsd -
                stripeFeeUsd -
                doctorUsd -
                pharmacyWholesaleTotal
            );
        } catch (e) {
            if (process.env.NODE_ENV === "development") {
                console.warn(
                    "⚠️ Failed to compute brandAmountUsd, defaulting to 0:",
                    e
                );
            } else {
                console.warn("⚠️ Failed to compute brandAmountUsd, defaulting to 0:");
            }

            brandAmountUsd = 0;
        }

        // Resolve clinic's Stripe account (via treatment.clinicId if present)
        let transferData: any = undefined;
        try {
            const treatmentWithClinic = await Treatment.findByPk(treatmentId, {
                include: [{ model: Clinic, as: "clinic" }] as any,
            });
            const clinicStripeAccountId = (treatmentWithClinic as any)?.clinic
                ?.stripeAccountId;
            if (clinicStripeAccountId && brandAmountUsd > 0) {
                transferData = {
                    destination: clinicStripeAccountId,
                    amount: Math.round(brandAmountUsd * 100), // cents
                };
            }
        } catch (e) {
            if (process.env.NODE_ENV === "development") {
                console.warn(
                    "⚠️ Could not resolve clinic Stripe account for transfer_data:",
                    e
                );
            } else {
                console.warn(
                    "⚠️ Could not resolve clinic Stripe account for transfer_data:"
                );
            }
        }

        // Persist payout breakdown on Order
        try {
            await order.update({
                platformFeeAmount: platformFeeUsd,
                platformFeePercent: Number(platformFeePercent.toFixed(2)),
                stripeAmount: Number(stripeFeeUsd.toFixed(2)),
                doctorAmount: Number(doctorFlatUsd.toFixed(2)),
                pharmacyWholesaleAmount: Number(pharmacyWholesaleTotal.toFixed(2)),
                brandAmount: Number(brandAmountUsd.toFixed(2)),
            });
        } catch (e) {
            if (process.env.NODE_ENV === "development") {
                console.warn("⚠️ Failed to persist payout breakdown on Order:", e);
            } else {
                console.warn("⚠️ Failed to persist payout breakdown on Order:");
            }
        }

        // Create payment intent with optional transfer_data to send clinic margin
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency,
                metadata: {
                    userId: currentUser.id,
                    treatmentId,
                    orderId: order.id,
                    orderNumber: orderNumber,
                    selectedProducts: JSON.stringify(selectedProducts),
                    selectedPlan,
                    orderType: "treatment_order",
                    brandAmountUsd: brandAmountUsd.toFixed(2),
                    platformFeePercent: String(platformFeePercent),
                    platformFeeUsd: platformFeeUsd.toFixed(2),
                    doctorFlatUsd: doctorFlatUsd.toFixed(2),
                    pharmacyWholesaleTotalUsd: pharmacyWholesaleTotal.toFixed(2),
                },
                description: `Order ${orderNumber} - ${treatment.name}`,
                ...(transferData ? { transfer_data: transferData } : {}),
            });
        } catch (stripeError: any) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Stripe payment intent creation failed:", stripeError);
            } else {
                console.error("❌ Stripe payment intent creation failed:");
            }

            // Mark order as failed
            await order.update({ status: "failed" });

            return res.status(500).json({
                error: "stripe_payment_intent_failed",
                message:
                    stripeError.message || "Failed to create payment intent with Stripe",
                details: stripeError.type || "unknown_error",
            });
        }

        // Create payment record
        await Payment.create({
            orderId: order.id,
            stripePaymentIntentId: paymentIntent.id,
            status: "pending",
            paymentMethod: "card",
            amount,
            currency: currency.toUpperCase(),
        });

        console.log("💳 Order and payment intent created:", {
            orderId: order.id,
            orderNumber: orderNumber,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            userId: currentUser.id,
        });

        res.status(200).json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                orderId: order.id,
                orderNumber: orderNumber,
            },
        });
    } catch (error) {
        // HIPAA: Do not log detailed errors in production
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error creating order and payment intent:", error);
        } else {
            console.error("❌ Error creating order and payment intent");
        }

        // Log specific error details for debugging
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }

        // Check if it's a Stripe error
        if (error && typeof error === "object" && "type" in error) {
            console.error("Stripe error type:", (error as any).type);
            console.error("Stripe error code:", (error as any).code);
        }

        res.status(500).json({
            success: false,
            message: "Failed to create order and payment intent",
            error:
                process.env.NODE_ENV === "development"
                    ? error instanceof Error
                        ? error.message
                        : String(error)
                    : undefined,
        });
    }
}

export const getOrdersById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUser = getCurrentUser(req);
        // HIPAA: Wrap all order logging in development check
        if (process.env.NODE_ENV === "development") {
            console.log("🔍 [ORDERS/:ID] Request received");
            console.log("🔍 [ORDERS/:ID] Order ID:", id);
        }

        if (!currentUser) {
            console.log("❌ [ORDERS/:ID] No current user found");
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        // Fetch full user data from database to get clinicId
        console.log("🔍 [ORDERS/:ID] Fetching user from database...");
        const user = await User.findByPk(currentUser.id, {
            include: [{ model: UserRoles, as: "userRoles", required: false }],
        });

        if (!user) {
            console.log("❌ [ORDERS/:ID] User not found in database");
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // SECURITY: Never log PHI (email is PHI under HIPAA)
        console.log("🔍 [ORDERS/:ID] User found:", {
            id: user.id,
            role: user.role,
            clinicId: user.clinicId,
            // email removed - PHI must not be logged
        });

        let whereClause: any = { id };
        let accessType = "unknown";

        // If user is a patient, only allow access to their own orders
        if (user.hasRoleSync("patient")) {
            whereClause.userId = currentUser.id;
            accessType = "patient_own_orders";
            console.log("🔍 [ORDERS/:ID] Patient access - restricting to own orders");
        } else if (user.hasAnyRoleSync(["doctor", "brand"])) {
            const activeRoles = user.userRoles?.getActiveRoles() || [user.role];
            accessType = "clinic_access";
            console.log(
                `🔍 [ORDERS/:ID] ${activeRoles.join("/").toUpperCase()} access - checking order belongs to clinic`
            );

            // For doctors and brand users, find the order and check if it belongs to their clinic
            console.log("🔍 [ORDERS/:ID] Finding order by ID...");
            const order = await Order.findByPk(id);

            if (!order) {
                console.log("❌ [ORDERS/:ID] Order not found by ID:", id);
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            console.log("🔍 [ORDERS/:ID] Order found:", {
                id: order.id,
                userId: order.userId,
                treatmentId: order.treatmentId,
                status: order.status,
            });

            // Get the treatment to find the clinic
            console.log("🔍 [ORDERS/:ID] Finding treatment for order...");
            const treatment = await Treatment.findByPk(order.treatmentId);

            if (!treatment) {
                console.log(
                    "❌ [ORDERS/:ID] Treatment not found for order:",
                    order.treatmentId
                );
                return res.status(404).json({
                    success: false,
                    message: "Treatment not found",
                });
            }

            console.log("🔍 [ORDERS/:ID] Treatment found:", {
                id: treatment.id,
                name: treatment.name,
                clinicId: treatment.clinicId,
            });

            // Check if the treatment belongs to the user's clinic
            console.log("🔍 [ORDERS/:ID] Checking clinic access...");
            console.log("🔍 [ORDERS/:ID] User clinicId:", user.clinicId);
            console.log("🔍 [ORDERS/:ID] Treatment clinicId:", treatment.clinicId);

            if (treatment.clinicId !== user.clinicId) {
                console.log("❌ [ORDERS/:ID] Access denied - clinic mismatch");
                return res.status(403).json({
                    success: false,
                    message: "Access denied",
                });
            }

            console.log(
                `✅ [ORDERS/:ID] ${user.role.toUpperCase()} clinic access granted`
            );
        } else {
            console.log(`❌ [ORDERS/:ID] Unsupported role: ${user.role}`);
            return res.status(403).json({
                success: false,
                message: `Access denied for role: ${user.role}. Only patients, doctors, and brands can access orders.`,
            });
        }

        console.log(
            "🔍 [ORDERS/:ID] Executing final query with whereClause:",
            whereClause
        );
        console.log("🔍 [ORDERS/:ID] Access type:", accessType);

        const order = await Order.findOne({
            where: whereClause,
            include: [
                {
                    model: OrderItem,
                    as: "orderItems",
                    include: [{ model: Product, as: "product" }],
                },
                {
                    model: Payment,
                    as: "payment",
                },
                {
                    model: ShippingAddress,
                    as: "shippingAddress",
                },
                {
                    model: Treatment,
                    as: "treatment",
                },
                {
                    model: ShippingOrder,
                    as: "shippingOrders",
                },
                {
                    model: User,
                    as: "user",
                },
            ],
        });

        if (!order) {
            console.log("❌ [ORDERS/:ID] Order not found after final query");
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Log order clinicId for redirect debugging
        if (process.env.NODE_ENV === 'development') {
            const orderJson = order.toJSON();
            console.log('[ORDERS/:ID] Order retrieved for redirect:', {
                orderId: order.id,
                orderNumber: (order as any).orderNumber,
                clinicId: (order as any).clinicId || orderJson.clinicId,
                userId: order.userId,
            });
        }

        // Fetch prescriptions for this order (created around the same time)
        const prescriptions = await Prescription.findAll({
            where: {
                patientId: order.userId,
                name: {
                    [Op.like]: `%${order.orderNumber}%`,
                },
            },
            include: [
                {
                    model: PrescriptionProducts,
                    as: "prescriptionProducts",
                    include: [
                        {
                            model: Product,
                            as: "product",
                        },
                    ],
                },
                {
                    model: User,
                    as: "doctor",
                    attributes: ["id", "firstName", "lastName"],
                },
                {
                    model: PrescriptionExtension,
                    as: "extensions",
                    required: false,
                },
            ],
        });

        // HIPAA Audit: Log PHI access (order contains patient name, address, medications)
        await AuditService.logOrderView(req, order.id);

        console.log("✅ [ORDERS/:ID] Order successfully retrieved and returned");
        res.status(200).json({
            success: true,
            data: {
                ...order.toJSON(),
                prescriptions,
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ [ORDERS/:ID] Exception occurred:", error);
            console.error(
                "❌ [ORDERS/:ID] Error type:",
                error instanceof Error ? error.constructor.name : "Unknown"
            );
            console.error(
                "❌ [ORDERS/:ID] Error message:",
                error instanceof Error ? error.message : String(error)
            );
            console.error(
                "❌ [ORDERS/:ID] Error stack:",
                error instanceof Error ? error.stack : "No stack trace"
            );
        } else {
            console.error("❌ [ORDERS/:ID] Exception occurred:");
            console.error("❌ [ORDERS/:ID] Error type:");
            console.error("❌ [ORDERS/:ID] Error message:");
            console.error("❌ [ORDERS/:ID] Error stack:");
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch order",
            error:
                process.env.NODE_ENV === "development" && error instanceof Error
                    ? error.message
                    : undefined,
        });
    }
}

export const getOrdersByClinicId = async (req: Request, res: Response) => {
    try {
        const { clinicId } = req.params;
        const { page, limit } = req.query;
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const paginationParams = {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
        };
    
        const result = await orderService.listOrdersByClinic(
          clinicId,
          currentUser.id,
          paginationParams
        );
    
        if (result.success) {
          // HIPAA Audit: Log bulk PHI access (viewing all orders for a clinic)
          await AuditService.logFromRequest(req, {
            action: AuditAction.VIEW,
            resourceType: AuditResourceType.ORDER,
            details: { bulkAccess: true, clinicId },
          });
          res.status(200).json(result);
        } else {
          if (result.message === "Forbidden") {
            res.status(403).json(result);
          } else {
            res.status(400).json(result);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error listing orders by clinic:", error);
        } else {
          console.error("❌ Error listing orders by clinic");
        }
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
}