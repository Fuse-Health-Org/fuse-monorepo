import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Ship,
  RefreshCw,
  Package,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Pill,
  Building2,
  ExternalLink,
  Settings,
  ShoppingCart,
  Calendar,
  User
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

interface IronSailPharmacy {
  id: string
  name: string
  slug: string
  status: string
}

interface IronSailMedication {
  medication_id: string
  name: string
  strength: string
  form: string
  formulation: string
  quantity: string
  quantity_units: string
  schedule_code: string
  type: string
  pharmacy: string
  price: string
}

interface PaginationInfo {
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface ConnectionConfig {
  hasCredentials: boolean
  hasSetupToken: boolean
  tokenValid: boolean
  apiAccessible: boolean
}

interface IronSailOrder {
  id: string
  orderId: string
  pharmacyOrderId: string
  status: string
  createdAt: string
  shippedAt?: string
  deliveredAt?: string
  trackingNumber?: string
  trackingUrl?: string
  order?: {
    orderNumber: string
    status: string
    user?: {
      firstName: string
      lastName: string
      email: string
    }
  }
}

export default function IronSailAdmin() {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [activeTab, setActiveTab] = useState<"overview" | "pharmacies" | "products" | "orders" | "config">("overview")

  // Pharmacies state
  const [pharmacies, setPharmacies] = useState<IronSailPharmacy[]>([])
  const [loadingPharmacies, setLoadingPharmacies] = useState(false)

  // Products state
  const [selectedPharmacy, setSelectedPharmacy] = useState<IronSailPharmacy | null>(null)
  const [medications, setMedications] = useState<IronSailMedication[]>([])
  const [loadingMedications, setLoadingMedications] = useState(false)
  const [medicationSearch, setMedicationSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0
  })

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("checking")
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null)
  
  // Orders state
  const [orders, setOrders] = useState<IronSailOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersPagination, setOrdersPagination] = useState<PaginationInfo>({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0
  })

  useEffect(() => {
    checkConnection()
  }, [])

  useEffect(() => {
    if (activeTab === "pharmacies" && pharmacies.length === 0) {
      fetchPharmacies()
    } else if (activeTab === "orders") {
      fetchOrders(1)
    }
  }, [activeTab])

  const checkConnection = async () => {
    setConnectionStatus("checking")
    try {
      const res = await fetch(`${baseUrl}/ironsail/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setConnectionStatus(data.success && data.connected ? "connected" : "disconnected")
      setConnectionConfig(data.config || null)
    } catch {
      setConnectionStatus("disconnected")
      setConnectionConfig(null)
    }
  }

  const fetchPharmacies = async () => {
    setLoadingPharmacies(true)
    try {
      const res = await fetch(`${baseUrl}/ironsail/pharmacies`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setPharmacies(data.data || [])
        toast.success(`Loaded ${data.data?.length || 0} pharmacies`)
      } else {
        toast.error(data.message || "Failed to load pharmacies")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load pharmacies")
      console.error(err)
    } finally {
      setLoadingPharmacies(false)
    }
  }

  const fetchMedications = async (pharmacyId: string, page: number = 1) => {
    setLoadingMedications(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      if (medicationSearch) params.append("search", medicationSearch)

      const res = await fetch(
        `${baseUrl}/ironsail/pharmacies/${pharmacyId}/medications?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (data.success) {
        setMedications(data.data || [])
        setPagination(data.pagination || { page: 1, per_page: 25, total: 0, total_pages: 0 })
        toast.success(`Loaded ${data.data?.length || 0} medications`)
      } else {
        toast.error(data.message || "Failed to load medications")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load medications")
      console.error(err)
    } finally {
      setLoadingMedications(false)
    }
  }

  const handleSelectPharmacy = (pharmacy: IronSailPharmacy) => {
    setSelectedPharmacy(pharmacy)
    setMedications([])
    setPagination({ page: 1, per_page: 25, total: 0, total_pages: 0 })
    setMedicationSearch("")
    fetchMedications(pharmacy.id, 1)
  }

  const handlePageChange = (newPage: number) => {
    if (selectedPharmacy && newPage >= 1 && newPage <= pagination.total_pages) {
      fetchMedications(selectedPharmacy.id, newPage)
    }
  }

  const handleSearchMedications = () => {
    if (selectedPharmacy) {
      fetchMedications(selectedPharmacy.id, 1)
    }
  }

  const handleClearSearch = () => {
    setMedicationSearch("")
    if (selectedPharmacy) {
      fetchMedications(selectedPharmacy.id, 1)
    }
  }

  const fetchOrders = async (page: number = 1) => {
    setLoadingOrders(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("per_page", "25")

      const res = await fetch(
        `${baseUrl}/ironsail/orders?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (data.success) {
        setOrders(data.data || [])
        setOrdersPagination(data.pagination || { page: 1, per_page: 25, total: 0, total_pages: 0 })
      } else {
        toast.error(data.message || "Failed to load orders")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders")
      console.error(err)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleOrdersPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= ordersPagination.total_pages) {
      fetchOrders(newPage)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const copyMedicationAsSpreadsheetRow = (med: IronSailMedication) => {
    // Create tab-separated values (TSV) format for MDI third-party API
    const headers = [
      "Medication/ Offering Name",
      "Pharmacy",
      "Condition/ Category",
      "Priority",
      "Formulation",
      "Strength",
      "Dosing Instructions",
      "Quantity",
      "Unit",
      "Vial Size",
      "Days Supply",
      "Refills",
      "Risks/Benefits for Patient (special necessities for GLPs)",
      "Prescription Category",
      "Intake Type",
      "Head of Clinical Feedback",
      "Head of Clinical Approval 1",
      "Clinical Support Feedback",
      "Clinical Support Approval 2",
      "Medical Feedback",
      "Medical Feedback For:",
      "Medical Review Approval 3",
      "MDI To add to all offerings",
      "Built in MDI",
      "Final Medical Sign Off (new products only)"
    ]

    // Try to infer category and prescription category from medication name
    const medNameLower = med.name?.toLowerCase() || ""
    const formLower = med.formulation?.toLowerCase() || ""
    
    let suggestedCategory = ""
    let suggestedPrescriptionCategory = ""
    let suggestedRisksBenefits = ""
    
    if (medNameLower.includes("semaglutide") || medNameLower.includes("tirzepatide") || medNameLower.includes("retatrutide")) {
      suggestedCategory = "Weight Loss"
      suggestedPrescriptionCategory = "GLP-1 Agonists"
      suggestedRisksBenefits = "Include subcutaneous insulin syringes. Do not increase dosing if severe side effects present."
    } else if (medNameLower.includes("nad")) {
      suggestedCategory = "Longevity"
      suggestedPrescriptionCategory = "Mitochondrial Support / Cellular Energy"
      suggestedRisksBenefits = "Inject slowly into abdominal fat or outer thigh. May cause brief flushing/warmth. Avoid late evening dosing if sleep sensitive"
    } else if (medNameLower.includes("bpc-157") || medNameLower.includes("bpc 157")) {
      suggestedCategory = "Recovery / Healing"
      suggestedPrescriptionCategory = "Peptide Therapy"
    } else if (medNameLower.includes("glutathione")) {
      suggestedCategory = "Longevity"
      suggestedPrescriptionCategory = "Antioxidant Support"
    }

    // Extract vial size from formulation if present (e.g., "4ml" from "Semaglutide 5mg/ml - 4ml (20mg)")
    const vialSizeMatch = formLower.match(/(\d+\.?\d*)\s*ml/i)
    const vialSize = vialSizeMatch ? `${vialSizeMatch[1]}ml` : ""

    // Map unit to match MDI format
    const unitMap: Record<string, string> = {
      "Milliliter": "mL",
      "milliliter": "mL",
      "ML": "mL",
      "Capsule": "Capsule",
      "Tablet": "Tablet"
    }
    const mappedUnit = unitMap[med.quantity_units] || med.quantity_units

    const values = [
      med.formulation || med.name,           // Medication/ Offering Name
      med.pharmacy,                           // Pharmacy
      suggestedCategory,                      // Condition/ Category (REQUIRED - suggested)
      "",                                     // Priority
      med.form === "Injectable" ? "Injection" : med.form, // Formulation
      med.strength,                           // Strength
      "",                                     // Dosing Instructions (REQUIRED - manual entry needed)
      med.quantity,                           // Quantity
      mappedUnit,                             // Unit
      vialSize,                               // Vial Size
      "",                                     // Days Supply (REQUIRED - manual entry needed)
      "",                                     // Refills
      suggestedRisksBenefits,                 // Risks/Benefits (REQUIRED - suggested)
      suggestedPrescriptionCategory,          // Prescription Category
      "White Label",                          // Intake Type (REQUIRED - default to White Label)
      "",                                     // Head of Clinical Feedback
      "FALSE",                                // Head of Clinical Approval 1
      "",                                     // Clinical Support Feedback
      "FALSE",                                // Clinical Support Approval 2
      "",                                     // Medical Feedback
      "",                                     // Medical Feedback For:
      "FALSE",                                // Medical Review Approval 3
      "",                                     // MDI To add to all offerings
      "FALSE",                                // Built in MDI
      "FALSE"                                 // Final Medical Sign Off
    ]

    // Join with tabs for spreadsheet paste
    const headerRow = headers.join("\t")
    const valueRow = values.join("\t")
    const tsvContent = `${headerRow}\n${valueRow}`

    navigator.clipboard.writeText(tsvContent)
    toast.success("Copied with MDI headers! Fill in: Dosing Instructions, Days Supply")
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    return isNaN(num) ? price : `$${num.toFixed(2)}`
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-6 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Ship className="h-6 w-6 text-teal-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">IronSail Admin Area</h1>
                <p className="text-gray-600 mt-1">
                  Browse IronSail pharmacies and product catalog
                </p>
              </div>
              <div className="flex items-center gap-2">
                {connectionStatus === "checking" ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking...
                  </Badge>
                ) : connectionStatus === "connected" ? (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={checkConnection}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === "overview"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab("pharmacies")}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === "pharmacies"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Pharmacies
              </div>
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === "products"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </div>
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === "orders"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Orders
              </div>
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === "config"
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </div>
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Connection Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {connectionStatus === "connected" ? (
                        <>
                          <CheckCircle2 className="h-8 w-8 text-green-500" />
                          <div>
                            <p className="text-2xl font-bold text-green-600">Active</p>
                            <p className="text-sm text-gray-500">API responding</p>
                          </div>
                        </>
                      ) : connectionStatus === "checking" ? (
                        <>
                          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                          <div>
                            <p className="text-2xl font-bold text-gray-600">Checking...</p>
                            <p className="text-sm text-gray-500">Please wait</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-8 w-8 text-red-500" />
                          <div>
                            <p className="text-2xl font-bold text-red-600">Offline</p>
                            <p className="text-sm text-gray-500">Check configuration</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Available Pharmacies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-8 w-8 text-teal-500" />
                      <div>
                        <p className="text-2xl font-bold">{pharmacies.length || "—"}</p>
                        <p className="text-sm text-gray-500">Partner pharmacies</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Product Catalog
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Package className="h-8 w-8 text-teal-500" />
                      <div>
                        <p className="text-2xl font-bold">{pagination.total || "—"}</p>
                        <p className="text-sm text-gray-500">Available medications</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Total Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-8 w-8 text-teal-500" />
                      <div>
                        <p className="text-2xl font-bold">{ordersPagination.total || "—"}</p>
                        <p className="text-sm text-gray-500">Orders sent to IronSail</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Start */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Start Guide</CardTitle>
                  <CardDescription>
                    How to use the IronSail Admin Area
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Browse Pharmacies</p>
                        <p className="text-sm text-gray-600">
                          View all available IronSail partner pharmacies and their status
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <div>
                        <p className="font-medium">View Products</p>
                        <p className="text-sm text-gray-600">
                          Search and view real-time pricing for all available medications
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Track Orders</p>
                        <p className="text-sm text-gray-600">
                          Monitor orders sent to IronSail, including status and tracking information
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      <div>
                        <p className="font-medium">Configuration</p>
                        <p className="text-sm text-gray-600">
                          Check connection status and manage API credentials
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-teal-50 border-teal-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-teal-600 mt-0.5" />
                    <div className="text-sm text-teal-900">
                      <p className="font-medium mb-1">About IronSail Integration</p>
                      <p className="text-teal-700">
                        IronSail (United Pharmacy API) provides access to a network of partner pharmacies
                        with real-time medication pricing. Use this admin area to browse available pharmacies
                        and their product catalogs. Product prices are fetched live from the pharmacy network.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pharmacies Tab */}
          {activeTab === "pharmacies" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        IronSail Pharmacies
                      </CardTitle>
                      <CardDescription>
                        Partner pharmacies available for order routing
                      </CardDescription>
                    </div>
                    <Button
                      onClick={fetchPharmacies}
                      disabled={loadingPharmacies}
                      variant="outline"
                      size="sm"
                    >
                      {loadingPharmacies ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingPharmacies ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : pharmacies.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No pharmacies found</p>
                      <Button onClick={fetchPharmacies} variant="outline" className="mt-4">
                        Load Pharmacies
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pharmacies.map((pharmacy) => (
                        <div
                          key={pharmacy.id}
                          className="p-4 border rounded-lg hover:border-teal-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-teal-100 rounded-lg">
                                  <Building2 className="h-5 w-5 text-teal-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">{pharmacy.name}</h3>
                                  <p className="text-sm text-gray-500">{pharmacy.slug}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                <Badge
                                  variant={pharmacy.status === "active" ? "default" : "secondary"}
                                  className={pharmacy.status === "active" ? "bg-green-100 text-green-800" : ""}
                                >
                                  {pharmacy.status}
                                </Badge>
                                <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                  {pharmacy.id.substring(0, 8)}...
                                </code>
                              </div>
                            </div>
                            <Button
                              onClick={() => {
                                handleSelectPharmacy(pharmacy)
                                setActiveTab("products")
                              }}
                              variant="outline"
                              size="sm"
                              className="text-teal-600 border-teal-200 hover:bg-teal-50"
                            >
                              <Package className="h-4 w-4 mr-1" />
                              View Products
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <div className="space-y-4">
              {/* Pharmacy Selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Select Pharmacy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pharmacies.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600 mb-2">Load pharmacies first</p>
                      <Button onClick={() => { fetchPharmacies(); setActiveTab("pharmacies") }} variant="outline">
                        Go to Pharmacies
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pharmacies.map((pharmacy) => (
                        <Button
                          key={pharmacy.id}
                          onClick={() => handleSelectPharmacy(pharmacy)}
                          variant={selectedPharmacy?.id === pharmacy.id ? "default" : "outline"}
                          className={selectedPharmacy?.id === pharmacy.id ? "bg-teal-600 hover:bg-teal-700" : ""}
                          size="sm"
                        >
                          {pharmacy.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Medications List */}
              {selectedPharmacy && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          {selectedPharmacy.name} - Medications
                        </CardTitle>
                        <CardDescription>
                          {pagination.total > 0
                            ? `Showing ${medications.length} of ${pagination.total} medications`
                            : "Browse available medications with real-time pricing"
                          }
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => fetchMedications(selectedPharmacy.id, pagination.page)}
                        disabled={loadingMedications}
                        variant="outline"
                        size="sm"
                      >
                        {loadingMedications ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Search */}
                    <div className="space-y-3 mb-4">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            placeholder="Search medications..."
                            value={medicationSearch}
                            onChange={(e) => setMedicationSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearchMedications()}
                          />
                        </div>
                        <Button onClick={handleSearchMedications} disabled={loadingMedications}>
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </Button>
                        {medicationSearch && (
                          <Button onClick={handleClearSearch} disabled={loadingMedications} variant="outline">
                            Clear
                          </Button>
                        )}
                      </div>
                      {medicationSearch && (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="font-normal">
                            Searching: {medicationSearch}
                          </Badge>
                          <p className="text-xs text-amber-600">
                            Note: The IronSail API may return partial matches or related products
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Medications Grid */}
                    {loadingMedications ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    ) : medications.length === 0 ? (
                      <div className="text-center py-12">
                        <Pill className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No medications found</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Try adjusting your search or select a different pharmacy
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {medications.map((med, idx) => (
                            <div
                              key={med.medication_id || idx}
                              className="p-4 border rounded-lg hover:border-teal-300 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{med.name}</h3>
                                    <Badge variant="outline" className="text-xs">
                                      {med.type}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">
                                    {med.formulation}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 bg-gray-100 rounded">
                                      <strong>Strength:</strong> {med.strength}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 rounded">
                                      <strong>Form:</strong> {med.form}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 rounded">
                                      <strong>Qty:</strong> {med.quantity} {med.quantity_units}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 rounded">
                                      <strong>Schedule:</strong> {med.schedule_code}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex items-center gap-2">
                                    <Button
                                      onClick={() => copyMedicationAsSpreadsheetRow(med)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs bg-teal-50 border-teal-200 hover:bg-teal-100 text-teal-700"
                                    >
                                      📊 Copy for MDI
                                    </Button>
                                    <div className="flex-1">
                                      <code className="px-2 py-1 bg-gray-50 rounded text-xs font-mono text-gray-500">
                                        ID: {med.medication_id.substring(0, 20)}...
                                      </code>
                                      <Button
                                        onClick={() => copyToClipboard(med.medication_id, "Medication ID")}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs ml-1"
                                      >
                                        Copy ID
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="flex items-center gap-1 text-xl font-bold text-teal-600">
                                    <DollarSign className="h-5 w-5" />
                                    {parseFloat(med.price).toFixed(2)}
                                  </div>
                                  <p className="text-xs text-gray-500">Real-time price</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {pagination.total_pages > 1 && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t">
                            <p className="text-sm text-gray-600">
                              Page {pagination.page} of {pagination.total_pages}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page <= 1 || loadingMedications}
                                variant="outline"
                                size="sm"
                              >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                              </Button>
                              <Button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= pagination.total_pages || loadingMedications}
                                variant="outline"
                                size="sm"
                              >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Info Card */}
              <Card className="bg-teal-50 border-teal-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-teal-600 mt-0.5" />
                    <div className="text-sm text-teal-900">
                      <p className="font-medium mb-1">About Medication Pricing</p>
                      <p className="text-teal-700">
                        All medication prices are fetched in real-time from the IronSail pharmacy network.
                        Prices may vary by pharmacy and are subject to change. Use the medication_id
                        when creating orders through the IronSail API.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        IronSail Orders
                      </CardTitle>
                      <CardDescription>
                        {ordersPagination.total > 0 
                          ? `Showing ${orders.length} of ${ordersPagination.total} orders`
                          : "Orders sent to IronSail pharmacies"
                        }
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => fetchOrders(ordersPagination.page)}
                      disabled={loadingOrders}
                      variant="outline"
                      size="sm"
                    >
                      {loadingOrders ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingOrders ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No IronSail orders found</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Orders will appear here after they are sent to IronSail pharmacies
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            className="p-4 border rounded-lg hover:border-teal-300 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold">{order.pharmacyOrderId}</h3>
                                  <Badge
                                    variant={
                                      order.status === "delivered" ? "default" :
                                      order.status === "shipped" ? "secondary" :
                                      order.status === "cancelled" ? "destructive" :
                                      "outline"
                                    }
                                    className={
                                      order.status === "delivered" ? "bg-green-100 text-green-800" :
                                      order.status === "shipped" ? "bg-blue-100 text-blue-800" :
                                      order.status === "processing" ? "bg-yellow-100 text-yellow-800" :
                                      ""
                                    }
                                  >
                                    {order.status}
                                  </Badge>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>
                                      {order.order?.user?.firstName} {order.order?.user?.lastName}
                                    </span>
                                    <span className="text-gray-400">•</span>
                                    <span>{order.order?.user?.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                      Created: {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  {order.trackingNumber && (
                                    <div className="flex items-center gap-2">
                                      <Package className="h-4 w-4" />
                                      <span>Tracking: {order.trackingNumber}</span>
                                      {order.trackingUrl && (
                                        <a 
                                          href={order.trackingUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-teal-600 hover:underline flex items-center gap-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Track
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {order.shippedAt && (
                                    <div className="text-xs text-gray-500">
                                      Shipped: {new Date(order.shippedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                  {order.deliveredAt && (
                                    <div className="text-xs text-gray-500">
                                      Delivered: {new Date(order.deliveredAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                  {order.order?.orderNumber}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {ordersPagination.total_pages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t">
                          <p className="text-sm text-gray-600">
                            Page {ordersPagination.page} of {ordersPagination.total_pages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleOrdersPageChange(ordersPagination.page - 1)}
                              disabled={ordersPagination.page <= 1 || loadingOrders}
                              variant="outline"
                              size="sm"
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                            <Button
                              onClick={() => handleOrdersPageChange(ordersPagination.page + 1)}
                              disabled={ordersPagination.page >= ordersPagination.total_pages || loadingOrders}
                              variant="outline"
                              size="sm"
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-teal-50 border-teal-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-teal-600 mt-0.5" />
                    <div className="text-sm text-teal-900">
                      <p className="font-medium mb-1">About Order Tracking</p>
                      <p className="text-teal-700">
                        These orders are stored in your database when sent to IronSail pharmacies. 
                        Status updates are received via webhooks from the IronSail API. Orders are 
                        automatically created when MD Integrations sends a prescription_submitted event.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === "config" && (
            <div className="space-y-6">
              {/* Connection Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    API Configuration Status
                  </CardTitle>
                  <CardDescription>
                    Current IronSail API connection configuration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {connectionConfig?.hasCredentials ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">Credentials</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {connectionConfig?.hasCredentials ? "Configured" : "Not configured"}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {connectionConfig?.tokenValid ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">Token Valid</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {connectionConfig?.tokenValid ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {connectionConfig?.apiAccessible ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="font-medium">API Access</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {connectionConfig?.apiAccessible ? "Connected" : "Not connected"}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {connectionConfig?.hasSetupToken ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className="font-medium">Setup Token</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {connectionConfig?.hasSetupToken ? "Available" : "Not set (optional)"}
                        </p>
                      </div>
                    </div>
                    <Button onClick={checkConnection} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Status
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Setup Credentials Warning */}
              {!connectionConfig?.hasCredentials && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      Credentials Not Configured
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm text-red-900">
                      <p>
                        <strong>Important:</strong> The setup token can only be used to create a maximum of
                        <strong> 20 credential pairs</strong> total, and we don't know how many have already been used.
                      </p>
                      <p>
                        To create new credentials, use the <strong>Swagger API Documentation</strong> directly
                        and call the <code className="px-1 py-0.5 bg-red-100 rounded">POST /auth/credentials</code> endpoint
                        with your setup token.
                      </p>
                      <p className="text-red-700">
                        Use this sparingly - only create new credentials when absolutely necessary.
                      </p>
                      <a
                        href="https://sandbox.api.impetusrx.com/pharmacy/api/documentation?tenant=fuse-sandbox"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Swagger Docs to Create Credentials
                      </a>
                      <div className="p-3 bg-white border border-red-200 rounded-lg mt-4">
                        <p className="font-medium mb-2">After creating credentials, add to your .env file:</p>
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {`IRONSAIL_CLIENT_ID=<your_client_id>
IRONSAIL_CLIENT_SECRET=<your_client_secret>`}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* API Documentation Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    API Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <a
                      href="https://sandbox.api.impetusrx.com/pharmacy#quick-start-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-teal-600" />
                      <div>
                        <p className="font-medium">Quick Start Guide</p>
                        <p className="text-sm text-gray-500">Main documentation for the United Pharmacy API</p>
                      </div>
                    </a>
                    <a
                      href="https://sandbox.api.impetusrx.com/pharmacy/api/documentation?tenant=fuse-sandbox"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-teal-600" />
                      <div>
                        <p className="font-medium">Swagger API Documentation</p>
                        <p className="text-sm text-gray-500">Interactive API reference with all endpoints</p>
                      </div>
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Environment Variables Reference */}
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="h-5 w-5" />
                    Environment Variables
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-white rounded border border-amber-200">
                      <code className="text-amber-800">IRONSAIL_API_BASE_URL</code>
                      <p className="text-amber-700 mt-1">
                        Base URL for the API. Default: https://sandbox.api.impetusrx.com/pharmacy/fuse-sandbox/api/v1
                      </p>
                    </div>
                    <div className="p-2 bg-white rounded border border-amber-200">
                      <code className="text-amber-800">IRONSAIL_TENANT</code>
                      <p className="text-amber-700 mt-1">Tenant name. Default: fuse-sandbox</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-amber-200">
                      <code className="text-amber-800">IRONSAIL_CLIENT_ID</code>
                      <p className="text-amber-700 mt-1">Client ID from credential creation</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-amber-200">
                      <code className="text-amber-800">IRONSAIL_CLIENT_SECRET</code>
                      <p className="text-amber-700 mt-1">Client Secret from credential creation</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-amber-200">
                      <code className="text-amber-800">IRONSAIL_SETUP_TOKEN</code>
                      <p className="text-amber-700 mt-1">One-time setup token (optional, can also be entered in UI)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
