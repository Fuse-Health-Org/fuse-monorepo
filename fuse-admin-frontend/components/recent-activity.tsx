import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

interface Order {
  id: string;
  orderNumber?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  orderItems?: Array<{
    id: string;
    product?: {
      id: string;
      name: string;
    };
  }>;
}

export function RecentActivity() {
  const { user, authenticatedFetch } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      if (!user?.clinicId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/recent-activity?` +
          `clinicId=${user.clinicId}&` +
          `limit=5`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setOrders(data.data);
          } else {
            setError(data.message || 'Failed to load recent activity');
          }
        } else {
          setError('Failed to load recent activity');
        }
      } catch (err) {
        // If it's an unauthorized error, the user will be redirected by authenticatedFetch
        if ((err as Error).message === 'unauthorized') {
          return;
        }
        console.error('Error fetching recent activity:', err);
        setError('Failed to load recent activity');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, [user?.clinicId, authenticatedFetch]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Format order number to show last 6 characters for compact display
  const formatOrderNumber = (orderNumber?: string) => {
    if (!orderNumber) return 'Order';
    // Show format like "ORD-...3526" for compact display
    if (orderNumber.length > 12) {
      return `${orderNumber.slice(0, 4)}...${orderNumber.slice(-4)}`;
    }
    return orderNumber;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Latest orders from your store</p>
        </div>
        <button
          onClick={() => router.push('/orders')}
          className="text-sm text-primary hover:underline"
        >
          View All
        </button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent orders</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const productName = order.orderItems?.[0]?.product?.name || 'Product';
              const itemCount = order.orderItems?.length || 0;

              return (
                <div
                  key={order.id}
                  className="flex items-start space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-mono">
                      {formatOrderNumber(order.orderNumber)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {productName}
                      {itemCount > 1 && ` +${itemCount - 1} more`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrency(order.totalAmount || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeAgo(order.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}