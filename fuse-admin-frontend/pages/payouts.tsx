import { useState, useEffect } from "react"
import Head from "next/head"
import Layout from "@/components/Layout"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Search,
} from "lucide-react"

interface Payout {
  orderId: string
  orderNumber: string
  amount: number
  totalAmount: number
  date: string
  status: string
  paymentStatus?: string
  paidAt?: string
  customer: {
    name: string
    email: string
  } | null
}

interface PayoutsData {
  payouts: Payout[]
  summary: {
    totalAmount: number
    totalOrders: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function Payouts() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PayoutsData | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchPayouts()
  }, [token, dateFrom, dateTo, currentPage])

  const fetchPayouts = async () => {
    if (!token) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (dateFrom) params.append("dateFrom", dateFrom)
      if (dateTo) params.append("dateTo", dateTo)
      params.append("page", currentPage.toString())
      params.append("limit", "20")

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/payouts/brand?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.message || "Failed to load payouts")
        }
      } else {
        setError("Failed to fetch payouts")
      }
    } catch (err) {
      console.error("Error fetching payouts:", err)
      setError("Failed to fetch payouts")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; text: string }> = {
      paid: { variant: "default", text: "Paid" },
      processing: { variant: "secondary", text: "Processing" },
      shipped: { variant: "secondary", text: "Shipped" },
      delivered: { variant: "default", text: "Delivered" },
    }

    const config = statusConfig[status.toLowerCase()] || { variant: "outline" as const, text: status }

    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  const filteredPayouts = data?.payouts.filter((payout) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      payout.orderNumber.toLowerCase().includes(query) ||
      payout.customer?.name.toLowerCase().includes(query) ||
      payout.customer?.email.toLowerCase().includes(query)
    )
  }) || []

  return (
    <Layout>
      <Head>
        <title>Payouts - Fuse</title>
      </Head>
      <div className="p-6 space-y-6">
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
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium mb-1 opacity-0 pointer-events-none">Actions</label>
                <button
                  onClick={() => {
                    setDateFrom("")
                    setDateTo("")
                    setSearchQuery("")
                  }}
                  className="w-full px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payouts List */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading payouts...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
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
                    <div key={payout.orderId} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{payout.orderNumber}</h3>
                            {getStatusBadge(payout.status)}
                            {payout.paymentStatus === "succeeded" && (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
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
                          {payout.customer && (
                            <div className="mt-3 pt-3 border-t">
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
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={currentPage === data.pagination.totalPages}
                        className="px-4 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

