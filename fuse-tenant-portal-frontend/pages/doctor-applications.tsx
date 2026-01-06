import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { 
  UserCheck, 
  Mail, 
  Phone, 
  Calendar,
  MapPin,
  Globe,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

interface DoctorApplication {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  npiNumber?: string
  createdAt: string
  activated: boolean
  website?: string
  businessType?: string
  city?: string
  state?: string
  isApprovedDoctor: boolean
}

interface NpiVerification {
  isValid: boolean
  message: string
  providerInfo?: {
    name: string
    credential: string
    primaryTaxonomy: string
    primaryLocation: string
    state: string
  }
}

export default function DoctorApplications() {
  const [applications, setApplications] = useState<DoctorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorApplication | null>(null)
  const [npiVerifications, setNpiVerifications] = useState<Record<string, NpiVerification>>({})
  const [verifyingNpis, setVerifyingNpis] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDoctorApplications()
  }, [])

  const fetchDoctorApplications = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("tenant_token")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

      const response = await fetch(`${apiUrl}/admin/doctor-applications`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const fetchedApplications = data.data || []
        setApplications(fetchedApplications)
        
        // Verify NPIs for all doctors
        fetchedApplications.forEach((doctor: DoctorApplication) => {
          if (doctor.npiNumber) {
            verifyNpi(doctor.npiNumber)
          }
        })
      } else {
        toast.error(data.message || "Failed to fetch doctor applications")
      }
    } catch (error) {
      console.error("Error fetching doctor applications:", error)
      toast.error("Failed to fetch doctor applications")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveClick = (doctor: DoctorApplication) => {
    setSelectedDoctor(doctor)
    setShowConfirmModal(true)
  }

  const handleConfirmApprove = async () => {
    if (!selectedDoctor) return

    try {
      setApprovingId(selectedDoctor.id)
      const token = localStorage.getItem("tenant_token")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

      const response = await fetch(
        `${apiUrl}/admin/doctor-applications/${selectedDoctor.id}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(
          `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName} has been approved!`
        )
        // Remove the approved doctor from the list
        setApplications((prev) =>
          prev.filter((app) => app.id !== selectedDoctor.id)
        )
        setShowConfirmModal(false)
        setSelectedDoctor(null)
      } else {
        toast.error(data.message || "Failed to approve doctor")
      }
    } catch (error) {
      console.error("Error approving doctor:", error)
      toast.error("Failed to approve doctor")
    } finally {
      setApprovingId(null)
    }
  }

  const verifyNpi = async (npi: string) => {
    if (verifyingNpis.has(npi) || npiVerifications[npi]) {
      return // Already verifying or verified
    }

    try {
      setVerifyingNpis((prev) => new Set(prev).add(npi))
      const token = localStorage.getItem("tenant_token")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

      const response = await fetch(`${apiUrl}/admin/verify-npi/${npi}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setNpiVerifications((prev) => ({
          ...prev,
          [npi]: {
            isValid: data.isValid,
            message: data.message,
            providerInfo: data.providerInfo,
          },
        }))
      }
    } catch (error) {
      console.error("Error verifying NPI:", error)
      setNpiVerifications((prev) => ({
        ...prev,
        [npi]: {
          isValid: false,
          message: "Unable to verify",
        },
      }))
    } finally {
      setVerifyingNpis((prev) => {
        const newSet = new Set(prev)
        newSet.delete(npi)
        return newSet
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Page Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-semibold text-[#1F2937] mb-2">
                Doctor Applications
              </h1>
              <p className="text-[#6B7280] text-base">
                Review and approve doctor applications to the Fuse ecosystem
              </p>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                  Pending Applications
                </h3>
                <p className="text-3xl font-bold text-[#1F2937]">
                  {loading ? "..." : applications.length}
                </p>
              </div>
              <div className="bg-[#F3F4F6] rounded-xl p-3">
                <UserCheck className="h-6 w-6 text-[#4FA59C]" />
              </div>
            </div>
          </div>

          {/* Applications List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-[#4FA59C] animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-12 text-center">
              <UserCheck className="h-12 w-12 text-[#9CA3AF] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                No Pending Applications
              </h3>
              <p className="text-[#6B7280]">
                All doctor applications have been reviewed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((doctor) => (
                <div
                  key={doctor.id}
                  className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-6 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-lg font-semibold text-white">
                            {doctor.firstName.charAt(0)}
                            {doctor.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#1F2937]">
                            Dr. {doctor.firstName} {doctor.lastName}
                          </h3>
                          <p className="text-sm text-[#6B7280]">
                            Applied {formatDate(doctor.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                          <Mail className="h-4 w-4 text-[#9CA3AF]" />
                          <a
                            href={`mailto:${doctor.email}`}
                            className="hover:text-[#4FA59C] transition-colors"
                          >
                            {doctor.email}
                          </a>
                        </div>

                        {doctor.phoneNumber && (
                          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                            <Phone className="h-4 w-4 text-[#9CA3AF]" />
                            <span>{doctor.phoneNumber}</span>
                          </div>
                        )}

                        {doctor.npiNumber && (
                          <div className="flex items-center gap-2 text-sm text-[#6B7280] flex-wrap">
                            <FileText className="h-4 w-4 text-[#9CA3AF]" />
                            <span>NPI: {doctor.npiNumber}</span>
                            {verifyingNpis.has(doctor.npiNumber) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Verifying...
                              </span>
                            ) : npiVerifications[doctor.npiNumber] ? (
                              npiVerifications[doctor.npiNumber].isValid ? (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium"
                                  title={npiVerifications[doctor.npiNumber].providerInfo?.name || "Valid NPI"}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Valid for {npiVerifications[doctor.npiNumber].providerInfo?.name || "N/A"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">
                                  <AlertTriangle className="h-3 w-3" />
                                  Invalid
                                </span>
                              )
                            ) : null}
                          </div>
                        )}

                        {(doctor.city || doctor.state) && (
                          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                            <MapPin className="h-4 w-4 text-[#9CA3AF]" />
                            <span>
                              {doctor.city}
                              {doctor.city && doctor.state && ", "}
                              {doctor.state}
                            </span>
                          </div>
                        )}

                        {doctor.website && (
                          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                            <Globe className="h-4 w-4 text-[#9CA3AF]" />
                            <a
                              href={doctor.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#4FA59C] transition-colors"
                            >
                              {doctor.website}
                            </a>
                          </div>
                        )}

                        {doctor.businessType && (
                          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                            <Briefcase className="h-4 w-4 text-[#9CA3AF]" />
                            <span>{doctor.businessType}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                          <Calendar className="h-4 w-4 text-[#9CA3AF]" />
                          <span>
                            Account{" "}
                            {doctor.activated ? "activated" : "not activated"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApproveClick(doctor)}
                      disabled={approvingId === doctor.id}
                      className="ml-4 px-5 py-2.5 bg-[#4FA59C] hover:bg-[#478F87] text-white rounded-xl font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvingId === doctor.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-[#FEF3C7] rounded-xl p-3">
                <AlertTriangle className="h-6 w-6 text-[#F59E0B]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                  Approve Doctor Application?
                </h3>
                <p className="text-sm text-[#6B7280] mb-4">
                  You are about to approve{" "}
                  <strong>
                    Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                  </strong>{" "}
                  as a healthcare provider.
                </p>
              </div>
            </div>

            <div className="bg-[#FEF2F2] border-l-4 border-[#EF4444] p-4 rounded-lg mb-6">
              <p className="text-sm text-[#991B1B] leading-relaxed">
                <strong>⚠️ Important:</strong> Approving someone as a doctor
                will give them high-level permissions to perform medical actions
                within the Fuse ecosystem, including:
              </p>
              <ul className="list-disc list-inside text-sm text-[#991B1B] mt-2 space-y-1">
                <li>Access to patient medical records</li>
                <li>Ability to prescribe medications</li>
                <li>Authorization to conduct consultations</li>
                <li>Manage patient treatments and care plans</li>
              </ul>
              <p className="text-sm text-[#991B1B] mt-3">
                Only approve if you have verified this person is a real, licensed
                healthcare provider.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedDoctor(null)
                }}
                disabled={approvingId !== null}
                className="flex-1 px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-xl font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={approvingId !== null}
                className="flex-1 px-4 py-2.5 bg-[#4FA59C] hover:bg-[#478F87] text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {approvingId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Yes, Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

