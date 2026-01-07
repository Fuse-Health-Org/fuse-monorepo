import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { Search, Loader2, User as UserIcon, Save, Eye } from "lucide-react"
import { toast } from "sonner"

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<BrandSubscriptionPlan[]>([])
  const [updatingRole, setUpdatingRole] = useState(false)

  // BrandSubscription form state
  const [formData, setFormData] = useState({
    productsChangedAmountOnCurrentCycle: 0,
    retriedProductSelectionForCurrentCycle: false,
    tutorialFinished: false,
    customMaxProducts: null as number | null,
    planType: '',
  })

  // Custom features form state
  const [customFeaturesData, setCustomFeaturesData] = useState({
    canAddCustomProducts: false,
    hasAccessToAnalytics: false,
    canUploadCustomProductImages: false,
    hasCustomPortal: false,
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
  }, [])

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

  const handleSelectUser = (user: User) => {
    console.log('👤 [Client Mgmt Frontend] Selected user:', user)
    console.log('📋 [Client Mgmt Frontend] User subscription:', user.brandSubscriptions?.[0])
    console.log('📦 [Client Mgmt Frontend] Subscription plan:', user.brandSubscriptions?.[0]?.plan)
    const customFeaturesToLog = Array.isArray(user.tenantCustomFeatures)
      ? user.tenantCustomFeatures[0]
      : user.tenantCustomFeatures
    console.log('🎨 [Client Mgmt Frontend] Custom features:', customFeaturesToLog)
    setSelectedUser(user)
    const subscription = user.brandSubscriptions?.[0]
    if (subscription) {
      setFormData({
        productsChangedAmountOnCurrentCycle: subscription.productsChangedAmountOnCurrentCycle,
        retriedProductSelectionForCurrentCycle: subscription.retriedProductSelectionForCurrentCycle,
        tutorialFinished: subscription.tutorialFinished,
        customMaxProducts: subscription.customMaxProducts ?? null,
        planType: subscription.planType || '',
      })
    } else {
      setFormData({
        productsChangedAmountOnCurrentCycle: 0,
        retriedProductSelectionForCurrentCycle: false,
        tutorialFinished: false,
        customMaxProducts: null,
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
      })
    } else {
      setCustomFeaturesData({
        canAddCustomProducts: false,
        hasAccessToAnalytics: false,
        canUploadCustomProductImages: false,
        hasCustomPortal: false,
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

  const handleSave = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
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
      toast.error('Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase()
    return (
      user.firstName.toLowerCase().includes(search) ||
      user.lastName.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    )
  })

  return (
    <div className="flex h-screen bg-[#F3F4F6]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
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
                            : 'bg-[#F9FAFB] hover:bg-[#E5E7EB] text-[#1F2937]'
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
                                : 'text-[#9CA3AF]'
                                }`}>
                                {user.email}
                              </p>
                              <p className={`text-xs mt-1 ${selectedUser?.id === user.id
                                ? 'text-white/70'
                                : 'text-[#6B7280]'
                                }`}>
                                Role: {user.role}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredUsers.length === 0 && (
                        <p className="text-center text-[#9CA3AF] py-8">No users found</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Details & Subscription Settings */}
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
                      <div className="bg-[#F9FAFB] rounded-lg p-4 border border-[#E5E7EB]">
                        <h3 className="font-semibold text-[#1F2937] mb-2">User Information</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-[#6B7280]">Name:</span>
                            <span className="ml-2 text-[#1F2937] font-medium">
                              {selectedUser.firstName} {selectedUser.lastName}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6B7280]">Email:</span>
                            <span className="ml-2 text-[#1F2937] font-medium">
                              {selectedUser.email}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[#6B7280] mb-2">Roles (select all that apply):</label>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.patient}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, patient: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <span className="text-sm text-[#374151]">Patient</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.doctor}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, doctor: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <span className="text-sm text-[#374151]">Doctor</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.admin}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, admin: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <span className="text-sm text-[#374151]">Admin</span>
                              </label>
                              <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={userRolesData.brand}
                                  onChange={(e) => setUserRolesData({ ...userRolesData, brand: e.target.checked })}
                                  disabled={updatingRole}
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <span className="text-sm text-[#374151]">Brand</span>
                              </label>
                              {/* Super Admin - Special styling to indicate elevated privileges */}
                              <div className="mt-3 pt-3 border-t border-red-200">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={userRolesData.superAdmin}
                                    onChange={(e) => setUserRolesData({ ...userRolesData, superAdmin: e.target.checked })}
                                    disabled={updatingRole}
                                    className="w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                                  />
                                  <span className="text-sm font-semibold text-red-700">Super Admin</span>
                                </label>
                                <p className="text-xs text-red-600 mt-1 ml-7">
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
                            <p className="text-xs text-[#6B7280] mt-2">
                              Users can have multiple roles. Changes take effect immediately.
                            </p>
                          </div>
                          <div>
                            <span className="text-[#6B7280]">Business Type:</span>
                            <span className="ml-2 text-[#1F2937] font-medium">
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
                          <p className="text-xs text-[#6B7280] text-center">
                            Opens a new tab to view the portal as this user
                          </p>
                        </div>
                      </div>

                      {selectedUser.brandSubscriptions && selectedUser.brandSubscriptions.length > 0 ? (
                        <>
                          {/* Subscription Info */}
                          <div className="bg-[#F9FAFB] rounded-lg p-4 border border-[#E5E7EB]">
                            <h3 className="font-semibold text-[#1F2937] mb-2">Subscription Details</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-[#6B7280]">Plan Type:</span>
                                <span className="ml-2 text-[#1F2937] font-medium">
                                  {selectedUser.brandSubscriptions[0].planType}
                                  {!selectedUser.brandSubscriptions[0].plan && (
                                    <span className="ml-2 text-red-600 text-xs">⚠️ Plan not found</span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#6B7280]">Status:</span>
                                <span className="ml-2 text-[#1F2937] font-medium">
                                  {selectedUser.brandSubscriptions[0].status}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#6B7280]">Monthly Price:</span>
                                <span className="ml-2 text-[#1F2937] font-medium">
                                  ${selectedUser.brandSubscriptions[0].monthlyPrice}
                                </span>
                              </div>
                              {selectedUser.brandSubscriptions[0].plan && (
                                <div>
                                  <span className="text-[#6B7280]">Plan Name:</span>
                                  <span className="ml-2 text-[#1F2937] font-medium">
                                    {selectedUser.brandSubscriptions[0].plan.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Editable Settings */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-[#1F2937]">Subscription Settings</h3>

                            {/* Plan Type Selector */}
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-2">
                                Subscription Plan Type
                              </label>
                              <select
                                value={formData.planType}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  planType: e.target.value
                                })}
                                className="w-full max-w-md px-3 py-2 border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4FA59C] bg-white"
                              >
                                <option value="">Select a plan...</option>
                                {availablePlans.map((plan) => (
                                  <option key={plan.id} value={plan.planType}>
                                    {plan.name} ({plan.planType}) - Max Products: {plan.maxProducts === -1 ? 'Unlimited' : plan.maxProducts}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-[#6B7280] mt-1">
                                Change the subscription plan type. This determines the default limits and features.
                              </p>
                              {selectedUser?.brandSubscriptions?.[0]?.planType &&
                                !availablePlans.find(p => p.planType === selectedUser.brandSubscriptions![0].planType) && (
                                  <p className="text-xs text-red-600 mt-1">
                                    ⚠️ Current plan type "{selectedUser.brandSubscriptions[0].planType}" does not exist in available plans!
                                  </p>
                                )}
                            </div>

                            {/* Products Changed Amount */}
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-2">
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
                              <p className="text-xs text-[#6B7280] mt-1">
                                Number of times products have been changed in the current billing cycle
                              </p>
                            </div>

                            {/* Custom Max Products */}
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-2">
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
                              <p className="text-xs text-[#6B7280] mt-1">
                                Override the max products from the subscription plan. Leave empty to use plan default. Use -1 for unlimited.
                              </p>
                              {selectedUser?.brandSubscriptions?.[0]?.plan && (
                                <p className="text-xs text-[#4FA59C] mt-1">
                                  Plan ({selectedUser.brandSubscriptions[0].plan.name}) default: {selectedUser.brandSubscriptions[0].plan.maxProducts === -1 ? 'Unlimited' : selectedUser.brandSubscriptions[0].plan.maxProducts}
                                </p>
                              )}
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
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <div>
                                  <span className="text-sm font-medium text-[#374151]">
                                    Retried Product Selection for Current Cycle
                                  </span>
                                  <p className="text-xs text-[#6B7280]">
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
                                  className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                />
                                <div>
                                  <span className="text-sm font-medium text-[#374151]">
                                    Tutorial Finished
                                  </span>
                                  <p className="text-xs text-[#6B7280]">
                                    Whether the user has completed the onboarding tutorial
                                  </p>
                                </div>
                              </label>
                            </div>

                            {/* Custom Features Section */}
                            <div className="space-y-4 pt-6 border-t border-[#E5E7EB]">
                              <h3 className="font-semibold text-[#1F2937]">Custom Feature Overrides</h3>
                              <p className="text-sm text-[#6B7280]">
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
                                    className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-[#374151]">
                                      Can Add Custom Products
                                    </span>
                                    <p className="text-xs text-[#6B7280]">
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
                                    className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-[#374151]">
                                      Has Access To Analytics
                                    </span>
                                    <p className="text-xs text-[#6B7280]">
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
                                    className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-[#374151]">
                                      Can Upload Custom Product Images
                                    </span>
                                    <p className="text-xs text-[#6B7280]">
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
                                    className="w-4 h-4 text-[#4FA59C] border-[#D1D5DB] rounded focus:ring-[#4FA59C]"
                                  />
                                  <div>
                                    <span className="text-sm font-medium text-[#374151]">
                                      Has Custom Portal
                                    </span>
                                    <p className="text-xs text-[#6B7280]">
                                      Allow this user to customize their portal (normally restricted to Standard+ plans)
                                    </p>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end pt-4 border-t border-[#E5E7EB]">
                              <Button
                                onClick={handleSave}
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
                        <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
                          <p className="text-lg font-medium">No Brand Subscription Found</p>
                          <p className="text-sm mt-2">This user doesn't have a brand subscription yet.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
                      <UserIcon className="h-12 w-12 mb-4" />
                      <p className="text-lg font-medium">No User Selected</p>
                      <p className="text-sm mt-2">Select a user from the list to view and edit their settings</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

