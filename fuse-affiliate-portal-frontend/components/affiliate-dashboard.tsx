import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { AffiliateAnalytics } from "./affiliate-analytics";
import { AffiliateRevenue } from "./affiliate-revenue";
import { AffiliateBranding } from "./affiliate-branding";

export function AffiliateDashboard() {
  const router = useRouter();
  const activeTab = (router.query.tab as string) || "analytics";

  // Redirect to default tab if no tab is specified
  useEffect(() => {
    if (!router.query.tab) {
      router.replace("/dashboard?tab=analytics", undefined, { shallow: true });
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Affiliate Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your affiliate analytics, revenue, and branding
        </p>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "analytics" && <AffiliateAnalytics />}
        {activeTab === "revenue" && <AffiliateRevenue />}
        {activeTab === "branding" && <AffiliateBranding />}
      </div>
    </div>
  );
}

