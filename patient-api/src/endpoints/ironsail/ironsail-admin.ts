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

      // Build where clause
      const where: any = {
        pharmacyOrderId: {
          [Op.like]: 'IRONSAIL-%'
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

  console.log("✅ IronSail Admin endpoints registered");
}
