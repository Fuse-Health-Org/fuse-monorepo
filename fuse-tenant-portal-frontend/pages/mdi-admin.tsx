import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  ExternalLink, 
  RefreshCw, 
  Database, 
  Package, 
  Users, 
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  Link2,
  Copy
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

interface Offering {
  id?: string
  offering_id?: string
  name?: string
  title?: string
  description?: string
  status?: string
}

interface MDIProduct {
  id: string
  name: string
  description?: string
  type?: string
}

export default function MDIAdmin() {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [activeTab, setActiveTab] = useState<"offerings" | "pharmacies" | "utils" | "invitation">("offerings")
  
  // Offerings state
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [loadingOfferings, setLoadingOfferings] = useState(false)
  
  // Pharmacies state
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [loadingPharmacies, setLoadingPharmacies] = useState(false)
  const [pharmacySearchTerm, setPharmacySearchTerm] = useState("")
  const [pharmacyCity, setPharmacyCity] = useState("")
  const [pharmacyState, setPharmacyState] = useState("")
  const [pharmacyZip, setPharmacyZip] = useState("")
  
  // Utils state
  const [patientIdForLicense, setPatientIdForLicense] = useState("")
  const [clearingLicense, setClearingLicense] = useState(false)
  
  // Test PDF state
  const [testPdfEmail, setTestPdfEmail] = useState("grrbm2@gmail.com")
  const [sendingTestPdf, setSendingTestPdf] = useState(false)

  useEffect(() => {
    if (activeTab === "offerings") {
      fetchOfferings()
    }
  }, [activeTab])

  const fetchOfferings = async () => {
    setLoadingOfferings(true)
    try {
      const res = await fetch(`${baseUrl}/md/admin/offerings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setOfferings(data.data || [])
        toast.success(`Loaded ${data.count || 0} offerings`)
      } else {
        toast.error(data.message || "Failed to load offerings")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load offerings")
      console.error(err)
    } finally {
      setLoadingOfferings(false)
    }
  }

  const fetchPharmacies = async () => {
    if (!pharmacySearchTerm && !pharmacyCity && !pharmacyState && !pharmacyZip) {
      toast.error("Please enter at least one search parameter")
      return
    }

    setLoadingPharmacies(true)
    try {
      const params = new URLSearchParams()
      if (pharmacySearchTerm) params.append("name", pharmacySearchTerm)
      if (pharmacyCity) params.append("city", pharmacyCity)
      if (pharmacyState) params.append("state", pharmacyState)
      if (pharmacyZip) params.append("zip", pharmacyZip)

      const res = await fetch(
        `${baseUrl}/md/admin/pharmacies?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (data.success) {
        setPharmacies(data.data || [])
        toast.success(`Found ${data.data?.length || 0} pharmacies`)
      } else {
        toast.error(data.message || "Failed to search pharmacies")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search pharmacies")
      console.error(err)
    } finally {
      setLoadingPharmacies(false)
    }
  }

  const handleClearDriverLicense = async () => {
    if (!patientIdForLicense.trim()) {
      toast.error("Please enter a patient ID")
      return
    }

    setClearingLicense(true)
    try {
      const res = await fetch(
        `${baseUrl}/md/admin/patient/${patientIdForLicense}/driver-license`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (data.success) {
        toast.success("Driver license cleared. Patient will need to re-verify.")
        setPatientIdForLicense("")
      } else {
        toast.error(data.message || "Failed to clear driver license")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to clear driver license")
      console.error(err)
    } finally {
      setClearingLicense(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleSendTestPdf = async () => {
    if (!testPdfEmail.trim()) {
      toast.error("Please enter an email address")
      return
    }

    setSendingTestPdf(true)
    try {
      const res = await fetch(`${baseUrl}/test/ironsail-pdf`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: testPdfEmail })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Test PDF sent to ${testPdfEmail}`)
      } else {
        toast.error(data.message || "Failed to send test PDF")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test PDF")
      console.error(err)
    } finally {
      setSendingTestPdf(false)
    }
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <ExternalLink className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">MDI Admin Area</h1>
                <p className="text-gray-600 mt-1">
                  Manage MD Integrations offerings, products, and utilities
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setActiveTab("offerings")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "offerings"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Offerings
              </div>
            </button>
            <button
              onClick={() => setActiveTab("pharmacies")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "pharmacies"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Pharmacies
              </div>
            </button>
            <button
              onClick={() => setActiveTab("utils")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "utils"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Utilities
              </div>
            </button>
            <button
              onClick={() => setActiveTab("invitation")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "invitation"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                MD Invitation Link
              </div>
            </button>
          </div>

          {/* Offerings Tab */}
          {activeTab === "offerings" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        MDI Offerings
                      </CardTitle>
                      <CardDescription>
                        Treatment types/services available for case creation
                      </CardDescription>
                    </div>
                    <Button
                      onClick={fetchOfferings}
                      disabled={loadingOfferings}
                      variant="outline"
                      size="sm"
                    >
                      {loadingOfferings ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingOfferings ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : offerings.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No offerings found</p>
                      <Button onClick={fetchOfferings} variant="outline" className="mt-4">
                        Load Offerings
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offerings.map((offering) => {
                        const id = offering.offering_id || offering.id || "N/A"
                        const name = offering.name || offering.title || "Unnamed Offering"
                        return (
                          <div
                            key={id}
                            className="p-4 border rounded-lg hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-lg">{name}</h3>
                                  {offering.status && (
                                    <Badge
                                      variant={
                                        offering.status === "active" ? "default" : "secondary"
                                      }
                                    >
                                      {offering.status}
                                    </Badge>
                                  )}
                                </div>
                                {offering.description && (
                                  <p className="text-sm text-gray-600 mb-3">
                                    {offering.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                    {id}
                                  </code>
                                  <Button
                                    onClick={() => copyToClipboard(id, "Offering ID")}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                  >
                                    Copy ID
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">About Offerings</p>
                      <p className="text-blue-700">
                        Offerings are treatment types configured in the MD Integrations dashboard. 
                        Link these to your products to enable telehealth case creation. Use the offering_id 
                        when linking products.
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
                        <Database className="h-5 w-5" />
                        DoseSpot Pharmacy Search
                      </CardTitle>
                      <CardDescription>
                        Search for pharmacies in the DoseSpot network
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Search Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Pharmacy Name</label>
                        <Input
                          placeholder="e.g., CVS, Walgreens"
                          value={pharmacySearchTerm}
                          onChange={(e) => setPharmacySearchTerm(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">City</label>
                        <Input
                          placeholder="e.g., Cleveland"
                          value={pharmacyCity}
                          onChange={(e) => setPharmacyCity(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">State</label>
                        <Input
                          placeholder="e.g., OH (2-letter code)"
                          value={pharmacyState}
                          onChange={(e) => setPharmacyState(e.target.value.toUpperCase())}
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">ZIP Code</label>
                        <Input
                          placeholder="e.g., 12345"
                          value={pharmacyZip}
                          onChange={(e) => setPharmacyZip(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <Button
                      onClick={fetchPharmacies}
                      disabled={loadingPharmacies}
                      className="w-full md:w-auto"
                    >
                      {loadingPharmacies ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Search Pharmacies
                    </Button>

                    {/* Results */}
                    {loadingPharmacies ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    ) : pharmacies.length === 0 ? (
                      <div className="text-center py-12">
                        <Database className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Search for DoseSpot pharmacies</p>
                        <p className="text-sm text-gray-500">
                          Enter at least one search parameter to find pharmacies
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600 mb-2">
                          Found {pharmacies.length} pharmacies
                        </div>
                        {pharmacies.map((pharmacy: any, idx: number) => (
                          <div
                            key={pharmacy.id || idx}
                            className="p-4 border rounded-lg hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-lg mb-1">
                                  {pharmacy.name || pharmacy.store_name}
                                </div>
                                {pharmacy.store_name && pharmacy.name !== pharmacy.store_name && (
                                  <div className="text-sm text-gray-600 mb-2">
                                    {pharmacy.store_name}
                                  </div>
                                )}
                                <div className="text-sm text-gray-700 space-y-1">
                                  {pharmacy.address1 && (
                                    <div>{pharmacy.address1}</div>
                                  )}
                                  {pharmacy.address2 && (
                                    <div>{pharmacy.address2}</div>
                                  )}
                                  <div>
                                    {pharmacy.city}, {pharmacy.state} {pharmacy.zip_code}
                                  </div>
                                </div>
                                {pharmacy.id && (
                                  <div className="mt-2">
                                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                      ID: {pharmacy.id}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">About Pharmacy Search</p>
                      <p className="text-blue-700">
                        Search the DoseSpot pharmacy network to find pharmacies for prescriptions. 
                        This searches the same database clinicians use when prescribing medications through MD Integrations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Utilities Tab */}
          {activeTab === "utils" && (
            <div className="space-y-4">
              {/* Test Prescription PDF */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Test Prescription PDF
                  </CardTitle>
                  <CardDescription>
                    Send a sample prescription PDF to test the pharmacy email format
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Recipient Email
                      </label>
                      <Input
                        placeholder="Enter email address"
                        value={testPdfEmail}
                        onChange={(e) => setTestPdfEmail(e.target.value)}
                        type="email"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        PDF will be sent with sample prescription data to test formatting
                      </p>
                    </div>
                    <Button
                      onClick={handleSendTestPdf}
                      disabled={sendingTestPdf || !testPdfEmail.trim()}
                    >
                      {sendingTestPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Send Test PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Clear Driver License */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Clear Driver License
                  </CardTitle>
                  <CardDescription>
                    Remove driver license verification for testing identity verification flow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        MD Patient ID
                      </label>
                      <Input
                        placeholder="Enter mdPatientId (UUID)"
                        value={patientIdForLicense}
                        onChange={(e) => setPatientIdForLicense(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Find this in the User table as mdPatientId field
                      </p>
                    </div>
                    <Button
                      onClick={handleClearDriverLicense}
                      disabled={clearingLicense || !patientIdForLicense.trim()}
                      variant="destructive"
                    >
                      {clearingLicense ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Clear Driver License
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* API Info */}
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="h-5 w-5" />
                    Available API Endpoints
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-3 text-sm">
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        GET /md/admin/offerings
                      </code>
                      <p className="text-amber-800 mt-1">List all available MDI offerings</p>
                    </div>
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        GET /md/admin/pharmacies
                      </code>
                      <p className="text-amber-800 mt-1">Search DoseSpot pharmacies</p>
                    </div>
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        GET /md/admin/products/:productId/offering
                      </code>
                      <p className="text-amber-800 mt-1">Get offering linked to a product</p>
                    </div>
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        POST /md/admin/products/:productId/offering/link
                      </code>
                      <p className="text-amber-800 mt-1">Link existing offering to product</p>
                    </div>
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        DELETE /md/admin/products/:productId/offering
                      </code>
                      <p className="text-amber-800 mt-1">Unlink offering from product</p>
                    </div>
                    <div>
                      <code className="px-2 py-1 bg-amber-100 rounded text-xs">
                        DELETE /md/admin/patient/:patientId/driver-license
                      </code>
                      <p className="text-amber-800 mt-1">Clear driver license for testing</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MD Invitation Link Tab */}
          {activeTab === "invitation" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    MD Invitation Link
                  </CardTitle>
                  <CardDescription>
                    Share this link with brands to invite them to join MD Integrations. Brands that sign up using this link will be automatically configured for MD Integrations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Invitation URL
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={`${process.env.NEXT_PUBLIC_ADMIN_FRONTEND_URL || "http://localhost:3002"}/signup?invitation=mdi`}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${process.env.NEXT_PUBLIC_ADMIN_FRONTEND_URL || "http://localhost:3002"}/signup?invitation=mdi`
                            navigator.clipboard.writeText(url)
                            toast.success("Link copied to clipboard!")
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${process.env.NEXT_PUBLIC_ADMIN_FRONTEND_URL || "http://localhost:3002"}/signup?invitation=mdi`
                            window.open(url, "_blank")
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Brands that register using this link will automatically be configured with MD Integrations format.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-300">
                      <p className="font-medium mb-1">About MD Invitation Link</p>
                      <p className="text-blue-700 dark:text-blue-400">
                        This is a fixed invitation link for MD Integrations. When brands sign up using this link, 
                        they will be automatically configured to use MD Integrations as their doctor portal format. 
                        Share this link with brands you want to invite to the platform.
                      </p>
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
