import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { Search, Loader2, User as UserIcon, Save, Eye, Building2 } from "lucide-react"
import { toast } from "sonner"
import { MedicalCompanySlug } from "@fuse/enums"

interface BrandSubscriptionPlan {
  id: string
  planType: string
  name: string
  maxProducts: number
  monthlyPrice: number
}

interface TenantCustomFeatures {
  id: string
  userId: string
  canAddCustomProducts: boolean
  hasAccessToAnalytics: boolean
  canUploadCustomProductImages: boolean
  hasCustomPortal: boolean
  hasPrograms: boolean
  canCustomizeFormStructure: boolean
  createdAt: string
  updatedAt: string
}

interface BrandSubscription {
  id: string
  userId: string
  planType: string
  status: string
  monthlyPrice: string
  currentPeriodStart: string
  currentPeriodEnd: string
  productsChangedAmountOnCurrentCycle: number
  retriedProductSelectionForCurrentCycle: boolean
  tutorialFinished: boolean
  customMaxProducts?: number | null
  customMerchantServiceFeePercent?: number | null
  createdAt: string
  updatedAt: string
  plan?: BrandSubscriptionPlan
}

interface UserRoles {
  id: string
  userId: string
  patient: boolean
  doctor: boolean
  admin: boolean
  brand: boolean
  superAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string // deprecated, kept for backwards compatibility
  activated: boolean
  businessType?: string
  createdAt: string
  updatedAt: string
  brandSubscriptions?: BrandSubscription[]
  tenantCustomFeatures?: TenantCustomFeatures | TenantCustomFeatures[]
  userRoles?: UserRoles
}

export default function ClientManagement() {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>('brand')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<BrandSubscriptionPlan[]>([])
  const [updatingRole, setUpdatingRole] = useState(false)
  const [patientPortalDashboardFormat, setPatientPortalDashboardFormat] = useState<string>(MedicalCompanySlug.FUSE)
  const [originalPatientPortalDashboardFormat, setOriginalPatientPortalDashboardFormat] = useState<string>(MedicalCompanySlug.FUSE)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [pendingFormatChange, setPendingFormatChange] = useState<string | null>(null)
  const [checkingData, setCheckingData] = useState(false)
  const [loadingClinicData, setLoadingClinicData] = useState(false)
  const [clinicDataCheck, setClinicDataCheck] = useState<{hasData: boolean, ordersCount: number, paymentsCount: number, prescriptionsCount: number} | null>(null)
  const [mainDoctorId, setMainDoctorId] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<User[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  // Medical companies state
  interface MedicalCompanyItem {
    id: string
    name: string
    slug: string
    apiUrl?: string
    dashboardUrl?: string
    documentationUrl?: string
    visitTypeFees?: {
      synchronous: number
      asynchronous: number
    }
  }
  const [medicalCompanies, setMedicalCompanies] = useState<MedicalCompanyItem[]>([])
  const [selectedMedicalCompany, setSelectedMedicalCompany] = useState<MedicalCompanyItem | null>(null)
  const [loadingMedicalCompanies, setLoadingMedicalCompanies] = useState(false)
  const [savingMedicalCompany, setSavingMedicalCompany] = useState(false)
  const [medicalCompanyForm, setMedicalCompanyForm] = useState({
    name: '',
    slug: '',
    apiUrl: '',
    dashboardUrl: '',
    documentationUrl: '',
    visitTypeFees: {
      synchronous: 0,
      asynchronous: 0,
    },
  })

  interface PharmacyApproval {
    id: string
    name: string
    slug: string
    isActive: boolean
    associationId: string | null
    doctorCompanyApprovedByPharmacy: 'pending' | 'approved' | 'rejected' | null
  }
  const [pharmacyApprovals, setPharmacyApprovals] = useState<PharmacyApproval[]>([])
  const [loadingPharmacies, setLoadingPharmacies] = useState(false)
  const [togglingPharmacy, setTogglingPharmacy] = useState<string | null>(null)

  // Doctor profile form state
  const [savingDoctorProfile, setSavingDoctorProfile] = useState(false)
  const [doctorForm, setDoctorForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dob: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    npiNumber: '',
    isApprovedDoctor: false,
    doctorLicenseStatesCoverage: [] as string[],
    medicalCompanyId: '',
  })

  interface DoctorPharmacyApproval {
    id: string
    name: string
    slug: string
    isActive: boolean
    companyStatus: 'pending' | 'approved' | 'rejected' | null
    doctorOverride: 'pending' | 'approved' | 'rejected' | null
    effectiveStatus: 'pending' | 'approved' | 'rejected'
    hasOverride: boolean
  }
  const [doctorPharmacyApprovals, setDoctorPharmacyApprovals] = useState<DoctorPharmacyApproval[]>([])
  const [loadingDoctorPharmacies, setLoadingDoctorPharmacies] = useState(false)
  const [togglingDoctorPharmacy, setTogglingDoctorPharmacy] = useState<string | null>(null)

  // BrandSubscription form state
  const [formData, setFormData] = useState({
    productsChangedAmountOnCurrentCycle: 0,
    retriedProductSelectionForCurrentCycle: false,
    tutorialFinished: false,
    customMaxProducts: null as number | null,
    customMerchantServiceFeePercent: null as number | null,
    planType: '',
  })

  // Custom features form state
  const [customFeaturesData, setCustomFeaturesData] = useState({
    canAddCustomProducts: false,
    hasAccessToAnalytics: false,
    canUploadCustomProductImages: false,
    hasCustomPortal: false,
    hasPrograms: false,
    canCustomizeFormStructure: false,
  })

  // User roles state
  const [userRolesData, setUserRolesData] = useState({
    patient: false,
    doctor: false,
    admin: false,
    brand: false,
    superAdmin: false,
  })

  useEffect(() => {
    fetchUsers()
    fetchAvailablePlans()
    fetchDoctors()
    fetchMedicalCompanies()
  }, [])

  const fetchMedicalCompanies = async () => {
    setLoadingMedicalCompanies(true)
    try {
      const response = await fetch(`${baseUrl}/medical-companies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch medical companies')
      const result = await response.json()
      setMedicalCompanies(result.data || [])
    } catch (error) {
      console.error('Error fetching medical companies:', error)
    } finally {
      setLoadingMedicalCompanies(false)
    }
  }

  const handleSelectMedicalCompany = (company: MedicalCompanyItem) => {
    setSelectedMedicalCompany(company)
    setSelectedUser(null)
    setMedicalCompanyForm({
      name: company.name || '',
      slug: company.slug || '',
      apiUrl: company.apiUrl || '',
      dashboardUrl: company.dashboardUrl || '',
      documentationUrl: company.documentationUrl || '',
      visitTypeFees: {
        synchronous: company.visitTypeFees?.synchronous || 0,
        asynchronous: company.visitTypeFees?.asynchronous || 0,
      },
    })
    fetchPharmacyApprovals(company.id)
  }

  const fetchPharmacyApprovals = async (companyId: string) => {
    setLoadingPharmacies(true)
    try {
      const response = await fetch(`${baseUrl}/medical-companies/${companyId}/pharmacies`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch pharmacies')
      const result = await response.json()
      setPharmacyApprovals(result.data || [])
    } catch (error) {
      console.error('Error fetching pharmacy approvals:', error)
    } finally {
      setLoadingPharmacies(false)
    }
  }

  const handleTogglePharmacyApproval = async (pharmacyId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    if (!selectedMedicalCompany) return
    setTogglingPharmacy(pharmacyId)
    try {
      const response = await fetch(
        `${baseUrl}/medical-companies/${selectedMedicalCompany.id}/pharmacies/${pharmacyId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ doctorCompanyApprovedByPharmacy: newStatus }),
        }
      )
      if (!response.ok) throw new Error('Failed to update pharmacy approval')
      setPharmacyApprovals(prev =>
        prev.map(p =>
          p.id === pharmacyId
            ? { ...p, doctorCompanyApprovedByPharmacy: newStatus }
            : p
        )
      )
    } catch (error) {
      console.error('Error updating pharmacy approval:', error)
    } finally {
      setTogglingPharmacy(null)
    }
  }

  const handleSaveMedicalCompany = async () => {
    if (!selectedMedicalCompany) return
    setSavingMedicalCompany(true)
    try {
      const response = await fetch(`${baseUrl}/medical-companies/${selectedMedicalCompany.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(medicalCompanyForm),
      })
      if (!response.ok) throw new Error('Failed to update medical company')
      const result = await response.json()
      // Update local state
      setMedicalCompanies(prev => prev.map(c => c.id === selectedMedicalCompany.id ? { ...c, ...medicalCompanyForm } : c))
      setSelectedMedicalCompany({ ...selectedMedicalCompany, ...medicalCompanyForm })
      alert('Medical company updated successfully!')
    } catch (error) {
      console.error('Error saving medical company:', error)
      alert('Failed to save medical company')
    } finally {
      setSavingMedicalCompany(false)
    }
  }

  const fetchAvailablePlans = async () => {
    try {
      const response = await fetch(`${baseUrl}/admin/subscription-plans`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch plans')
      }

      const result = await response.json()
      setAvailablePlans(result.data || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${baseUrl}/admin/users?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const result = await response.json()
      console.log('📦 [Client Mgmt Frontend] Fetched users:', result.data.users.length)
      console.log('📦 [Client Mgmt Frontend] First user subscription:', result.data.users[0]?.brandSubscriptions?.[0])
      setUsers(result.data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchClinicData = async (userId: string) => {
    try {
      const response = await fetch(`${baseUrl}/admin/users/${userId}/clinic`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        const format = result.data?.patientPortalDashboardFormat || MedicalCompanySlug.FUSE
        setPatientPortalDashboardFormat(format)
        setOriginalPatientPortalDashboardFormat(format)
        setMainDoctorId(result.data?.mainDoctorId || result.data?.mainDoctor?.id || null)
      }
    } catch (error) {
      console.error('Error fetching clinic data:', error)
    }
  }

  const fetchDoctors = async () => {
    setLoadingDoctors(true)
    try {
      const response = await fetch(`${baseUrl}/admin/users?role=doctor&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setDoctors(result.data?.users || [])
      }
    } catch (error) {
      console.error('Error fetching doctors:', error)
      toast.error('Failed to load doctors')
    } finally {
      setLoadingDoctors(false)
    }
  }

  const checkClinicData = async (userId: string) => {
    try {
      const response = await fetch(`${baseUrl}/admin/users/${userId}/clinic/data-check`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setClinicDataCheck(result.data)
      }
    } catch (error) {
      console.error('Error checking clinic data:', error)
    }
  }

  const handleSelectUser = async (user: User) => {
    setSelectedMedicalCompany(null)
    console.log('👤 [Client Mgmt Frontend] Selected user:', user)
    console.log('📋 [Client Mgmt Frontend] User subscription:', user.brandSubscriptions?.[0])
    console.log('📦 [Client Mgmt Frontend] Subscription plan:', user.brandSubscriptions?.[0]?.plan)
    const customFeaturesToLog = Array.isArray(user.tenantCustomFeatures)
      ? user.tenantCustomFeatures[0]
      : user.tenantCustomFeatures
    console.log('🎨 [Client Mgmt Frontend] Custom features:', customFeaturesToLog)
    setSelectedUser(user)
    setLoadingClinicData(true)
    setClinicDataCheck(null)
    try {
      await Promise.all([
        fetchClinicData(user.id),
        checkClinicData(user.id)
      ])
    } finally {
      setLoadingClinicData(false)
    }
    const subscription = user.brandSubscriptions?.[0]
    if (subscription) {
      setFormData({
        productsChangedAmountOnCurrentCycle: subscription.productsChangedAmountOnCurrentCycle,
        retriedProductSelectionForCurrentCycle: subscription.retriedProductSelectionForCurrentCycle,
        tutorialFinished: subscription.tutorialFinished,
        customMaxProducts: subscription.customMaxProducts ?? null,
        customMerchantServiceFeePercent: subscription.customMerchantServiceFeePercent ?? null,
        planType: subscription.planType || '',
      })
    } else {
      setFormData({
        productsChangedAmountOnCurrentCycle: 0,
        retriedProductSelectionForCurrentCycle: false,
        tutorialFinished: false,
        customMaxProducts: null,
        customMerchantServiceFeePercent: null,
        planType: '',
      })
    }

    // Load custom features
    // tenantCustomFeatures can be an object (from @HasOne) or array (legacy), handle both
    const customFeatures = Array.isArray(user.tenantCustomFeatures)
      ? user.tenantCustomFeatures[0]
      : user.tenantCustomFeatures
    if (customFeatures) {
      setCustomFeaturesData({
        canAddCustomProducts: customFeatures.canAddCustomProducts || false,
        hasAccessToAnalytics: customFeatures.hasAccessToAnalytics || false,
        canUploadCustomProductImages: customFeatures.canUploadCustomProductImages || false,
        hasCustomPortal: customFeatures.hasCustomPortal || false,
        hasPrograms: customFeatures.hasPrograms || false,
        canCustomizeFormStructure: customFeatures.canCustomizeFormStructure || false,
      })
    } else {
      setCustomFeaturesData({
        canAddCustomProducts: false,
        hasAccessToAnalytics: false,
        canUploadCustomProductImages: false,
        hasCustomPortal: false,
        hasPrograms: false,
        canCustomizeFormStructure: false,
      })
    }

    // Load user roles
    if (user.userRoles) {
      setUserRolesData({
        patient: user.userRoles.patient,
        doctor: user.userRoles.doctor,
        admin: user.userRoles.admin,
        brand: user.userRoles.brand,
        superAdmin: user.userRoles.superAdmin,
      })
    } else {
      // Fallback to deprecated role field
      setUserRolesData({
        patient: user.role === 'patient',
        doctor: user.role === 'doctor',
        admin: user.role === 'admin',
        brand: user.role === 'brand',
        superAdmin: false,
      })
    }

    // Load doctor profile fields
    setDoctorForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: (user as any).phoneNumber || '',
      dob: (user as any).dob || '',
      gender: (user as any).gender || '',
      address: (user as any).address || '',
      city: (user as any).city || '',
      state: (user as any).state || '',
      zipCode: (user as any).zipCode || '',
      npiNumber: (user as any).npiNumber || '',
      isApprovedDoctor: (user as any).isApprovedDoctor || false,
      doctorLicenseStatesCoverage: (user as any).doctorLicenseStatesCoverage || [],
      medicalCompanyId: (user as any).medicalCompanyId || '',
    })

    // Fetch doctor pharmacy approvals if doctor filter is active
    if (roleFilter === 'doctor') {
      fetchDoctorPharmacyApprovals(user.id)
    }
  }

  const fetchDoctorPharmacyApprovals = async (doctorUserId: string) => {
    setLoadingDoctorPharmacies(true)
    try {
      const response = await fetch(`${baseUrl}/medical-companies/doctor/${doctorUserId}/pharmacies`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch doctor pharmacy approvals')
      const result = await response.json()
      setDoctorPharmacyApprovals(result.data || [])
    } catch (error) {
      console.error('Error fetching doctor pharmacy approvals:', error)
    } finally {
      setLoadingDoctorPharmacies(false)
    }
  }

  const handleDoctorPharmacyOverride = async (pharmacyId: string, newStatus: 'pending' | 'approved' | 'rejected' | 'inherit') => {
    if (!selectedUser) return
    setTogglingDoctorPharmacy(pharmacyId)
    try {
      const response = await fetch(
        `${baseUrl}/medical-companies/doctor/${selectedUser.id}/pharmacies/${pharmacyId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ doctorApprovedByPharmacy: newStatus }),
        }
      )
      if (!response.ok) throw new Error('Failed to update doctor pharmacy override')
      // Re-fetch to get updated effective statuses
      await fetchDoctorPharmacyApprovals(selectedUser.id)
    } catch (error) {
      console.error('Error updating doctor pharmacy override:', error)
    } finally {
      setTogglingDoctorPharmacy(null)
    }
  }

  const handleSaveDoctorProfile = async () => {
    if (!selectedUser) return
    setSavingDoctorProfile(true)
    try {
      const response = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/doctor-profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(doctorForm),
      })
      if (!response.ok) throw new Error('Failed to update doctor profile')
      // Update local users state so re-selecting the doctor shows the saved values
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, ...doctorForm } as any : u
      ))
      setSelectedUser({ ...selectedUser, ...doctorForm } as any)
      // Re-fetch pharmacy approvals in case medicalCompanyId changed
      fetchDoctorPharmacyApprovals(selectedUser.id)
      alert('Doctor profile updated successfully!')
    } catch (error) {
      console.error('Error saving doctor profile:', error)
      alert('Failed to save doctor profile')
    } finally {
      setSavingDoctorProfile(false)
    }
  }

  const handleRolesChange = async () => {
    if (!selectedUser) return

    setUpdatingRole(true)
    try {
      const response = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/roles`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userRolesData),
      })

      if (!response.ok) {
        throw new Error('Failed to update user roles')
      }

      const result = await response.json()
      console.log('✅ Updated user roles:', result.data)

      const activeRoles = Object.entries(userRolesData)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)

      toast.success(`Roles updated: ${activeRoles.join(', ') || 'none'}`)

      // Update the selected user
      const updatedUser = {
        ...selectedUser,
        userRoles: {
          ...selectedUser.userRoles!,
          ...userRolesData,
        },
      }
      setSelectedUser(updatedUser)

      // Also update in the users list
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === selectedUser.id
            ? updatedUser
            : u
        )
      )
    } catch (error) {
      console.error('Error updating user roles:', error)
      toast.error('Failed to update user roles')
    } finally {
      setUpdatingRole(false)
    }
  }

  const handlePreview = async () => {
    if (!selectedUser) return

    setPreviewing(true)
    try {
      const response = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/impersonate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to generate impersonation token')
      }

      const result = await response.json()

      // Determine the admin portal URL based on environment
      const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true'
      const isLocal = window.location.hostname === 'localhost'

      let adminPortalUrl: string
      if (isLocal) {
        adminPortalUrl = 'http://localhost:3002'
      } else if (isStaging) {
        adminPortalUrl = 'https://app.fusehealthstaging.xyz'
      } else {
        adminPortalUrl = 'https://app.fusehealth.com'
      }

      // Redirect to admin portal with the impersonation token
      const previewUrl = `${adminPortalUrl}?impersonateToken=${result.token}`
      window.open(previewUrl, '_blank')

      toast.success(`Opening preview for ${selectedUser.firstName} ${selectedUser.lastName}`)
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error('Failed to generate preview')
    } finally {
      setPreviewing(false)
    }
  }

  const handleSave = async (forceUpdateFormat = false) => {
    if (!selectedUser) return

    setSaving(true)
    try {
      // Check if patientPortalDashboardFormat changed
      const formatChanged = patientPortalDashboardFormat !== originalPatientPortalDashboardFormat
      
      // If format changed and there's existing data, show warning (unless forceUpdate is true)
      if (formatChanged && clinicDataCheck?.hasData && !forceUpdateFormat) {
        setPendingFormatChange(patientPortalDashboardFormat)
        setShowWarningModal(true)
        setSaving(false)
        return
      }

      // Update subscription settings
      const subscriptionResponse = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/brand-subscription`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!subscriptionResponse.ok) {
        throw new Error('Failed to update subscription')
      }

      const subscriptionResult = await subscriptionResponse.json()
      console.log('✅ [Client Mgmt Frontend] Subscription save response:', subscriptionResult)

      // Update custom features
      const featuresResponse = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/custom-features`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customFeaturesData),
      })

      if (!featuresResponse.ok) {
        throw new Error('Failed to update custom features')
      }

      const featuresResult = await featuresResponse.json()
      console.log('✅ [Client Mgmt Frontend] Features save response:', featuresResult)

      // Update patient portal dashboard format if changed
      if (formatChanged) {
        const formatResponse = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/clinic/patient-portal-dashboard-format`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patientPortalDashboardFormat: patientPortalDashboardFormat,
            forceUpdate: forceUpdateFormat,
          }),
        })

        if (!formatResponse.ok) {
          const errorData = await formatResponse.json()
          throw new Error(errorData.message || 'Failed to update patient portal dashboard format')
        }

        const formatResult = await formatResponse.json()
        console.log('✅ [Client Mgmt Frontend] Format save response:', formatResult)
        setOriginalPatientPortalDashboardFormat(patientPortalDashboardFormat)
      }

      // Update main doctor if patientPortalDashboardFormat is FUSE
      if (patientPortalDashboardFormat === MedicalCompanySlug.FUSE) {
        const mainDoctorResponse = await fetch(`${baseUrl}/admin/users/${selectedUser.id}/clinic/main-doctor`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mainDoctorId: mainDoctorId || null,
          }),
        })

        if (!mainDoctorResponse.ok) {
          const errorData = await mainDoctorResponse.json()
          throw new Error(errorData.message || 'Failed to update main doctor')
        }

        const mainDoctorResult = await mainDoctorResponse.json()
        console.log('✅ [Client Mgmt Frontend] Main doctor save response:', mainDoctorResult)
      }

      toast.success('Settings updated successfully')

      // Update the selected user with the response data
      const updatedUser = {
        ...selectedUser,
        brandSubscriptions: subscriptionResult.data ? [subscriptionResult.data] : selectedUser.brandSubscriptions,
        tenantCustomFeatures: featuresResult.data || selectedUser.tenantCustomFeatures,
      }
      setSelectedUser(updatedUser)

      // Also update in the users list
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === selectedUser.id
            ? updatedUser
            : u
        )
      )
    } catch (error) {
      console.error('Error updating settings:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmFormatChange = () => {
    setShowWarningModal(false)
    setPendingFormatChange(null)
    // Save with forceUpdate = true
    handleSave(true)
  }

  const handleCancelFormatChange = () => {
    setShowWarningModal(false)
    setPendingFormatChange(null)
    setPatientPortalDashboardFormat(originalPatientPortalDashboardFormat)
  }

  const filteredUsers = users.filter(user => {
    // Role filter
    if (user.role !== roleFilter) return false

    // Search filter
    const search = searchTerm.toLowerCase()
    return (
      user.firstName.toLowerCase().includes(search) ||
      user.lastName.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    )
  })

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Select a user to manage</CardDescription>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {[
                      { value: 'brand', label: 'Brands' },
                      { value: 'doctor', label: 'Doctors' },
                      { value: 'patient', label: 'Patients' },
                      { value: 'affiliate', label: 'Affiliates' },
                      { value: 'admin', label: 'Admins' },
                      { value: 'medical_company', label: 'Medical Companies' },
                    ].map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => {
                          setRoleFilter(role.value)
                          setSearchTerm('')
                          if (role.value === 'medical_company') {
                            setSelectedUser(null)
                          } else {
                            setSelectedMedicalCompany(null)
                          }
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                          roleFilter === role.value
                            ? 'bg-[#4FA59C] text-white border-[#4FA59C]'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {roleFilter === 'medical_company' ? (
                    // Medical Companies list
                    loadingMedicalCompanies ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-[#4FA59C]" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {medicalCompanies
                          .filter(c => {
                            if (!searchTerm) return true
                            const search = searchTerm.toLowerCase()
                            return c.name.toLowerCase().includes(search) || c.slug.toLowerCase().includes(search)
                          })
                          .map((company) => (
                          <button
                            key={company.id}
                            onClick={() => handleSelectMedicalCompany(company)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${selectedMedicalCompany?.id === company.id
                              ? 'bg-[#4FA59C] text-white'
                              : 'bg-muted/50 hover:bg-muted text-foreground'
                              }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedMedicalCompany?.id === company.id
                                ? 'bg-white/20'
                                : 'bg-[#4FA59C]/10'
                                }`}>
                                <Building2 className={`h-5 w-5 ${selectedMedicalCompany?.id === company.id
                                  ? 'text-white'
                                  : 'text-[#4FA59C]'
                                  }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{company.name}</p>
                                <p className={`text-xs truncate ${selectedMedicalCompany?.id === company.id
                                  ? 'text-white/80'
                                  : 'text-muted-foreground'
                                  }`}>
                                  {company.slug}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {medicalCompanies.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">No medical companies found</p>
                        )}
                      </div>
                    )
                  ) : (
                    // Users list
                    loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-[#4FA59C]" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${selectedUser?.id === user.id
                              ? 'bg-[#4FA59C] text-white'
                              : 'bg-muted/50 hover:bg-muted text-foreground'
                              }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedUser?.id === user.id
                                ? 'bg-white/20'
                                : 'bg-[#4FA59C]/10'
                                }`}>
                                <UserIcon className={`h-5 w-5 ${selectedUser?.id === user.id
                                  ? 'text-white'
                                  : 'text-[#4FA59C]'
                                  }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className={`text-xs truncate ${selectedUser?.id === user.id
                                  ? 'text-white/80'
                                  : 'text-muted-foreground'
                                  }`}>
                                  {user.email}
                                </p>
                                <p className={`text-xs mt-1 ${selectedUser?.id === user.id
                                  ? 'text-white/70'
                                  : 'text-muted-foreground'
                                  }`}>
                                  Role: {user.role}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {filteredUsers.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">No users found</p>
                        )}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

              {/* Right Panel */}
              {roleFilter === 'medical_company' ? (
                // Medical Company Details
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Medical Company Settings</CardTitle>
                    <CardDescription>
                      View and edit medical company details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedMedicalCompany ? (
                      <div className="space-y-6">
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Company Information</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Name</label>
                              <Input
                                value={medicalCompanyForm.name}
                                onChange={(e) => setMedicalCompanyForm({ ...medicalCompanyForm, name: e.target.value })}
                                placeholder="Company name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Slug</label>
                              <Input
                                value={medicalCompanyForm.slug}
                                onChange={(e) => setMedicalCompanyForm({ ...medicalCompanyForm, slug: e.target.value })}
                                placeholder="company-slug"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">API URL</label>
                              <Input
                                value={medicalCompanyForm.apiUrl}
                                onChange={(e) => setMedicalCompanyForm({ ...medicalCompanyForm, apiUrl: e.target.value })}
                                placeholder="https://api.example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Dashboard URL</label>
                              <Input
                                value={medicalCompanyForm.dashboardUrl}
                                onChange={(e) => setMedicalCompanyForm({ ...medicalCompanyForm, dashboardUrl: e.target.value })}
                                placeholder="https://dashboard.example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Documentation URL</label>
                              <Input
                                value={medicalCompanyForm.documentationUrl}
                                onChange={(e) => setMedicalCompanyForm({ ...medicalCompanyForm, documentationUrl: e.target.value })}
                                placeholder="https://docs.example.com"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Visit Type Fees</h3>
                          <p className="text-xs text-muted-foreground mb-4">
                            These fees are used platform-wide for this medical company (Fuse, MDI, or Beluga).
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Synchronous Visit Fee (USD)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={medicalCompanyForm.visitTypeFees.synchronous}
                                onChange={(e) =>
                                  setMedicalCompanyForm({
                                    ...medicalCompanyForm,
                                    visitTypeFees: {
                                      ...medicalCompanyForm.visitTypeFees,
                                      synchronous: Number(e.target.value) || 0,
                                    },
                                  })
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Asynchronous Visit Fee (USD)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={medicalCompanyForm.visitTypeFees.asynchronous}
                                onChange={(e) =>
                                  setMedicalCompanyForm({
                                    ...medicalCompanyForm,
                                    visitTypeFees: {
                                      ...medicalCompanyForm.visitTypeFees,
                                      asynchronous: Number(e.target.value) || 0,
                                    },
                                  })
                                }
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={handleSaveMedicalCompany}
                          disabled={savingMedicalCompany}
                          className="bg-[#4FA59C] hover:bg-[#3d8a82] text-white"
                        >
                          {savingMedicalCompany ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {savingMedicalCompany ? 'Saving...' : 'Save Changes'}
                        </Button>

                        {/* Pharmacy Approvals */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Pharmacy Approvals</h3>
                          <p className="text-xs text-muted-foreground mb-4">
                            Toggle whether each pharmacy has approved this medical company.
                          </p>
                          {loadingPharmacies ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-6 w-6 animate-spin text-[#4FA59C]" />
                            </div>
                          ) : pharmacyApprovals.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No pharmacies found</p>
                          ) : (
                            <div className="space-y-3">
                              {pharmacyApprovals.map((pharmacy) => {
                                const currentStatus = pharmacy.doctorCompanyApprovedByPharmacy || 'pending'
                                const isUpdating = togglingPharmacy === pharmacy.id
                                return (
                                  <div
                                    key={pharmacy.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                                  >
                                    <div className="flex-1 min-w-0 mr-3">
                                      <p className="font-medium text-sm text-foreground">{pharmacy.name}</p>
                                      <p className="text-xs text-muted-foreground">{pharmacy.slug}</p>
                                    </div>
                                    <div className={`flex rounded-lg border border-border overflow-hidden ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                                      {([
                                        { value: 'pending', label: 'Pending', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
                                        { value: 'approved', label: 'Approved', activeClass: 'bg-[#4FA59C] text-white border-[#4FA59C]' },
                                        { value: 'rejected', label: 'Rejected', activeClass: 'bg-red-500 text-white border-red-500' },
                                      ] as const).map((option) => (
                                        <button
                                          key={option.value}
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() => {
                                            if (currentStatus !== option.value) {
                                              handleTogglePharmacyApproval(pharmacy.id, option.value)
                                            }
                                          }}
                                          className={`px-2.5 py-1 text-xs font-medium transition-all ${
                                            currentStatus === option.value
                                              ? option.activeClass
                                              : 'bg-background text-muted-foreground hover:bg-muted'
                                          }`}
                                        >
                                          {option.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Building2 className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium">No Medical Company Selected</p>
                        <p className="text-sm mt-2">Select a medical company from the list to view and edit its settings</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : roleFilter === 'doctor' ? (
                // Doctor Profile Details
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Doctor Profile</CardTitle>
                    <CardDescription>
                      View and edit doctor information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedUser ? (
                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Basic Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">First Name</label>
                              <Input
                                value={doctorForm.firstName}
                                onChange={(e) => setDoctorForm({ ...doctorForm, firstName: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Last Name</label>
                              <Input
                                value={doctorForm.lastName}
                                onChange={(e) => setDoctorForm({ ...doctorForm, lastName: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Email</label>
                              <Input
                                value={doctorForm.email}
                                onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Phone Number</label>
                              <Input
                                value={doctorForm.phoneNumber}
                                onChange={(e) => setDoctorForm({ ...doctorForm, phoneNumber: e.target.value })}
                                placeholder="(555) 123-4567"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Date of Birth</label>
                              <Input
                                type="date"
                                value={doctorForm.dob}
                                onChange={(e) => setDoctorForm({ ...doctorForm, dob: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Gender</label>
                              <select
                                value={doctorForm.gender}
                                onChange={(e) => setDoctorForm({ ...doctorForm, gender: e.target.value })}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">Select...</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Address</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Street Address</label>
                              <Input
                                value={doctorForm.address}
                                onChange={(e) => setDoctorForm({ ...doctorForm, address: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm text-muted-foreground mb-1">City</label>
                                <Input
                                  value={doctorForm.city}
                                  onChange={(e) => setDoctorForm({ ...doctorForm, city: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-muted-foreground mb-1">State</label>
                                <Input
                                  value={doctorForm.state}
                                  onChange={(e) => setDoctorForm({ ...doctorForm, state: e.target.value })}
                                  placeholder="e.g. CA"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-muted-foreground mb-1">Zip Code</label>
                                <Input
                                  value={doctorForm.zipCode}
                                  onChange={(e) => setDoctorForm({ ...doctorForm, zipCode: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Medical Credentials */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Medical Credentials</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">NPI Number</label>
                              <Input
                                value={doctorForm.npiNumber}
                                onChange={(e) => setDoctorForm({ ...doctorForm, npiNumber: e.target.value })}
                                placeholder="10-digit NPI"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">
                                License States Coverage
                              </label>
                              <Input
                                value={doctorForm.doctorLicenseStatesCoverage.join(', ')}
                                onChange={(e) => setDoctorForm({
                                  ...doctorForm,
                                  doctorLicenseStatesCoverage: e.target.value
                                    .split(',')
                                    .map(s => s.trim().toUpperCase())
                                    .filter(s => s.length > 0),
                                })}
                                placeholder="CA, NY, TX (comma separated)"
                              />
                              <p className="text-xs text-muted-foreground mt-1">Enter state codes separated by commas</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="block text-sm font-medium text-foreground">Approved Doctor</label>
                                <p className="text-xs text-muted-foreground">Whether this doctor is approved to practice on the platform</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDoctorForm({ ...doctorForm, isApprovedDoctor: !doctorForm.isApprovedDoctor })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 ${
                                  doctorForm.isApprovedDoctor ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    doctorForm.isApprovedDoctor ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Medical Company */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-4">Medical Company</h3>
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">Assigned Medical Company</label>
                            <select
                              value={doctorForm.medicalCompanyId}
                              onChange={(e) => setDoctorForm({ ...doctorForm, medicalCompanyId: e.target.value })}
                              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="">None</option>
                              {medicalCompanies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name} ({company.slug})
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-1">
                              The doctor inherits pharmacy approvals from their medical company. Save the profile to apply changes.
                            </p>
                          </div>
                        </div>

                        {/* Pharmacy Approvals */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-2">Pharmacy Approvals</h3>
                          <p className="text-xs text-muted-foreground mb-4">
                            By default, the doctor inherits the approval status from their medical company.
                            You can override per pharmacy.
                          </p>
                          {loadingDoctorPharmacies ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-6 w-6 animate-spin text-[#4FA59C]" />
                            </div>
                          ) : doctorPharmacyApprovals.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No pharmacies found</p>
                          ) : (
                            <div className="space-y-3">
                              {doctorPharmacyApprovals.map((pharmacy) => {
                                const isUpdating = togglingDoctorPharmacy === pharmacy.id
                                return (
                                  <div
                                    key={pharmacy.id}
                                    className="p-3 rounded-lg border border-border bg-background"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex-1 min-w-0 mr-3">
                                        <p className="font-medium text-sm text-foreground">{pharmacy.name}</p>
                                        <p className="text-xs text-muted-foreground">{pharmacy.slug}</p>
                                      </div>
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        pharmacy.effectiveStatus === 'approved'
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                          : pharmacy.effectiveStatus === 'pending'
                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      }`}>
                                        {pharmacy.effectiveStatus.charAt(0).toUpperCase() + pharmacy.effectiveStatus.slice(1)}
                                        {pharmacy.hasOverride ? ' (Override)' : ' (Inherited)'}
                                      </span>
                                    </div>
                                    <div className={`flex rounded-lg border border-border overflow-hidden ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                                      {([
                                        { value: 'inherit' as const, label: `Inherit${pharmacy.companyStatus ? ` (${pharmacy.companyStatus})` : ''}`, activeClass: 'bg-blue-500 text-white border-blue-500' },
                                        { value: 'pending' as const, label: 'Pending', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
                                        { value: 'approved' as const, label: 'Approved', activeClass: 'bg-[#4FA59C] text-white border-[#4FA59C]' },
                                        { value: 'rejected' as const, label: 'Rejected', activeClass: 'bg-red-500 text-white border-red-500' },
                                      ]).map((option) => {
                                        const isActive = option.value === 'inherit'
                                          ? !pharmacy.hasOverride
                                          : pharmacy.hasOverride && pharmacy.doctorOverride === option.value
                                        return (
                                          <button
                                            key={option.value}
                                            type="button"
                                            disabled={isUpdating}
                                            onClick={() => handleDoctorPharmacyOverride(pharmacy.id, option.value)}
                                            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-all ${
                                              isActive
                                                ? option.activeClass
                                                : 'bg-background text-muted-foreground hover:bg-muted'
                                            }`}
                                          >
                                            {option.label}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Roles */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-2">Roles</h3>
                          <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
                          <div className="space-y-2">
                            {[
                              { key: 'patient', label: 'Patient' },
                              { key: 'doctor', label: 'Doctor' },
                              { key: 'admin', label: 'Admin' },
                              { key: 'brand', label: 'Brand' },
                              { key: 'superAdmin', label: 'Super Admin' },
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(userRolesData as any)[key]}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, [key]: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <span className="text-sm text-foreground">{label}</span>
                              </label>
                            ))}
                          </div>
                          <Button
                            onClick={handleRolesChange}
                            disabled={updatingRole}
                            className="mt-3 bg-[#4FA59C] hover:bg-[#3d8a82] text-white text-xs"
                            size="sm"
                          >
                            {updatingRole ? 'Updating...' : 'Update Roles'}
                          </Button>
                        </div>

                        <Button
                          onClick={handleSaveDoctorProfile}
                          disabled={savingDoctorProfile}
                          className="bg-[#4FA59C] hover:bg-[#3d8a82] text-white"
                        >
                          {savingDoctorProfile ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {savingDoctorProfile ? 'Saving...' : 'Save Doctor Profile'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <UserIcon className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium">No Doctor Selected</p>
                        <p className="text-sm mt-2">Select a doctor from the list to view and edit their profile</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Brand Subscription Settings</CardTitle>
                  <CardDescription>
                    Configure subscription settings for the selected user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedUser ? (
                    <div className="space-y-6">
                      {/* User Info */}
                      {loadingClinicData ? (
                        <div className="bg-muted/50 rounded-lg p-4 border border-border animate-pulse">
                          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                              <div className="h-4 bg-muted rounded w-32"></div>
                            </div>
                            <div>
                              <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                              <div className="h-4 bg-muted rounded w-40"></div>
                            </div>
                            <div className="col-span-2 mt-2">
                              <div className="h-4 bg-muted rounded w-32 mb-3"></div>
                              <div className="space-y-2">
                                <div className="h-4 bg-muted rounded w-20"></div>
                                <div className="h-4 bg-muted rounded w-20"></div>
                                <div className="h-4 bg-muted rounded w-20"></div>
                                <div className="h-4 bg-muted rounded w-20"></div>
                              </div>
                              <div className="h-8 bg-muted rounded w-32 mt-4"></div>
                            </div>
                            <div>
                              <div className="h-4 bg-muted rounded w-28 mb-1"></div>
                              <div className="h-4 bg-muted rounded w-20"></div>
                            </div>
                          </div>
                          <div className="h-10 bg-muted rounded w-full mt-4"></div>
                        </div>
                      ) : (
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                          <h3 className="font-semibold text-foreground mb-2">User Information</h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Name:</span>
                              <span className="ml-2 text-foreground font-medium">
                                {selectedUser.firstName} {selectedUser.lastName}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <span className="ml-2 text-foreground font-medium">
                                {selectedUser.email}
                              </span>
                            </div>
                          <div className="col-span-2">
                            <label className="block text-muted-foreground mb-2">Roles (select all that apply):</label>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.patient}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, patient: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <span className="text-sm text-foreground">Patient</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.doctor}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, doctor: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <span className="text-sm text-foreground">Doctor</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.admin}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, admin: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <span className="text-sm text-foreground">Admin</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.brand}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, brand: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <span className="text-sm text-foreground">Brand</span>
                              </label>
                              {/* Super Admin - Special styling to indicate elevated privileges */}
                              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={userRolesData.superAdmin}
                                    onChange={(e) => setUserRolesData({ ...userRolesData, superAdmin: e.target.checked })}
                                    disabled={updatingRole}
                                    className="w-4 h-4 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 rounded focus:ring-red-500 bg-background"
                                  />
                                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Super Admin</span>
                                </label>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-7">
                                  Bypasses audit logging and 2FA requirements
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={handleRolesChange}
                              disabled={updatingRole}
                              className="mt-3 bg-[#4FA59C] hover:bg-[#3d8580] text-white text-sm"
                            >
                              {updatingRole ? 'Updating...' : 'Update Roles'}
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              Users can have multiple roles. Changes take effect immediately.
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Business Type:</span>
                            <span className="ml-2 text-foreground font-medium">
                              {selectedUser.businessType || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Preview Button */}
                        <div className="space-y-2 mt-4">
                          <Button
                            onClick={handlePreview}
                            disabled={previewing}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                          >
                            {previewing ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Preview...
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview User Portal
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            Opens a new tab to view the portal as this user
                          </p>
                        </div>
                        </div>
                      )}

                      {loadingClinicData ? (
                        <div className="space-y-6 animate-pulse">
                          {/* Skeleton for User Info */}
                          <div className="bg-muted/50 rounded-lg p-4 border border-border">
                            <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                            <div className="space-y-3">
                              <div className="h-4 bg-muted rounded w-1/2"></div>
                              <div className="h-4 bg-muted rounded w-1/2"></div>
                              <div className="h-4 bg-muted rounded w-1/3"></div>
                            </div>
                          </div>
                          {/* Skeleton for Subscription Details */}
                          <div className="bg-muted/50 rounded-lg p-4 border border-border">
                            <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="h-4 bg-muted rounded"></div>
                              <div className="h-4 bg-muted rounded"></div>
                              <div className="h-4 bg-muted rounded"></div>
                              <div className="h-4 bg-muted rounded"></div>
                            </div>
                          </div>
                          {/* Skeleton for Settings */}
                          <div className="space-y-4">
                            <div className="h-6 bg-muted rounded w-1/4"></div>
                            <div className="space-y-4">
                              <div className="h-10 bg-muted rounded"></div>
                              <div className="h-10 bg-muted rounded w-3/4"></div>
                              <div className="h-10 bg-muted rounded w-2/3"></div>
                              <div className="h-20 bg-muted rounded"></div>
                            </div>
                          </div>
                        </div>
                      ) : selectedUser.brandSubscriptions && selectedUser.brandSubscriptions.length > 0 ? (
                        <>
                          {/* Subscription Info */}
                          <div className="bg-muted/50 rounded-lg p-4 border border-border">
                            <h3 className="font-semibold text-foreground mb-2">Subscription Details</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Plan Type:</span>
                                <span className="ml-2 text-foreground font-medium">
                                  {selectedUser.brandSubscriptions[0].planType}
                                  {!selectedUser.brandSubscriptions[0].plan && (
                                    <span className="ml-2 text-destructive text-xs">⚠️ Plan not found</span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Status:</span>
                                <span className="ml-2 text-foreground font-medium">
                                  {selectedUser.brandSubscriptions[0].status}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Monthly Price:</span>
                                <span className="ml-2 text-foreground font-medium">
                                  ${selectedUser.brandSubscriptions[0].monthlyPrice}
                                </span>
                              </div>
                              {selectedUser.brandSubscriptions[0].plan && (
                                <div>
                                  <span className="text-muted-foreground">Plan Name:</span>
                                  <span className="ml-2 text-foreground font-medium">
                                    {selectedUser.brandSubscriptions[0].plan.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Editable Settings */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-foreground">Subscription Settings</h3>

                            {/* Plan Type Selector */}
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Subscription Plan Type
                              </label>
                              <select
                                value={formData.planType}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  planType: e.target.value
                                })}
                                className="w-full max-w-md px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4FA59C] bg-background text-foreground"
                              >
                                <option value="">Select a plan...</option>
                                {availablePlans.map((plan) => (
                                  <option key={plan.id} value={plan.planType}>
                                    {plan.name} ({plan.planType}) - Max Products: {plan.maxProducts === -1 ? 'Unlimited' : plan.maxProducts}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Change the subscription plan type. This determines the default limits and features.
                              </p>
                              {selectedUser?.brandSubscriptions?.[0]?.planType &&
                                !availablePlans.find(p => p.planType === selectedUser.brandSubscriptions![0].planType) && (
                                  <p className="text-xs text-destructive mt-1">
                                    ⚠️ Current plan type "{selectedUser.brandSubscriptions[0].planType}" does not exist in available plans!
                                  </p>
                                )}
                            </div>

                            {/* Products Changed Amount */}
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Products Changed Amount on Current Cycle
                              </label>
                              <Input
                                type="number"
                                value={formData.productsChangedAmountOnCurrentCycle}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  productsChangedAmountOnCurrentCycle: parseInt(e.target.value) || 0
                                })}
                                className="max-w-xs"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Number of times products have been changed in the current billing cycle
                              </p>
                            </div>

                            {/* Custom Max Products */}
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Custom Max Products Override
                              </label>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  value={formData.customMaxProducts ?? ''}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    customMaxProducts: e.target.value === '' ? null : parseInt(e.target.value) || 0
                                  })}
                                  placeholder={`Plan default: ${selectedUser?.brandSubscriptions?.[0]?.plan?.maxProducts === -1 ? 'Unlimited' : selectedUser?.brandSubscriptions?.[0]?.plan?.maxProducts ?? 'N/A'}`}
                                  className="max-w-xs"
                                />
                                {formData.customMaxProducts !== null && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, customMaxProducts: null })}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Override the max products from the subscription plan. Leave empty to use plan default. Use -1 for unlimited.
                              </p>
                              {selectedUser?.brandSubscriptions?.[0]?.plan && (
                                <p className="text-xs text-[#4FA59C] mt-1">
                                  Plan ({selectedUser.brandSubscriptions[0].plan.name}) default: {selectedUser.brandSubscriptions[0].plan.maxProducts === -1 ? 'Unlimited' : selectedUser.brandSubscriptions[0].plan.maxProducts}
                                </p>
                              )}
                            </div>

                            {/* Custom Merchant Service Fee Override */}
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Merchant Service Fee Override
                              </label>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={formData.customMerchantServiceFeePercent ?? ''}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    customMerchantServiceFeePercent: e.target.value === '' ? null : parseFloat(e.target.value) || 0
                                  })}
                                  placeholder={`Tier default`}
                                  className="max-w-xs"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                                {formData.customMerchantServiceFeePercent !== null && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, customMerchantServiceFeePercent: null })}
                                  >
                                    Clear (use tier default)
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Negotiated per-brand override for the merchant service fee. Leave empty to use this brand's tier default.
                              </p>
                            </div>

                            {/* Retried Product Selection */}
                            <div>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.retriedProductSelectionForCurrentCycle}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    retriedProductSelectionForCurrentCycle: e.target.checked
                                  })}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <div>
                                  <span className="text-sm font-medium text-foreground">
                                    Retried Product Selection for Current Cycle
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    Whether the user has retried product selection in the current cycle
                                  </p>
                                </div>
                              </label>
                            </div>

                            {/* Tutorial Finished */}
                            <div>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.tutorialFinished}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    tutorialFinished: e.target.checked
                                  })}
                                  className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                />
                                <div>
                                  <span className="text-sm font-medium text-foreground">
                                    Tutorial Finished
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    Whether the user has completed the onboarding tutorial
                                  </p>
                                </div>
                              </label>
                            </div>

                            {/* Custom Features Section */}
                            <div className="space-y-4 pt-6 border-t border-border">
                              <h3 className="font-semibold text-foreground">Custom Feature Overrides</h3>
                              <p className="text-sm text-muted-foreground">
                                Enable or disable specific features for this user, regardless of their plan.
                              </p>

                              {/* Can Add Custom Products */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.canAddCustomProducts}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      canAddCustomProducts: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Can Add Custom Products
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to create custom products (normally restricted to Premium/Enterprise plans)
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Has Access To Analytics */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.hasAccessToAnalytics}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      hasAccessToAnalytics: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Has Access To Analytics
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to access the Analytics section
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Can Upload Custom Product Images */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.canUploadCustomProductImages}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      canUploadCustomProductImages: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Can Upload Custom Product Images
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to upload custom images for products
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Has Custom Portal */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.hasCustomPortal}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      hasCustomPortal: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Has Custom Portal
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to customize their portal (normally restricted to Standard+ plans)
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Has Programs */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.hasPrograms}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      hasPrograms: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Has Programs
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to access and manage Programs
                                    </p>
                                  </div>
                                </label>
                              </div>

                              {/* Can Customize Form Structure */}
                              <div>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={customFeaturesData.canCustomizeFormStructure}
                                    onChange={(e) => setCustomFeaturesData({
                                      ...customFeaturesData,
                                      canCustomizeFormStructure: e.target.checked
                                    })}
                                    className="w-4 h-4 text-[#4FA59C] border-input rounded focus:ring-[#4FA59C] bg-background"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-foreground">
                                      Can Customize Form Structure
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      Allow this user to customize product form structures (add/edit form layouts)
                                    </p>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* Patient Portal Dashboard Format */}
                            <div className="space-y-4 pt-6 border-t border-border">
                              <h3 className="font-semibold text-foreground">Patient Portal Dashboard Format</h3>
                              <p className="text-sm text-muted-foreground">
                                Choose the dashboard format for the patient portal. Changing this setting is strongly discouraged if there are existing Orders, Payments, or Prescriptions.
                              </p>
                              
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Dashboard Format
                                </label>
                                <select
                                  value={patientPortalDashboardFormat}
                                  onChange={(e) => {
                                    setPatientPortalDashboardFormat(e.target.value)
                                    // Reset mainDoctorId if switching away from FUSE
                                    if (e.target.value !== MedicalCompanySlug.FUSE) {
                                      setMainDoctorId(null)
                                    }
                                  }}
                                  disabled={saving || checkingData}
                                  className="w-full max-w-md px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4FA59C] bg-background text-foreground"
                                >
                                  <option value="fuse">Fuse Dashboard</option>
                                  <option value="md-integrations">MD Integrations</option>
                                  <option value="beluga">Beluga</option>
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Fuse Dashboard: Internal messaging, treatments, and subscription management.
                                  <br />
                                  MD Integrations: Connects with external medical systems.
                                  <br />
                                  Beluga: Uses Beluga-specific platform integrations.
                                </p>
                                {clinicDataCheck?.hasData && (
                                  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                                      <strong>Warning:</strong> This brand has existing data:
                                      <br />
                                      • {clinicDataCheck.ordersCount} Orders
                                      <br />
                                      • {clinicDataCheck.paymentsCount} Payments
                                      <br />
                                      • {clinicDataCheck.prescriptionsCount} Prescriptions
                                      <br />
                                      Changing the dashboard format is strongly discouraged.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Main Doctor (only for FUSE format) */}
                            {patientPortalDashboardFormat === MedicalCompanySlug.FUSE && (
                              <div className="space-y-4 pt-6 border-t border-border">
                                <h3 className="font-semibold text-foreground">Responsible Doctor</h3>
                                <p className="text-sm text-muted-foreground">
                                  Select the doctor who is currently responsible for this clinic. This is different from the referrer doctor (who made the referral).
                                </p>
                                
                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-2">
                                    Main Doctor
                                  </label>
                                  {loadingDoctors ? (
                                    <div className="flex items-center space-x-2 text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="text-sm">Loading doctors...</span>
                                    </div>
                                  ) : (
                                    <select
                                      value={mainDoctorId || ''}
                                      onChange={(e) => setMainDoctorId(e.target.value || null)}
                                      disabled={saving}
                                      className="w-full max-w-md px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4FA59C] bg-background text-foreground"
                                    >
                                      <option value="">No doctor assigned</option>
                                      {doctors.map((doctor) => (
                                        <option key={doctor.id} value={doctor.id}>
                                          {doctor.firstName} {doctor.lastName} ({doctor.email})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    The main doctor is responsible for managing this clinic. This can be changed at any time.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Save Button */}
                            <div className="flex justify-end pt-4 border-t border-border">
                              <Button
                                onClick={() => handleSave()}
                                disabled={saving}
                                className="bg-[#4FA59C] hover:bg-[#3d8580] text-white"
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <p className="text-lg font-medium">No Brand Subscription Found</p>
                          <p className="text-sm mt-2">This user doesn't have a brand subscription yet.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <UserIcon className="h-12 w-12 mb-4" />
                      <p className="text-lg font-medium">No User Selected</p>
                      <p className="text-sm mt-2">Select a user from the list to view and edit their settings</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">⚠️ WARNING: Critical Configuration Change</h2>
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-800 p-4 mb-4">
                <p className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                  You should NOT change the Patient Portal Dashboard Format if there are already Orders, Payments, or Prescriptions for this brand.
                </p>
                {clinicDataCheck && (
                  <div className="text-sm text-red-700 dark:text-red-400 space-y-1">
                    <p><strong>Current Data:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li>{clinicDataCheck.ordersCount} Order(s)</li>
                      <li>{clinicDataCheck.paymentsCount} Payment(s)</li>
                      <li>{clinicDataCheck.prescriptionsCount} Prescription(s)</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-800 p-4 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Why this is risky:</strong> Changing the dashboard format after data has been created can cause:
                  <br />
                  • Data inconsistencies
                  <br />
                  • Integration failures with MD systems
                  <br />
                  • Patient portal access issues
                  <br />
                  • Potential data loss or corruption
                </p>
              </div>
              <p className="text-sm text-foreground mb-4">
                <strong>We strongly advise against this change.</strong> If you absolutely must proceed, ensure you have:
                <br />
                • Backed up all data
                <br />
                • Notified all stakeholders
                <br />
                • Tested the new format in a staging environment
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                onClick={handleCancelFormatChange}
                disabled={saving}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Cancel (Recommended)
              </Button>
              <Button
                onClick={handleConfirmFormatChange}
                disabled={saving}
                className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Yes, I Understand the Risks - Proceed Anyway'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

