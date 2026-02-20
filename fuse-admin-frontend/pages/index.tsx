import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { MetricCards } from "@/components/metric-cards";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";

const StoreAnalytics = dynamic(
  () => import("@/components/store-analytics").then((mod) => mod.StoreAnalytics),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="h-[300px] bg-muted/50 rounded" />
      </div>
    ),
  }
);

const RecentOrders = dynamic(
  () => import("@/components/recent-orders").then((mod) => mod.RecentOrders),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-muted rounded" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    ),
  }
);

export default function Dashboard() {
  const { user, hasActiveSubscription } = useAuth();
  const router = useRouter();
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [checkoutEmbedUrl, setCheckoutEmbedUrl] = useState<string>("");
  const [mockDataUsage, setMockDataUsage] = useState({
    metrics: false,
    analytics: false,
    orders: false,
  });
  // Default to full current month (1st to last day of month)
  // Use lazy initialization to avoid creating new Date objects on every render
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  });

  const handleDateChange = useCallback((newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }, []);

  // Serialize router.query to a stable string for dependency tracking
  const queryString = useMemo(() => JSON.stringify(router.query), [router.query]);

  const isUsingAnyMockData = useMemo(
    () => mockDataUsage.metrics || mockDataUsage.analytics || mockDataUsage.orders,
    [mockDataUsage]
  );

  const handleMetricsMockData = useCallback((isUsingMockData: boolean) => {
    setMockDataUsage((prev) => ({ ...prev, metrics: isUsingMockData }));
  }, []);

  const handleAnalyticsMockData = useCallback((isUsingMockData: boolean) => {
    setMockDataUsage((prev) => ({ ...prev, analytics: isUsingMockData }));
  }, []);

  const handleOrdersMockData = useCallback((isUsingMockData: boolean) => {
    setMockDataUsage((prev) => ({ ...prev, orders: isUsingMockData }));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      setShowCheckoutGate(false);
      setCheckoutEmbedUrl("");
      setIsCheckingSetup(false);
      return;
    }

    if (!router.isReady || !user) {
      return;
    }

    if (!hasActiveSubscription) {
      const params = new URLSearchParams();
      Object.entries(router.query).forEach(([key, value]) => {
        if (key === "openCheckout") return;
        if (Array.isArray(value)) {
          value.forEach((entry) => params.append(key, entry));
          return;
        }
        if (value != null) {
          params.set(key, String(value));
        }
      });

      const selectedPlanType = localStorage.getItem("selectedPlanType");
      const selectedPlanName = localStorage.getItem("selectedPlanName");

      if (!params.get("planType") && selectedPlanType) {
        params.set("planType", selectedPlanType);
      }
      if (!params.get("planName") && selectedPlanName) {
        params.set("planName", selectedPlanName);
      }

      const qs = params.toString();
      setCheckoutEmbedUrl(`/checkout?embed=1${qs ? `&${qs}` : ""}`);
      setShowCheckoutGate(true);
    } else {
      setShowCheckoutGate(false);
      setCheckoutEmbedUrl("");
    }
    setIsCheckingSetup(false);
  }, [router.isReady, user, hasActiveSubscription, queryString]);

  return (
    <Layout>
      <div className={`relative ${showCheckoutGate ? "pointer-events-none select-none blur-[2px]" : ""}`}>
        <div className="p-8 space-y-8" id="overview-dashboard">
          {/* Header Section */}
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
              Overview
            </h1>
            <p className="text-sm text-muted-foreground/70">Monitor your business performance and insights</p>
          </div>

          {isUsingAnyMockData && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">
                Demo data active
              </p>
              <p className="text-sm text-amber-800/90 mt-1">
                You are viewing demo data until your first orders are created.
              </p>
            </div>
          )}

          {/* Metric Cards */}
          <MetricCards
            startDate={startDate}
            endDate={endDate}
            onMockDataStatusChange={handleMetricsMockData}
          />

          {/* Analytics Chart */}
          <StoreAnalytics
            startDate={startDate}
            endDate={endDate}
            onMockDataStatusChange={handleAnalyticsMockData}
          />

          {/* Recent Orders */}
          <RecentOrders
            onMockDataStatusChange={handleOrdersMockData}
          />
        </div>
      </div>

      {!isCheckingSetup && showCheckoutGate && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-border max-h-[92vh]">
            <div className="px-6 py-4 border-b border-border bg-background">
              <h2 className="text-lg font-semibold text-foreground">Final Step</h2>
              <p className="text-sm text-muted-foreground">
                Finish your subscription to unlock the full dashboard.
              </p>
            </div>
            <div className="h-[calc(92vh-180px)]">
              {checkoutEmbedUrl ? (
                <iframe
                  src={checkoutEmbedUrl}
                  title="Checkout setup"
                  className="w-full h-full border-0 bg-background"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}