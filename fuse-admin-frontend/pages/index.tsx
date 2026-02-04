import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MetricCards } from "@/components/metric-cards";
import { StoreAnalytics } from "@/components/store-analytics";
import { RecentOrders } from "@/components/recent-orders";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
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
    </div>
  );
}