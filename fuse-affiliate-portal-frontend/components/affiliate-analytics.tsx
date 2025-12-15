import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";

interface AnalyticsData {
  recordCount: number;
  analytics: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    timeRange: {
      start: string;
      end: string;
    };
    categoryData: {
      category: string;
      orderCount: number;
      revenue: number;
      avgOrderValue: number;
    } | null;
    timeSeries: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
  } | null;
  message?: string;
}

export function AffiliateAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall("/affiliate/analytics", {
        method: "GET",
        body: JSON.stringify({ startDate, endDate }),
      });

      if (response.success) {
        // Handle potential nested data structure
        // Backend returns: { success: true, data: { recordCount, analytics } }
        // apiCall wraps it: { success: true, data: { success: true, data: {...} } }
        let analyticsData = response.data;

        // Unwrap if double nested
        if (analyticsData?.data && typeof analyticsData.data === "object") {
          analyticsData = analyticsData.data;
        }

        console.log("📊 Analytics response:", {
          response,
          responseData: response.data,
          analyticsData,
          recordCount: analyticsData?.recordCount,
          hasAnalytics: !!analyticsData?.analytics,
          analyticsKeys: analyticsData ? Object.keys(analyticsData) : [],
        });
        setData(analyticsData);
      } else {
        setError(
          response.error || "Failed to fetch analytics"
        );
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-8">
            <Icon
              icon="lucide:alert-circle"
              className="text-4xl text-danger mx-auto mb-4"
            />
            <p className="text-danger">{error}</p>
            <Button
              color="primary"
              variant="flat"
              onPress={fetchAnalytics}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Check if there's insufficient data
  const MIN_RECORDS_REQUIRED = 10;
  const currentRecordCount = data?.recordCount ?? 0;
  const hasInsufficientData =
    !data || !data.analytics || currentRecordCount < MIN_RECORDS_REQUIRED;
  const recordsNeeded = Math.max(0, MIN_RECORDS_REQUIRED - currentRecordCount);

  if (hasInsufficientData) {
    return (
      <div className="space-y-6">
        {/* Insufficient Data Card */}
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <Icon
                icon="lucide:info"
                className="text-4xl text-primary mx-auto mb-4"
              />
              <p className="text-lg font-semibold mb-6">Insufficient Data</p>

              <div className="space-y-6 max-w-[300px] mx-auto">
                {/* Current Orders Card - Inside */}
                <Card className="bg-content1">
                  <CardBody>
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <Icon
                          icon="lucide:package"
                          className="text-3xl text-muted-foreground"
                        />
                        <p className="text-2xl font-bold">
                          {currentRecordCount}
                        </p>
                      </div>
                      <div className="flex">
                        <p className="text-sm text-muted-foreground">
                          Current orders
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-2xl text-primary">
                      {recordsNeeded}
                    </span>{" "}
                    {recordsNeeded === 1 ? "order" : "orders"} remaining
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Minimum {MIN_RECORDS_REQUIRED} orders required to display
                    analytics.
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="w-full bg-content3 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (currentRecordCount / MIN_RECORDS_REQUIRED) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {currentRecordCount} / {MIN_RECORDS_REQUIRED} orders
                  </p>
                </div>
              </div>

              {data?.message && (
                <p className="text-sm text-muted-foreground mt-4">
                  {data.message}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Date Range Selector - still show even with insufficient data */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Date Range</h2>
          </CardHeader>
          <CardBody>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-content3 rounded-lg bg-background"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-content3 rounded-lg bg-background"
                />
              </div>
              <Button color="primary" onPress={fetchAnalytics}>
                Update
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const analytics = data.analytics!;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Date Range</h2>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-content3 rounded-lg bg-background"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-content3 rounded-lg bg-background"
              />
            </div>
            <Button color="primary" onPress={fetchAnalytics}>
              Update
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  $
                  {analytics.totalRevenue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <Icon
                icon="lucide:dollar-sign"
                className="text-3xl text-primary"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{analytics.orderCount}</p>
              </div>
              <Icon
                icon="lucide:shopping-cart"
                className="text-3xl text-primary"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold">
                  $
                  {analytics.avgOrderValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <Icon
                icon="lucide:trending-up"
                className="text-3xl text-primary"
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Time Series Chart */}
      {analytics.timeSeries && analytics.timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Revenue Over Time</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {analytics.timeSeries.map((point) => (
                <div
                  key={point.date}
                  className="flex items-center justify-between p-3 bg-content1 rounded-lg"
                >
                  <span className="font-medium">
                    {new Date(point.date).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {point.orders} orders
                    </span>
                    <span className="font-semibold">
                      $
                      {point.revenue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Category Data */}
      {analytics.categoryData && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">
              Category: {analytics.categoryData.category}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-xl font-bold">
                  {analytics.categoryData.orderCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold">
                  $
                  {analytics.categoryData.revenue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Order</p>
                <p className="text-xl font-bold">
                  $
                  {analytics.categoryData.avgOrderValue.toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
