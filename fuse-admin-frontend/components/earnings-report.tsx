import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

interface EarningsReportProps {
  startDate: Date;
  endDate: Date;
}

interface ProductBreakdown {
  productId: string;
  productName: string;
  unitsSold: number;
  cost: number;
  revenue: number;
  profit: number;
  profitMargin: number;
}

interface EarningsData {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  productBreakdown: ProductBreakdown[];
}

export function EarningsReport({ startDate, endDate }: EarningsReportProps) {
  const { user, authenticatedFetch } = useAuth();
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarningsReport = async () => {
      if (!user?.clinicId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/earnings-report?` +
          `clinicId=${user.clinicId}&` +
          `startDate=${startDate.toISOString()}&` +
          `endDate=${endDate.toISOString()}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setEarningsData(data.data);
          } else {
            setError(data.message || 'Failed to load earnings report');
          }
        } else {
          setError('Failed to load earnings report');
        }
      } catch (err) {
        // If it's an unauthorized error, the user will be redirected by authenticatedFetch
        if ((err as Error).message === 'unauthorized') {
          return;
        }
        console.error('Error fetching earnings report:', err);
        setError('Failed to load earnings report');
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsReport();
  }, [user?.clinicId, authenticatedFetch, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Earnings Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Earnings Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!earningsData) {
    return null;
  }

  const isProfitable = earningsData.profit >= 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Earnings Report</CardTitle>
        <p className="text-sm text-muted-foreground">Profit analysis and product breakdown</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(earningsData.totalRevenue)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(earningsData.totalCost)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <p className={`text-lg font-semibold flex items-center gap-1 ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(earningsData.profit)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Profit Margin</p>
            <p className={`text-lg font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {earningsData.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Product Breakdown */}
        {earningsData.productBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Top Products</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {earningsData.productBreakdown.slice(0, 5).map((product) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {product.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.unitsSold} units sold
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(product.revenue)}
                    </p>
                    <p className={`text-xs ${product.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.profitMargin.toFixed(1)}% margin
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

