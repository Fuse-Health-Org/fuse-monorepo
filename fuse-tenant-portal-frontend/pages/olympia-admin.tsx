import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  UserPlus,
  UserCog,
  Pill,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

// ========== Interfaces ==========

interface OlympiaPatient {
  uuid: string
  first_name: string
  middle_name?: string
  last_name: string
  dob: string
  gender: string
  allergies: string
  medication_list: string
  email: string
  phone?: string
  b_addr_1?: string
  b_addr_2?: string
  b_addr_city?: string
  b_addr_state?: string
  b_addr_zip?: string
  s_addr_1: string
  s_addr_2?: string
  s_addr_city: string
  s_addr_state: string
  s_addr_zip: string
  emr_record_id?: string
  has_pending_prescription?: boolean
  has_processing_prescription?: boolean
}

interface ConnectionConfig {
  hasCredentials: boolean
  tokenValid: boolean
  apiAccessible: boolean
}

interface PrescriptionProduct {
  prod_id: string
  qty: string
  sig: string
  doc_note: string
  refills: string
}

// ========== Component ==========

export default function OlympiaAdmin() {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [activeTab, setActiveTab] = useState<"create-patient" | "search-patient" | "create-prescription">("create-patient")

  // Connection
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("checking")
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null)

  // Create Patient state
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [createPatientForm, setCreatePatientForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    dob: "",
    gender: "M",
    allergies: "",
    medication_list: "",
    email: "",
    phone: "",
    b_addr_1: "",
    b_addr_2: "",
    b_addr_city: "",
    b_addr_state: "",
    b_addr_zip: "",
    s_addr_1: "",
    s_addr_2: "",
    s_addr_city: "",
    s_addr_state: "",
    s_addr_zip: "",
    emr_record_id: "",
    drivers_license_state: "",
    drivers_license_number: "",
    email_opt_in: "",
  })

  // Search Patient state
  const [searchField, setSearchField] = useState("email")
  const [searchValue, setSearchValue] = useState("")
  const [searchWildcard, setSearchWildcard] = useState<"" | "before" | "after" | "both">("")
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [searchResults, setSearchResults] = useState<OlympiaPatient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<OlympiaPatient | null>(null)
  const [updatingPatient, setUpdatingPatient] = useState(false)

  // API Response Logs
  const [apiResponses, setApiResponses] = useState<Array<{
    timestamp: string
    operation: string
    request: any
    response: any
    error?: any
  }>>([])

  const addApiResponse = (operation: string, request: any, response: any, error?: any) => {
    setApiResponses(prev => [{
      timestamp: new Date().toISOString(),
      operation,
      request,
      response,
      error,
    }, ...prev].slice(0, 10)) // Keep last 10 responses
  }

  // Create Prescription state
  const [creatingPrescription, setCreatingPrescription] = useState(false)
  const [prescriptionForm, setPrescriptionForm] = useState({
    patient_id: "",
    physician_fname: "",
    physician_lname: "",
    physician_phone: "",
    physician_npi: "",
    allergies: "", // Defaults to "NKDA" on backend if empty
    med_cond: "", // Defaults to "N/A" on backend if empty
    p_last_visit: "",
    ship_to: "patient",
    vendor_order_id: "", // REQUIRED
    notes: "",
    // ship_method: hardcoded to "overnight" on backend
    // bill_to: hardcoded to "physician" on backend
    // pt_team_username: excluded per Olympia dev guidance
  })
  const [prescriptionProducts, setPrescriptionProducts] = useState<PrescriptionProduct[]>([
    { prod_id: "", qty: "1", sig: "Use as directed.", doc_note: "", refills: "0" },
  ])

  // ========== API Calls ==========

  const checkConnection = async () => {
    setConnectionStatus("checking")
    try {
      const res = await fetch(`${baseUrl}/olympia/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setConnectionStatus(data.success && data.connected ? "connected" : "disconnected")
      setConnectionConfig(data.config || null)
    } catch {
      setConnectionStatus("disconnected")
      setConnectionConfig(null)
    }
  }

  // Check connection on mount
  useState(() => {
    checkConnection()
  })

  const handleCreatePatient = async () => {
    if (!createPatientForm.first_name || !createPatientForm.last_name || !createPatientForm.email || !createPatientForm.dob || !createPatientForm.allergies || !createPatientForm.medication_list || !createPatientForm.s_addr_1 || !createPatientForm.s_addr_city || !createPatientForm.s_addr_state || !createPatientForm.s_addr_zip) {
      toast.error("Please fill in all required fields")
      return
    }

    setCreatingPatient(true)
    try {
      const res = await fetch(`${baseUrl}/olympia/patients`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createPatientForm),
      })
      const data = await res.json()
      if (data.success) {
        addApiResponse("Create Patient", createPatientForm, data.data)
        toast.success(`Patient created! UUID: ${data.data.uuid}`)
      } else {
        addApiResponse("Create Patient", createPatientForm, null, data)
        toast.error(data.message || "Failed to create patient")
      }
    } catch (err: any) {
      addApiResponse("Create Patient", createPatientForm, null, err.message)
      toast.error(err.message || "Failed to create patient")
    } finally {
      setCreatingPatient(false)
    }
  }

  const handleSearchPatients = async () => {
    if (!searchValue.trim()) {
      toast.error("Please enter a search value")
      return
    }

    setSearchingPatients(true)
    setSelectedPatient(null)
    try {
      const searchBody: any = {
        [searchField]: {
          search: searchValue,
          ...(searchWildcard ? { wildcard: searchWildcard } : {}),
        },
      }

      const res = await fetch(`${baseUrl}/olympia/patients/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      })
      const data = await res.json()
      if (data.success) {
        addApiResponse("Search Patients", searchBody, data.data)
        setSearchResults(data.data || [])
        toast.success(`Found ${data.data?.length || 0} patient(s)`)
      } else {
        addApiResponse("Search Patients", searchBody, null, data)
        toast.error(data.message || "Failed to search patients")
      }
    } catch (err: any) {
      addApiResponse("Search Patients", { searchField, searchValue }, null, err.message)
      toast.error(err.message || "Failed to search patients")
    } finally {
      setSearchingPatients(false)
    }
  }

  const handleUpdatePatient = async () => {
    if (!selectedPatient) return

    setUpdatingPatient(true)
    try {
      const res = await fetch(`${baseUrl}/olympia/patients/${selectedPatient.uuid}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedPatient),
      })
      const data = await res.json()
      if (data.success) {
        addApiResponse("Update Patient", selectedPatient, data.data)
        toast.success(`Patient ${selectedPatient.uuid} updated successfully`)
      } else {
        addApiResponse("Update Patient", selectedPatient, null, data)
        toast.error(data.message || "Failed to update patient")
      }
    } catch (err: any) {
      addApiResponse("Update Patient", selectedPatient, null, err.message)
      toast.error(err.message || "Failed to update patient")
    } finally {
      setUpdatingPatient(false)
    }
  }

  const handleCreatePrescription = async () => {
    if (!prescriptionForm.patient_id || !prescriptionForm.physician_fname || !prescriptionForm.physician_lname || !prescriptionForm.physician_npi || !prescriptionForm.vendor_order_id) {
      toast.error("Please fill in all required fields (Patient UUID, Physician info, Vendor Order ID)")
      return
    }

    const validProducts = prescriptionProducts.filter(p => p.prod_id)
    if (validProducts.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    setCreatingPrescription(true)
    try {
      const payload = {
        patient_id: prescriptionForm.patient_id,
        physician: {
          physician_fname: prescriptionForm.physician_fname,
          physician_lname: prescriptionForm.physician_lname,
          physician_phone: prescriptionForm.physician_phone,
          physician_npi: prescriptionForm.physician_npi,
        },
        products: validProducts.map(p => ({
          prod_id: parseInt(p.prod_id),
          qty: parseInt(p.qty) || 1,
          sig: p.sig,
          doc_note: p.doc_note || undefined,
          refills: parseInt(p.refills) || 0,
        })),
        allergies: prescriptionForm.allergies || undefined, // Backend defaults to "NKDA"
        med_cond: prescriptionForm.med_cond || undefined, // Backend defaults to "N/A"
        p_last_visit: prescriptionForm.p_last_visit || undefined,
        ship_to: prescriptionForm.ship_to,
        vendor_order_id: prescriptionForm.vendor_order_id, // Required
        notes: prescriptionForm.notes || undefined,
        // ship_method, bill_to, pt_team_username are handled/excluded by backend
      }

      const res = await fetch(`${baseUrl}/olympia/prescriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        addApiResponse("Create Prescription", payload, data.data)
        toast.success(`Prescription created! ID: ${data.data.prescriptionID}`)
      } else {
        addApiResponse("Create Prescription", payload, null, data)
        toast.error(data.message || "Failed to create prescription")
      }
    } catch (err: any) {
      addApiResponse("Create Prescription", prescriptionForm, null, err.message)
      toast.error(err.message || "Failed to create prescription")
    } finally {
      setCreatingPrescription(false)
    }
  }

  const addProduct = () => {
    setPrescriptionProducts([
      ...prescriptionProducts,
      { prod_id: "", qty: "1", sig: "Use as directed.", doc_note: "", refills: "0" },
    ])
  }

  const removeProduct = (index: number) => {
    if (prescriptionProducts.length <= 1) return
    setPrescriptionProducts(prescriptionProducts.filter((_, i) => i !== index))
  }

  const updateProduct = (index: number, field: keyof PrescriptionProduct, value: string) => {
    const updated = [...prescriptionProducts]
    updated[index] = { ...updated[index], [field]: value }
    setPrescriptionProducts(updated)
  }

  const updatePatientField = (field: string, value: string) => {
    setCreatePatientForm(prev => ({ ...prev, [field]: value }))
  }

  const updateSelectedPatientField = (field: string, value: string) => {
    if (!selectedPatient) return
    setSelectedPatient({ ...selectedPatient, [field]: value })
  }

  // ========== Tab Config ==========

  const tabs = [
    { id: "create-patient" as const, label: "Create Patient", icon: UserPlus },
    { id: "search-patient" as const, label: "Search & Update", icon: UserCog },
    { id: "create-prescription" as const, label: "Create Prescription", icon: Pill },
  ]

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClipboardList className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">Olympia Admin Area</h1>
                <p className="text-gray-600 mt-1">
                  Manage patients and prescriptions in Olympia Pharmacy
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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </div>
              </button>
            ))}
          </div>

          {/* ==================== CREATE PATIENT TAB ==================== */}
          {activeTab === "create-patient" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Create Patient
                  </CardTitle>
                  <CardDescription>
                    Create a new patient in Olympia Pharmacy. If the patient already exists, their existing UUID will be returned.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">First Name <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="John"
                          value={createPatientForm.first_name}
                          onChange={(e) => updatePatientField("first_name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Middle Name</label>
                        <Input
                          placeholder="Michael"
                          value={createPatientForm.middle_name}
                          onChange={(e) => updatePatientField("middle_name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Last Name <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="Doe"
                          value={createPatientForm.last_name}
                          onChange={(e) => updatePatientField("last_name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Date of Birth <span className="text-red-500">*</span></label>
                        <Input
                          type="date"
                          value={createPatientForm.dob}
                          onChange={(e) => updatePatientField("dob", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Gender <span className="text-red-500">*</span></label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value={createPatientForm.gender}
                          onChange={(e) => updatePatientField("gender", e.target.value)}
                        >
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Email <span className="text-red-500">*</span></label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={createPatientForm.email}
                          onChange={(e) => updatePatientField("email", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Phone</label>
                        <Input
                          placeholder="4075551200"
                          value={createPatientForm.phone}
                          onChange={(e) => updatePatientField("phone", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">EMR Record ID</label>
                        <Input
                          placeholder="JD123-456"
                          value={createPatientForm.emr_record_id}
                          onChange={(e) => updatePatientField("emr_record_id", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Medical Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Allergies <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="none / NKDA"
                          value={createPatientForm.allergies}
                          onChange={(e) => updatePatientField("allergies", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Medication List <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="None"
                          value={createPatientForm.medication_list}
                          onChange={(e) => updatePatientField("medication_list", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Shipping Address <span className="text-red-500">*</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Address Line 1 <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="456 Park Place"
                          value={createPatientForm.s_addr_1}
                          onChange={(e) => updatePatientField("s_addr_1", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Address Line 2</label>
                        <Input
                          placeholder="Apt 4B"
                          value={createPatientForm.s_addr_2}
                          onChange={(e) => updatePatientField("s_addr_2", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">City <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="Tampa"
                          value={createPatientForm.s_addr_city}
                          onChange={(e) => updatePatientField("s_addr_city", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">State <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="FL"
                          maxLength={3}
                          value={createPatientForm.s_addr_state}
                          onChange={(e) => updatePatientField("s_addr_state", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">ZIP <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="34287"
                          value={createPatientForm.s_addr_zip}
                          onChange={(e) => updatePatientField("s_addr_zip", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Billing Address (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Address Line 1</label>
                        <Input
                          placeholder="123 Main St"
                          value={createPatientForm.b_addr_1}
                          onChange={(e) => updatePatientField("b_addr_1", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Address Line 2</label>
                        <Input
                          placeholder=""
                          value={createPatientForm.b_addr_2}
                          onChange={(e) => updatePatientField("b_addr_2", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">City</label>
                        <Input
                          placeholder="Miami"
                          value={createPatientForm.b_addr_city}
                          onChange={(e) => updatePatientField("b_addr_city", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">State</label>
                        <Input
                          placeholder="FL"
                          maxLength={3}
                          value={createPatientForm.b_addr_state}
                          onChange={(e) => updatePatientField("b_addr_state", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">ZIP</label>
                        <Input
                          placeholder="32107"
                          value={createPatientForm.b_addr_zip}
                          onChange={(e) => updatePatientField("b_addr_zip", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleCreatePatient}
                    disabled={creatingPatient}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {creatingPatient ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Create Patient
                  </Button>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-medium mb-1">About Patient Creation</p>
                      <p className="text-purple-700">
                        If the patient already exists in Olympia&apos;s system (matched by email), the existing patient UUID will be returned instead of creating a duplicate.
                        The UUID is required when creating prescriptions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== SEARCH & UPDATE PATIENT TAB ==================== */}
          {activeTab === "search-patient" && (
            <div className="space-y-6">
              {/* Search Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Patients
                  </CardTitle>
                  <CardDescription>
                    Search for patients in Olympia Pharmacy by any field
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Search Field</label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value={searchField}
                          onChange={(e) => setSearchField(e.target.value)}
                        >
                          <option value="email">Email</option>
                          <option value="first_name">First Name</option>
                          <option value="last_name">Last Name</option>
                          <option value="dob">Date of Birth</option>
                          <option value="phone">Phone</option>
                          <option value="emr_record_id">EMR Record ID</option>
                          <option value="uuid">UUID</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Search Value</label>
                        <Input
                          placeholder={`Search by ${searchField}...`}
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchPatients()}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Wildcard</label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value={searchWildcard}
                          onChange={(e) => setSearchWildcard(e.target.value as any)}
                        >
                          <option value="">Exact Match</option>
                          <option value="before">Before (ends with)</option>
                          <option value="after">After (starts with)</option>
                          <option value="both">Both (contains)</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      onClick={handleSearchPatients}
                      disabled={searchingPatients}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {searchingPatients ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Search Patients
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Search Results ({searchResults.length})
                    </CardTitle>
                    <CardDescription>
                      Click a patient to select them for editing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {searchResults.map((patient) => (
                        <div
                          key={patient.uuid}
                          onClick={() => setSelectedPatient({ ...patient })}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedPatient?.uuid === patient.uuid
                              ? "border-purple-500 bg-purple-50 shadow-sm"
                              : "hover:border-purple-300"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-semibold text-lg">
                                  {patient.first_name} {patient.middle_name ? `${patient.middle_name} ` : ""}{patient.last_name}
                                </h3>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {patient.uuid}
                                </Badge>
                                {patient.has_pending_prescription && (
                                  <Badge className="bg-yellow-100 text-yellow-800">Pending Rx</Badge>
                                )}
                                {patient.has_processing_prescription && (
                                  <Badge className="bg-blue-100 text-blue-800">Processing Rx</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mt-2">
                                <span>DOB: {patient.dob}</span>
                                <span>Gender: {patient.gender}</span>
                                <span>Email: {patient.email}</span>
                                {patient.phone && <span>Phone: {patient.phone}</span>}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                Shipping: {patient.s_addr_1}, {patient.s_addr_city}, {patient.s_addr_state} {patient.s_addr_zip}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Update Patient Form */}
              {selectedPatient && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCog className="h-5 w-5" />
                      Update Patient: {selectedPatient.first_name} {selectedPatient.last_name}
                    </CardTitle>
                    <CardDescription>
                      UUID: <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{selectedPatient.uuid}</code> — Edit any field below and save
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Personal */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Personal Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">First Name</label>
                          <Input
                            value={selectedPatient.first_name}
                            onChange={(e) => updateSelectedPatientField("first_name", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Middle Name</label>
                          <Input
                            value={selectedPatient.middle_name || ""}
                            onChange={(e) => updateSelectedPatientField("middle_name", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Last Name</label>
                          <Input
                            value={selectedPatient.last_name}
                            onChange={(e) => updateSelectedPatientField("last_name", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Date of Birth</label>
                          <Input
                            type="date"
                            value={selectedPatient.dob}
                            onChange={(e) => updateSelectedPatientField("dob", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Gender</label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                            value={selectedPatient.gender}
                            onChange={(e) => updateSelectedPatientField("gender", e.target.value)}
                          >
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Email</label>
                          <Input
                            type="email"
                            value={selectedPatient.email}
                            onChange={(e) => updateSelectedPatientField("email", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Phone</label>
                          <Input
                            value={selectedPatient.phone || ""}
                            onChange={(e) => updateSelectedPatientField("phone", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">EMR Record ID</label>
                          <Input
                            value={selectedPatient.emr_record_id || ""}
                            onChange={(e) => updateSelectedPatientField("emr_record_id", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Medical */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Medical Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Allergies</label>
                          <Input
                            value={selectedPatient.allergies}
                            onChange={(e) => updateSelectedPatientField("allergies", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Medication List</label>
                          <Input
                            value={selectedPatient.medication_list}
                            onChange={(e) => updateSelectedPatientField("medication_list", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Shipping */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Shipping Address</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium mb-1.5 block">Address Line 1</label>
                          <Input
                            value={selectedPatient.s_addr_1}
                            onChange={(e) => updateSelectedPatientField("s_addr_1", e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium mb-1.5 block">Address Line 2</label>
                          <Input
                            value={selectedPatient.s_addr_2 || ""}
                            onChange={(e) => updateSelectedPatientField("s_addr_2", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">City</label>
                          <Input
                            value={selectedPatient.s_addr_city}
                            onChange={(e) => updateSelectedPatientField("s_addr_city", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">State</label>
                          <Input
                            value={selectedPatient.s_addr_state}
                            onChange={(e) => updateSelectedPatientField("s_addr_state", e.target.value.toUpperCase())}
                            maxLength={3}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">ZIP</label>
                          <Input
                            value={selectedPatient.s_addr_zip}
                            onChange={(e) => updateSelectedPatientField("s_addr_zip", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save */}
                    <Button
                      onClick={handleUpdatePatient}
                      disabled={updatingPatient}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {updatingPatient ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Update Patient
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ==================== CREATE PRESCRIPTION TAB ==================== */}
          {activeTab === "create-prescription" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-5 w-5" />
                    Create Prescription
                  </CardTitle>
                  <CardDescription>
                    Submit a new prescription order to Olympia Pharmacy. A valid patient UUID is required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Patient & Order Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Patient & Order</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Patient UUID <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="e.g., 66df09779557f"
                          value={prescriptionForm.patient_id}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, patient_id: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Vendor Order ID <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="Your internal order ID (required)"
                          value={prescriptionForm.vendor_order_id}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, vendor_order_id: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Physician */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Physician Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">First Name <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="John"
                          value={prescriptionForm.physician_fname}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, physician_fname: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Last Name <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="Doe"
                          value={prescriptionForm.physician_lname}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, physician_lname: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Phone</label>
                        <Input
                          placeholder="1234567890"
                          value={prescriptionForm.physician_phone}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, physician_phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">NPI <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="1234567890"
                          value={prescriptionForm.physician_npi}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, physician_npi: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Medical Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Allergies</label>
                        <Input
                          placeholder="NKDA (default if empty)"
                          value={prescriptionForm.allergies}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, allergies: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Defaults to &quot;NKDA&quot; if left empty</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Medical Conditions</label>
                        <Input
                          placeholder="N/A (default if empty)"
                          value={prescriptionForm.med_cond}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, med_cond: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Defaults to &quot;N/A&quot; if left empty</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Last Visit Date</label>
                        <Input
                          type="date"
                          value={prescriptionForm.p_last_visit}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, p_last_visit: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping & Billing */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Shipping & Billing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Ship Method</label>
                        <div className="w-full border rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-700 font-medium">
                          Overnight
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Hardcoded for this integration</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Ship To</label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value={prescriptionForm.ship_to}
                          onChange={(e) => setPrescriptionForm(prev => ({ ...prev, ship_to: e.target.value }))}
                        >
                          <option value="patient">Patient</option>
                          <option value="physician">Physician</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Bill To</label>
                        <div className="w-full border rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-700 font-medium">
                          Physician
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Always billed to physician</p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Notes</h3>
                    <Input
                      placeholder="Additional notes for the pharmacy..."
                      value={prescriptionForm.notes}
                      onChange={(e) => setPrescriptionForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  {/* Products */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Products <span className="text-red-500">*</span></h3>
                      <Button onClick={addProduct} variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Product
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {prescriptionProducts.map((product, index) => (
                        <div key={index} className="p-4 border rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-700">Product #{index + 1}</span>
                            {prescriptionProducts.length > 1 && (
                              <Button
                                onClick={() => removeProduct(index)}
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Product ID <span className="text-red-500">*</span></label>
                              <Input
                                placeholder="1683"
                                value={product.prod_id}
                                onChange={(e) => updateProduct(index, "prod_id", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Quantity</label>
                              <Input
                                type="number"
                                min="1"
                                value={product.qty}
                                onChange={(e) => updateProduct(index, "qty", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Refills</label>
                              <Input
                                type="number"
                                min="0"
                                value={product.refills}
                                onChange={(e) => updateProduct(index, "refills", e.target.value)}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm font-medium mb-1 block">Sig (Instructions)</label>
                              <Input
                                placeholder="Use as directed."
                                value={product.sig}
                                onChange={(e) => updateProduct(index, "sig", e.target.value)}
                              />
                            </div>
                            <div className="md:col-span-5">
                              <label className="text-sm font-medium mb-1 block">Doctor Notes</label>
                              <Input
                                placeholder="Use once daily as directed."
                                value={product.doc_note}
                                onChange={(e) => updateProduct(index, "doc_note", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleCreatePrescription}
                    disabled={creatingPrescription}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {creatingPrescription ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Pill className="h-4 w-4 mr-2" />
                    )}
                    Create Prescription
                  </Button>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-medium mb-1">About Prescriptions</p>
                      <p className="text-purple-700">
                        A valid Olympia patient UUID is required. Use the &quot;Search &amp; Update&quot; tab to find an existing patient
                        or the &quot;Create Patient&quot; tab to create one first. The <code className="px-1 py-0.5 bg-purple-100 rounded text-xs">vendor_order_id</code> field
                        is used to link this prescription back to your internal order for webhook tracking updates.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== API RESPONSE LOG (VISIBLE ON ALL TABS) ==================== */}
          {apiResponses.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Recent API Responses
                    </CardTitle>
                    <CardDescription>
                      Last 10 API calls to Olympia Pharmacy
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setApiResponses([])}
                    variant="outline"
                    size="sm"
                  >
                    Clear Log
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {apiResponses.map((log, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg ${
                        log.error ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.error ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          <span className="font-semibold text-sm">
                            {log.operation}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {/* Request */}
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Request:</p>
                          <pre className="text-xs bg-white border rounded p-2 overflow-x-auto">
                            {JSON.stringify(log.request, null, 2)}
                          </pre>
                        </div>

                        {/* Response */}
                        {log.response && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Response:</p>
                            <pre className="text-xs bg-white border rounded p-2 overflow-x-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {log.error && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-1">Error:</p>
                            <pre className="text-xs bg-white border border-red-300 rounded p-2 overflow-x-auto text-red-600">
                              {typeof log.error === 'string' ? log.error : JSON.stringify(log.error, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
