import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useAuth } from "@/contexts/AuthContext"
import {
  DollarSign,
  Building2,
  User,
  Package,
  TrendingUp,
  Calendar,
  Search,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react"

interface PayoutSummary {
  clinicId?: string
  clinicName?: string
  clinicSlug?: string
  doctorId?: string
  doctorName?: string
  doctorEmail?: string
  pharmacyId?: string
  pharmacyName?: string
  affiliateId?: string
  affiliateName?: string
  affiliateEmail?: string
  totalAmount: number
  orderCount: number
  orders: Array<{
    orderId: string
    orderNumber: string
    amount: number
    date: string
    status: string
    paymentStatus?: string
  }>
}

interface PayoutsData {
  brands: PayoutSummary[]
  doctors: PayoutSummary[]
  pharmacies: PayoutSummary[]
  affiliates: PayoutSummary[]
  totals: {
    totalBrandAmount: number
    totalDoctorAmount: number
    totalPharmacyAmount: number
    totalAffiliateAmount: number
    totalPlatformFee: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface RefundRequestItem {
  id: string
  orderId: string
  clinicId: string
  requestedById: string
  amount: number
  brandCoverageAmount: number
  reason?: string
  status: "pending" | "approved" | "denied"
  reviewedById?: string
  reviewNotes?: string
  reviewedAt?: string
  createdAt: string
  order?: {
    id: string
    orderNumber: string
    totalAmount: number
    brandAmount: number
    status: string
  }
  clinic?: {
    id: string
    name: string
    slug: string
  }
  requestedBy?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  reviewedBy?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export default function Payouts() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PayoutsData | null>(null)
  const [selectedTab, setSelectedTab] = useState<"brands" | "doctors" | "pharmacies" | "affiliates" | "refund-requests">("brands")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Refund request states
  const [refundRequests, setRefundRequests] = useState<RefundRequestItem[]>([])
  const [refundRequestsLoading, setRefundRequestsLoading] = useState(false)
  const [refundRequestsError, setRefundRequestsError] = useState<string | null>(null)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<"approve" | "deny">("approve")
  const [reviewTarget, setReviewTarget] = useState<RefundRequestItem | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [refundRequestFilter, setRefundRequestFilter] = useState<"all" | "pending" | "approved" | "denied">("pending")
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchPayouts()
    fetchRefundRequests()
  }, [token, dateFrom, dateTo])

  useEffect(() => {
    if (selectedTab === "refund-requests") {
      fetchRefundRequests()
    }
  }, [selectedTab])

  const fetchPayouts = async () => {
    if (!token) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (dateFrom) params.append("dateFrom", dateFrom)
      if (dateTo) params.append("dateTo", dateTo)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/payouts/tenant?${params.toString()}`,
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

  const fetchRefundRequests = async () => {
    if (!token) return

    try {
      setRefundRequestsLoading(true)
      setRefundRequestsError(null)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/refund-requests/clinic/all`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRefundRequests(result.data)
        } else {
          setRefundRequestsError(result.message || "Failed to load refund requests")
        }
      } else {
        setRefundRequestsError("Failed to fetch refund requests")
      }
    } catch (err) {
      console.error("Error fetching refund requests:", err)
      setRefundRequestsError("Failed to fetch refund requests")
    } finally {
      setRefundRequestsLoading(false)
    }
  }

  const openReviewModal = (request: RefundRequestItem, action: "approve" | "deny") => {
    setReviewTarget(request)
    setReviewAction(action)
    setReviewNotes("")
    setShowReviewModal(true)
  }

  const handleReviewSubmit = async () => {
    if (!token || !reviewTarget) return

    try {
      setProcessingRequestId(reviewTarget.id)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/refund-requests/${reviewTarget.id}/${reviewAction}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewNotes: reviewNotes || undefined,
          }),
        }
      )

      const result = await response.json()

      if (response.ok && result.success) {
        const actionLabel = reviewAction === "approve" ? "approved" : "denied"
        setActionSuccess(`Refund request for order ${reviewTarget.order?.orderNumber} has been ${actionLabel}.`)
        setShowReviewModal(false)
        setReviewTarget(null)
        setReviewNotes("")
        fetchRefundRequests()
        setTimeout(() => setActionSuccess(null), 5000)
      } else {
        setRefundRequestsError(result.message || `Failed to ${reviewAction} refund request`)
      }
    } catch (err) {
      console.error(`Error ${reviewAction}ing refund request:`, err)
      setRefundRequestsError(`An error occurred while processing the refund request`)
    } finally {
      setProcessingRequestId(null)
    }
  }

  const filteredRefundRequests = refundRequests.filter((r) => {
    if (refundRequestFilter === "all") return true
    return r.status === refundRequestFilter
  })

  const pendingRefundCount = refundRequests.filter((r) => r.status === "pending").length

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
    const statusConfig: Record<string, { color: string; icon: any; text: string }> = {
      paid: { color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800", icon: CheckCircle, text: "Paid" },
      processing: { color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: Clock, text: "Processing" },
      shipped: { color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800", icon: Package, text: "Shipped" },
      delivered: { color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800", icon: CheckCircle, text: "Delivered" },
    }

    const config = statusConfig[status.toLowerCase()] || {
      color: "bg-muted text-muted-foreground border-border",
      icon: Clock,
      text: status,
    }

    const Icon = config.icon

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {config.text}
      </span>
    )
  }

  const filteredData = () => {
    if (!data) return { brands: [], doctors: [], pharmacies: [], affiliates: [] }

    const filterFn = (item: PayoutSummary) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        item.clinicName?.toLowerCase().includes(query) ||
        item.doctorName?.toLowerCase().includes(query) ||
        item.pharmacyName?.toLowerCase().includes(query) ||
        item.affiliateName?.toLowerCase().includes(query) ||
        item.clinicSlug?.toLowerCase().includes(query)
      )
    }

    return {
      brands: data.brands.filter(filterFn),
      doctors: data.doctors.filter(filterFn),
      pharmacies: data.pharmacies.filter(filterFn),
      affiliates: data.affiliates.filter(filterFn),
    }
  }

  const displayData = filteredData()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Page Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Payouts Tracking</h1>
              <p className="text-muted-foreground text-base">Monitor and track all payouts to brands, doctors, pharmacies, and affiliates</p>
            </div>
          </div>

          {/* Summary Cards */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Brand Payouts</h3>
                  <div className="bg-muted rounded-xl p-2">
                    <Building2 className="h-5 w-5 text-[#4FA59C]" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(data.totals.totalBrandAmount)}</p>
                <p className="text-sm text-muted-foreground mt-1">{data.brands.length} brands</p>
              </div>

              <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Doctor Payouts</h3>
                  <div className="bg-muted rounded-xl p-2">
                    <User className="h-5 w-5 text-[#4FA59C]" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(data.totals.totalDoctorAmount)}</p>
                <p className="text-sm text-muted-foreground mt-1">{data.doctors.length} doctors</p>
              </div>

              <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Pharmacy Payouts</h3>
                  <div className="bg-muted rounded-xl p-2">
                    <Package className="h-5 w-5 text-[#4FA59C]" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(data.totals.totalPharmacyAmount)}</p>
                <p className="text-sm text-muted-foreground mt-1">{data.pharmacies.length} pharmacies</p>
              </div>

              <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platform Fees</h3>
                  <div className="bg-muted rounded-xl p-2">
                    <TrendingUp className="h-5 w-5 text-[#4FA59C]" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(data.totals.totalPlatformFee)}</p>
                <p className="text-sm text-muted-foreground mt-1">Total collected</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-xl focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-medium text-muted-foreground mb-1 opacity-0">Clear</label>
                <button
                  onClick={() => {
                    setDateFrom("")
                    setDateTo("")
                    setSearchQuery("")
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-xl hover:bg-muted/80 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card rounded-2xl shadow-sm border border-border">
            <div className="border-b border-border">
              <div className="flex space-x-8 px-6">
                <button
                  onClick={() => setSelectedTab("brands")}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === "brands"
                      ? "border-[#4FA59C] text-[#4FA59C]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Brands ({displayData.brands.length})
                </button>
                <button
                  onClick={() => setSelectedTab("doctors")}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === "doctors"
                      ? "border-[#4FA59C] text-[#4FA59C]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Doctors ({displayData.doctors.length})
                </button>
                <button
                  onClick={() => setSelectedTab("pharmacies")}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === "pharmacies"
                      ? "border-[#4FA59C] text-[#4FA59C]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pharmacies ({displayData.pharmacies.length})
                </button>
                <button
                  onClick={() => setSelectedTab("affiliates")}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    selectedTab === "affiliates"
                      ? "border-[#4FA59C] text-[#4FA59C]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Affiliates ({displayData.affiliates.length})
                </button>
                <button
                  onClick={() => setSelectedTab("refund-requests")}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors relative ${
                    selectedTab === "refund-requests"
                      ? "border-[#4FA59C] text-[#4FA59C]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Refund Requests
                  {pendingRefundCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                      {pendingRefundCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FA59C]"></div>
                  <p className="mt-4 text-muted-foreground">Loading payouts...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-destructive">{error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTab === "brands" &&
                    (displayData.brands.length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">No brand payouts found</p>
                    ) : (
                      displayData.brands.map((brand) => (
                        <div key={brand.clinicId} className="border border-border rounded-xl p-6 hover:shadow-md transition-all bg-card">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{brand.clinicName}</h3>
                              <p className="text-sm text-muted-foreground">{brand.clinicSlug}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(brand.totalAmount)}</p>
                              <p className="text-sm text-muted-foreground">{brand.orderCount} orders</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {brand.orders.slice(0, 5).map((order) => (
                              <div key={order.orderId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(order.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(order.status)}
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                                </div>
                              </div>
                            ))}
                            {brand.orders.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{brand.orders.length - 5} more orders
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ))}

                  {selectedTab === "doctors" &&
                    (displayData.doctors.length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">No doctor payouts found</p>
                    ) : (
                      displayData.doctors.map((doctor) => (
                        <div key={doctor.doctorId} className="border border-border rounded-xl p-6 hover:shadow-md transition-all bg-card">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{doctor.doctorName}</h3>
                              <p className="text-sm text-muted-foreground">{doctor.doctorEmail}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(doctor.totalAmount)}</p>
                              <p className="text-sm text-muted-foreground">{doctor.orderCount} orders</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {doctor.orders.slice(0, 5).map((order) => (
                              <div key={order.orderId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(order.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(order.status)}
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                                </div>
                              </div>
                            ))}
                            {doctor.orders.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{doctor.orders.length - 5} more orders
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ))}

                  {selectedTab === "pharmacies" &&
                    (displayData.pharmacies.length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">No pharmacy payouts found</p>
                    ) : (
                      displayData.pharmacies.map((pharmacy) => (
                        <div key={pharmacy.pharmacyId} className="border border-border rounded-xl p-6 hover:shadow-md transition-all bg-card">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{pharmacy.pharmacyName}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(pharmacy.totalAmount)}</p>
                              <p className="text-sm text-muted-foreground">{pharmacy.orderCount} orders</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {pharmacy.orders.slice(0, 5).map((order) => (
                              <div key={order.orderId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(order.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(order.status)}
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                                </div>
                              </div>
                            ))}
                            {pharmacy.orders.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{pharmacy.orders.length - 5} more orders
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ))}

                  {selectedTab === "affiliates" &&
                    (displayData.affiliates.length === 0 ? (
                      <p className="text-center py-12 text-muted-foreground">No affiliate payouts found</p>
                    ) : (
                      displayData.affiliates.map((affiliate) => (
                        <div
                          key={affiliate.affiliateId}
                          className="border border-border rounded-xl p-6 hover:shadow-md transition-all bg-card"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{affiliate.affiliateName}</h3>
                              <p className="text-sm text-muted-foreground">{affiliate.affiliateEmail}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-foreground">{formatCurrency(affiliate.totalAmount)}</p>
                              <p className="text-sm text-muted-foreground">{affiliate.orderCount} orders</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {affiliate.orders.slice(0, 5).map((order) => (
                              <div key={order.orderId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(order.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(order.status)}
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                                </div>
                              </div>
                            ))}
                            {affiliate.orders.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{affiliate.orders.length - 5} more orders
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ))}

                  {selectedTab === "refund-requests" && (
                    <div className="space-y-4">
                      {/* Success Banner */}
                      {actionSuccess && (
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <p className="text-sm text-green-800 dark:text-green-300">{actionSuccess}</p>
                        </div>
                      )}

                      {/* Error Banner */}
                      {refundRequestsError && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          <p className="text-sm text-red-800 dark:text-red-300">{refundRequestsError}</p>
                        </div>
                      )}

                      {/* Filter Chips */}
                      <div className="flex items-center gap-2">
                        {(["all", "pending", "approved", "denied"] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setRefundRequestFilter(filter)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize ${
                              refundRequestFilter === filter
                                ? "bg-[#4FA59C] text-white border-[#4FA59C]"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                          >
                            {filter}
                            {filter === "pending" && pendingRefundCount > 0 && (
                              <span className="ml-1">({pendingRefundCount})</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {refundRequestsLoading ? (
                        <div className="text-center py-12">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#4FA59C]"></div>
                          <p className="mt-4 text-muted-foreground">Loading refund requests...</p>
                        </div>
                      ) : filteredRefundRequests.length === 0 ? (
                        <div className="text-center py-12">
                          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            {refundRequestFilter === "pending"
                              ? "No pending refund requests"
                              : `No ${refundRequestFilter === "all" ? "" : refundRequestFilter + " "}refund requests found`}
                          </p>
                        </div>
                      ) : (
                        filteredRefundRequests.map((request) => (
                          <div
                            key={request.id}
                            className={`border rounded-xl p-6 transition-all bg-card ${
                              request.status === "pending"
                                ? "border-amber-300 dark:border-amber-700 shadow-sm"
                                : "border-border hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h3 className="text-lg font-semibold text-foreground">
                                    {request.order?.orderNumber || "Unknown Order"}
                                  </h3>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                      request.status === "pending"
                                        ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                        : request.status === "approved"
                                        ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                        : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                                    }`}
                                  >
                                    {request.status === "pending" && <Clock className="h-3 w-3" />}
                                    {request.status === "approved" && <CheckCircle className="h-3 w-3" />}
                                    {request.status === "denied" && <XCircle className="h-3 w-3" />}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                </div>
                                {request.clinic?.name && (
                                  <p className="text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 className="h-3.5 w-3.5" />
                                      {request.clinic.name}
                                    </span>
                                  </p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  Requested by {request.requestedBy?.firstName} {request.requestedBy?.lastName} ({request.requestedBy?.email})
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(request.createdAt)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-foreground">{formatCurrency(request.amount)}</p>
                                <p className="text-xs text-muted-foreground">Refund amount</p>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Order Total</p>
                                <p className="text-sm font-semibold text-foreground">{formatCurrency(request.order?.totalAmount || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Brand Revenue</p>
                                <p className="text-sm font-semibold text-foreground">{formatCurrency(request.order?.brandAmount || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Brand Covers (Full Refund)</p>
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(request.brandCoverageAmount)}</p>
                              </div>
                            </div>

                            {request.reason && (
                              <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                                <p className="text-sm text-foreground">{request.reason}</p>
                              </div>
                            )}

                            {/* Review info for already-reviewed requests */}
                            {request.status !== "pending" && request.reviewedBy && (
                              <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                  {request.status === "approved" ? "Approved" : "Denied"} by
                                </p>
                                <p className="text-sm text-foreground">
                                  {request.reviewedBy.firstName} {request.reviewedBy.lastName} &mdash; {request.reviewedAt ? formatDate(request.reviewedAt) : ""}
                                </p>
                                {request.reviewNotes && (
                                  <p className="text-sm text-muted-foreground mt-1">&ldquo;{request.reviewNotes}&rdquo;</p>
                                )}
                              </div>
                            )}

                            {/* Action Buttons for pending requests */}
                            {request.status === "pending" && (
                              <div className="flex items-center gap-3 pt-2 border-t border-border">
                                <button
                                  onClick={() => openReviewModal(request, "approve")}
                                  disabled={processingRequestId === request.id}
                                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Approve &amp; Process Refund
                                </button>
                                <button
                                  onClick={() => openReviewModal(request, "deny")}
                                  disabled={processingRequestId === request.id}
                                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-muted text-foreground border border-border hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Deny
                                </button>
                                {processingRequestId === request.id && (
                                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Review Refund Request Modal */}
        {showReviewModal && reviewTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-border">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {reviewAction === "approve" ? "Approve Refund Request" : "Deny Refund Request"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviewTarget.order?.orderNumber}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    setReviewTarget(null)
                    setReviewNotes("")
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {reviewAction === "approve" ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-medium mb-1">This will process the refund via Stripe</p>
                        <p>
                          The patient will receive a refund of <strong>{formatCurrency(reviewTarget.amount)}</strong>.
                          Since pharmacy and doctor payments cannot be reversed, the entire refund amount will be charged to the brand.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-800 dark:text-red-300">
                        <p className="font-medium mb-1">This will deny the refund request</p>
                        <p>
                          The patient will not receive a refund. The brand admin will be notified.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refund amount</span>
                    <span className="font-medium text-foreground">{formatCurrency(reviewTarget.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requested by</span>
                    <span className="font-medium text-foreground">
                      {reviewTarget.requestedBy?.firstName} {reviewTarget.requestedBy?.lastName}
                    </span>
                  </div>
                  {reviewTarget.reason && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reason</span>
                      <span className="font-medium text-foreground text-right max-w-[200px]">{reviewTarget.reason}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Review notes <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewAction === "approve"
                        ? "e.g. Verified with brand, refund approved..."
                        : "e.g. Reason for denial..."
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    setReviewTarget(null)
                    setReviewNotes("")
                  }}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewSubmit}
                  disabled={processingRequestId === reviewTarget.id}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    reviewAction === "approve"
                      ? processingRequestId === reviewTarget.id
                        ? "bg-green-300 dark:bg-green-800 text-green-100 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                      : processingRequestId === reviewTarget.id
                      ? "bg-red-300 dark:bg-red-800 text-red-100 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {processingRequestId === reviewTarget.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : reviewAction === "approve" ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Approve &amp; Refund
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Deny Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

