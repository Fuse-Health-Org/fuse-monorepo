import { Express } from "express";
import { getIronSailToken, IRONSAIL_API_BASE } from "./ironsail-auth";
import ShippingOrder from "../../models/ShippingOrder";
import Order from "../../models/Order";
import User from "../../models/User";
import { Op } from "sequelize";

// ============= IRONSAIL ADMIN API =============
// Provides admin access to browse IronSail pharmacies and medication catalogs

export function registerIronSailAdminEndpoints(
  app: Express,
  authenticateJWT: any
) {
  // List IronSail orders from our database
  app.get("/ironsail/orders", authenticateJWT, async (req, res) => {
    try {
      const { page = "1", per_page = "25", status } = req.query;
      const pageNum = parseInt(page as string);
      const perPage = Math.min(parseInt(per_page as string), 100);
      const offset = (pageNum - 1) * perPage;

      // Build where clause - include IRONSAIL, PENDING, and FAILED orders
      const where: any = {
        pharmacyOrderId: {
          [Op.or]: [
            { [Op.like]: 'IRONSAIL-%' },
            { [Op.like]: 'PENDING-%' },
            { [Op.like]: 'FAILED-%' }
          ]
        }
      };

      if (status && typeof status === 'string') {
        where.status = status;
      }

      // Get total count
      const total = await ShippingOrder.count({ where });

      // Fetch orders with related data
      const shippingOrders = await ShippingOrder.findAll({
        where,
        include: [
          {
            model: Order,
            as: "order",
            attributes: ["id", "orderNumber", "status", "createdAt"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "firstName", "lastName", "email"]
              }
            ]
          }
        ],
        order: [["createdAt", "DESC"]],
        limit: perPage,
        offset
      });

      console.log(`[IronSail] Listed ${shippingOrders.length} IronSail orders (page ${pageNum})`);

      return res.json({
        success: true,
        data: shippingOrders,
        pagination: {
          page: pageNum,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage)
        }
      });
    } catch (error: any) {
      console.error("[IronSail] Error listing orders:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to list IronSail orders",
        error: error?.message
      });
    }
  });

  // List available IronSail pharmacies
  app.get("/ironsail/pharmacies", authenticateJWT, async (req, res) => {
    try {
      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${IRONSAIL_API_BASE}/pharmacies`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[IronSail] Failed to fetch pharmacies:", errorText);
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch pharmacies from IronSail",
          error: errorText
        });
      }

      const data = await response.json() as { data?: any[] };
      console.log(`[IronSail] Fetched ${data.data?.length || 0} pharmacies`);

      return res.json({
        success: true,
        data: data.data || [],
        count: data.data?.length || 0
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching pharmacies:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch pharmacies",
        error: error?.message
      });
    }
  });

  // Test endpoint to debug IronSail search (no auth required for debugging)
  console.log("📝 Registering /ironsail/test-search endpoint");
  app.get("/ironsail/test-search", async (req, res) => {
    try {
      const { pharmacy = "kaduceus", search = "semaglutide" } = req.query;

      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Test 1: Without search parameter
      const urlNoSearch = `${IRONSAIL_API_BASE}/pharmacies/${pharmacy}/medications?page=1`;
      console.log(`\n[IronSail Test] URL without search: ${urlNoSearch}`);

      const responseNoSearch = await fetch(urlNoSearch, { method: "GET", headers });
      const dataNoSearch = await responseNoSearch.json() as { data?: any[]; pagination?: any };

      // Test 2: With search parameter
      const urlWithSearch = `${IRONSAIL_API_BASE}/pharmacies/${pharmacy}/medications?page=1&search=${encodeURIComponent(search as string)}`;
      console.log(`[IronSail Test] URL with search: ${urlWithSearch}`);

      const responseWithSearch = await fetch(urlWithSearch, { method: "GET", headers });
      const dataWithSearch = await responseWithSearch.json() as { data?: any[]; pagination?: any };

      // Test 3: Try 'name' parameter instead
      const urlWithName = `${IRONSAIL_API_BASE}/pharmacies/${pharmacy}/medications?page=1&name=${encodeURIComponent(search as string)}`;
      console.log(`[IronSail Test] URL with name param: ${urlWithName}`);

      const responseWithName = await fetch(urlWithName, { method: "GET", headers });
      const dataWithName = await responseWithName.json() as { data?: any[]; pagination?: any };

      // Test 4: Try 'q' parameter
      const urlWithQ = `${IRONSAIL_API_BASE}/pharmacies/${pharmacy}/medications?page=1&q=${encodeURIComponent(search as string)}`;
      console.log(`[IronSail Test] URL with q param: ${urlWithQ}`);

      const responseWithQ = await fetch(urlWithQ, { method: "GET", headers });
      const dataWithQ = await responseWithQ.json() as { data?: any[]; pagination?: any };

      // Log first item names from each response
      console.log(`\n[IronSail Test] Results summary:`);
      console.log(`  No search: ${dataNoSearch.data?.length || 0} items, first: ${dataNoSearch.data?.[0]?.name || 'N/A'}`);
      console.log(`  With search: ${dataWithSearch.data?.length || 0} items, first: ${dataWithSearch.data?.[0]?.name || 'N/A'}`);
      console.log(`  With name: ${dataWithName.data?.length || 0} items, first: ${dataWithName.data?.[0]?.name || 'N/A'}`);
      console.log(`  With q: ${dataWithQ.data?.length || 0} items, first: ${dataWithQ.data?.[0]?.name || 'N/A'}`);

      return res.json({
        success: true,
        searchTerm: search,
        pharmacy,
        results: {
          noSearch: {
            url: urlNoSearch,
            count: dataNoSearch.data?.length || 0,
            pagination: dataNoSearch.pagination,
            firstFive: dataNoSearch.data?.slice(0, 5).map((m: any) => m.name) || []
          },
          withSearch: {
            url: urlWithSearch,
            count: dataWithSearch.data?.length || 0,
            pagination: dataWithSearch.pagination,
            firstFive: dataWithSearch.data?.slice(0, 5).map((m: any) => m.name) || []
          },
          withName: {
            url: urlWithName,
            count: dataWithName.data?.length || 0,
            pagination: dataWithName.pagination,
            firstFive: dataWithName.data?.slice(0, 5).map((m: any) => m.name) || []
          },
          withQ: {
            url: urlWithQ,
            count: dataWithQ.data?.length || 0,
            pagination: dataWithQ.pagination,
            firstFive: dataWithQ.data?.slice(0, 5).map((m: any) => m.name) || []
          }
        }
      });
    } catch (error: any) {
      console.error("[IronSail Test] Error:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Test failed",
        error: error?.message
      });
    }
  });

  // Get medications/products for a specific IronSail pharmacy
  // Note: IronSail API does NOT support server-side search, so we fetch all and filter locally
  app.get("/ironsail/pharmacies/:pharmacyId/medications", authenticateJWT, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const { page = "1", search } = req.query;
      const requestedPage = parseInt(page as string);
      const perPage = 25;

      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // If searching, we need to fetch ALL medications and filter locally
      // because IronSail API doesn't support server-side search
      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        console.log(`[IronSail] Search requested for "${searchTerm}" - fetching all pages for client-side filtering`);

        // First, get page 1 to know total pages
        const firstPageUrl = `${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications?page=1`;
        const firstResponse = await fetch(firstPageUrl, { method: "GET", headers });

        if (!firstResponse.ok) {
          const errorText = await firstResponse.text();
          console.error("[IronSail] Failed to fetch medications:", errorText);
          return res.status(firstResponse.status).json({
            success: false,
            message: "Failed to fetch medications from IronSail",
            error: errorText
          });
        }

        const firstData = await firstResponse.json() as {
          data?: any[];
          pagination?: { page: number; per_page: number; total: number; total_pages: number }
        };

        let allMedications = firstData.data || [];
        const totalPages = firstData.pagination?.total_pages || 1;

        // Fetch remaining pages if there are more
        if (totalPages > 1) {
          const pagePromises: Promise<any[]>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            const pageUrl = `${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications?page=${p}`;
            pagePromises.push(
              fetch(pageUrl, { method: "GET", headers })
                .then(r => r.json())
                .then((d: any) => d.data || [])
            );
          }
          const additionalPages = await Promise.all(pagePromises);
          additionalPages.forEach(pageData => {
            allMedications = allMedications.concat(pageData);
          });
        }

        console.log(`[IronSail] Fetched ${allMedications.length} total medications, filtering for "${searchTerm}"`);

        // Filter by search term (check name, formulation, type)
        const filteredMedications = allMedications.filter((med: any) => {
          const name = (med.name || '').toLowerCase();
          const formulation = (med.formulation || '').toLowerCase();
          const type = (med.type || '').toLowerCase();
          return name.includes(searchTerm) ||
            formulation.includes(searchTerm) ||
            type.includes(searchTerm);
        });

        console.log(`[IronSail] Found ${filteredMedications.length} medications matching "${searchTerm}"`);

        // Paginate the filtered results
        const totalFiltered = filteredMedications.length;
        const totalFilteredPages = Math.ceil(totalFiltered / perPage);
        const startIndex = (requestedPage - 1) * perPage;
        const paginatedResults = filteredMedications.slice(startIndex, startIndex + perPage);

        return res.json({
          success: true,
          data: paginatedResults,
          pagination: {
            page: requestedPage,
            per_page: perPage,
            total: totalFiltered,
            total_pages: totalFilteredPages
          },
          searchApplied: searchTerm
        });
      }

      // No search - just fetch the requested page normally
      const url = `${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications?page=${page}`;
      console.log(`[IronSail] Fetching medications from: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[IronSail] Failed to fetch medications:", errorText);
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch medications from IronSail",
          error: errorText
        });
      }

      const data = await response.json() as {
        data?: any[];
        pagination?: { page: number; per_page: number; total: number; total_pages: number }
      };
      console.log(`[IronSail] Fetched ${data.data?.length || 0} medications for pharmacy ${pharmacyId}`);

      return res.json({
        success: true,
        data: data.data || [],
        pagination: data.pagination || {
          page: requestedPage,
          per_page: perPage,
          total: data.data?.length || 0,
          total_pages: 1
        }
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching medications:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch medications",
        error: error?.message
      });
    }
  });

  // Get details of a specific medication
  app.get("/ironsail/medications/:medicationId", authenticateJWT, async (req, res) => {
    try {
      const { medicationId } = req.params;
      const { pharmacyId } = req.query;

      if (!pharmacyId) {
        return res.status(400).json({
          success: false,
          message: "pharmacyId query parameter is required"
        });
      }

      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch all medications and find the specific one
      const response = await fetch(`${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch medication details"
        });
      }

      const data = await response.json() as { data?: any[] };
      const medication = data.data?.find((med: any) => med.medication_id === medicationId);

      if (!medication) {
        return res.status(404).json({
          success: false,
          message: "Medication not found"
        });
      }

      return res.json({
        success: true,
        data: medication
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching medication details:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch medication details",
        error: error?.message
      });
    }
  });

  // =============================================================================
  // TEST ENDPOINT: IronSail PDF Preview
  // =============================================================================
  app.post("/test/ironsail-pdf", async (req, res) => {
    try {
      const IronSailOrderService = (await import('../../services/pharmacy/ironsail-order')).default;
      const sgMail = (await import('@sendgrid/mail')).default;
      const PDFDocument = (await import('pdfkit')).default;

      // Sample data matching the problematic case
      const testData = {
        orderNumber: 'ORD-20260116-231232-781543',
        patientFirstName: 'Lb',
        patientLastName: 'Acc',
        patientEmail: 'lbacc816@gmail.com',
        patientPhone: '3513513135',
        patientGender: 'Male',
        patientDOB: '1992-03-05',
        patientAddress: '66 Hansen Way, Apartment 4',
        patientCity: 'Palo Alto',
        patientState: 'CA',
        patientZipCode: '94304',
        patientCountry: 'USA',
        productName: 'Semaglutide/Methylcobalamin 2.5mg/0.5mg/ml 4ml (10mg)',
        productSKU: '3629',
        rxId: '3629',
        medicationForm: 'Injectable',
        sig: `Thank you for choosing our Semaglutide/Methylcobalamin weight loss program.
Your prescription has been submitted to the pharmacy. You should receive shipping confirmation within 2-3 business days.

INSTRUCTIONS:
- Store medication in refrigerator
- Inject subcutaneously as directed by your healthcare provider
- Take as directed by your healthcare provider

If you have any questions about your treatment, please message your provider through the patient portal.`,
        dispense: '4.00 Milliliter',
        daysSupply: '30',
        refills: '0',
        shippingInfo: 'fedex_priority_overnight',
        memo: 'MDI Prescription - pending',
        orderDate: '1/16/2026',
        ndc: undefined,
        pharmacyNotes: `Company: FUSE HEALTH LLC
Patient ID: lbacc816@gmail.com
Case ID: 8536c3d3-66e0-4bf2-8497-a31f359fad20`,
        mdiClinicianName: undefined,
        isMdiPrescription: true,
      };

      // Generate PDF using current layout
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          margin: 50,
          size: [795, 1008]
        });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const col1 = 50;
        const col2 = 290;
        const col3 = 530;

        // Company Header
        doc.fontSize(18).font('Helvetica-Bold').text('FUSE HEALTH INC', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text('254 Chapman Road, Ste 208 #24703, Newark, DE 19702 USA', { align: 'center' });
        doc.text('+19095321861', { align: 'center' });
        doc.moveDown(1.5);

        // Title
        doc.fontSize(16).text('Electronic Prescription Order (MDI)', { align: 'center', underline: true });
        doc.moveDown(1.5);

        // === FIRST 3-COLUMN GRID ===
        let startY = doc.y;
        doc.fontSize(10).text('Prescriber: SHUBH DHRUV', col1, startY);
        doc.text('Order Number: ' + testData.orderNumber, col1, doc.y);
        doc.text('Memo: ' + testData.memo, col1, doc.y);

        doc.text('License: PA63768 (California)', col2, startY);
        doc.text('NPI: 1477329381', col2, doc.y);
        doc.text('Shipping: ' + testData.shippingInfo, col2, doc.y);

        doc.text('Date: ' + testData.orderDate, col3, startY);
        doc.fillColor('blue').text('MDI Prescription', col3, doc.y);
        doc.fillColor('black');

        doc.moveDown(3);

        // === PATIENT INFORMATION ===
        doc.fontSize(14).text('Patient Information', 0, doc.y, { align: 'center', underline: true });
        doc.moveDown(1);

        startY = doc.y;
        doc.fontSize(10);
        doc.text('First Name: ' + testData.patientFirstName, col1, startY);
        doc.text('Phone: ' + testData.patientPhone, col1, doc.y);
        doc.text('Address: ' + testData.patientAddress, col1, doc.y);
        doc.text('State: ' + testData.patientState, col1, doc.y);

        doc.text('Last Name: ' + testData.patientLastName, col2, startY);
        doc.text('Email: ' + testData.patientEmail, col2, doc.y);
        doc.text('City: ' + testData.patientCity, col2, doc.y);
        doc.text('Zip Code: ' + testData.patientZipCode, col2, doc.y);

        doc.text('Gender: ' + testData.patientGender, col3, startY);
        doc.text('DOB: ' + testData.patientDOB, col3, doc.y);
        doc.text('Country: ' + testData.patientCountry, col3, doc.y);

        doc.moveDown(3);
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
        doc.font('Helvetica').text(testData.productName + ' (' + testData.productSKU + ')', valueX, currentY);
        currentY += rowHeight;

        // Row 2: RX ID
        doc.font('Helvetica-Bold').text('RX ID:', labelX, currentY);
        doc.font('Helvetica').text(testData.rxId, valueX, currentY);
        currentY += rowHeight;

        // Row 3: Form
        doc.font('Helvetica-Bold').text('Form:', labelX, currentY);
        doc.font('Helvetica').text(testData.medicationForm, valueX, currentY);
        currentY += rowHeight;

        // Row 4: Dispense
        doc.font('Helvetica-Bold').text('Dispense:', labelX, currentY);
        doc.font('Helvetica').text(testData.dispense, valueX, currentY);
        currentY += rowHeight;

        // Row 5: Days Supply
        doc.font('Helvetica-Bold').text('Days Supply:', labelX, currentY);
        doc.font('Helvetica').text(testData.daysSupply, valueX, currentY);
        currentY += rowHeight;

        // Row 6: Refills
        doc.font('Helvetica-Bold').text('Refills:', labelX, currentY);
        doc.font('Helvetica').text(testData.refills, valueX, currentY);
        currentY += rowHeight;

        doc.y = currentY;

        // SIG in its own box
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Sig (Directions):', col1);
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        const sigStartY = doc.y;
        doc.rect(col1, sigStartY, 695, 100).stroke();
        doc.text(testData.sig, col1 + 10, sigStartY + 10, { width: 675 });
        doc.y = sigStartY + 110;

        // Pharmacy Notes
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Pharmacy Notes:', col1);
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(testData.pharmacyNotes, col1, doc.y, { width: 695 });

        doc.end();
      });

      // Get email from request body or default
      const recipientEmail = req.body?.email || 'grrbm2@gmail.com';

      // Send email
      const msg = {
        to: recipientEmail,
        from: 'noreply@fusehealth.com',
        subject: `[TEST] IronSail PDF Preview - ${new Date().toISOString()}`,
        html: `<h2>Test PDF for IronSail Layout</h2><p>See attached PDF to review the current layout.</p>`,
        attachments: [
          {
            content: pdfBuffer.toString('base64'),
            filename: `Test_Prescription_${Date.now()}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ],
      };

      await sgMail.send(msg as any);

      res.json({
        success: true,
        message: `Test PDF sent to ${recipientEmail}`,
        pdfSize: pdfBuffer.length,
      });
    } catch (error) {
      console.error('Test PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate/send test PDF',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // =============================================================================
  // MANUAL RETRY ENDPOINT
  // =============================================================================

  /**
   * POST /ironsail/orders/:id/retry
   * Manually retry a failed or stuck IronSail order
   */
  app.post("/ironsail/orders/:id/retry", authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;

      // Import retry service
      const IronSailRetryService = (await import('../../services/pharmacy/ironsail-retry.service')).default;

      console.log(`[IronSail Admin] Manual retry requested for shipping order: ${id}`);

      const result = await IronSailRetryService.manualRetry(id);

      if (result.success) {
        res.json({
          success: true,
          message: 'Order retry succeeded',
        });
      } else if (result.shouldRetry) {
        res.json({
          success: true,
          message: 'Order retry in progress, will continue automatically',
          nextRetryAt: result.nextRetryAt?.toISOString(),
          retryCount: result.retryCount,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Retry failed',
        });
      }
    } catch (error) {
      console.error('[IronSail Admin] Manual retry error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  console.log("✅ IronSail Admin endpoints registered");
}
