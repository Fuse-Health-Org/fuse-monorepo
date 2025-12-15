import { useState, useEffect } from "react";

export function usePharmacyCoverages(isOpen: boolean, tenantProductId: string | undefined) {
  const [pharmacyCoverages, setPharmacyCoverages] = useState<any[]>([]);

  useEffect(() => {
    const fetchPharmacyCoverages = async () => {
      if (!isOpen || !tenantProductId) {
        return;
      }

      try {
        console.log('💊 [PHARMACY COVERAGE] Fetching coverages for tenantProductId:', tenantProductId);

        // Fetch the tenant product to get the base productId
        const productRes = await fetch(`/api/public/tenant-products/${tenantProductId}`);
        const productData = await productRes.json();

        if (!productRes.ok || !productData?.success || !productData?.data?.productId) {
          console.log('⚠️ [PHARMACY COVERAGE] Could not get base productId');
          return;
        }

        const baseProductId = productData.data.productId;
        console.log('💊 [PHARMACY COVERAGE] Base productId:', baseProductId);

        // Fetch pharmacy coverages directly
        const coverageRes = await fetch(`/api/public/products/${baseProductId}/pharmacy-coverages`);
        const coverageData = await coverageRes.json();

        if (coverageRes.ok && coverageData?.success && Array.isArray(coverageData?.data)) {
          console.log('💊 [PHARMACY COVERAGE] Found coverages:', coverageData.data);
          setPharmacyCoverages(coverageData.data);
        } else {
          console.log('⚠️ [PHARMACY COVERAGE] No coverages found');
          setPharmacyCoverages([]);
        }
      } catch (error) {
        console.error('❌ [PHARMACY COVERAGE] Error fetching:', error);
        setPharmacyCoverages([]);
      }
    };

    fetchPharmacyCoverages();
  }, [isOpen, tenantProductId]);

  return pharmacyCoverages;
}

