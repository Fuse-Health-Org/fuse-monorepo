import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, Users, TrendingUp, ShoppingCart, ArrowUp, ArrowDown } from "lucide-react"
import { useAuth } from '@/contexts/AuthContext';

interface MetricCardsProps {
  startDate: Date;
  endDate: Date;
}

interface DashboardMetrics {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  conversionRate: number;
  activeSubscriptions: number;
  newPatients: number;
  percentageChanges?: {
    revenue?: number;
    orders?: number;
    avgOrderValue?: number;
  };
}

export function MetricCards({ startDate, endDate }: MetricCardsProps) {
  const { user, authenticatedFetch } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!user?.clinicId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/metrics?` +
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
            setMetrics(data.data);
          } else {
            setError(data.message || 'Failed to load metrics');
          }
        } else {
          setError('Failed to load metrics');
        }
      } catch (err) {
        // If it's an unauthorized error, the user will be redirected by authenticatedFetch
        if ((err as Error).message === 'unauthorized') {
          return;
        }
        console.error('Error fetching metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [user?.clinicId, authenticatedFetch, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={`inline-flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const metricItems = [
    {
      title: "Total Revenue",
      value: formatCurrency(metrics.revenue),
      description: metrics.percentageChanges?.revenue !== undefined 
        ? formatPercentage(metrics.percentageChanges.revenue)
        : "No previous data",
      icon: DollarSign,
    },
    {
      title: "Total Orders",
      value: metrics.orderCount.toString(),
      description: metrics.percentageChanges?.orders !== undefined
        ? formatPercentage(metrics.percentageChanges.orders)
        : `${metrics.conversionRate.toFixed(1)}% conversion`,
      icon: ShoppingCart,
    },
    {
      title: "Active Subscriptions",
      value: metrics.activeSubscriptions.toString(),
      description: `${metrics.newPatients} new patients`,
      icon: Users,
    },
    {
      title: "Avg Order Value",
      value: formatCurrency(metrics.avgOrderValue),
      description: metrics.percentageChanges?.avgOrderValue !== undefined
        ? formatPercentage(metrics.percentageChanges.avgOrderValue)
        : `Based on ${metrics.orderCount} orders`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricItems.map((metric) => (
        <Card key={metric.title} className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
              <div className="text-xs text-muted-foreground">{metric.description}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}