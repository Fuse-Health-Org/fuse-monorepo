import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { AffiliateRevenue } from "../components/affiliate-revenue";
import Layout from "../components/Layout";
import { Spinner, Card, CardBody } from "@heroui/react";
import Head from "next/head";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PayoutsData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const isAffiliate = React.useMemo(() => {
    if (!user) return false;
    return user.role === "affiliate" || user.userRoles?.affiliate === true;
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
    if (!authLoading && user && !isAffiliate) {
      router.push("/signin?error=Access denied. Affiliate role required.");
      return;
    }
  }, [user, authLoading, isAffiliate, router]);

  useEffect(() => {
    if (isAffiliate) {
      fetchPayouts();
    }
  }, [isAffiliate, dateFrom, dateTo, currentPage]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      params.append("page", currentPage.toString());
      params.append("limit", "20");

      const response = await apiCall(`/payouts/affiliate?${params.toString()}`, {
        method: "GET",
      });

      if (response.success) {
        let payoutsData = response.data;
        if (payoutsData?.data && typeof payoutsData.data === "object") {
          payoutsData = payoutsData.data;
        }
        setData(payoutsData);
      } else {
        setError(response.error || "Failed to fetch payouts");
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
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || !isAffiliate) {
    return null;
  }

  return (
    <Layout>
      <Head>
        <title>Payouts - Fuse Affiliate Portal</title>
      </Head>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground mt-1">View your payouts from Fuse</p>
          </div>
        </div>

        {/* Summary Card */}
        {data && (
          <Card>
            <CardBody className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-foreground-400 mb-1">Total Payouts</p>
                  <p className="text-3xl font-bold">{formatCurrency(data.summary.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-400 mb-1">Total Orders</p>
                  <p className="text-3xl font-bold">{data.summary.totalOrders}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-400 mb-1">Average per Order</p>
                  <p className="text-3xl font-bold">
                    {data.summary.totalOrders > 0
                      ? formatCurrency(data.summary.totalAmount / data.summary.totalOrders)
                      : formatCurrency(0)}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardBody className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Icon
                    icon="lucide:search"
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-400"
                  />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-divider rounded-md bg-content1 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-divider rounded-md bg-content1 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-divider rounded-md bg-content1 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium mb-1 opacity-0 pointer-events-none">Actions</label>
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSearchQuery("");
                  }}
                  className="w-full px-4 py-2 text-sm font-medium bg-content2 hover:bg-content3 rounded-md transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Payouts List */}
        <Card>
          <CardBody className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <Spinner size="lg" />
                <p className="mt-4 text-foreground-400">Loading payouts...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <Icon icon="lucide:alert-circle" className="h-12 w-12 text-danger mx-auto mb-4" />
                <p className="text-danger">{error}</p>
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-foreground-400">No payouts found</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {filteredPayouts.map((payout) => (
                    <div
                      key={payout.orderId}
                      className="border border-divider rounded-lg p-4 hover:bg-content2 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{payout.orderNumber}</h3>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                payout.status === "paid" || payout.status === "delivered"
                                  ? "bg-success-100 text-success-700"
                                  : payout.status === "processing" || payout.status === "shipped"
                                  ? "bg-warning-100 text-warning-700"
                                  : "bg-default-100 text-default-700"
                              }`}
                            >
                              {payout.status}
                            </span>
                            {payout.paymentStatus === "succeeded" && (
                              <span className="px-2 py-1 text-xs rounded-full bg-success-100 text-success-700 flex items-center gap-1">
                                <Icon icon="lucide:check-circle" className="h-3 w-3" />
                                Paid
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-foreground-400">
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
                            <div className="mt-3 pt-3 border-t border-divider">
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
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-divider">
                    <p className="text-sm text-foreground-400">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm border border-divider rounded-md hover:bg-content2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={currentPage === data.pagination.totalPages}
                        className="px-4 py-2 text-sm border border-divider rounded-md hover:bg-content2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}

