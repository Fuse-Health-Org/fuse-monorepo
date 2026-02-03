import { getCurrentUser } from "@/config/jwt";
import Clinic from "@/models/Clinic";
import Order from "@/models/Order";
import Payment, { PaymentGoesTo } from "@/models/Payment";
import Physician from "@/models/Physician";
import User from "@/models/User";
import UserRoles from "@/models/UserRoles";
import { Request, Response } from "express";
import { Op } from "sequelize";

export const getTenantPayouts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        // Only tenant managers should access this endpoint
        // Check if user has tenant management role
        const user = await User.findByPk(currentUser.id, {
            include: [{ model: UserRoles, as: "userRoles" }],
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // For now, allow access to any authenticated user
        // TODO: Add proper tenant management role check

        const { dateFrom, dateTo, page = "1", limit = "50" } = req.query;

        const whereClause: any = {
            status: {
                [Op.in]: ["paid", "processing", "shipped", "delivered"],
            },
        };

        if (dateFrom) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.gte]: new Date(dateFrom as string),
            };
        }

        if (dateTo) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.lte]: new Date(dateTo as string),
            };
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Get count separately to avoid issues with multiple User associations
        const total = await Order.count({
            where: whereClause,
            distinct: true,
            col: "id",
        });

        const orders = await Order.findAll({
            where: whereClause,
            attributes: [
                "id",
                "orderNumber",
                "status",
                "totalAmount",
                "platformFeeAmount",
                "doctorAmount",
                "pharmacyWholesaleAmount",
                "brandAmount",
                "stripeAmount",
                "createdAt",
                "clinicId",
                "physicianId",
                "affiliateId",
                "approvedByDoctorId",
            ],
            include: [
                {
                    model: Clinic,
                    as: "clinic",
                    attributes: ["id", "name", "slug"],
                    required: false,
                },
                {
                    model: Physician,
                    as: "physician",
                    attributes: ["id", "firstName", "lastName", "email"],
                    required: false,
                },
                {
                    model: User,
                    as: "affiliate",
                    attributes: ["id", "firstName", "lastName", "email"],
                    required: false,
                },
                {
                    model: User,
                    as: "approvedByDoctorUser",
                    attributes: ["id", "firstName", "lastName", "email"],
                    required: false,
                },
                {
                    model: Payment,
                    as: "payment",
                    attributes: ["status", "paidAt"],
                    required: false,
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
        });

        // Aggregate payouts by recipient type
        const payouts = {
            brands: {} as Record<string, any>,
            doctors: {} as Record<string, any>,
            pharmacies: {} as Record<string, any>,
            affiliates: {} as Record<string, any>,
            totals: {
                totalBrandAmount: 0,
                totalDoctorAmount: 0,
                totalPharmacyAmount: 0,
                totalAffiliateAmount: 0,
                totalPlatformFee: 0,
            },
        };

        orders.forEach((order: any) => {
            const orderData = order.toJSON();

            // Brand payouts
            if (orderData.brandAmount > 0 && orderData.clinicId) {
                const clinicKey = orderData.clinicId;
                if (!payouts.brands[clinicKey]) {
                    payouts.brands[clinicKey] = {
                        clinicId: clinicKey,
                        clinicName: orderData.clinic?.name || "Unknown",
                        clinicSlug: orderData.clinic?.slug || "",
                        totalAmount: 0,
                        orderCount: 0,
                        orders: [],
                    };
                }
                payouts.brands[clinicKey].totalAmount += parseFloat(orderData.brandAmount) || 0;
                payouts.brands[clinicKey].orderCount += 1;
                payouts.brands[clinicKey].orders.push({
                    orderId: orderData.id,
                    orderNumber: orderData.orderNumber,
                    amount: parseFloat(orderData.brandAmount) || 0,
                    date: orderData.createdAt,
                    status: orderData.status,
                    paymentStatus: orderData.payment?.status,
                });
                payouts.totals.totalBrandAmount += parseFloat(orderData.brandAmount) || 0;
            }

            // Doctor payouts - use approvedByDoctorId if available, otherwise fallback to physicianId
            if (orderData.doctorAmount > 0) {
                // Prioritize approvedByDoctorId over physicianId
                const doctorId = orderData.approvedByDoctorId || orderData.physicianId;
                if (doctorId) {
                    const doctorKey = doctorId;
                    if (!payouts.doctors[doctorKey]) {
                        // Use approvedByDoctorUser user data if available, otherwise use physician data
                        const doctorUser = orderData.approvedByDoctorUser;
                        const doctorPhysician = orderData.physician;
                        payouts.doctors[doctorKey] = {
                            doctorId: doctorKey,
                            doctorName: doctorUser
                                ? `${doctorUser.firstName || ""} ${doctorUser.lastName || ""}`.trim()
                                : doctorPhysician
                                    ? `${doctorPhysician.firstName || ""} ${doctorPhysician.lastName || ""}`.trim()
                                    : "Unknown",
                            doctorEmail: doctorUser?.email || doctorPhysician?.email || "",
                            totalAmount: 0,
                            orderCount: 0,
                            orders: [],
                        };
                    }
                    payouts.doctors[doctorKey].totalAmount += parseFloat(orderData.doctorAmount) || 0;
                    payouts.doctors[doctorKey].orderCount += 1;
                    payouts.doctors[doctorKey].orders.push({
                        orderId: orderData.id,
                        orderNumber: orderData.orderNumber,
                        amount: parseFloat(orderData.doctorAmount) || 0,
                        date: orderData.createdAt,
                        status: orderData.status,
                        paymentStatus: orderData.payment?.status,
                    });
                    payouts.totals.totalDoctorAmount += parseFloat(orderData.doctorAmount) || 0;
                }
            }

            // Pharmacy payouts
            if (orderData.pharmacyWholesaleAmount > 0) {
                const pharmacyKey = "pharmacy"; // Since we don't have pharmacyId in Order
                if (!payouts.pharmacies[pharmacyKey]) {
                    payouts.pharmacies[pharmacyKey] = {
                        pharmacyId: pharmacyKey,
                        pharmacyName: "Pharmacy",
                        totalAmount: 0,
                        orderCount: 0,
                        orders: [],
                    };
                }
                payouts.pharmacies[pharmacyKey].totalAmount += parseFloat(orderData.pharmacyWholesaleAmount) || 0;
                payouts.pharmacies[pharmacyKey].orderCount += 1;
                payouts.pharmacies[pharmacyKey].orders.push({
                    orderId: orderData.id,
                    orderNumber: orderData.orderNumber,
                    amount: parseFloat(orderData.pharmacyWholesaleAmount) || 0,
                    date: orderData.createdAt,
                    status: orderData.status,
                    paymentStatus: orderData.payment?.status,
                });
                payouts.totals.totalPharmacyAmount += parseFloat(orderData.pharmacyWholesaleAmount) || 0;
            }

            // Affiliate payouts
            if (orderData.affiliateId) {
                // Calculate affiliate commission using AFFILIATE_REVENUE_PERCENTAGE
                const affiliateRevenuePercentage = parseFloat(
                    process.env.AFFILIATE_REVENUE_PERCENTAGE || process.env["AFFILIATE-REVENUE-PERCENTAJE"] || "1"
                ) / 100;
                const orderTotal = parseFloat(orderData.totalAmount) || 0;
                const affiliateAmount = orderTotal * affiliateRevenuePercentage;

                const affiliateKey = orderData.affiliateId;
                if (!payouts.affiliates[affiliateKey]) {
                    payouts.affiliates[affiliateKey] = {
                        affiliateId: affiliateKey,
                        affiliateName: orderData.affiliate
                            ? `${orderData.affiliate.firstName || ""} ${orderData.affiliate.lastName || ""}`.trim()
                            : "Unknown",
                        affiliateEmail: orderData.affiliate?.email || "",
                        totalAmount: 0,
                        orderCount: 0,
                        orders: [],
                    };
                }
                payouts.affiliates[affiliateKey].totalAmount += Math.round(affiliateAmount * 100) / 100; // Round to 2 decimal places
                payouts.affiliates[affiliateKey].orderCount += 1;
                payouts.affiliates[affiliateKey].orders.push({
                    orderId: orderData.id,
                    orderNumber: orderData.orderNumber,
                    amount: Math.round(affiliateAmount * 100) / 100,
                    date: orderData.createdAt,
                    status: orderData.status,
                    paymentStatus: orderData.payment?.status,
                });
                payouts.totals.totalAffiliateAmount += Math.round(affiliateAmount * 100) / 100;
            }

            payouts.totals.totalPlatformFee += parseFloat(orderData.platformFeeAmount) || 0;
        });

        // Convert objects to arrays
        const result = {
            brands: Object.values(payouts.brands),
            doctors: Object.values(payouts.doctors),
            pharmacies: Object.values(payouts.pharmacies),
            affiliates: Object.values(payouts.affiliates),
            totals: payouts.totals,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching tenant payouts:", error);
        } else {
            console.error("❌ Error fetching tenant payouts");
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getBrandPayouts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user || !user.clinicId) {
            return res.status(403).json({
                success: false,
                message: "User does not have a clinic associated",
            });
        }

        const { dateFrom, dateTo, page = "1", limit = "50" } = req.query;

        const whereClause: any = {
            paymentGoesTo: PaymentGoesTo.BRAND,
            status: {
                [Op.in]: ["succeeded", "processing"],
            },
        };

        if (dateFrom) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.gte]: new Date(dateFrom as string),
            };
        }

        if (dateTo) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.lte]: new Date(dateTo as string),
            };
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Get payments that go to this brand
        // Filter by clinic's stripeAccountId in metadata or by order's clinicId
        const { rows: payments, count: total } = await Payment.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Order,
                    as: "order",
                    where: {
                        clinicId: user.clinicId,
                    },
                    required: false,
                    attributes: [
                        "id",
                        "orderNumber",
                        "status",
                        "totalAmount",
                        "brandAmount",
                        "createdAt",
                    ],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "firstName", "lastName", "email"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
            distinct: true,
        });

        // Filter payments that are associated with this brand's clinic
        // Either through order.clinicId or through metadata.destination matching clinic's stripeAccountId
        const clinic = await Clinic.findByPk(user.clinicId);
        const payouts = payments
            .filter((payment: any) => {
                const paymentData = payment.toJSON();
                // If payment has an order with matching clinicId
                if (paymentData.order && paymentData.order.clinicId === user.clinicId) {
                    return true;
                }
                // If payment metadata has destination matching clinic's stripeAccountId
                if (
                    clinic?.stripeAccountId &&
                    paymentData.stripeMetadata?.destination === clinic.stripeAccountId
                ) {
                    return true;
                }
                return false;
            })
            .map((payment: any) => {
                const paymentData = payment.toJSON();
                const order = paymentData.order;
                return {
                    paymentId: paymentData.id,
                    orderId: order?.id || null,
                    orderNumber: order?.orderNumber || null,
                    amount: parseFloat(paymentData.amount) || 0,
                    totalAmount: order ? parseFloat(order.totalAmount) || 0 : parseFloat(paymentData.amount) || 0,
                    date: paymentData.createdAt,
                    status: paymentData.status,
                    paidAt: paymentData.paidAt,
                    stripePaymentIntentId: paymentData.stripePaymentIntentId,
                    customer: order?.user
                        ? {
                            name: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim(),
                            email: order.user.email,
                        }
                        : null,
                };
            });

        const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                payouts,
                summary: {
                    totalAmount,
                    totalOrders: payouts.length,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching brand payouts:", error);
        } else {
            console.error("❌ Error fetching brand payouts");
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getAffiliatePayouts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        const { dateFrom, dateTo, page = "1", limit = "50" } = req.query;

        const whereClause: any = {
            affiliateId: currentUser.id,
            status: {
                [Op.in]: ["paid", "processing", "shipped", "delivered"],
            },
        };

        if (dateFrom) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.gte]: new Date(dateFrom as string),
            };
        }

        if (dateTo) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.lte]: new Date(dateTo as string),
            };
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        const { rows: orders, count: total } = await Order.findAndCountAll({
            where: whereClause,
            attributes: [
                "id",
                "orderNumber",
                "status",
                "totalAmount",
                "createdAt",
            ],
            include: [
                {
                    model: Payment,
                    as: "payment",
                    attributes: ["status", "paidAt"],
                },
                {
                    model: Clinic,
                    as: "clinic",
                    attributes: ["id", "name", "slug"],
                },
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "firstName", "lastName", "email"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
            distinct: true,
        });

        // Calculate affiliate commission using AFFILIATE_REVENUE_PERCENTAGE
        const affiliateRevenuePercentage = parseFloat(
            process.env.AFFILIATE_REVENUE_PERCENTAGE || process.env["AFFILIATE-REVENUE-PERCENTAJE"] || "1"
        ) / 100;

        const payouts = orders.map((order: any) => {
            const orderData = order.toJSON();
            // Calculate affiliate commission as percentage of order total
            const orderTotal = parseFloat(orderData.totalAmount) || 0;
            const affiliateAmount = orderTotal * affiliateRevenuePercentage;

            return {
                orderId: orderData.id,
                orderNumber: orderData.orderNumber,
                amount: Math.round(affiliateAmount * 100) / 100, // Round to 2 decimal places
                totalAmount: orderTotal,
                date: orderData.createdAt,
                status: orderData.status,
                paymentStatus: orderData.payment?.status,
                paidAt: orderData.payment?.paidAt,
                brand: orderData.clinic
                    ? {
                        name: orderData.clinic.name,
                        slug: orderData.clinic.slug,
                    }
                    : null,
                customer: orderData.user
                    ? {
                        name: `${orderData.user.firstName || ""} ${orderData.user.lastName || ""}`.trim(),
                        email: orderData.user.email,
                    }
                    : null,
            };
        });

        const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                payouts,
                summary: {
                    totalAmount,
                    totalOrders: payouts.length,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching affiliate payouts:", error);
        } else {
            console.error("❌ Error fetching affiliate payouts");
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getDoctorPayouts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        const user = await User.findByPk(currentUser.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Only allow doctors to access their payouts
        if (user.role !== "doctor") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Doctor role required.",
            });
        }

        const { dateFrom, dateTo, page = "1", limit = "50" } = req.query;

        // Debug log in development
        if (process.env.NODE_ENV === "development") {
            console.log(`[PAYOUTS/DOCTOR] Fetching payouts for doctor:`, {
                doctorId: user.id,
                doctorEmail: user.email,
                role: user.role,
            });
        }

        const whereClause: any = {
            paymentGoesTo: PaymentGoesTo.DOCTOR,
            status: {
                [Op.in]: ["succeeded", "processing"],
            },
        };

        if (dateFrom) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.gte]: new Date(dateFrom as string),
            };
        }

        if (dateTo) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.lte]: new Date(dateTo as string),
            };
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Get payments that go to this doctor
        // Filter by order's approvedByDoctorId matching this doctor
        const { rows: payments, count: total } = await Payment.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Order,
                    as: "order",
                    where: {
                        approvedByDoctorId: user.id,
                    },
                    required: false,
                    attributes: [
                        "id",
                        "orderNumber",
                        "status",
                        "totalAmount",
                        "doctorAmount",
                        "createdAt",
                        "approvedByDoctorId",
                    ],
                    include: [
                        {
                            model: Clinic,
                            as: "clinic",
                            attributes: ["id", "name", "slug"],
                            required: false,
                        },
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "firstName", "lastName", "email"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
            distinct: true,
        });

        // Filter payments that are associated with this doctor
        // Either through order.approvedByDoctorId or through metadata.doctorId
        const payouts = payments
            .filter((payment: any) => {
                const paymentData = payment.toJSON();
                // If payment has an order with matching approvedByDoctorId
                if (paymentData.order && paymentData.order.approvedByDoctorId === user.id) {
                    return true;
                }
                // If payment metadata has doctorId matching this doctor
                if (paymentData.stripeMetadata?.doctorId === user.id) {
                    return true;
                }
                return false;
            })
            .map((payment: any) => {
                const paymentData = payment.toJSON();
                const order = paymentData.order;
                return {
                    paymentId: paymentData.id,
                    orderId: order?.id || null,
                    orderNumber: order?.orderNumber || null,
                    amount: parseFloat(paymentData.amount) || 0,
                    totalAmount: order ? parseFloat(order.totalAmount) || 0 : parseFloat(paymentData.amount) || 0,
                    date: paymentData.createdAt,
                    status: paymentData.status,
                    paidAt: paymentData.paidAt,
                    stripePaymentIntentId: paymentData.stripePaymentIntentId,
                    brand: order?.clinic
                        ? {
                            name: order.clinic.name,
                            slug: order.clinic.slug,
                        }
                        : null,
                    customer: order?.user
                        ? {
                            name: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim(),
                            email: order.user.email,
                        }
                        : null,
                };
            });

        const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                payouts,
                summary: {
                    totalAmount,
                    totalOrders: payouts.length,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching doctor payouts:", error);
        } else {
            console.error("❌ Error fetching doctor payouts");
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getPharmacyPayouts = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated",
            });
        }

        const { dateFrom, dateTo, page = "1", limit = "50" } = req.query;

        const whereClause: any = {
            paymentGoesTo: PaymentGoesTo.PHARMACY,
            status: {
                [Op.in]: ["succeeded", "processing"],
            },
        };

        if (dateFrom) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.gte]: new Date(dateFrom as string),
            };
        }

        if (dateTo) {
            whereClause.createdAt = {
                ...whereClause.createdAt,
                [Op.lte]: new Date(dateTo as string),
            };
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Get payments that go to pharmacy
        const { rows: payments, count: total } = await Payment.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Order,
                    as: "order",
                    required: false,
                    attributes: [
                        "id",
                        "orderNumber",
                        "status",
                        "totalAmount",
                        "pharmacyWholesaleAmount",
                        "createdAt",
                    ],
                    include: [
                        {
                            model: Clinic,
                            as: "clinic",
                            attributes: ["id", "name", "slug"],
                            required: false,
                        },
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "firstName", "lastName", "email"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
            distinct: true,
        });

        const payouts = payments.map((payment: any) => {
            const paymentData = payment.toJSON();
            const order = paymentData.order;
            return {
                paymentId: paymentData.id,
                orderId: order?.id || null,
                orderNumber: order?.orderNumber || null,
                amount: parseFloat(paymentData.amount) || 0,
                totalAmount: order ? parseFloat(order.totalAmount) || 0 : parseFloat(paymentData.amount) || 0,
                date: paymentData.createdAt,
                status: paymentData.status,
                paidAt: paymentData.paidAt,
                stripePaymentIntentId: paymentData.stripePaymentIntentId,
                brand: order?.clinic
                    ? {
                        name: order.clinic.name,
                        slug: order.clinic.slug,
                    }
                    : null,
                customer: order?.user
                    ? {
                        name: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim(),
                        email: order.user.email,
                    }
                    : null,
            };
        });

        const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                payouts,
                summary: {
                    totalAmount,
                    totalOrders: payouts.length,
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching pharmacy payouts:", error);
        } else {
            console.error("❌ Error fetching pharmacy payouts");
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}