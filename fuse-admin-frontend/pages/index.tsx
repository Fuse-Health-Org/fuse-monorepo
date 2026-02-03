import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MetricCards } from "@/components/metric-cards";
import { StoreAnalytics } from "@/components/store-analytics";
import { RecentActivity } from "@/components/recent-activity";
import { EarningsReport } from "@/components/earnings-report";
import { QuickActions } from "@/components/quick-actions";
import DateRangeSelector from "@/components/date-range-selector";
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
        <main className="flex-1 overflow-y-auto p-6 space-y-6" id="overview-dashboard">
          {/* Header Section */}
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-muted-foreground">Monitor your business performance and insights</p>
          </div>

          {/* Date Range Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DateRangeSelector
              startDate={startDate}
              endDate={endDate}
              onDateChange={handleDateChange}
            />
          </div>

          {/* Metric Cards */}
          <MetricCards startDate={startDate} endDate={endDate} />

          {/* Analytics and Quick Actions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <StoreAnalytics startDate={startDate} endDate={endDate} />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>

          {/* Earnings Report and Recent Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentActivity />
            </div>
            <div>
              <EarningsReport startDate={startDate} endDate={endDate} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}