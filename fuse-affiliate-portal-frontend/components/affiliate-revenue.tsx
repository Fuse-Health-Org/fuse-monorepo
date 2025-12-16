import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";

interface RevenueData {
  totalRevenue?: number;
  orderCount?: number;
  affiliatePercentage?: number;
  affiliateEarnings?: number;
  currency?: string;
}

export function AffiliateRevenue() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RevenueData | null>(null);

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiCall("/affiliate/revenue", {
          method: "GET",
        });

        if (response.success) {
          // Handle potential nested data structure
          // Backend returns: { success: true, data: { totalRevenue, orderCount, ... } }
          let revenueData = response.data;
          
          // Unwrap if double nested
          if (revenueData?.data && typeof revenueData.data === 'object') {
            revenueData = revenueData.data;
          }
          
          console.log("💰 Revenue response:", { 
            response, 
            responseData: response.data,
            revenueData,
            orderCount: revenueData?.orderCount,
            revenueKeys: revenueData ? Object.keys(revenueData) : []
          });
          setData(revenueData);
        } else {
          setError(response.error || "Failed to fetch revenue");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchRevenue();
  }, []);

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
            <Icon icon="lucide:alert-circle" className="text-4xl text-danger mx-auto mb-4" />
            <p className="text-danger font-medium mb-2">Error Loading Revenue Data</p>
            <p className="text-sm text-danger/80">{error}</p>
            <Button
              color="primary"
              variant="flat"
              onPress={() => window.location.reload()}
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
  const hasInsufficientData = !data || 
    !data.totalRevenue || 
    data.totalRevenue === 0 ||
    !data.orderCount ||
    data.orderCount === 0;

  if (hasInsufficientData) {
    const currentOrderCount = data?.orderCount ?? 0;
    
    return (
      <Card>
        <CardBody>
          <div className="text-center py-8">
            <Icon icon="lucide:info" className="text-4xl text-primary mx-auto mb-4" />
            <p className="text-lg font-semibold mb-6">No Revenue Data Available</p>
            
            <div className="space-y-6 max-w-[300px] mx-auto">
              {/* Current Orders Card - Inside */}
              <Card className="bg-content1">
                <CardBody>
                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <Icon icon="lucide:package" className="text-3xl text-muted-foreground" />
                      <p className="text-2xl font-bold">{currentOrderCount}</p>
                    </div>
                    <div className="flex">
                      <p className="text-sm text-muted-foreground">
                        Current orders
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              
              <p className="text-sm text-muted-foreground">
                {currentOrderCount === 0
                  ? "No orders have been assigned to your affiliate account yet."
                  : `Revenue data will appear here once orders are processed and assigned to your affiliate account.`
                }
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Safe defaults for all numeric values
  const totalRevenue = data.totalRevenue ?? 0;
  const orderCount = data.orderCount ?? 0;
  const affiliatePercentage = data.affiliatePercentage ?? 10;
  const affiliateEarnings = data.affiliateEarnings ?? 0;

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Revenue Summary</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-content1 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <Icon icon="lucide:dollar-sign" className="text-2xl text-primary" />
                </div>
                <p className="text-3xl font-bold">
                  ${totalRevenue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  From {orderCount} orders
                </p>
              </div>

              <div className="p-4 bg-content1 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Your Earnings</p>
                  <Icon icon="lucide:trending-up" className="text-2xl text-success" />
                </div>
                <p className="text-3xl font-bold text-success">
                  ${affiliateEarnings.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {affiliatePercentage}% of total revenue
                </p>
              </div>
            </div>

            <div className="p-4 bg-content1 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Revenue Breakdown</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Share</span>
                  <span className="font-semibold">
                    {affiliatePercentage}% (${affiliateEarnings.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Brand Share</span>
                  <span className="font-semibold">
                    {100 - affiliatePercentage}% (${(totalRevenue - affiliateEarnings).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })})
                  </span>
                </div>
                <div className="w-full bg-content3 rounded-full h-2 mt-4">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${affiliatePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

