import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MetricCards } from "@/components/metric-cards";
import { StoreAnalytics } from "@/components/store-analytics";
import { RecentOrders } from "@/components/recent-orders";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";

export default function Dashboard() {
  const { user, authenticatedFetch, hasActiveSubscription } = useAuth();
  const router = useRouter();
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [checkoutEmbedUrl, setCheckoutEmbedUrl] = useState<string>("");
  
  // Default to full current month (1st to last day of month)
  const now = new Date();
  const [startDate, setStartDate] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [endDate, setEndDate] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  );

  const handleDateChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const checkoutQueryFromRouter = useMemo(() => {
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
    return params;
  }, [router.query]);

  useEffect(() => {
    const checkAccountSetupGate = async () => {
      if (typeof window !== "undefined" && window.self !== window.top) {
        setShowCheckoutGate(false);
        setCheckoutEmbedUrl("");
        setIsCheckingSetup(false);
        return;
      }

      if (!router.isReady || !user) {
        return;
      }

      setIsCheckingSetup(true);
      try {
        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/brand-subscriptions/basic-info`,
          {
            method: "GET",
            skipLogoutOn401: true,
          }
        );

        let shouldShowCheckout = false;
        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            shouldShowCheckout = data?.data?.status !== "active";
          } else {
            shouldShowCheckout = !hasActiveSubscription;
          }
        } else {
          shouldShowCheckout = !hasActiveSubscription;
        }

        if (shouldShowCheckout) {
          const params = new URLSearchParams(checkoutQueryFromRouter.toString());
          const selectedPlanType = localStorage.getItem("selectedPlanType");
          const selectedPlanName = localStorage.getItem("selectedPlanName");

          if (!params.get("planType") && selectedPlanType) {
            params.set("planType", selectedPlanType);
          }
          if (!params.get("planName") && selectedPlanName) {
            params.set("planName", selectedPlanName);
          }

          const queryString = params.toString();
          setCheckoutEmbedUrl(`/checkout?embed=1${queryString ? `&${queryString}` : ""}`);
          setShowCheckoutGate(true);
        } else {
          setShowCheckoutGate(false);
          setCheckoutEmbedUrl("");
        }
      } catch (error) {
        console.error("Failed to validate account setup gate:", error);
        setShowCheckoutGate(!hasActiveSubscription);
      } finally {
        setIsCheckingSetup(false);
      }
    };

    void checkAccountSetupGate();
  }, [router.isReady, user, authenticatedFetch, hasActiveSubscription, checkoutQueryFromRouter]);

  return (
    <div className="flex h-screen bg-background relative">
      <Sidebar />
      <div className={`flex-1 flex flex-col overflow-hidden ${showCheckoutGate ? "pointer-events-none select-none blur-[2px]" : ""}`}>
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8" id="overview-dashboard">
          {/* Header Section */}
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
              Overview
            </h1>
            <p className="text-sm text-muted-foreground/70">Monitor your business performance and insights</p>
          </div>

          {/* Metric Cards */}
          <MetricCards startDate={startDate} endDate={endDate} />

          {/* Analytics Chart */}
          <StoreAnalytics startDate={startDate} endDate={endDate} />

          {/* Recent Orders */}
          <RecentOrders />
        </main>
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
    </div>
  );
}