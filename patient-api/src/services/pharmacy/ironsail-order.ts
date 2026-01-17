import Order from '../../models/Order';
import PharmacyProduct from '../../models/PharmacyProduct';
import { google } from 'googleapis';
import PDFDocument from 'pdfkit';
import sgMail from '@sendgrid/mail';
import ShippingOrder, { OrderShippingStatus } from '../../models/ShippingOrder';

interface IronSailOrderData {
    orderNumber: string;
    patientFirstName: string;
    patientLastName: string;
    patientEmail: string;
    patientPhone: string;
    patientGender: string;
    patientDOB: string;
    patientAddress: string;
    patientCity: string;
    patientState: string;
    patientZipCode: string;
    patientCountry: string;
    productName: string;
    productSKU: string;
    rxId: string;
    medicationForm: string;
    sig: string;
    dispense: string;
    daysSupply: string;
    refills: string;
    shippingInfo: string;
    memo: string;
    orderDate: string;
    // MDI Prescription fields
    ndc?: string;
    pharmacyNotes?: string;
    mdiClinicianName?: string;
    isMdiPrescription: boolean;
}

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

class IronSailOrderService {
    private spreadsheetId: string;

    constructor() {
        this.spreadsheetId = process.env.IRONSAIL_FUSE_PRODUCTS_SPREADSHEET_ID || '14Lwc-mbVaqd_oGvg-0C7oyPa3JmaRQ7cLXcN1kl4LT8';
    }

    async createOrder(order: Order, coverage?: PharmacyProduct) {
        try {
            const coverageName = coverage?.pharmacyCoverage?.customName || 'Product';
            console.log(`🚢 [IronSail] Processing order ${order.orderNumber} for coverage: ${coverageName}`);

            // Extract order data
            const orderData = this.extractOrderData(order, coverage);

            // 1. Generate PDF
            console.log(`📄 [IronSail] Generating PDF for order ${order.orderNumber} - ${coverageName}`);
            const pdfBuffer = await this.generatePDF(orderData);
            console.log(`✅ [IronSail] PDF generated successfully (${pdfBuffer.length} bytes)`);

            // 2. Send email with PDF attachment
            console.log(`📧 [IronSail] Sending email for order ${order.orderNumber} - ${coverageName}`);
            try {
                await this.sendEmail(orderData, pdfBuffer, coverageName);
                console.log(`✅ [IronSail] Email sent successfully for ${coverageName}`);
            } catch (emailError) {
                console.error(`❌ [IronSail] Email send failed for ${coverageName}:`, emailError);
                throw new Error(`Email send failed: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
            }

            // 3. Write to Google Spreadsheet
            console.log(`📊 [IronSail] Writing to spreadsheet for order ${order.orderNumber} - ${coverageName}`);
            try {
                await this.writeToSpreadsheet(orderData);
                console.log(`✅ [IronSail] Spreadsheet updated successfully for ${coverageName}`);
            } catch (spreadsheetError) {
                console.error(`❌ [IronSail] Spreadsheet write failed for ${coverageName}:`, spreadsheetError);
                throw new Error(`Spreadsheet write failed: ${spreadsheetError instanceof Error ? spreadsheetError.message : 'Unknown error'}`);
            }

            // 4. Create ShippingOrder record (include coverage ID if available for uniqueness)
            console.log(`📋 [IronSail] Creating ShippingOrder record for ${coverageName}`);
            const coverageId = coverage?.pharmacyCoverageId || coverage?.id;
            const pharmacyOrderId = coverageId
                ? `IRONSAIL-${order.orderNumber}-${coverageId.substring(0, 8)}`
                : `IRONSAIL-${order.orderNumber}`;

            await ShippingOrder.create({
                orderId: order.id,
                shippingAddressId: order.shippingAddressId,
                status: OrderShippingStatus.PROCESSING,
                pharmacyOrderId: pharmacyOrderId
            });
            console.log(`✅ [IronSail] ShippingOrder record created with ID: ${pharmacyOrderId}`);

            console.log(`✅ [IronSail] Order ${order.orderNumber} processed successfully`);

            return {
                success: true,
                message: "IronSail order processed successfully",
                data: {
                    orderNumber: order.orderNumber,
                    pharmacyOrderId: `IRONSAIL-${order.orderNumber}`
                }
            };

        } catch (error) {
            console.error(`❌ [IronSail] Failed to process order ${order.orderNumber}:`, error);
            return {
                success: false,
                message: "Failed to process IronSail order",
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // Public method to retry email send for an order
    async retrySendEmail(order: Order, coverage?: PharmacyProduct) {
        try {
            const coverageName = coverage?.pharmacyCoverage?.customName || 'Product';
            console.log(`📧 [IronSail] Retrying email send for order ${order.orderNumber} - ${coverageName}`);

            const orderData = this.extractOrderData(order, coverage);
            const pdfBuffer = await this.generatePDF(orderData);

            await this.sendEmail(orderData, pdfBuffer, coverageName);
            console.log(`✅ [IronSail] Email retry successful for ${order.orderNumber} - ${coverageName}`);

            return {
                success: true,
                message: "Email sent successfully"
            };
        } catch (error) {
            console.error(`❌ [IronSail] Email retry failed for ${order.orderNumber}:`, error);
            return {
                success: false,
                message: "Failed to send email",
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // Public method to retry spreadsheet write for an order
    async retryWriteToSpreadsheet(order: Order, coverage?: PharmacyProduct) {
        try {
            console.log(`📊 [IronSail] Retrying spreadsheet write for order ${order.orderNumber}`);

            const orderData = this.extractOrderData(order, coverage);
            await this.writeToSpreadsheet(orderData);

            console.log(`✅ [IronSail] Spreadsheet retry successful for ${order.orderNumber}`);

            return {
                success: true,
                message: "Spreadsheet updated successfully"
            };
        } catch (error) {
            console.error(`❌ [IronSail] Spreadsheet retry failed for ${order.orderNumber}:`, error);
            return {
                success: false,
                message: "Failed to write to spreadsheet",
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private extractOrderData(order: Order, coverage?: PharmacyProduct): IronSailOrderData {
        const patient = order.user;
        const shippingAddr = order.shippingAddress;
        const product = order.tenantProduct?.product || order.orderItems?.[0]?.product;
        const quantity = order.orderItems?.[0]?.quantity || 1;

        console.log('📋 [IronSail] Extracting order data from patient:', {
            firstName: patient?.firstName,
            lastName: patient?.lastName,
            email: patient?.email,
            phoneNumber: patient?.phoneNumber,
            gender: patient?.gender,
            dob: patient?.dob
        });

        // Check for MDI prescription data
        const mdOfferings = (order as any).mdOfferings as MDIOffering[] | undefined;
        const mdPrescriptions = (order as any).mdPrescriptions as any[] | undefined;
        const hasMdiData = Boolean((mdOfferings && mdOfferings.length > 0) || (mdPrescriptions && mdPrescriptions.length > 0));

        // Get the first MDI offering/prescription (or match by product name if multiple)
        let mdiOffering: MDIOffering | undefined;
        let mdiProduct: MDIOfferingProduct | undefined;

        if (mdOfferings && mdOfferings.length > 0) {
            // Try to match by product name if coverage has a custom name
            const coverageName = coverage?.pharmacyCoverage?.customName?.toLowerCase();
            if (coverageName) {
                mdiOffering = mdOfferings.find(o => 
                    o.title?.toLowerCase().includes(coverageName) ||
                    o.name?.toLowerCase().includes(coverageName) ||
                    o.product?.name?.toLowerCase().includes(coverageName) ||
                    o.product?.title?.toLowerCase().includes(coverageName)
                );
            }
            // Fallback to first offering
            if (!mdiOffering) {
                mdiOffering = mdOfferings[0];
            }
            mdiProduct = mdiOffering?.product;
        }

        // Log MDI prescription data for debugging
        if (hasMdiData) {
            // Log ALL fields from offerings to find where clinician note is
            if (mdOfferings && mdOfferings.length > 0) {
                mdOfferings.forEach((o: any, idx: number) => {
                    console.log('💊 [IronSail] Full offering object:', {
                        idx,
                        allKeys: Object.keys(o || {}),
                        // Check all possible note/directions fields
                        directions: o?.directions,
                        thank_you_note: o?.thank_you_note,
                        clinical_note: o?.clinical_note,
                        clinician_note: o?.clinician_note,
                        notes: o?.notes,
                        sig: o?.sig,
                        instructions: o?.instructions,
                        // Product fields
                        productKeys: Object.keys(o?.product || {}),
                        productDirections: o?.product?.directions,
                        productPharmacyNotes: o?.product?.pharmacy_notes,
                    });
                });
            }
            
            // Log prescriptions too
            if (mdPrescriptions && mdPrescriptions.length > 0) {
                mdPrescriptions.forEach((p: any, idx: number) => {
                    console.log('💊 [IronSail] Full prescription object:', {
                        idx,
                        allKeys: Object.keys(p || {}),
                        directions: p?.directions,
                        sig: p?.sig,
                        pharmacy_notes: p?.pharmacy_notes,
                    });
                });
            }
            
            console.log('💊 [IronSail] MDI Prescription data found:', {
                orderNumber: order.orderNumber,
                offeringsCount: mdOfferings?.length || 0,
                prescriptionsCount: mdPrescriptions?.length || 0,
                selectedOffering: mdiOffering ? {
                    title: mdiOffering.title || mdiOffering.name,
                    directions: mdiOffering.directions || mdiProduct?.directions,
                    quantity: mdiProduct?.quantity,
                    daysSupply: mdiProduct?.days_supply,
                    refills: mdiProduct?.refills,
                    ndc: mdiProduct?.ndc,
                    pharmacyNotes: mdiProduct?.pharmacy_notes,
                } : 'none'
            });
        } else {
            console.log('📋 [IronSail] No MDI prescription data, using coverage/product defaults');
        }

        // Format gender
        const gender = patient?.gender ?
            patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '';

        // Format DOB
        const dob = patient?.dob ? new Date(patient.dob).toISOString().split('T')[0] : '';

        // Priority for SIG: MDI directions > MDI thank_you_note > product placeholder > pharmacy coverage > order notes > default
        // Note: MDI clinicians often put instructions in thank_you_note instead of directions field
        const mdiDirections = mdiOffering?.directions || mdiProduct?.directions;
        const mdiThankYouNote = (mdiOffering as any)?.thank_you_note || (mdiProduct as any)?.thank_you_note;
        
        // Also check prescriptions for thank_you_note
        const mdiPrescription = mdPrescriptions?.[0];
        const prescriptionThankYouNote = mdiPrescription?.thank_you_note;
        const prescriptionDirections = mdiPrescription?.directions;
        
        // Use directions if available, otherwise fall back to thank_you_note (which contains INSTRUCTIONS)
        let sig: string;
        if (mdiDirections && mdiDirections.trim()) {
            sig = mdiDirections;
            console.log('📋 [IronSail] Using MDI directions as SIG');
        } else if (prescriptionDirections && prescriptionDirections.trim()) {
            sig = prescriptionDirections;
            console.log('📋 [IronSail] Using MDI prescription directions as SIG');
        } else if (mdiThankYouNote && mdiThankYouNote.trim()) {
            sig = mdiThankYouNote;
            console.log('📋 [IronSail] Using MDI thank_you_note as SIG (fallback)');
        } else if (prescriptionThankYouNote && prescriptionThankYouNote.trim()) {
            sig = prescriptionThankYouNote;
            console.log('📋 [IronSail] Using MDI prescription thank_you_note as SIG (fallback)');
        } else {
            sig = product?.placeholderSig ||
                coverage?.pharmacyCoverage?.customSig ||
                coverage?.sig ||
                order.doctorNotes ||
                order.notes ||
                `Take as directed by your healthcare provider`;
            console.log('📋 [IronSail] Using product/coverage/default SIG');
        }

        // Priority for quantity/dispense: MDI quantity > order quantity
        const mdiQuantity = mdiProduct?.quantity;
        const dispenseUnit = mdiProduct?.dispense_unit || product?.medicationSize || 'Unit';
        const dispense = mdiQuantity 
            ? `${mdiQuantity} ${dispenseUnit}`
            : `${quantity} ${dispenseUnit}`;

        // Priority for days supply: MDI days_supply > default 30
        const daysSupply = mdiProduct?.days_supply?.toString() || '30';

        // Priority for refills: MDI refills > default 2
        const refills = mdiProduct?.refills?.toString() || '2';

        // Use patient address if available, otherwise fall back to shipping address
        const address = patient?.address || shippingAddr?.address || '';
        const apartment = shippingAddr?.apartment ? `, ${shippingAddr.apartment}` : '';
        const fullAddress = apartment ? `${address}${apartment}` : address;
        const city = patient?.city || shippingAddr?.city || '';
        const state = patient?.state || shippingAddr?.state || '';
        const zipCode = patient?.zipCode || shippingAddr?.zipCode || '';

        console.log('📋 [IronSail] Resolved address fields:', {
            address: fullAddress,
            city,
            state,
            zipCode,
            source: patient?.address ? 'patient' : 'shipping'
        });

        // Build memo with MDI info if available
        const memo = hasMdiData 
            ? `MDI Prescription - ${mdiOffering?.status || 'Approved'}`
            : 'Order approved';

        return {
            orderNumber: order.orderNumber,
            patientFirstName: patient?.firstName || '',
            patientLastName: patient?.lastName || '',
            patientEmail: patient?.email || '',
            patientPhone: patient?.phoneNumber || '',
            patientGender: gender,
            patientDOB: dob,
            patientAddress: fullAddress,
            patientCity: city,
            patientState: state,
            patientZipCode: zipCode,
            patientCountry: 'USA',
            productName: mdiOffering?.title || mdiOffering?.name || mdiProduct?.name || coverage?.pharmacyCoverage?.customName || coverage?.pharmacyProductName || product?.name || 'Unknown Product',
            productSKU: coverage?.pharmacyProductId || product?.pharmacyProductId || '',
            rxId: coverage?.rxId || '',
            medicationForm: coverage?.form || '',
            sig: sig,
            dispense: dispense,
            daysSupply: daysSupply,
            refills: refills,
            shippingInfo: 'fedex_priority_overnight',
            memo: memo,
            orderDate: new Date(order.createdAt).toLocaleDateString('en-US'),
            // MDI specific fields
            ndc: mdiProduct?.ndc || undefined,
            pharmacyNotes: mdiProduct?.pharmacy_notes || undefined,
            mdiClinicianName: undefined, // Could be populated from case assignment if needed
            isMdiPrescription: hasMdiData
        };
    }

    private async generatePDF(data: IronSailOrderData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            // Increase page width by 30% (letter width is 612, 30% more = ~795)
            const doc = new PDFDocument({
                margin: 50,
                size: [795, 1008] // width increased by 30%, height standard letter
            });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Column positions - adjusted for wider page
            const col1 = 50;
            const col2 = 290;
            const col3 = 530;

            // Company Header
            doc.fontSize(18).font('Helvetica-Bold').text('FUSE HEALTH INC', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text('254 Chapman Road, Ste 208 #24703, Newark, DE 19702 USA', { align: 'center' });
            doc.text('+19095321861', { align: 'center' });
            doc.moveDown(1.5);

            // Title - indicate if MDI prescription
            const titleText = data.isMdiPrescription 
                ? 'Electronic Prescription Order (MDI)'
                : 'Electronic Prescription Order';
            doc.fontSize(16).text(titleText, { align: 'center', underline: true });
            doc.moveDown(1.5);

            // === FIRST 3-COLUMN GRID ===
            let startY = doc.y;

            // Left column - show MDI clinician if available, otherwise default prescriber
            const prescriberName = data.mdiClinicianName || 'SHUBH DHRUV';
            doc.fontSize(10).text(`Prescriber: ${prescriberName}`, col1, startY);
            doc.text('Order', col1, doc.y);
            doc.text('Number: ' + data.orderNumber, col1, doc.y);
            doc.text('Memo: ' + data.memo, col1, doc.y);

            // Middle column
            doc.text('License: PA63768 (California)', col2, startY);
            doc.text('NPI: 1477329381', col2, doc.y);
            doc.text('Shipping Information: ' + data.shippingInfo, col2, doc.y);

            // Right column
            doc.text('Date: ' + data.orderDate, col3, startY);
            if (data.isMdiPrescription) {
                doc.moveDown(0.5);
                doc.fillColor('blue').text('MDI Prescription', col3, doc.y);
                doc.fillColor('black');
            }

            doc.moveDown(3);

            // === PATIENT INFORMATION ===
            doc.fontSize(14).text('Patient Information', 0, doc.y, { align: 'center', underline: true });
            doc.moveDown(1);

            // === SECOND 3-COLUMN GRID ===
            startY = doc.y;

            // Left column
            doc.fontSize(10).text('First', col1, startY);
            doc.text('Name: ' + data.patientFirstName, col1, doc.y);
            doc.moveDown(0.5);
            doc.text('Phone', col1, doc.y);
            doc.text('Number: ' + data.patientPhone, col1, doc.y);
            doc.moveDown(0.5);
            doc.text('Address: ' + data.patientAddress, col1, doc.y);
            doc.moveDown(0.5);
            doc.text('State: ' + data.patientState, col1, doc.y);

            // Middle column
            doc.text('Last', col2, startY);
            doc.text('Name: ' + data.patientLastName, col2, doc.y);
            doc.moveDown(0.5);
            doc.text('Email: ' + data.patientEmail, col2, doc.y);
            doc.moveDown(0.5);
            doc.text('City: ' + data.patientCity, col2, doc.y);
            doc.moveDown(0.5);
            doc.text('Zip', col2, doc.y);
            doc.text('Code: ' + data.patientZipCode, col2, doc.y);

            // Right column
            doc.text('Gender: ' + data.patientGender, col3, startY);
            doc.moveDown(0.5);
            doc.text('DOB: ' + data.patientDOB, col3, doc.y);
            doc.moveDown(0.5);
            doc.text('Country: ' + data.patientCountry, col3, doc.y);

            doc.moveDown(3);
            // Add 30 pixels extra spacing
            doc.y += 30;

            // === MEDICATION ===
            doc.fontSize(14).text('Medication', 0, doc.y, { align: 'center', underline: true });
            doc.moveDown(1);

            // Simple table layout - label on left, value on right, each row separate
            const labelX = col1;
            const valueX = col1 + 120;
            const rowHeight = 18;

            let currentY = doc.y;
            doc.fontSize(10);

            // Row 1: Name
            doc.font('Helvetica-Bold').text('Name:', labelX, currentY);
            doc.font('Helvetica').text(data.productName + (data.productSKU ? ' (' + data.productSKU + ')' : ''), valueX, currentY);
            currentY += rowHeight;

            // Row 2: NDC (if available)
            if (data.ndc) {
                doc.font('Helvetica-Bold').text('NDC:', labelX, currentY);
                doc.font('Helvetica').text(data.ndc, valueX, currentY);
                currentY += rowHeight;
            }

            // Row 3: RX ID
            doc.font('Helvetica-Bold').text('RX ID:', labelX, currentY);
            doc.font('Helvetica').text(data.rxId || 'N/A', valueX, currentY);
            currentY += rowHeight;

            // Row 4: Form
            doc.font('Helvetica-Bold').text('Form:', labelX, currentY);
            doc.font('Helvetica').text(data.medicationForm || 'N/A', valueX, currentY);
            currentY += rowHeight;

            // Row 5: Dispense
            doc.font('Helvetica-Bold').text('Dispense:', labelX, currentY);
            doc.font('Helvetica').text(data.dispense, valueX, currentY);
            currentY += rowHeight;

            // Row 6: Days Supply
            doc.font('Helvetica-Bold').text('Days Supply:', labelX, currentY);
            doc.font('Helvetica').text(data.daysSupply, valueX, currentY);
            currentY += rowHeight;

            // Row 7: Refills
            doc.font('Helvetica-Bold').text('Refills:', labelX, currentY);
            doc.font('Helvetica').text(data.refills, valueX, currentY);
            currentY += rowHeight;

            doc.y = currentY;

            // SIG gets its own section since it can be long
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').text('Sig (Directions):', col1);
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            
            // Draw a box around the SIG for better readability
            const sigStartY = doc.y;
            doc.rect(col1, sigStartY, 695, 80).stroke();
            doc.text(data.sig, col1 + 10, sigStartY + 10, { width: 675, height: 70 });
            doc.y = sigStartY + 90;

            // Add pharmacy notes section if available (from MDI)
            if (data.pharmacyNotes) {
                doc.moveDown(1);
                doc.fontSize(12).font('Helvetica-Bold').text('Pharmacy Notes:', col1);
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica').text(data.pharmacyNotes, col1, doc.y, { width: 695 });
            }

            doc.end();
        });
    }

    private async sendEmail(data: IronSailOrderData, pdfBuffer: Buffer, coverageIdentifier?: string): Promise<void> {
        const recipientEmail = process.env.IRONSAIL_FUSE_PRODUCTS_DESTINATION_EMAIL_ADDRESS || 'orders@ironsail.com';
        const patientFullName = `${data.patientFirstName} ${data.patientLastName}`.trim();

        // Build BCC list, excluding the recipient email to avoid duplicates
        const bccEmails = ['grrbm2@gmail.com', 'daniel@fusehealth.com']
            .filter(email => email.toLowerCase() !== recipientEmail.toLowerCase())
            .map(email => ({ email }));

        // Add coverage identifier to subject if provided (for multi-coverage products)
        const subjectSuffix = coverageIdentifier ? ` - ${coverageIdentifier}` : '';
        
        // Add MDI indicator to subject if this is an MDI prescription
        const mdiIndicator = data.isMdiPrescription ? ' [MDI]' : '';

        // Build pharmacy notes section if available
        const pharmacyNotesHtml = data.pharmacyNotes 
            ? `<p><strong>Pharmacy Notes:</strong> ${data.pharmacyNotes}</p>` 
            : '';

        // Build NDC section if available
        const ndcHtml = data.ndc 
            ? `<p><strong>NDC:</strong> ${data.ndc}</p>` 
            : '';

        const msg: any = {
            to: recipientEmail,
            from: 'noreply@fusehealth.com',
            ...(bccEmails.length > 0 && { bcc: bccEmails }), // Only add BCC if there are emails
            subject: `New Prescription Order ${data.orderNumber}${subjectSuffix}${mdiIndicator} - ${patientFullName}`,
            html: `
        <h2>New Electronic Prescription Order from FUSE HEALTH INC</h2>
        ${data.isMdiPrescription ? '<p style="color: #2563eb; font-weight: bold;">📋 MDI Prescription</p>' : ''}
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>Date:</strong> ${data.orderDate}</p>
        <p><strong>Patient:</strong> ${patientFullName}</p>
        <hr style="margin: 15px 0;">
        <h3>Prescription Details</h3>
        <p><strong>Medication:</strong> ${data.productName}</p>
        ${ndcHtml}
        <p><strong>SIG:</strong> ${data.sig}</p>
        <p><strong>Dispense:</strong> ${data.dispense}</p>
        <p><strong>Days Supply:</strong> ${data.daysSupply}</p>
        <p><strong>Refills:</strong> ${data.refills}</p>
        ${pharmacyNotesHtml}
        <hr style="margin: 15px 0;">
        <p><strong>Shipping:</strong> ${data.shippingInfo}</p>
        <br>
        <p>Please see the attached PDF for complete prescription details.</p>
      `,
            attachments: [
                {
                    content: pdfBuffer.toString('base64'),
                    filename: `Prescription_${data.orderNumber}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment',
                },
            ],
        };

        try {
            await sgMail.send(msg);
            const bccList = bccEmails.map(b => b.email).join(', ');
            console.log(`✅ [IronSail] Email sent to ${recipientEmail}${bccList ? ` (BCC: ${bccList})` : ''}`);
        } catch (error: any) {
            console.error(`❌ [IronSail] SendGrid error details:`, JSON.stringify(error.response?.body, null, 2));
            throw error;
        }
    }

    private async writeToSpreadsheet(data: IronSailOrderData): Promise<void> {
        try {
            // Initialize Google Sheets API
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
                    private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const sheets = google.sheets({ version: 'v4', auth });

            // Use configurable sheet name or default to 'Sheet1'
            const sheetName = process.env.IRONSAIL_SPREADSHEET_SHEET_NAME || 'Sheet1';

            // Check if headers exist (read first row)
            try {
                const headerResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!A1:AD1`, // Extended for MDI fields
                });

                const existingHeaders = headerResponse.data.values?.[0];

                // If no headers or empty sheet, add headers
                if (!existingHeaders || existingHeaders.length === 0) {
                    console.log(`📋 [IronSail] Creating headers in spreadsheet`);
                    const headers = [
                        'Date',
                        'Order Number',
                        'Prescriber',
                        'License',
                        'NPI',
                        'Patient First Name',
                        'Patient Last Name',
                        'Patient Gender',
                        'Patient Phone',
                        'Patient Email',
                        'RX_ID',
                        'Patient DOB',
                        'Patient Address',
                        'Patient City',
                        'Patient State',
                        'Patient Zip Code',
                        'Patient Country',
                        'Medication Name',
                        'Product SKU',
                        'NDC',
                        'Sig',
                        'Dispense',
                        'Days Supply',
                        'Refills',
                        'Shipping Information',
                        'Memo',
                        'Pharmacy Notes',
                        'MDI Prescription',
                        'Status'
                    ];

                    await sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `${sheetName}!A1:AD1`, // Extended for MDI fields
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [headers],
                        },
                    });

                    console.log(`✅ [IronSail] Headers created successfully`);
                }
            } catch (headerError) {
                console.log(`⚠️ [IronSail] Could not check headers, will attempt to append anyway:`, headerError);
            }

            // Prepare row data
            const prescriberName = data.mdiClinicianName || 'SHUBH DHRUV';
            const row = [
                data.orderDate,
                data.orderNumber,
                prescriberName, // Prescriber - use MDI clinician if available
                'PA63768 (California)', // License
                '1477329381', // NPI
                data.patientFirstName,
                data.patientLastName,
                data.patientGender,
                data.patientPhone,
                data.patientEmail,
                data.rxId,
                data.patientDOB,
                data.patientAddress,
                data.patientCity,
                data.patientState,
                data.patientZipCode,
                data.patientCountry,
                data.productName,
                data.productSKU,
                data.ndc || '', // NDC from MDI
                data.sig,
                data.dispense,
                data.daysSupply,
                data.refills,
                data.shippingInfo,
                data.memo,
                data.pharmacyNotes || '', // Pharmacy notes from MDI
                data.isMdiPrescription ? 'Yes' : 'No', // MDI Prescription flag
                'Pending' // Status
            ];

            const appendRange = `${sheetName}!A:AD`; // Extended for MDI fields
            console.log(`📝 [IronSail] Appending order data to ${appendRange}`);

            // Append to spreadsheet
            await sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: appendRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [row],
                },
            });

            console.log(`✅ [IronSail] Written to spreadsheet: ${this.spreadsheetId} (Sheet: ${sheetName})`);
        } catch (error) {
            console.error(`❌ [IronSail] Failed to write to spreadsheet:`, error);
            throw error;
        }
    }
}

export default IronSailOrderService;

