import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { toast } from 'sonner'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, User, Lock, Mail, Phone, Save, MapPin } from 'lucide-react'
import { ApiClient } from '@/lib/api'
import { US_STATES } from '@fuse/enums'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Tab = 'profile' | 'password' | 'license'

export default function Settings() {
  const { user, authenticatedFetch } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Profile fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // License coverage fields
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [loadingLicense, setLoadingLicense] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }

    // Load user data
    if (user) {
      setFirstName(user.firstName || '')
      setLastName(user.lastName || '')
      setEmail(user.email || '')
      setPhone(user.phone || '')
    }

    // Load license coverage if user is a doctor
    if (user?.userRoles?.doctor) {
      loadLicenseCoverage()
    }
  }, [user, router])

  const loadLicenseCoverage = async () => {
    setLoadingLicense(true)
    try {
      const apiClient = new ApiClient(authenticatedFetch)
      const response = await apiClient.getDoctorDetails()
      if (response.success) {
        setSelectedStates(response.data.doctorLicenseStatesCoverage || [])
      }
    } catch (error) {
      console.error('Failed to load license coverage:', error)
      toast.error('Failed to load license coverage')
    } finally {
      setLoadingLicense(false)
    }
  }

  const handleLicenseSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const apiClient = new ApiClient(authenticatedFetch)
      const response = await apiClient.updateDoctorDetails(selectedStates)

      if (!response.success) {
        throw new Error(response.message || 'Failed to update license coverage')
      }

      toast.success('License coverage updated successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update license coverage'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const toggleState = (stateCode: string) => {
    setSelectedStates((prev) => {
      if (prev.includes(stateCode)) {
        return prev.filter((code) => code !== stateCode)
      } else {
        return [...prev, stateCode]
      }
    })
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile')
      }

      toast.success('Profile updated successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Validation
    if (!currentPassword) {
      const errorMessage = 'Current password is required'
      setError(errorMessage)
      toast.error(errorMessage)
      setSaving(false)
      return
    }

    if (newPassword.length < 8) {
      const errorMessage = 'New password must be at least 8 characters long'
      setError(errorMessage)
      toast.error(errorMessage)
      setSaving(false)
      return
    }

    if (newPassword !== confirmPassword) {
      const errorMessage = "Passwords don't match"
      setError(errorMessage)
      toast.error(errorMessage)
      setSaving(false)
      return
    }

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to change password')
      }

      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Head>
        <title>Settings - Doctor Portal</title>
        <meta name="description" content="Manage your profile and account settings" />
      </Head>
      
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-semibold text-foreground mb-2">Settings</h1>
                <p className="text-muted-foreground">Manage your profile and account settings</p>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-border">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTab === 'profile'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTab === 'password'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </div>
                </button>
                {user?.userRoles?.doctor && (
                  <button
                    onClick={() => setActiveTab('license')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      activeTab === 'license'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      License Coverage
                    </div>
                  </button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information and contact details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileSave} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                            First Name
                          </label>
                          <div className="relative">
                            <input
                              id="firstName"
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-3 py-2 pl-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Enter your first name"
                              required
                            />
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                            Last Name
                          </label>
                          <div className="relative">
                            <input
                              id="lastName"
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-3 py-2 pl-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Enter your last name"
                              required
                            />
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-foreground">
                          Email
                        </label>
                        <div className="relative">
                          <input
                            id="email"
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-3 py-2 pl-10 border border-input rounded-md bg-muted text-muted-foreground cursor-not-allowed"
                          />
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Email cannot be changed. Contact support if you need to update your email.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium text-foreground">
                          Phone Number
                        </label>
                        <div className="relative">
                          <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 pl-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Enter your phone number"
                          />
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Password Tab */}
              {activeTab === 'password' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            id="currentPassword"
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Enter your current password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            id="newPassword"
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Enter your new password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Must be at least 8 characters long
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Confirm your new password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                          className="flex items-center gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          {saving ? 'Changing...' : 'Change Password'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* License Coverage Tab */}
              {activeTab === 'license' && user?.userRoles?.doctor && (
                <Card>
                  <CardHeader>
                    <CardTitle>License Coverage</CardTitle>
                    <CardDescription>
                      Select the US states where you are licensed to prescribe medications. You will only be able to approve orders for patients in these states.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingLicense ? (
                      <div className="text-center py-8 text-muted-foreground">Loading license coverage...</div>
                    ) : (
                      <form onSubmit={handleLicenseSave} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Licensed States ({selectedStates.length} selected)
                          </label>
                          <div className="border border-input rounded-md p-4 max-h-96 overflow-y-auto bg-background">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {US_STATES.map((state) => (
                                <label
                                  key={state.key}
                                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-2 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedStates.includes(state.key)}
                                    onChange={() => toggleState(state.key)}
                                    className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
                                  />
                                  <span className="text-sm text-foreground">
                                    {state.key} - {state.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select all states where you hold an active medical license. This information is required to approve prescriptions.
                          </p>
                        </div>

                        <div className="flex justify-end pt-4">
                          <Button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save License Coverage'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
