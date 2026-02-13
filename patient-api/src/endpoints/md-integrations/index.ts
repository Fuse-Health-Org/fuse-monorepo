import { Express } from "express";
import { MedicalCompanySlug } from "@fuse/enums";

// ============= MD INTEGRATIONS ENDPOINTS =============
// All MD Integrations (MDI) related endpoints for patient portal and admin

export function registerMDIntegrationsEndpoints(
    app: Express,
    authenticateJWT: any,
    getCurrentUser: any
) {
    // Import services
    const MDFilesService = require("../../services/mdIntegration/MDFiles.service").default;
    const { AuditService, AuditAction, AuditResourceType } = require("../../services/audit.service");
    const User = require("../../models/User").default;
    const Order = require("../../models/Order").default;
    const Clinic = require("../../models/Clinic").default;
    const TenantProduct = require("../../models/TenantProduct").default;
    const Product = require("../../models/Product").default;
    const UserService = require("../../services/user.service").default;

    // ============= FILE OPERATIONS =============

    // Get MD file by ID
    app.get("/md-files/:fileId", authenticateJWT, async (req, res) => {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    message: "File ID is required",
                });
            }

            const file = await MDFilesService.getFile(fileId);

            // HIPAA Audit: Log medical document access
            await AuditService.logFromRequest(req, {
                action: AuditAction.VIEW,
                resourceType: AuditResourceType.DOCUMENT,
                resourceId: fileId,
            });

            res.json({
                success: true,
                data: file,
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error fetching file:", error);
            } else {
                console.error("❌ Error fetching file");
            }
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : "Failed to fetch file",
            });
        }
    });

    // Download MD file
    app.get("/md-files/:fileId/download", authenticateJWT, async (req, res) => {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    message: "File ID is required",
                });
            }

            // Get file metadata first
            const fileInfo = await MDFilesService.getFile(fileId);

            // Download file content
            const fileBuffer = await MDFilesService.downloadFile(fileId);

            // HIPAA Audit: Log medical document download
            await AuditService.logFromRequest(req, {
                action: AuditAction.EXPORT,
                resourceType: AuditResourceType.DOCUMENT,
                resourceId: fileId,
                details: { fileName: fileInfo.name, download: true },
            });

            res.set({
                "Content-Type": fileInfo.mime_type,
                "Content-Disposition": `attachment; filename="${fileInfo.name}"`,
            });

            res.send(fileBuffer);
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error downloading file:", error);
            } else {
                console.error("❌ Error downloading file");
            }
            res.status(500).json({
                success: false,
                message:
                    error instanceof Error ? error.message : "Failed to download file",
            });
        }
    });

    // Delete MD file
    app.delete("/md-files/:fileId", authenticateJWT, async (req, res) => {
        try {
            const { fileId } = req.params;

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    message: "File ID is required",
                });
            }

            await MDFilesService.deleteFile(fileId);

            res.json({
                success: true,
                message: "File deleted successfully",
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error deleting file:", error);
            } else {
                console.error("❌ Error deleting file");
            }
            res.status(500).json({
                success: false,
                message:
                    error instanceof Error ? error.message : "Failed to delete file",
            });
        }
    });

    // ============= PATIENT & CASES =============

    // Get current user's MD patient record
    app.get("/md/patient", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const user = await User.findByPk(currentUser.id);
            if (!user || !user.mdPatientId) {
                return res
                    .status(404)
                    .json({ success: false, message: "MD patient not found for user" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDPatientService = (
                await import("../../services/mdIntegration/MDPatient.service")
            ).default;

            const tokenResponse = await MDAuthService.generateToken();
            const patient = await MDPatientService.getPatient(
                user.mdPatientId,
                tokenResponse.access_token
            );

            // HIPAA Audit: Log PHI access (viewing telehealth patient record)
            await AuditService.logPatientView(req, currentUser.id, {
                mdPatientId: user.mdPatientId,
            });

            return res.json({ success: true, data: patient });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error fetching MD patient:", error);
            } else {
                console.error("❌ Error fetching MD patient");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch MD patient" });
        }
    });

    // Get MD case details by caseId
    app.get("/md/cases/:caseId", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { caseId } = req.params;
            if (!caseId) {
                return res
                    .status(400)
                    .json({ success: false, message: "caseId is required" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDCaseService = (
                await import("../../services/mdIntegration/MDCase.service")
            ).default;

            const tokenResponse = await MDAuthService.generateToken();
            const mdCase = await MDCaseService.getCase(
                caseId,
                tokenResponse.access_token
            ) as any;

            // Log MD case response to see available fields (dev only)
            if (process.env.NODE_ENV === "development") {
                console.log("[MD-CASE] Full case response fields:", Object.keys(mdCase || {}));
                console.log("[MD-CASE] Case status/hold fields:", {
                    status: mdCase?.status,
                    case_status: mdCase?.case_status,
                    hold_status: mdCase?.hold_status,
                    is_waiting: mdCase?.is_waiting,
                    waiting_for: mdCase?.waiting_for,
                    pending_requirements: mdCase?.pending_requirements,
                    requirements: mdCase?.requirements,
                });
            }

            // Also fetch patient data to check if driver's license / intro video is uploaded
            const MDPatientService = (
                await import("../../services/mdIntegration/MDPatient.service")
            ).default;

            let patientData: any = null;
            const patientId = mdCase?.patient?.patient_id || mdCase?.patient_id;
            if (patientId) {
                try {
                    patientData = await MDPatientService.getPatient(patientId, tokenResponse.access_token);
                    if (process.env.NODE_ENV === "development") {
                        console.log("[MD-CASE] Patient verification status:", {
                            patient_id: patientId,
                            has_driver_license: !!patientData?.driver_license,
                            has_intro_video: !!patientData?.intro_video,
                            auth_link: patientData?.auth_link,
                        });
                    }
                } catch (e) {
                    console.warn("[MD-CASE] Failed to fetch patient data:", e);
                }
            }

            // Also fetch stored prescriptions/offerings from our database
            const order = await Order.findOne({ where: { mdCaseId: caseId, userId: currentUser.id } });
            const storedPrescriptions = (order as any)?.mdPrescriptions || [];
            const storedOfferings = (order as any)?.mdOfferings || [];
            const storedPendingActions = (order as any)?.mdPendingActions || {};

            // Extract pending requirements from MD API response
            // MD may include status or requirements info in the case response
            const mdPendingRequirements: any = {};

            // Check various possible fields where MD might indicate pending requirements
            if (mdCase?.status === 'waiting' || mdCase?.case_status === 'waiting' || mdCase?.is_waiting) {
                // Case is waiting for something
                if (mdCase?.waiting_for === 'drivers_license' || mdCase?.waiting_for?.includes?.('license')) {
                    mdPendingRequirements.driversLicense = {
                        accessLink: mdCase?.drivers_license_url || mdCase?.verification_url || null,
                        requestedAt: mdCase?.updated_at || new Date().toISOString(),
                        fromApi: true,
                    };
                }
                if (mdCase?.waiting_for === 'intro_video' || mdCase?.waiting_for?.includes?.('video')) {
                    mdPendingRequirements.introVideo = {
                        accessLink: mdCase?.intro_video_url || mdCase?.video_url || null,
                        requestedAt: mdCase?.updated_at || new Date().toISOString(),
                        fromApi: true,
                    };
                }
            }

            // Check for explicit requirements array
            if (Array.isArray(mdCase?.requirements) || Array.isArray(mdCase?.pending_requirements)) {
                const reqs = mdCase?.requirements || mdCase?.pending_requirements || [];
                for (const req of reqs) {
                    const reqType = req?.type || req?.name || req;
                    if (typeof reqType === 'string') {
                        if (reqType.toLowerCase().includes('license') || reqType.toLowerCase().includes('id')) {
                            mdPendingRequirements.driversLicense = {
                                accessLink: req?.url || req?.access_link || null,
                                requestedAt: req?.created_at || new Date().toISOString(),
                                fromApi: true,
                            };
                        }
                        if (reqType.toLowerCase().includes('video')) {
                            mdPendingRequirements.introVideo = {
                                accessLink: req?.url || req?.access_link || null,
                                requestedAt: req?.created_at || new Date().toISOString(),
                                fromApi: true,
                            };
                        }
                    }
                }
            }

            // Check patient data for missing verification
            // If driver_license or intro_video is null but was requested, show as pending
            if (patientData) {
                // If patient has no driver's license uploaded and we have an auth link or webhook data
                if (!patientData.driver_license && !mdPendingRequirements.driversLicense) {
                    // Check if there's an auth_link from patient data we can use
                    if (patientData.auth_link || storedPendingActions.driversLicense?.accessLink) {
                        mdPendingRequirements.driversLicense = {
                            accessLink: storedPendingActions.driversLicense?.accessLink || patientData.auth_link,
                            requestedAt: storedPendingActions.driversLicense?.requestedAt || new Date().toISOString(),
                            fromApi: true,
                            missingVerification: true,
                        };
                    }
                }
                // Similarly for intro video
                if (!patientData.intro_video && !mdPendingRequirements.introVideo) {
                    if (storedPendingActions.introVideo?.accessLink) {
                        mdPendingRequirements.introVideo = {
                            accessLink: storedPendingActions.introVideo.accessLink,
                            requestedAt: storedPendingActions.introVideo.requestedAt || new Date().toISOString(),
                            fromApi: true,
                            missingVerification: true,
                        };
                    }
                }
            }

            // Merge: prefer webhook-stored data (has access link), fall back to API data
            const pendingActions = {
                driversLicense: storedPendingActions.driversLicense || mdPendingRequirements.driversLicense || null,
                introVideo: storedPendingActions.introVideo || mdPendingRequirements.introVideo || null,
            };

            // Only include if there's actually something pending
            const hasPendingActions = pendingActions.driversLicense || pendingActions.introVideo;

            // HIPAA Audit: Log PHI access (viewing telehealth case details)
            await AuditService.logFromRequest(req, {
                action: AuditAction.VIEW,
                resourceType: AuditResourceType.PRESCRIPTION,
                resourceId: caseId,
                details: { mdCase: true },
            });

            return res.json({
                success: true,
                data: {
                    ...mdCase,
                    // Include stored data from our database (from webhooks)
                    storedPrescriptions,
                    storedOfferings,
                    orderNumber: (order as any)?.orderNumber,
                    orderStatus: (order as any)?.status,
                    approvedByDoctor: (order as any)?.approvedByDoctor || false,
                    pendingActions: hasPendingActions ? pendingActions : null,
                }
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error fetching MD case:", error);
            } else {
                console.error("❌ Error fetching MD case");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch MD case" });
        }
    });

    // Get latest MD case for the current user (by most recent order with mdCaseId)
    app.get("/md/cases/latest", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const lastOrder = await Order.findOne({
                where: { userId: currentUser.id },
                order: [["createdAt", "DESC"]],
            } as any);

            if (!lastOrder || !(lastOrder as any).mdCaseId) {
                return res
                    .status(404)
                    .json({ success: false, message: "No MD case found for latest order" });
            }

            const caseId = (lastOrder as any).mdCaseId as string;
            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDCaseService = (
                await import("../../services/mdIntegration/MDCase.service")
            ).default;
            const tokenResponse = await MDAuthService.generateToken();
            const mdCase = await MDCaseService.getCase(
                caseId,
                tokenResponse.access_token
            );

            // HIPAA Audit: Log PHI access (viewing latest telehealth case)
            await AuditService.logFromRequest(req, {
                action: AuditAction.VIEW,
                resourceType: AuditResourceType.PRESCRIPTION,
                resourceId: caseId,
                details: { mdCase: true, latestCase: true },
            });

            return res.json({ success: true, data: mdCase });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error fetching latest MD case:", error);
            } else {
                console.error("❌ Error fetching latest MD case");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch latest MD case" });
        }
    });

    // Create an MD Integrations Case directly after checkout
    // Called from frontend after payment success for clinics using md-integrations dashboard format
    app.post("/md/cases", async (req, res) => {
        try {
            let currentUser: any = null;
            try {
                currentUser = getCurrentUser(req);
            } catch { }
            const { orderId, patientOverrides, clinicId } = req.body || {};

            if (!orderId || typeof orderId !== 'string') {
                return res.status(400).json({ success: false, message: "orderId is required" });
            }

            // Load order
            const order = await Order.findByPk(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            // Check if the clinic uses md-integrations dashboard format
            // Get clinic from order's user or from provided clinicId
            let clinic: any = null;
            if (clinicId) {
                clinic = await Clinic.findByPk(clinicId);
            } else if ((order as any).userId) {
                const orderUser = await User.findByPk((order as any).userId);
                if (orderUser && orderUser.clinicId) {
                    clinic = await Clinic.findByPk(orderUser.clinicId);
                }
            }

            // Skip MDI if clinic doesn't use md-integrations format
            if (!clinic || (clinic as any).patientPortalDashboardFormat !== MedicalCompanySlug.MD_INTEGRATIONS) {
                console.log('ℹ️ Skipping MD Integrations - clinic uses fuse dashboard format');
                return res.json({
                    success: true,
                    message: 'MD Integrations skipped (clinic uses fuse format)',
                    data: { skipped: true }
                });
            }

            console.log('🏥 Processing MD Integrations for clinic:', clinic.name);

            // If no authenticated user, infer from order
            if (!currentUser) {
                const ownerUser = await User.findByPk((order as any).userId);
                if (!ownerUser) {
                    return res.status(404).json({ success: false, message: "User not found for order" });
                }
                currentUser = ownerUser;
            } else {
                // If authenticated, ensure access to order
                if ((order as any).userId !== currentUser.id) {
                    return res.status(403).json({ success: false, message: "Forbidden" });
                }
            }

            // If case already exists, return early
            if ((order as any).mdCaseId) {
                return res.json({ success: true, message: 'MD case already exists', data: { caseId: (order as any).mdCaseId } });
            }

            // Ensure user exists and has mdPatientId
            const user = await User.findByPk(currentUser.id);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            // Attempt to populate missing fields from questionnaire answers before syncing
            try {
                const qa = ((order as any).questionnaireAnswers || {}) as Record<string, any>;
                const keys = Object.keys(qa);
                const findAnswer = (substrs: string[]): string | undefined => {
                    const key = keys.find(k => substrs.some(s => k.toLowerCase().includes(s)));
                    const val = key ? qa[key] : undefined;
                    return typeof val === 'string' ? val : (val != null ? String(val) : undefined);
                };

                const dob = findAnswer(['date of birth', 'dob', 'birth']);
                const genderAns = findAnswer(['gender', 'sex']);
                const phoneAns = findAnswer(['mobile', 'phone']);
                const firstNameAns = findAnswer(['first name']);
                const lastNameAns = findAnswer(['last name']);
                const emailAns = findAnswer(['email']);

                if (process.env.NODE_ENV === 'development') {
                    console.log('MD Case: extracted fields from QA', {
                        hasDob: Boolean(dob),
                        hasGender: Boolean(genderAns),
                        hasPhone: Boolean(phoneAns)
                    });
                }

                const updatePayload: Partial<typeof User> = {} as any;
                if (!user.dob && dob) (updatePayload as any).dob = dob;
                if (!user.gender && genderAns) (updatePayload as any).gender = String(genderAns).toLowerCase();
                if (!user.phoneNumber && phoneAns) (updatePayload as any).phoneNumber = phoneAns;
                if (!user.firstName && firstNameAns) (updatePayload as any).firstName = firstNameAns;
                if (!user.lastName && lastNameAns) (updatePayload as any).lastName = lastNameAns;
                if (!user.email && emailAns) (updatePayload as any).email = emailAns;

                // Apply explicit overrides from client (takes precedence)
                if (patientOverrides && typeof patientOverrides === 'object') {
                    const { firstName, lastName, email, dob: dobOv, gender: genderOv, phoneNumber: phoneOv } = patientOverrides as any;
                    if (firstName) (updatePayload as any).firstName = String(firstName);
                    if (lastName) (updatePayload as any).lastName = String(lastName);
                    if (email) (updatePayload as any).email = String(email);
                    if (dobOv) (updatePayload as any).dob = String(dobOv);
                    if (genderOv) (updatePayload as any).gender = String(genderOv).toLowerCase();
                    if (phoneOv) (updatePayload as any).phoneNumber = String(phoneOv);
                }

                if (Object.keys(updatePayload).length > 0) {
                    await user.update(updatePayload);
                    await user.reload();
                }

                // Step 2: Sync patient with MD Integrations (creates mdPatientId if doesn't exist)
                // This performs: POST /partner/patients if mdPatientId is missing
                // OR: PATCH /partner/patients/{id} if mdPatientId exists
                const userService = new UserService();

                if (process.env.NODE_ENV === 'development') {
                    console.log('[MD-CASE] Starting patient sync:', {
                        userId: user.id,
                        hasMdPatientId: Boolean(user.mdPatientId),
                        hasDob: Boolean(user.dob),
                        hasGender: Boolean(user.gender),
                        hasPhone: Boolean(user.phoneNumber),
                        hasShippingAddressId: Boolean((order as any).shippingAddressId),
                    });
                }

                const syncedUser = await userService.syncPatientInMD(user.id, (order as any).shippingAddressId);

                if (!syncedUser) {
                    const errorDetails = {
                        userId: user.id,
                        hasDob: Boolean(user.dob),
                        hasGender: Boolean(user.gender),
                        hasPhone: Boolean(user.phoneNumber),
                        hasShippingAddressId: Boolean((order as any).shippingAddressId),
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                    };
                    console.error('[MD-CASE] ❌ syncPatientInMD returned null', errorDetails);
                    throw new Error(`Failed to sync patient with MD Integrations. Check server logs for details. User data: ${JSON.stringify(errorDetails)}`);
                }

                await user.reload();

                if (process.env.NODE_ENV === 'development') {
                    const wasNewPatient = !user.mdPatientId && syncedUser.mdPatientId;
                    console.log('[MD-CASE] ✅ Patient synced successfully:', {
                        wasNewPatient,
                        mdPatientId: syncedUser.mdPatientId || user.mdPatientId,
                        userId: user.id,
                    });
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                const errorStack = e instanceof Error ? e.stack : undefined;
                console.error('[MD-CASE] ⚠️ Could not enrich/sync patient before creating case:', {
                    error: errorMsg,
                    stack: errorStack,
                    userId: user.id,
                    hasDob: Boolean(user.dob),
                    hasGender: Boolean(user.gender),
                    hasPhone: Boolean(user.phoneNumber),
                    hasAddress: Boolean((order as any).shippingAddressId),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                });
                // Continue to validation - will fail with clear error message if mdPatientId missing
            }

            // Reload user one more time to ensure we have latest state
            await user.reload();

            if (!user.mdPatientId) {
                // Validate required fields and provide actionable details
                const missingOrInvalid: Record<string, string> = {};
                const isValidDate = (value?: string) => {
                    if (!value) return false;
                    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
                    if (!m) return false;
                    const year = Number(m[1]);
                    const month = Number(m[2]);
                    const day = Number(m[3]);
                    if (year < 1900 || year > new Date().getFullYear()) return false;
                    if (month < 1 || month > 12) return false;
                    if (day < 1 || day > 31) return false;
                    return true;
                };

                if (!user.firstName) missingOrInvalid.firstName = 'required';
                if (!user.lastName) missingOrInvalid.lastName = 'required';
                if (!user.email) missingOrInvalid.email = 'required';
                if (!user.dob || !isValidDate(user.dob as any)) missingOrInvalid.dob = 'required (YYYY-MM-DD, realistic)';
                if (!user.gender) missingOrInvalid.gender = 'required (male/female)';
                if (!user.phoneNumber) missingOrInvalid.phoneNumber = 'required (US format)';
                const hasShipping = Boolean((order as any).shippingAddressId);
                console.warn('MD Case: mdPatientId missing after sync', {
                    hasDob: Boolean(user.dob),
                    hasGender: Boolean(user.gender),
                    hasPhone: Boolean(user.phoneNumber),
                    hasShipping
                });
                return res.status(400).json({
                    success: false,
                    message: "User is not provisioned in MD Integrations (missing mdPatientId)",
                    details: {
                        hasDob: Boolean(user.dob),
                        hasGender: Boolean(user.gender),
                        hasPhone: Boolean(user.phoneNumber),
                        hasShipping,
                        missingOrInvalid
                    }
                });
            }

            // Resolve offering to use - priority: product.mdOfferingId > product.mdCaseId > config > sandbox default
            let offeringId: string | undefined;
            let offeringSource = 'none';

            // First, try to get offering from the product linked to this order
            try {
                if ((order as any).tenantProductId) {
                    const tenantProduct = await TenantProduct.findByPk((order as any).tenantProductId, {
                        include: [{ model: Product, as: 'product', required: false }] as any
                    } as any);
                    const product = tenantProduct && (tenantProduct as any).product;

                    // Check for new mdOfferingId field first
                    if (product && product.mdOfferingId) {
                        offeringId = product.mdOfferingId;
                        offeringSource = `product.mdOfferingId (${product.mdOfferingName || product.name})`;
                    }
                    // Fall back to legacy mdCaseId field
                    else if (product && product.mdCaseId) {
                        offeringId = product.mdCaseId;
                        offeringSource = 'product.mdCaseId (legacy)';
                    }
                }
            } catch (e) {
                console.warn('[MD-CASE] Error getting product offering:', e);
            }

            // Fall back to config default
            if (!offeringId) {
                try {
                    const mdConfig = (await import('../../services/mdIntegration/config')).mdIntegrationsConfig;
                    if (mdConfig.defaultOfferingId) {
                        offeringId = mdConfig.defaultOfferingId;
                        offeringSource = 'config.defaultOfferingId';
                    }
                } catch { }
            }

            // Fall back to sandbox default for development
            if (!offeringId && process.env.NODE_ENV !== 'production') {
                offeringId = '3c3d0118-e362-4466-9c92-d852720c5a41';
                offeringSource = 'sandbox default';
            }

            console.log('[MD-CASE] Resolved offering:', { offeringId: offeringId || 'none', source: offeringSource });

            if (!offeringId) {
                return res.status(400).json({
                    success: false,
                    message: "No offering_id configured. Please set MD_INTEGRATIONS_OFFERING_ID or configure offering in product.",
                    details: {
                        hint: "Offerings must be pre-configured in MD Integrations dashboard. Reference the offering_id here."
                    }
                });
            }

            // Build case questions from stored questionnaire answers
            const { extractCaseQuestions, extractRichCaseQuestions } = await import('../../utils/questionnaireAnswers');

            // Step 1: Generate access token (uses cached token if available)
            const MDAuthService = (await import('../../services/mdIntegration/MDAuth.service')).default;
            const MDCaseService = (await import('../../services/mdIntegration/MDCase.service')).default;

            const tokenResponse = await MDAuthService.generateToken();

            // Create case with minimal payload (patient_id + offering_id)
            // Questions will be posted separately after case creation for md-integrations source
            const casePayload: any = {
                patient_id: user.mdPatientId, // From step 2 (already synced via syncPatientInMD)
                metadata: `orderId: ${order.id}`, // Link back to internal order
                hold_status: false,
                case_offerings: [{ offering_id: offeringId }], // Pre-configured offering
            };

            if (process.env.NODE_ENV === 'development') {
                console.log('[MD-CASE] Creating case with payload:', JSON.stringify(casePayload, null, 2));
            }

            const caseResponse = await MDCaseService.createCase(casePayload, tokenResponse.access_token);
            const caseId = (caseResponse as any).case_id;

            // Store case_id in order for future reference and webhook processing
            await order.update({ mdCaseId: caseId });

            if (process.env.NODE_ENV === 'development') {
                console.log('[MD-CASE] ✅ Case created successfully:', {
                    caseId,
                    orderId: order.id,
                    patientId: user.mdPatientId
                });
            }

            // Post case questions individually after case creation
            // Check if the questionnaire is from md-integrations source
            let questionsResult: { posted: number; failed: number; errors: string[] } = { posted: 0, failed: 0, errors: [] };

            if ((order as any).questionnaireAnswers) {
                // Check medicalCompanySource from the questionnaire linked to this order
                let medicalCompanySource: string | null = null;
                try {
                    // Try to find the questionnaire through the order's product/treatment
                    if ((order as any).questionnaireId) {
                        const Questionnaire = (await import('../../models/Questionnaire')).default;
                        const questionnaire = await Questionnaire.findByPk((order as any).questionnaireId);
                        if (questionnaire) {
                            medicalCompanySource = questionnaire.medicalCompanySource;
                        }
                    }
                    // If not found via questionnaireId, try through tenantProduct
                    if (!medicalCompanySource && (order as any).tenantProductId) {
                        const TenantProduct = (await import('../../models/TenantProduct')).default;
                        const Questionnaire = (await import('../../models/Questionnaire')).default;
                        const tp = await TenantProduct.findByPk((order as any).tenantProductId);
                        if (tp && (tp as any).productId) {
                            const q = await Questionnaire.findOne({ where: { productId: (tp as any).productId } });
                            if (q) {
                                medicalCompanySource = q.medicalCompanySource;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[MD-CASE] Could not determine medicalCompanySource:', e);
                }

                // Default to md-integrations if we can't determine source (clinic already confirmed as MDI)
                if (!medicalCompanySource) {
                    medicalCompanySource = 'md-integrations';
                }

                console.log('[MD-CASE] Questionnaire medicalCompanySource:', medicalCompanySource);

                if (medicalCompanySource === 'md-integrations') {
                    // Use rich format and post questions individually via POST /v1/partner/cases/:case_id/questions
                    const richQuestions = extractRichCaseQuestions((order as any).questionnaireAnswers);

                    if (richQuestions.length > 0) {
                        console.log(`[MD-CASE] Posting ${richQuestions.length} questions to case ${caseId} via individual POST endpoint`);
                        questionsResult = await MDCaseService.postCaseQuestions(caseId, richQuestions, tokenResponse.access_token);
                        console.log(`[MD-CASE] Questions posted: ${questionsResult.posted} success, ${questionsResult.failed} failed`);
                    }
                } else {
                    // For non-MDI sources, use the basic format (backward compatible)
                    const basicQuestions = extractCaseQuestions((order as any).questionnaireAnswers);
                    if (basicQuestions.length > 0) {
                        console.log(`[MD-CASE] Posting ${basicQuestions.length} basic questions to case ${caseId}`);
                        questionsResult = await MDCaseService.postCaseQuestions(caseId, basicQuestions, tokenResponse.access_token);
                        console.log(`[MD-CASE] Questions posted: ${questionsResult.posted} success, ${questionsResult.failed} failed`);
                    }
                }
            }

            return res.json({
                success: true,
                message: 'MD Integrations case created successfully',
                data: {
                    caseId,
                    patientId: user.mdPatientId,
                    orderId: order.id,
                    questions: questionsResult
                }
            });
        } catch (error: any) {
            // Enhanced error handling with actionable error messages
            const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
            const errorDetails = error?.response?.data || {};

            if (process.env.NODE_ENV === "development") {
                console.error("[MD-CASE] ❌ Error creating MD case:", {
                    message: errorMessage,
                    details: errorDetails,
                    stack: error?.stack
                });
            } else {
                console.error("[MD-CASE] ❌ Error creating MD case:", errorMessage);
            }

            // Return appropriate status code based on error type
            const statusCode = error?.response?.status || 500;

            return res.status(statusCode).json({
                success: false,
                message: "Failed to create MD Integrations case",
                error: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { details: errorDetails } : {})
            });
        }
    });

    // Get offerings for a specific MD case
    app.get("/md/cases/:caseId/offerings", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res
                    .status(401)
                    .json({ success: false, message: "Unauthorized" });
            }

            const { caseId } = req.params as any;
            if (!caseId) {
                return res
                    .status(400)
                    .json({ success: false, message: "caseId is required" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDCaseService = (
                await import("../../services/mdIntegration/MDCase.service")
            ).default;
            const tokenResponse = await MDAuthService.generateToken();
            const offerings = await MDCaseService.getCaseOfferings(
                caseId,
                tokenResponse.access_token
            );

            return res.json({ success: true, data: offerings });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error fetching MD case offerings:", error);
            } else {
                console.error("❌ Error fetching MD case offerings");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch MD case offerings" });
        }
    });

    // ============= OFFERINGS & SYNC =============

    // List MD offerings for current user (approved and pending)
    app.get("/md/offerings", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res
                    .status(401)
                    .json({ success: false, message: "Unauthorized" });
            }

            const limit = Math.min(
                parseInt(String((req.query as any).limit || "50"), 10) || 50,
                200
            );
            const offset =
                parseInt(String((req.query as any).offset || "0"), 10) || 0;

            const orders = await Order.findAll({
                where: { userId: currentUser.id },
                order: [["createdAt", "DESC"]] as any,
                limit,
                offset,
            } as any);

            const flattened: any[] = [];
            for (const order of orders) {
                const mdCaseId = (order as any).mdCaseId;
                const mdOfferings = (order as any).mdOfferings as
                    | any[]
                    | null
                    | undefined;
                const tenantProduct = (order as any).tenantProduct;
                const questionnaireAnswers = (order as any).questionnaireAnswers;

                // Helper function to get product details from TenantProduct
                const getTenantProductDetails = async () => {
                    const tenantProductId = (order as any).tenantProductId;
                    if (!tenantProductId) return null;

                    try {
                        const tenantProduct = await TenantProduct.findByPk(
                            tenantProductId,
                            {
                                include: [
                                    {
                                        model: Product,
                                        as: "product",
                                    },
                                ],
                            }
                        );

                        if (!tenantProduct) return null;

                        const categories = Array.isArray(
                            (tenantProduct.product as any)?.categories
                        )
                            ? (tenantProduct.product as any).categories.filter(Boolean)
                            : [];

                        return {
                            id: tenantProduct.id,
                            name: tenantProduct.product?.name || "Product",
                            description: tenantProduct.product?.description || null,
                            placeholderSig: tenantProduct.product?.placeholderSig || null,
                            category: categories[0] ?? null,
                            categories,
                            stripePriceId: tenantProduct.stripePriceId || null,
                            isActive: tenantProduct.isActive ?? true,
                        };
                    } catch (error) {
                        if (process.env.NODE_ENV === "development") {
                            console.error("❌ Error fetching TenantProduct:", error);
                        } else {
                            console.error("❌ Error fetching TenantProduct");
                        }
                        return null;
                    }
                };

                // Helper function to process questionnaire answers
                const getQuestionnaireAnswers = () => {
                    if (!questionnaireAnswers) return null;

                    // Check if it's the new structured format (simplified check)
                    if (
                        questionnaireAnswers &&
                        typeof questionnaireAnswers === "object" &&
                        "answers" in questionnaireAnswers &&
                        "metadata" in questionnaireAnswers
                    ) {
                        return {
                            format: "structured",
                            answers: questionnaireAnswers.answers,
                            metadata: questionnaireAnswers.metadata,
                        };
                    } else {
                        return {
                            format: "legacy",
                            answers: questionnaireAnswers,
                        };
                    }
                };

                // Get TenantProduct details
                const tenantProductDetails = await getTenantProductDetails();
                const questionnaireAnswersData = getQuestionnaireAnswers();

                // Determine status and classification based on approvedByDoctor field
                const orderStatus = (order as any).status;
                const approvedByDoctor = (order as any).approvedByDoctor || false;
                let status = orderStatus || "pending";
                let classification: "approved" | "pending" = approvedByDoctor
                    ? "approved"
                    : "pending";
                let title = tenantProductDetails?.name || "Order";

                // Store MD offerings count for reference
                const hasMdOfferings =
                    Array.isArray(mdOfferings) && mdOfferings.length > 0;

                // Get stored prescriptions
                const mdPrescriptions = (order as any).mdPrescriptions as any[] | null | undefined;
                const hasPrescriptions = Array.isArray(mdPrescriptions) && mdPrescriptions.length > 0;

                // Get pending actions
                const mdPendingActions = (order as any).mdPendingActions || null;

                // Create ONE entry per order (not per MD offering)
                flattened.push({
                    orderId: order.id,
                    orderNumber: (order as any).orderNumber,
                    caseId: mdCaseId,
                    offeringId: null,
                    caseOfferingId: null,
                    title: title,
                    productId: null,
                    productType: null,
                    status: status,
                    orderStatus: orderStatus,
                    createdAt: (order as any).createdAt,
                    updatedAt: (order as any).updatedAt,
                    classification,
                    // Enhanced details with TenantProduct and questionnaire answers
                    tenantProduct: tenantProductDetails,
                    questionnaireAnswers: questionnaireAnswersData,
                    // Store MD offerings count for reference
                    mdOfferingsCount: hasMdOfferings ? mdOfferings.length : 0,
                    // Include prescription data
                    mdPrescriptions: hasPrescriptions ? mdPrescriptions : [],
                    mdOfferings: hasMdOfferings ? mdOfferings : [],
                    hasPrescriptions,
                    // Include pending actions (driver's license, intro video, etc.)
                    mdPendingActions,
                });
            }

            return res.json({ success: true, data: flattened });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error listing MD offerings:", error);
            } else {
                console.error("❌ Error listing MD offerings");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to list MD offerings" });
        }
    });

    // One-off: resync MD case details onto the order (NO AUTH by request)
    // Body: { caseId: string }
    app.post("/md/resync", async (req, res) => {
        try {
            const { caseId } = req.body || {};
            if (!caseId || typeof caseId !== "string") {
                return res
                    .status(400)
                    .json({ success: false, message: "caseId is required" });
            }

            const MDWebhookService = (
                await import("../../services/mdIntegration/MDWebhook.service")
            ).default;
            await MDWebhookService.resyncCaseDetails(caseId);

            return res.json({ success: true, message: "Resync triggered", caseId });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Error in /md/resync:", error);
            } else {
                console.error("❌ Error in /md/resync");
            }
            return res
                .status(500)
                .json({ success: false, message: "Failed to resync case details" });
        }
    });

    // ============= ADMIN ENDPOINTS =============

    // List all available MDI offerings (treatment types/services)
    // Use this to find offering IDs for mapping your products
    app.get("/md/admin/offerings", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDCaseService = (
                await import("../../services/mdIntegration/MDCase.service")
            ).default;

            const tokenResponse = await MDAuthService.generateToken();
            const offerings = await MDCaseService.listOfferings(tokenResponse.access_token);

            console.log(`[MD-ADMIN] Listed ${offerings?.length || 0} offerings`);

            return res.json({
                success: true,
                data: offerings,
                count: offerings?.length || 0,
                hint: "Use the 'offering_id' field when creating cases with case_offerings parameter"
            });
        } catch (error: any) {
            console.error("❌ Error listing MDI offerings:", error?.response?.data || error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to list MDI offerings",
                error: error?.response?.data?.message || error?.message
            });
        }
    });

    // Search DoseSpot pharmacies
    app.get("/md/admin/pharmacies", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { name, city, state, zip, address, phoneOrFax, ncpdpID } = req.query as any;

            // At least one parameter is required
            if (!name && !city && !state && !zip && !address && !phoneOrFax && !ncpdpID) {
                return res.status(400).json({
                    success: false,
                    message: "At least one search parameter is required",
                    hint: "Provide name, city, state, zip, address, phoneOrFax, or ncpdpID"
                });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const { resolveMdIntegrationsBaseUrl } = await import("../../services/mdIntegration/config");

            const tokenResponse = await MDAuthService.generateToken();

            // Build query params
            const params = new URLSearchParams();
            if (name) params.append('name', name);
            if (city) params.append('city', city);
            if (state) params.append('state', state);
            if (zip) params.append('zip', zip);
            if (address) params.append('address', address);
            if (phoneOrFax) params.append('phoneOrFax', phoneOrFax);
            if (ncpdpID) params.append('ncpdpID', ncpdpID);

            const url = resolveMdIntegrationsBaseUrl(`/partner/pharmacies?${params.toString()}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenResponse.access_token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("❌ Error searching pharmacies:", data);
                return res.status(response.status).json({
                    success: false,
                    message: "Failed to search pharmacies",
                    error: data
                });
            }

            console.log(`[MD-ADMIN] Pharmacy search:`, {
                params: Object.fromEntries(params),
                count: Array.isArray(data) ? data.length : 0
            });

            return res.json({
                success: true,
                data: Array.isArray(data) ? data : [],
                count: Array.isArray(data) ? data.length : 0,
                hint: "These are pharmacies from the DoseSpot network"
            });
        } catch (error: any) {
            console.error("❌ Error searching pharmacies:", error?.response?.data || error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to search pharmacies",
                error: error?.response?.data?.message || error?.message
            });
        }
    });

    // List available MDI products (medications/services that can be prescribed)
    // These are from DoseSpot's drug database
    // NOTE: This endpoint may not be available in all MD Integrations environments
    app.get("/md/admin/products", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { page, per_page, search } = req.query as any;

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const MDCaseService = (
                await import("../../services/mdIntegration/MDCase.service")
            ).default;

            const tokenResponse = await MDAuthService.generateToken();
            const products = await MDCaseService.listProducts(tokenResponse.access_token, {
                page: page ? parseInt(page) : undefined,
                per_page: per_page ? parseInt(per_page) : undefined,
                search: search || undefined,
            });

            console.log(`[MD-ADMIN] Listed products`, {
                search,
                count: products?.data?.length || products?.length || 0
            });

            return res.json({
                success: true,
                data: products,
                hint: "These are medications/services available through DoseSpot. Clinicians prescribe from this catalog."
            });
        } catch (error: any) {
            const errorData = error?.response?.data || {};
            const isNotFound = error?.response?.status === 404 || errorData.error === 'NotFoundHttpException';

            console.error("❌ Error listing MDI products:", errorData || error?.message || error);

            // Return a more helpful error for 404s
            if (isNotFound) {
                return res.status(503).json({
                    success: false,
                    message: "MDI Products endpoint not available",
                    error: "The /partner/products endpoint is not available in your MD Integrations environment. This feature may not be supported by your current MDI plan or API version.",
                    hint: "This feature is optional - you can still manage offerings and create cases without it."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Failed to list MDI products",
                error: errorData?.message || error?.message
            });
        }
    });

    // Clear driver's license for a patient (for testing identity verification flow)
    app.delete("/md/admin/patient/:patientId/driver-license", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { patientId } = req.params;
            if (!patientId) {
                return res.status(400).json({ success: false, message: "patientId is required" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;

            const tokenResponse = await MDAuthService.generateToken();

            // Try to clear the driver_license_id by setting it to null
            const response = await fetch(
                `https://api.mdintegrations.com/v1/partner/patients/${patientId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${tokenResponse.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        driver_license_id: null
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                console.error("❌ Error clearing driver license:", data);
                return res.status(response.status).json({
                    success: false,
                    message: "Failed to clear driver license",
                    error: data
                });
            }

            console.log(`[MD-ADMIN] Cleared driver license for patient ${patientId}`);

            return res.json({
                success: true,
                message: "Driver license cleared. Patient will need to re-verify identity.",
                data
            });
        } catch (error: any) {
            console.error("❌ Error clearing driver license:", error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to clear driver license",
                error: error?.message
            });
        }
    });

    // Get MDI offering linked to a product
    app.get("/md/admin/products/:productId/offering", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { productId } = req.params;
            const product = await Product.findByPk(productId);

            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            if (!product.mdOfferingId) {
                return res.json({
                    success: true,
                    data: {
                        hasOffering: false,
                        product: {
                            id: product.id,
                            name: product.name,
                            description: product.description,
                            categories: product.categories,
                        }
                    }
                });
            }

            // Fetch the offering details from MDI
            const MDAuthService = (await import("../../services/mdIntegration/MDAuth.service")).default;
            const MDCaseService = (await import("../../services/mdIntegration/MDCase.service")).default;

            const tokenResponse = await MDAuthService.generateToken();
            const offerings = await MDCaseService.listOfferings(tokenResponse.access_token);

            const linkedOffering = offerings.find((o: any) =>
                o.offering_id === product.mdOfferingId || o.id === product.mdOfferingId
            );

            return res.json({
                success: true,
                data: {
                    hasOffering: true,
                    offeringId: product.mdOfferingId,
                    offeringName: product.mdOfferingName || linkedOffering?.name || linkedOffering?.title,
                    offering: linkedOffering || null,
                    product: {
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        categories: product.categories,
                    }
                }
            });
        } catch (error: any) {
            console.error("❌ Error getting product MDI offering:", error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to get product MDI offering",
                error: error?.message
            });
        }
    });

    // Link an existing MDI offering to a product
    app.post("/md/admin/products/:productId/offering/link", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { productId } = req.params;
            const { offeringId } = req.body;

            if (!offeringId) {
                return res.status(400).json({ success: false, message: "offeringId is required" });
            }

            const product = await Product.findByPk(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            // Verify the offering exists in MDI
            const MDAuthService = (await import("../../services/mdIntegration/MDAuth.service")).default;
            const MDCaseService = (await import("../../services/mdIntegration/MDCase.service")).default;

            const tokenResponse = await MDAuthService.generateToken();
            const offerings = await MDCaseService.listOfferings(tokenResponse.access_token);

            const offering = offerings.find((o: any) =>
                o.offering_id === offeringId || o.id === offeringId
            );

            if (!offering) {
                return res.status(404).json({ success: false, message: "MDI offering not found" });
            }

            // Update the product
            await product.update({
                mdOfferingId: offering.offering_id || offering.id,
                mdOfferingName: offering.name || offering.title,
            });

            console.log(`[MD-ADMIN] Linked product ${product.name} to MDI offering ${offering.name || offering.title}`);

            return res.json({
                success: true,
                message: "Product linked to MDI offering",
                data: {
                    productId: product.id,
                    productName: product.name,
                    offeringId: product.mdOfferingId,
                    offeringName: product.mdOfferingName,
                }
            });
        } catch (error: any) {
            console.error("❌ Error linking product to MDI offering:", error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to link product to MDI offering",
                error: error?.message
            });
        }
    });

    // Unlink MDI offering from a product
    app.delete("/md/admin/products/:productId/offering", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { productId } = req.params;
            const product = await Product.findByPk(productId);

            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            await product.update({
                mdOfferingId: null,
                mdOfferingName: null,
            });

            console.log(`[MD-ADMIN] Unlinked product ${product.name} from MDI offering`);

            return res.json({
                success: true,
                message: "Product unlinked from MDI offering",
            });
        } catch (error: any) {
            console.error("❌ Error unlinking product from MDI offering:", error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to unlink product from MDI offering",
                error: error?.message
            });
        }
    });

    // Create a new MDI offering from product data
    app.post("/md/admin/products/:productId/offering/create", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { productId } = req.params;
            const product = await Product.findByPk(productId);

            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            if (product.mdOfferingId) {
                return res.status(400).json({
                    success: false,
                    message: "Product already has an MDI offering linked",
                    existingOfferingId: product.mdOfferingId,
                    existingOfferingName: product.mdOfferingName,
                });
            }

            const MDAuthService = (await import("../../services/mdIntegration/MDAuth.service")).default;
            const { resolveMdIntegrationsBaseUrl } = await import("../../services/mdIntegration/config");

            const tokenResponse = await MDAuthService.generateToken();

            // Create the offering in MDI
            const offeringData = {
                name: product.name,
                title: product.name,
                description: product.description || `Treatment for ${product.name}`,
                // Add any other required fields based on MDI API requirements
            };

            console.log(`[MD-ADMIN] Creating MDI offering for product ${product.name}:`, offeringData);

            const response = await fetch(
                resolveMdIntegrationsBaseUrl('/partner/offerings'),
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokenResponse.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(offeringData)
                }
            );

            const data: any = await response.json();

            if (!response.ok) {
                console.error("❌ Error creating MDI offering:", data);
                return res.status(response.status).json({
                    success: false,
                    message: "Failed to create MDI offering",
                    error: data?.message || data?.error || data
                });
            }

            const newOfferingId = data.offering_id || data.id;
            const newOfferingName = data.name || data.title || product.name;

            // Update the product with the new offering ID
            await product.update({
                mdOfferingId: newOfferingId,
                mdOfferingName: newOfferingName,
            });

            console.log(`[MD-ADMIN] Created MDI offering ${newOfferingName} (${newOfferingId}) for product ${product.name}`);

            return res.json({
                success: true,
                message: "MDI offering created and linked to product",
                data: {
                    productId: product.id,
                    productName: product.name,
                    offeringId: newOfferingId,
                    offeringName: newOfferingName,
                    offering: data,
                }
            });
        } catch (error: any) {
            console.error("❌ Error creating MDI offering:", error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to create MDI offering",
                error: error?.message
            });
        }
    });

    // ============= QUESTIONNAIRE ENDPOINTS =============

    // List all enabled partner questionnaires
    app.get("/md/admin/questionnaires", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const { resolveMdIntegrationsBaseUrl } = await import("../../services/mdIntegration/config");

            const tokenResponse = await MDAuthService.generateToken();

            const url = resolveMdIntegrationsBaseUrl('/partner/questionnaires');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenResponse.access_token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data: any = await response.json();

            if (!response.ok) {
                console.error("❌ Error listing MDI questionnaires:", data);
                return res.status(response.status).json({
                    success: false,
                    message: "Failed to list MDI questionnaires",
                    error: data
                });
            }

            const rawQuestionnaires = Array.isArray(data) ? data : (data?.data || []);

            console.log(`[MD-ADMIN] Listed ${rawQuestionnaires.length} questionnaires`);

            // Normalize questionnaire data - MDI may use various field names for the ID
            const questionnaires = rawQuestionnaires.map((q: any) => ({
                ...q,
                // Normalize the ID to a consistent field
                _normalizedId: q.partner_questionnaire_id || q.questionnaire_id || q.id || q.uuid || null,
            }));

            return res.json({
                success: true,
                data: questionnaires,
                count: questionnaires.length,
                hint: "Use the questionnaire ID to fetch questions for a specific questionnaire"
            });
        } catch (error: any) {
            console.error("❌ Error listing MDI questionnaires:", error?.response?.data || error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to list MDI questionnaires",
                error: error?.response?.data?.message || error?.message
            });
        }
    });

    // Get questions for a specific questionnaire
    app.get("/md/admin/questionnaires/:questionnaireId/questions", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const { questionnaireId } = req.params;
            if (!questionnaireId) {
                return res.status(400).json({ success: false, message: "questionnaireId is required" });
            }

            const MDAuthService = (
                await import("../../services/mdIntegration/MDAuth.service")
            ).default;
            const { resolveMdIntegrationsBaseUrl } = await import("../../services/mdIntegration/config");

            const tokenResponse = await MDAuthService.generateToken();

            const url = resolveMdIntegrationsBaseUrl(`/partner/questionnaires/${questionnaireId}/questions`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenResponse.access_token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data: any = await response.json();

            if (!response.ok) {
                console.error("❌ Error fetching questionnaire questions:", data);
                return res.status(response.status).json({
                    success: false,
                    message: "Failed to fetch questionnaire questions",
                    error: data
                });
            }

            const questions = Array.isArray(data) ? data : (data?.data || []);

            console.log(`[MD-ADMIN] Fetched ${questions.length} questions for questionnaire ${questionnaireId}`);

            return res.json({
                success: true,
                data: questions,
                count: questions.length,
                questionnaireId,
                hint: "These are the questions configured for this questionnaire in MDI"
            });
        } catch (error: any) {
            console.error("❌ Error fetching questionnaire questions:", error?.response?.data || error?.message || error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch questionnaire questions",
                error: error?.response?.data?.message || error?.message
            });
        }
    });

    console.log("✅ MD Integrations endpoints registered");
}
