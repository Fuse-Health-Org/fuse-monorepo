import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from '@/contexts/AuthContext';
import { User, Clock, CheckCircle, AlertCircle, Package } from "lucide-react"
import Link from 'next/link';

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  payment?: {
    status: string
    paymentMethod: string
  }
  orderItems?: Array<{
    id: string
    quantity: number
    product: {
      id: string
      name: string
      category?: string
    }
  }>
}

interface RecentOrdersProps {
  onMockDataStatusChange?: (isUsingMockData: boolean) => void;
}

const buildMockOrders = (): Order[] => {
  const now = new Date();
  const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();

  return [
    {
      id: 'mock-order-1',
      orderNumber: 'MOCK-1048',
      status: 'shipped',
      totalAmount: 219,
      createdAt: minutesAgo(35),
      user: { id: 'mock-user-1', firstName: 'Emma', lastName: 'Brown', email: 'emma@example.com' },
      payment: { status: 'captured', paymentMethod: 'card' },
      orderItems: [{ id: 'mock-item-1', quantity: 1, product: { id: 'mock-product-1', name: 'GLP-1 Starter Plan' } }],
    },
    {
      id: 'mock-order-2',
      orderNumber: 'MOCK-1047',
      status: 'pending',
      totalAmount: 149,
      createdAt: minutesAgo(92),
      user: { id: 'mock-user-2', firstName: 'James', lastName: 'Walker', email: 'james@example.com' },
      payment: { status: 'processing', paymentMethod: 'card' },
      orderItems: [{ id: 'mock-item-2', quantity: 1, product: { id: 'mock-product-2', name: 'Weight Loss Follow-up' } }],
    },
    {
      id: 'mock-order-3',
      orderNumber: 'MOCK-1046',
      status: 'delivered',
      totalAmount: 265,
      createdAt: minutesAgo(220),
      user: { id: 'mock-user-3', firstName: 'Sophia', lastName: 'Carter', email: 'sophia@example.com' },
      payment: { status: 'paid', paymentMethod: 'card' },
      orderItems: [{ id: 'mock-item-3', quantity: 2, product: { id: 'mock-product-3', name: 'Metabolic Support Kit' } }],
    },
  ];
};

export function RecentOrders({ onMockDataStatusChange }: RecentOrdersProps) {
  const { user, authenticatedFetch } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    onMockDataStatusChange?.(isUsingMockData);
  }, [isUsingMockData, onMockDataStatusChange]);

  useEffect(() => {
    const fetchRecentOrders = async () => {
      if (!user?.clinicId) {
        setOrders(buildMockOrders());
        setIsUsingMockData(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/orders/by-clinic/${user.clinicId}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Show only the 10 most recent orders
            const recentOrders = (data.data.orders || []).slice(0, 10);
            if (recentOrders.length > 0) {
              setOrders(recentOrders);
              setIsUsingMockData(false);
            } else {
              setOrders(buildMockOrders());
              setIsUsingMockData(true);
            }
          } else {
            setOrders(buildMockOrders());
            setIsUsingMockData(true);
          }
        } else {
          setOrders(buildMockOrders());
          setIsUsingMockData(true);
        }
      } catch (err) {
        // If it's an unauthorized error, the user will be redirected by authenticatedFetch
        if ((err as Error).message === 'unauthorized') {
          return;
        }
        console.error('Error fetching orders:', err);
        setOrders(buildMockOrders());
        setIsUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentOrders();
  }, [user?.clinicId, authenticatedFetch]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPaymentStatusBadge = (paymentStatus?: string) => {
    if (!paymentStatus) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    switch (paymentStatus.toLowerCase()) {
      case 'succeeded':
      case 'paid':
      case 'captured':
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Captured
          </Badge>
        );
      case 'requires_capture':
      case 'authorized':
      case 'on_hold':
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            On Hold
          </Badge>
        );
      case 'processing':
      case 'payment_processing':
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      case 'failed':
      case 'cancelled':
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            {paymentStatus}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
            {paymentStatus}
          </Badge>
        );
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Delivered
          </Badge>
        );
      case 'shipped':
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            <Package className="h-3 w-3 mr-1" />
            Shipped
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 text-xs">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border shadow-apple-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-apple-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-foreground">Recent Orders</CardTitle>
          <Link 
            href="/orders" 
            className="text-sm font-medium text-primary hover:text-primary/80 transition-smooth"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.map((order) => (
            <Link 
              key={order.id}
              href={`/orders/${order.id}`}
              className="block"
            >
              <div className="p-4 bg-muted/20 hover:bg-muted/40 rounded-lg transition-smooth border border-transparent hover:border-border cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  {/* Left side - Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-foreground">
                        #{order.orderNumber}
                      </h3>
                      {getOrderStatusBadge(order.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground/70 mb-2">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">
                          {order.user?.firstName} {order.user?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    {order.orderItems && order.orderItems.length > 0 && (
                      <div className="text-xs text-muted-foreground/60 truncate">
                        {order.orderItems.map(item => item.product.name).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Right side - Payment status and amount */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="font-semibold text-foreground">
                      {formatCurrency(order.totalAmount)}
                    </div>
                    {getPaymentStatusBadge(order.payment?.status)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
