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

export default function Payouts() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PayoutsData | null>(null)
  const [selectedTab, setSelectedTab] = useState<"brands" | "doctors" | "pharmacies" | "affiliates">("brands")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchPayouts()
  }, [token, dateFrom, dateTo])

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
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

