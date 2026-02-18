import Order from '../../models/Order';
import User from '../../models/User';
import ShippingAddress from '../../models/ShippingAddress';
import { getIronSailToken, IRONSAIL_API_BASE, IRONSAIL_TENANT } from '../../endpoints/ironsail/ironsail-auth';
import ShippingOrder, { OrderShippingStatus } from '../../models/ShippingOrder';
import { PharmacyProvider } from '../../models/Product';

// MDI Offering/Product structure from webhook
interface MDIOfferingProduct {
    ndc?: string | null;
    name?: string;
    title?: string;
    quantity?: string;
    directions?: string;
    days_supply?: number | null;
    refills?: number;
    dispense_unit?: string;
    pharmacy_notes?: string;
    pharmacy_id?: string | null;
    pharmacy_name?: string | null;
    force_pharmacy?: boolean;
    medication_id?: string | null; // IronSail medication_id
}

interface MDIOffering {
    id?: string;
    case_offering_id?: string;
    title?: string;
    name?: string;
    directions?: string;
    status?: string;
    product?: MDIOfferingProduct;
    product_id?: string;
}

interface IronSailPatient {
    uuid?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    date_of_birth: string; // YYYY-MM-DD
    gender: 'M' | 'F' | 'U';
    address: {
        street: string;
        street_2?: string;
        city: string;
        state: string; // 2-letter code
        zip: string; // 5 or 9 digits
        country?: string;
    };
}

interface IronSailOrderRequest {
    patient_id: string; // UUID from IronSail
    pharmacy_id: string; // UUID from IronSail
    medication_id: string; // Encoded medication ID
    dispense_quantity: number; // 1-1000
    days_supply?: number; // 1-365
    order_id?: string; // Max 100 chars
    customer_id?: string; // Max 100 chars
    memo?: string; // Max 1024 chars
    clinical_notes?: string; // Max 2048 chars
    webhook_urls?: string[]; // Up to 5 URLs
}

class IronSailApiOrderService {
    /**
     * Create or get patient in IronSail
     */
    private async createOrGetPatient(user: User, shippingAddress?: ShippingAddress | null): Promise<string> {
        try {
            const token = await getIronSailToken();
            if (!token) {
                throw new Error('Failed to get IronSail authentication token');
            }

            // Check if patient already exists by email
            const searchResponse = await fetch(
                `${IRONSAIL_API_BASE}/patients?email=${encodeURIComponent(user.email)}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (searchResponse.ok) {
                const searchData = await searchResponse.json() as { data?: any[] };
                if (searchData.data && searchData.data.length > 0) {
                    const existingPatient = searchData.data[0];
                    console.log(`[IronSail API] Found existing patient: ${existingPatient.uuid}`);
                    return existingPatient.uuid;
                }
            }

            // Patient doesn't exist, create new one
            const address = shippingAddress || {
                address: user.address || '',
                apartment: '',
                city: user.city || '',
                state: user.state || '',
                zipCode: user.zipCode || '',
                country: 'USA'
            };

            // Format phone number (must be exactly 10 digits)
            let phoneNumber = (user.phoneNumber || '').replace(/\D/g, '');
            if (phoneNumber.length !== 10) {
                console.warn(`[IronSail API] Invalid phone number length, using placeholder`);
                phoneNumber = '0000000000'; // Placeholder if invalid
            }

            // Format DOB (must be in past, YYYY-MM-DD)
            let dob = user.dob || '';
            if (!dob || new Date(dob) >= new Date()) {
                console.warn(`[IronSail API] Invalid or missing DOB, using default`);
                // Use a default date (18 years ago) if invalid
                const defaultDate = new Date();
                defaultDate.setFullYear(defaultDate.getFullYear() - 18);
                dob = defaultDate.toISOString().split('T')[0];
            }

            // Format gender (M, F, or U)
            let gender: 'M' | 'F' | 'U' = 'U';
            if (user.gender) {
                const genderUpper = user.gender.toUpperCase();
                if (genderUpper === 'MALE' || genderUpper === 'M') {
                    gender = 'M';
                } else if (genderUpper === 'FEMALE' || genderUpper === 'F') {
                    gender = 'F';
                }
            }

            // Format state (must be 2-letter code)
            const state = (address.state || '').substring(0, 2).toUpperCase();
            if (!state || state.length !== 2) {
                throw new Error(`Invalid state code: ${address.state}`);
            }

            // Format ZIP (must be 5 or 9 digits)
            let zip = (address.zipCode || '').replace(/\D/g, '');
            if (zip.length > 9) {
                zip = zip.substring(0, 9);
            }
            if (zip.length < 5) {
                throw new Error(`Invalid ZIP code: ${address.zipCode}`);
            }

            const patientData: IronSailPatient = {
                first_name: user.firstName.substring(0, 35), // Max 35 chars
                last_name: user.lastName.substring(0, 35),
                email: user.email,
                phone_number: phoneNumber,
                date_of_birth: dob,
                gender: gender,
                address: {
                    street: (address.address || '').substring(0, 255),
                    street_2: address.apartment ? address.apartment.substring(0, 255) : undefined,
                    city: (address.city || '').substring(0, 100),
                    state: state,
                    zip: zip,
                    country: 'USA'
                }
            };

            console.log(`[IronSail API] Creating patient record`);
            const createResponse = await fetch(`${IRONSAIL_API_BASE}/patients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(patientData)
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error(`[IronSail API] Failed to create patient:`, errorText);
                throw new Error(`Failed to create patient in IronSail: ${errorText}`);
            }

            const patientResult = await createResponse.json() as { data?: { uuid: string } };
            const patientUuid = patientResult.data?.uuid || (patientResult as any).uuid;

            if (!patientUuid) {
                throw new Error('Patient created but no UUID returned');
            }

            console.log(`[IronSail API] Patient created successfully: ${patientUuid}`);
            return patientUuid;
        } catch (error) {
            console.error(`[IronSail API] Error creating/getting patient:`, error);
            throw error;
        }
    }

    /**
     * Create order in IronSail API
     */
    async createOrder(order: Order): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            console.log(`[IronSail API] Creating order for ${order.orderNumber}`);

            // Load order with relations
            const fullOrder = await Order.findOne({
                where: { id: order.id },
                include: [
                    {
                        model: User,
                        as: 'user',
                        required: true
                    },
                    {
                        model: ShippingAddress,
                        as: 'shippingAddress',
                        required: false
                    }
                ]
            });

            if (!fullOrder || !fullOrder.user) {
                throw new Error('Order or user not found');
            }

            // Get MDI prescription/offering data
            const mdOfferings = (fullOrder as any).mdOfferings as MDIOffering[] | undefined;
            const mdPrescriptions = (fullOrder as any).mdPrescriptions as any[] | undefined;

            console.error('\n[IronSail API] ===== CHECKING MDI DATA =====');
            console.error('[IronSail API] Order:', fullOrder.orderNumber);
            console.error('[IronSail API] mdOfferings:', mdOfferings ? `present (${mdOfferings.length} items)` : 'MISSING/NULL');
            console.error('[IronSail API] mdPrescriptions:', mdPrescriptions ? `present (${mdPrescriptions.length} items)` : 'MISSING/NULL');
            if (mdOfferings) {
                console.error('[IronSail API] mdOfferings data:', JSON.stringify(mdOfferings, null, 2));
            }

            if (!mdOfferings || mdOfferings.length === 0) {
                throw new Error('No MDI offerings found in order. Cannot create IronSail order without prescription data.');
            }

            // Get the first offering (or match by pharmacy if specified)
            const offering = mdOfferings[0];
            const product = offering.product;

            if (!product) {
                throw new Error('No product data found in MDI offering');
            }

            // Get pharmacy_id and medication_id from offering
            const pharmacyId = product.pharmacy_id;
            const medicationId = product.medication_id;

            if (!pharmacyId) {
                throw new Error('No pharmacy_id found in MDI offering. Cannot route order to IronSail.');
            }

            if (!medicationId) {
                throw new Error('No medication_id found in MDI offering. Cannot identify medication in IronSail.');
            }

            console.log(`[IronSail API] Order details:`, {
                pharmacyId,
                medicationId,
                productName: product.name || product.title
            });

            // Create or get patient in IronSail
            const patientUuid = await this.createOrGetPatient(fullOrder.user, fullOrder.shippingAddress);

            // Prepare order data
            const dispenseQuantity = parseInt(product.quantity || '1', 10);
            if (isNaN(dispenseQuantity) || dispenseQuantity < 1 || dispenseQuantity > 1000) {
                throw new Error(`Invalid dispense_quantity: ${product.quantity}. Must be between 1 and 1000.`);
            }

            const daysSupply = product.days_supply || 30;
            if (daysSupply < 1 || daysSupply > 365) {
                throw new Error(`Invalid days_supply: ${daysSupply}. Must be between 1 and 365.`);
            }

            // Build clinical notes from various sources
            const clinicalNotesParts: string[] = [];
            if (product.pharmacy_notes) {
                clinicalNotesParts.push(`Pharmacy Notes: ${product.pharmacy_notes}`);
            }
            if (offering.directions) {
                clinicalNotesParts.push(`Directions: ${offering.directions}`);
            }
            if ((offering as any).clinical_note) {
                clinicalNotesParts.push(`Clinical Note: ${(offering as any).clinical_note}`);
            }
            const clinicalNotes = clinicalNotesParts.join('\n\n').substring(0, 2048); // Max 2048 chars

            // Build memo
            const memo = `MDI Prescription - Order ${order.orderNumber}`.substring(0, 1024); // Max 1024 chars

            // Get webhook URL from environment (optional)
            const webhookUrl = process.env.IRONSAIL_WEBHOOK_URL;
            const webhookUrls = webhookUrl ? [webhookUrl] : undefined;

            const orderRequest: IronSailOrderRequest = {
                patient_id: patientUuid,
                pharmacy_id: pharmacyId,
                medication_id: medicationId,
                dispense_quantity: dispenseQuantity,
                days_supply: daysSupply,
                order_id: order.orderNumber.substring(0, 100), // Max 100 chars
                customer_id: fullOrder.userId.substring(0, 100), // Max 100 chars
                memo: memo,
                clinical_notes: clinicalNotes || undefined,
                webhook_urls: webhookUrls
            };

            console.log(`[IronSail API] Submitting order to IronSail:`, {
                patient_id: patientUuid,
                pharmacy_id: pharmacyId,
                medication_id: medicationId,
                dispense_quantity: dispenseQuantity,
                days_supply: daysSupply
            });

            // Submit order to IronSail
            const token = await getIronSailToken();
            if (!token) {
                throw new Error('Failed to get IronSail authentication token');
            }

            const orderResponse = await fetch(`${IRONSAIL_API_BASE}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(orderRequest)
            });

            if (!orderResponse.ok) {
                const errorText = await orderResponse.text();
                console.error(`[IronSail API] Failed to create order:`, errorText);
                return {
                    success: false,
                    error: `Failed to create order in IronSail: ${errorText}`
                };
            }

            const orderResult = await orderResponse.json() as { data?: any };
            const ironSailOrder = orderResult.data || orderResult;

            console.log(`[IronSail API] Order created successfully:`, {
                order_uuid: ironSailOrder.uuid || ironSailOrder.id,
                order_id: ironSailOrder.order_id,
                status: ironSailOrder.status
            });

            // Create ShippingOrder record
            const ironSailOrderUuid = ironSailOrder.uuid || ironSailOrder.id;
            const pharmacyOrderId = `IRONSAIL-${ironSailOrderUuid}`;

            await ShippingOrder.create({
                orderId: order.id,
                shippingAddressId: order.shippingAddressId,
                status: OrderShippingStatus.PROCESSING,
                pharmacyOrderId: pharmacyOrderId,
                pharmacy: PharmacyProvider.IRONSAIL
            });

            console.log(`[IronSail API] ShippingOrder record created: ${pharmacyOrderId}`);

            return {
                success: true,
                data: {
                    ironSailOrderUuid: ironSailOrderUuid,
                    pharmacyOrderId: pharmacyOrderId,
                    status: ironSailOrder.status,
                    order_id: ironSailOrder.order_id
                }
            };
        } catch (error) {
            console.error(`[IronSail API] Error creating order:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

export default new IronSailApiOrderService();
