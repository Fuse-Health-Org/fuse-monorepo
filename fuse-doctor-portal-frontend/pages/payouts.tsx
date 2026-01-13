import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Head from "next/head";
import { Icon } from "@iconify/react";
import { ApiClient } from "@/lib/api";

interface Payout {
  orderId: string;
  orderNumber: string;
  amount: number;
  totalAmount: number;
  date: string;
  status: string;
  paymentStatus?: string;
  paidAt?: string;
  brand: {
    name: string;
    slug: string;
  } | null;
  customer: {
    name: string;
    email: string;
  } | null;
}

interface PayoutsData {
  payouts: Payout[];
  summary: {
    totalAmount: number;
    totalOrders: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PayoutsPage() {
  const { user, authenticatedFetch, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PayoutsData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const isDoctor = React.useMemo(() => {
    if (!user) return false;
    return user.role === "doctor";
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
    if (!authLoading && user && !isDoctor) {
      router.push("/signin?error=Access denied. Doctor role required.");
      return;
    }
  }, [user, authLoading, isDoctor, router]);

  useEffect(() => {
    if (isDoctor) {
      fetchPayouts();
    }
  }, [isDoctor, dateFrom, dateTo, currentPage]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      params.append("page", currentPage.toString());
      params.append("limit", "20");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await authenticatedFetch(
        `${apiUrl}/payouts/doctor?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch payouts");
      }

      const result = await response.json();
      if (result.success) {
        let payoutsData = result.data;
        if (payoutsData?.data && typeof payoutsData.data === "object") {
          payoutsData = payoutsData.data;
        }
        setData(payoutsData);
      } else {
        setError(result.message || "Failed to fetch payouts");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredPayouts =
    data?.payouts.filter((payout) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        payout.orderNumber.toLowerCase().includes(query) ||
        payout.brand?.name.toLowerCase().includes(query) ||
        payout.customer?.name.toLowerCase().includes(query) ||
        payout.customer?.email.toLowerCase().includes(query)
      );
    }) || [];

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Icon icon="lucide:loader-2" className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading payouts...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || !isDoctor) {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>Payouts - Fuse Doctor Portal</title>
      </Head>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground mt-1">View your earnings from orders</p>
          </div>
        </div>

        {/* Summary Card */}
        {data && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Payouts</p>
                <p className="text-3xl font-bold">{formatCurrency(data.summary.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Orders</p>
                <p className="text-3xl font-bold">{data.summary.totalOrders}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Average per Order</p>
                <p className="text-3xl font-bold">
                  {data.summary.totalOrders > 0
                    ? formatCurrency(data.summary.totalAmount / data.summary.totalOrders)
                    : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search Orders</label>
              <div className="relative">
                <Icon
                  icon="lucide:search"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSearchQuery("");
                }}
                className="w-full px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Payouts List */}
        <div className="bg-card border border-border rounded-lg p-6">
          {loading ? (
            <div className="text-center py-12">
              <Icon icon="lucide:loader-2" className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading payouts...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Icon icon="lucide:alert-circle" className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">{error}</p>
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No payouts found</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {filteredPayouts.map((payout) => (
                  <div
                    key={payout.orderId}
                    className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{payout.orderNumber}</h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              payout.status === "paid" || payout.status === "delivered"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : payout.status === "processing" || payout.status === "shipped"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {payout.status}
                          </span>
                          {payout.paymentStatus === "succeeded" && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
                              <Icon icon="lucide:check-circle" className="h-3 w-3" />
                              Paid
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Payout Amount</p>
                            <p className="text-lg font-bold text-foreground">{formatCurrency(payout.amount)}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Order Total</p>
                            <p>{formatCurrency(payout.totalAmount)}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Date</p>
                            <p>{formatDate(payout.date)}</p>
                            {payout.paidAt && (
                              <p className="text-xs mt-1">Paid: {formatDate(payout.paidAt)}</p>
                            )}
                          </div>
                        </div>
                        {payout.brand && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-sm">
                              <span className="font-medium">Brand:</span> {payout.brand.name}
                            </p>
                          </div>
                        )}
                        {payout.customer && (
                          <div className="mt-2">
                            <p className="text-sm">
                              <span className="font-medium">Customer:</span> {payout.customer.name} ({payout.customer.email})
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={currentPage === data.pagination.totalPages}
                      className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
