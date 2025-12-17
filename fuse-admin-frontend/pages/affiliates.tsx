import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import { ToastManager } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { Users, UserPlus, Mail, Search, UserCheck, Calendar, Send, X } from 'lucide-react'

interface Affiliate {
  id: string
  firstName: string
  lastName: string
  email: string
  clinicId: string | null
  clinic?: {
    id: string
    name: string
    slug: string
    affiliateOwnerClinicId: string | null
  }
  createdAt: string
  userRoles?: {
    affiliate: boolean
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Affiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const { user, token } = useAuth()
  const { toasts, dismiss, error: showErrorToast } = useToast()

  useEffect(() => {
    fetchAffiliates()
  }, [token, user])

  const fetchAffiliates = async () => {
    if (!token || !user) return

    try {
      setLoading(true)

      // Fetch all users with affiliate role
      const response = await fetch(`${API_URL}/admin/users?role=affiliate&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Filter to only affiliates and include clinic info
          const affiliateUsers = (data.data?.users || []).filter((u: any) => 
            u.userRoles?.affiliate === true
          ).map((u: any) => ({
            id: u.id,
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email,
            clinicId: u.clinicId || null,
            clinic: u.clinic || null,
            createdAt: u.createdAt,
            userRoles: u.userRoles
          }))
          setAffiliates(affiliateUsers)
        }
      }
    } catch (err) {
      console.error('Error fetching affiliates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (affiliate: Affiliate) => {
    setAffiliateToDelete(affiliate)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!affiliateToDelete) return
    await removeAffiliateOwner(affiliateToDelete.id)
    setShowDeleteModal(false)
    setAffiliateToDelete(null)
  }

  const removeAffiliateOwner = async (affiliateId: string) => {
    if (!token || !user) return

    try {
      setRemoving(affiliateId)

      // Remove affiliate parent clinic
      const response = await fetch(
        `${API_URL}/admin/users/${affiliateId}/affiliate-owner`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parentClinicId: null
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Refresh affiliates list
          await fetchAffiliates()
        }
      }
    } catch (err) {
      console.error('Error removing affiliate owner:', err)
    } finally {
      setRemoving(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleInviteAffiliate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !user || !inviteEmail.trim()) return

    // Check if already at max (5 affiliates)
    if (myAffiliates.length >= 5) {
      const errorMsg = 'Maximum of 5 affiliates per brand. Please remove an affiliate before inviting a new one.'
      showErrorToast(errorMsg, 'Cannot Invite Affiliate')
      return
    }

    try {
      setInviting(true)
      setInviteSuccess(null)

      const response = await fetch(`${API_URL}/admin/affiliates/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: inviteEmail.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setInviteSuccess(`Invitation sent successfully to ${inviteEmail}`)
          setInviteEmail('')
          setTimeout(() => {
            setShowInviteModal(false)
            setInviteSuccess(null)
            fetchAffiliates() // Refresh list
          }, 2000)
        } else {
          const errorMsg = data.message || 'Failed to send invitation'
          showErrorToast(errorMsg, 'Invitation Failed')
        }
      } else {
        const errorData = await response.json()
        const errorMsg = errorData.message || 'Failed to send invitation'
        showErrorToast(errorMsg, 'Invitation Failed')
      }
    } catch (err) {
      console.error('Error inviting affiliate:', err)
      const errorMsg = 'Failed to send invitation'
      showErrorToast(errorMsg, 'Network Error')
    } finally {
      setInviting(false)
    }
  }

  // Only show affiliates whose clinic is linked to this brand's clinic
  const myAffiliates = affiliates.filter(a => a.clinic?.affiliateOwnerClinicId === user?.clinicId)
  
  const filteredAffiliates = myAffiliates.filter(affiliate =>
    searchTerm === '' ||
    (affiliate.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    affiliate.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading affiliates...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Affiliates - Fuse Admin</title>
      </Head>

      <div className="min-h-screen bg-background p-8" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Affiliates</h1>
              <p className="text-sm text-muted-foreground">Manage your affiliate partners</p>
            </div>
            <Button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2"
              disabled={myAffiliates.length >= 5}
            >
              <Send className="h-4 w-4" />
              Invite Affiliate
              {myAffiliates.length >= 5 && ` (Max: 5)`}
            </Button>
          </div>

          {/* Success Message */}
          {inviteSuccess && (
            <div className="mb-6 p-4 border border-green-200 rounded-md bg-green-50">
              <p className="text-green-600 text-sm">{inviteSuccess}</p>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && affiliateToDelete && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
              <Card className="w-full max-w-md border-border shadow-lg" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="border-b border-border flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold">Remove Affiliate</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={removing === affiliateToDelete.id}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <p className="text-sm text-foreground">
                      Are you sure you want to remove <span className="font-semibold">{affiliateToDelete.firstName || affiliateToDelete.email}</span> as an affiliate?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This action will unassign them from your brand. They will no longer have access to your affiliate portal.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDeleteModal(false)
                          setAffiliateToDelete(null)
                        }}
                        disabled={removing === affiliateToDelete.id}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmDelete}
                        disabled={removing === affiliateToDelete.id}
                      >
                        {removing === affiliateToDelete.id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !inviting && setShowInviteModal(false)}>
              <Card className="w-full max-w-md border-border shadow-lg" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="border-b border-border flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold">Invite Affiliate</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => !inviting && setShowInviteModal(false)}
                    disabled={inviting}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleInviteAffiliate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="affiliate@example.com"
                        required
                        disabled={inviting}
                        className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        An invitation email with login credentials will be sent to this address
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowInviteModal(false)}
                        disabled={inviting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={inviting || !inviteEmail.trim()}
                      >
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <UserCheck className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Affiliates</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">{myAffiliates.length} / 5</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search affiliates by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>
          </div>

          {/* Affiliates List */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-semibold">My Affiliates ({filteredAffiliates.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAffiliates.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No affiliates assigned</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? 'Try adjusting your search' : 'Invite affiliates to get started'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredAffiliates.map((affiliate) => (
                    <div
                      key={affiliate.id}
                      className="p-6 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <UserPlus className="h-6 w-6 text-muted-foreground" />
                          </div>

                          {/* Affiliate Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-base font-semibold text-foreground">
                                {affiliate.firstName || affiliate.email}
                              </h3>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                <span>{affiliate.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Joined {formatDate(affiliate.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleDeleteClick(affiliate)}
                              disabled={removing === affiliate.id}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ToastManager toasts={toasts} onDismiss={dismiss} />
    </Layout>
  )
}


