import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ToastManager } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import Layout from '@/components/Layout'
import {
    Users,
    Search,
    Filter,
    Mail,
    Phone,
    UserCheck,
    UserX,
    Send,
    Calendar,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    X,
    Loader2,
    Workflow,
    Plus,
    Upload,
    UserPlus,
    FileSpreadsheet,
    Download,
    Tag as TagIcon,
    UserCog,
    AlertTriangle
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Tag {
  id: string
  name: string
  color?: string
  category?: string
  userCount?: number
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  emailOptedOut: boolean
  smsOptedOut: boolean
  optOutDate?: string
  createdAt: string
  lastLoginAt?: string
  lastContactDate?: string
  tags?: Tag[]
}

interface ContactsData {
  contacts: Contact[]
  total: number
  limit: number
  offset: number
}

interface Sequence {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
}

export default function ContactsPage() {
  const { user, token } = useAuth()
  const { toasts, dismiss, success: showSuccess, error: showError } = useToast()

  // State
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [optOutFilter, setOptOutFilter] = useState<'all' | 'active' | 'email_opted_out' | 'sms_opted_out'>('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  
  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('')
  
  // Modal state - Send Sequence
  const [showSequenceModal, setShowSequenceModal] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('')
  const [sendingSequence, setSendingSequence] = useState(false)

  // Modal state - Edit Contact
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  })
  const [savingContact, setSavingContact] = useState(false)

  // Modal state - Create Contact
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  })
  const [creatingContact, setCreatingContact] = useState(false)

  // Modal state - Upload CSV
  const [showUploadCSVModal, setShowUploadCSVModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [uploadingCSV, setUploadingCSV] = useState(false)
  
  // Dropdown state for Add Contact button
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  
  // Modal state - Send Sequence by Tag
  const [showSendByTagModal, setShowSendByTagModal] = useState(false)
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false)
  const [selectedTagForSend, setSelectedTagForSend] = useState<string>('')
  const [sendingByTag, setSendingByTag] = useState(false)
  
  // Modal state - Manage Contact Tags
  const [showManageTagsModal, setShowManageTagsModal] = useState(false)
  const [managingTagsContact, setManagingTagsContact] = useState<Contact | null>(null)
  const [selectedTagsForContact, setSelectedTagsForContact] = useState<string[]>([])
  const [savingTags, setSavingTags] = useState(false)

  // Fetch active sequences
  const fetchSequences = async () => {
    if (!token) return

    try {
      // Skip analytics refresh for faster loading
      const response = await fetch(`${API_URL}/sequences?status=active&refreshAnalytics=false`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Backend returns sequences directly in data, not nested
          const sequenceList = Array.isArray(data.data) ? data.data : []
          console.log('✅ Active sequences loaded:', sequenceList.length)
          console.log('Sequences:', sequenceList.map((s: Sequence) => ({ id: s.id, name: s.name, status: s.status })))
          setSequences(sequenceList)
        }
      } else {
        console.error('❌ Failed to fetch sequences:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching sequences:', error)
    }
  }

  // Fetch all tags
  const fetchTags = async () => {
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/tags`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAllTags(data.data || [])
        }
      }
    } catch (error) {
      console.error('❌ Error fetching tags:', error)
    }
  }

  // Fetch contacts
  const fetchContacts = async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const offset = (page - 1) * limit
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        optOutStatus: optOutFilter
      })

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      if (selectedTagFilter) {
        params.append('tagId', selectedTagFilter)
      }

      const response = await fetch(`${API_URL}/contacts?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response not OK:', response.status, errorText)
        showError(`Failed to fetch contacts: ${response.status}`)
        return
      }

      const data = await response.json()

      if (data.success) {
        setContacts(data.data.contacts)
        setTotal(data.data.total)
      } else {
        showError(data.message || 'Failed to fetch contacts')
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
      showError(`Failed to fetch contacts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Send sequence to contact
  const handleSendSequence = async () => {
    if (!selectedContact || !selectedSequenceId) {
      showError('Please select a sequence')
      return
    }

    try {
      setSendingSequence(true)

      const response = await fetch(`${API_URL}/sequence-triggers/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedContact.id,
          sequenceId: selectedSequenceId
        })
      })

      const data = await response.json()

      if (data.success) {
        showSuccess(`Sequence "${data.data.sequenceName}" sent to ${data.data.userName}!`)
        setShowSequenceModal(false)
        setSelectedContact(null)
        setSelectedSequenceId('')
        // Refresh contacts to update last contact date
        fetchContacts()
      } else {
        showError(data.message || 'Failed to send sequence')
      }
    } catch (error) {
      console.error('Error sending sequence:', error)
      showError('Failed to send sequence')
    } finally {
      setSendingSequence(false)
    }
  }

  // Open modal to select sequence
  const openSendSequenceModal = (contact: Contact) => {
    setSelectedContact(contact)
    setSelectedSequenceId('')
    setShowSequenceModal(true)
    fetchSequences()
  }

  // Close modal
  const closeSendSequenceModal = () => {
    setShowSequenceModal(false)
    setSelectedContact(null)
    setSelectedSequenceId('')
  }

  // Send sequence to all contacts with a tag
  const handleSendSequenceByTag = async () => {
    if (!selectedTagForSend || !selectedSequenceId) {
      showError('Please select both a tag and a sequence')
      return
    }

    // Show confirmation modal
    setShowConfirmSendModal(true)
  }

  const confirmSendSequenceByTag = async () => {
    try {
      setShowConfirmSendModal(false)
      setSendingByTag(true)

      const response = await fetch(`${API_URL}/sequence-triggers/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagId: selectedTagForSend,
          sequenceId: selectedSequenceId
        })
      })

      const data = await response.json()

      if (data.success) {
        showSuccess(data.message || `Sequence sent to ${data.data.usersTriggered} contacts!`)
        setShowSendByTagModal(false)
        setSelectedTagForSend('')
        setSelectedSequenceId('')
        fetchContacts()
      } else {
        showError(data.message || 'Failed to send sequence by tag')
      }
    } catch (error) {
      console.error('Error sending sequence by tag:', error)
      showError('Failed to send sequence by tag')
    } finally {
      setSendingByTag(false)
    }
  }

  // Open modal to send sequence by tag
  const openSendByTagModal = () => {
    setSelectedTagForSend('')
    setSelectedSequenceId('')
    setShowSendByTagModal(true)
    fetchSequences()
  }

  // Close send by tag modal
  const closeSendByTagModal = () => {
    setShowSendByTagModal(false)
    setSelectedTagForSend('')
    setSelectedSequenceId('')
  }

  // Open modal to manage tags for a contact
  const openManageTagsModal = (contact: Contact) => {
    setManagingTagsContact(contact)
    setSelectedTagsForContact(contact.tags?.map(t => t.id) || [])
    setShowManageTagsModal(true)
  }

  // Close manage tags modal
  const closeManageTagsModal = () => {
    setShowManageTagsModal(false)
    setManagingTagsContact(null)
    setSelectedTagsForContact([])
  }

  // Toggle tag selection
  const toggleTagSelection = (tagId: string) => {
    setSelectedTagsForContact(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  // Save contact tags
  const handleSaveContactTags = async () => {
    if (!managingTagsContact) return

    try {
      setSavingTags(true)

      const currentTagIds = managingTagsContact.tags?.map(t => t.id) || []
      const toAdd = selectedTagsForContact.filter(id => !currentTagIds.includes(id))
      const toRemove = currentTagIds.filter(id => !selectedTagsForContact.includes(id))

      // Add new tags
      for (const tagId of toAdd) {
        const response = await fetch(`${API_URL}/tags/${tagId}/assign`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: managingTagsContact.id })
        })

        if (!response.ok) {
          throw new Error('Failed to assign tag')
        }
      }

      // Remove tags
      for (const tagId of toRemove) {
        const response = await fetch(`${API_URL}/tags/${tagId}/assign/${managingTagsContact.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to remove tag')
        }
      }

      showSuccess('Tags updated successfully')
      closeManageTagsModal()
      fetchContacts()
    } catch (error) {
      console.error('Error saving tags:', error)
      showError('Failed to update tags')
    } finally {
      setSavingTags(false)
    }
  }

  // Open edit contact modal
  const openEditModal = (contact: Contact) => {
    setEditingContact(contact)
    setEditFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phoneNumber: contact.phoneNumber || ''
    })
    setShowEditModal(true)
  }

  // Close edit contact modal
  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingContact(null)
    setEditFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: ''
    })
  }

  // Save contact changes
  const handleSaveContact = async () => {
    if (!editingContact) return

    // Validate phone number (USA format: exactly 10 digits)
    if (editFormData.phoneNumber && editFormData.phoneNumber.trim()) {
      const cleanPhone = editFormData.phoneNumber.replace(/[\s\-\(\)\.]/g, '')
      const phoneRegex = /^\d{10}$/
      if (!phoneRegex.test(cleanPhone)) {
        showError('Phone number must be exactly 10 digits (e.g., 5551234567)')
        return
      }
    }

    try {
      setSavingContact(true)

      const response = await fetch(`${API_URL}/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      })

      const data = await response.json()

      if (data.success) {
        showSuccess('Contact updated successfully!')
        closeEditModal()
        fetchContacts() // Refresh the list
      } else {
        showError(data.message || 'Failed to update contact')
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      showError('Failed to update contact')
    } finally {
      setSavingContact(false)
    }
  }

  // Create new contact
  const handleCreateContact = async () => {
    // Validation
    if (!createFormData.firstName.trim() || !createFormData.lastName.trim()) {
      showError('First name and last name are required')
      return
    }
    if (!createFormData.email.trim()) {
      showError('Email is required')
      return
    }

    // Validate phone number (USA format: exactly 10 digits)
    if (createFormData.phoneNumber && createFormData.phoneNumber.trim()) {
      const cleanPhone = createFormData.phoneNumber.replace(/[\s\-\(\)\.]/g, '')
      const phoneRegex = /^\d{10}$/
      if (!phoneRegex.test(cleanPhone)) {
        showError('Phone number must be exactly 10 digits (e.g., 5551234567)')
        return
      }
    }

    try {
      setCreatingContact(true)

      const response = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createFormData)
      })

      const data = await response.json()

      if (data.success) {
        showSuccess('Contact created successfully!')
        setShowCreateModal(false)
        setCreateFormData({
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: ''
        })
        fetchContacts() // Refresh the list
      } else {
        showError(data.message || 'Failed to create contact')
      }
    } catch (error) {
      console.error('Error creating contact:', error)
      showError('Failed to create contact')
    } finally {
      setCreatingContact(false)
    }
  }

  // Handle CSV file selection and preview
  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      showError('Please select a valid CSV file')
      return
    }

    setCsvFile(file)

    // Read and preview CSV
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        showError('CSV file must contain at least a header row and one data row')
        return
      }

      // Parse CSV (simple implementation)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })

      setCsvPreview(preview)
    }
    reader.readAsText(file)
  }

  // Upload CSV
  const handleUploadCSV = async () => {
    if (!csvFile) {
      showError('Please select a CSV file')
      return
    }

    try {
      setUploadingCSV(true)

      const formData = new FormData()
      formData.append('csv', csvFile)

      const response = await fetch(`${API_URL}/contacts/upload-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      console.log('📡 CSV Upload Response:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Response not OK:', errorText)
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📦 CSV Upload Data:', data)

      if (data.success) {
        const imported = data.data.imported
        const skipped = data.data.skipped || 0
        
        if (skipped > 0 && data.data.errors) {
          console.warn('⚠️ CSV Import warnings:', data.data.errors)
          showSuccess(`Imported ${imported} contacts successfully! ${skipped} contacts were skipped. Check console for details.`)
        } else {
          showSuccess(`Successfully imported ${imported} contacts!`)
        }
        
        setShowUploadCSVModal(false)
        setCsvFile(null)
        setCsvPreview([])
        fetchContacts() // Refresh the list
      } else {
        // Show detailed error message
        const errorMsg = data.message || 'Failed to upload CSV'
        const errors = data.errors || []
        
        if (errors.length > 0) {
          console.error('❌ CSV Import errors:', errors)
          // Show first few errors in toast
          const firstErrors = errors.slice(0, 3).join('; ')
          showError(`${errorMsg}: ${firstErrors}${errors.length > 3 ? ` (and ${errors.length - 3} more - check console)` : ''}`)
        } else {
          showError(errorMsg)
        }
      }
    } catch (error) {
      console.error('❌ Error uploading CSV:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showError(`Failed to upload CSV: ${errorMessage}`)
    } finally {
      setUploadingCSV(false)
    }
  }

  // Download CSV template
  const downloadCSVTemplate = () => {
    const template = 'firstName,lastName,email,phoneNumber\nJohn,Doe,john.doe@example.com,5551234567\nJane,Smith,jane.smith@example.com,5559876543\nCarlos,Lopez,carlos.lopez@example.com,2125551234'
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contacts_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Effects
  useEffect(() => {
    if (token) {
      fetchContacts()
      fetchTags()
    } else {
      setLoading(false)
    }
  }, [token, page, optOutFilter, selectedTagFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (token) {
        setPage(1) // Reset to first page on search
        fetchContacts()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Helpers
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  const getStatusBadge = (contact: Contact) => {
    if (contact.emailOptedOut && contact.smsOptedOut) {
      return <Badge variant="destructive" className="gap-1"><UserX className="h-3 w-3" /> All Opted Out</Badge>
    }
    if (contact.emailOptedOut) {
      return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" /> Email Opted Out</Badge>
    }
    if (contact.smsOptedOut) {
      return <Badge variant="secondary" className="gap-1"><Phone className="h-3 w-3" /> SMS Opted Out</Badge>
    }
    return <Badge variant="default" className="gap-1"><UserCheck className="h-3 w-3" /> Active</Badge>
  }

  const totalPages = Math.ceil(total / limit)

  if (!token) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Please log in to view contacts</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Contacts - Fuse Admin</title>
      </Head>

      <ToastManager toasts={toasts} onDismiss={dismiss} />

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Contacts
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your patients and their communication preferences
            </p>
          </div>
          
          {/* Add Contact Button with Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
            
            {showAddDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowAddDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowCreateModal(true)
                      setShowAddDropdown(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Create Single Contact</div>
                      <div className="text-xs text-muted-foreground">Add one patient manually</div>
                    </div>
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={() => {
                      setShowUploadCSVModal(true)
                      setShowAddDropdown(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-b-md"
                  >
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Upload CSV</div>
                      <div className="text-xs text-muted-foreground">Import multiple patients</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-bold">{total}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {contacts.filter(c => !c.emailOptedOut && !c.smsOptedOut).length}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Email Opted Out</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {contacts.filter(c => c.emailOptedOut).length}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SMS Opted Out</p>
                  <p className="text-2xl font-bold text-red-600">
                    {contacts.filter(c => c.smsOptedOut).length}
                  </p>
                </div>
                <Phone className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Tag Filter */}
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">All Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>

                {/* Send Sequence by Tag Button */}
                <Button
                  onClick={openSendByTagModal}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <TagIcon className="h-4 w-4" />
                  Send by Tag
                </Button>
              </div>

              {/* Status Filter */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={optOutFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setOptOutFilter('all')}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={optOutFilter === 'active' ? 'default' : 'outline'}
                  onClick={() => setOptOutFilter('active')}
                  size="sm"
                >
                  Active
                </Button>
                <Button
                  variant={optOutFilter === 'email_opted_out' ? 'default' : 'outline'}
                  onClick={() => setOptOutFilter('email_opted_out')}
                  size="sm"
                >
                  Email Opted Out
                </Button>
                <Button
                  variant={optOutFilter === 'sms_opted_out' ? 'default' : 'outline'}
                  onClick={() => setOptOutFilter('sms_opted_out')}
                  size="sm"
                >
                  SMS Opted Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Contacts {loading ? '...' : `(${contacts.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Tags</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Phone</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Last Contact</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr 
                          key={contact.id} 
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openEditModal(contact)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                {contact.firstName[0]}{contact.lastName[0]}
                              </div>
                              <div>
                                <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {contact.tags && contact.tags.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {contact.tags.slice(0, 3).map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs"
                                    style={{
                                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                                      borderColor: tag.color || undefined,
                                      color: tag.color || undefined
                                    }}
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                                {contact.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{contact.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {contact.email}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {contact.phoneNumber || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(contact)}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(contact.lastContactDate)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation() // Prevent row click
                                openSendSequenceModal(contact)
                              }}
                            >
                              <Send className="h-4 w-4" />
                              Send Sequence
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} contacts
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Sequence Modal */}
      {showSequenceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Send Sequence</h2>
              </div>
              <button
                onClick={closeSendSequenceModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={sendingSequence}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Contact Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Sending to:</p>
                <p className="font-semibold">
                  {selectedContact?.firstName} {selectedContact?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{selectedContact?.email}</p>
              </div>

              {/* Sequence Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select a sequence <span className="text-red-500">*</span>
                </label>
                {sequences.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No active sequences found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create and activate a sequence first
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedSequenceId}
                    onChange={(e) => setSelectedSequenceId(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={sendingSequence}
                  >
                    <option value="">-- Select a sequence --</option>
                    {sequences.map((seq) => (
                      <option key={seq.id} value={seq.id}>
                        {seq.name}
                        {seq.description ? ` - ${seq.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={closeSendSequenceModal}
                disabled={sendingSequence}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendSequence}
                disabled={!selectedSequenceId || sendingSequence || sequences.length === 0}
                className="gap-2"
              >
                {sendingSequence ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Sequence
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Edit Contact</h2>
              </div>
              <button
                onClick={closeEditModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={savingContact}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  placeholder="John"
                  disabled={savingContact}
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  placeholder="Doe"
                  disabled={savingContact}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="john.doe@example.com"
                  disabled={savingContact}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={editFormData.phoneNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  placeholder="5551234567 (10 digits)"
                  maxLength={10}
                  disabled={savingContact}
                />
              </div>

              {/* Opt-out Status Info (read-only) */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Communication Status:</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span className={editingContact.emailOptedOut ? 'text-red-600' : 'text-green-600'}>
                      Email: {editingContact.emailOptedOut ? 'Opted Out' : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    <span className={editingContact.smsOptedOut ? 'text-red-600' : 'text-green-600'}>
                      SMS: {editingContact.smsOptedOut ? 'Opted Out' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags Management Button */}
              <Button
                variant="outline"
                onClick={() => {
                  closeEditModal()
                  openManageTagsModal(editingContact)
                }}
                className="w-full flex items-center justify-center gap-2"
                disabled={savingContact}
              >
                <TagIcon className="h-4 w-4" />
                Manage Tags
                {editingContact.tags && editingContact.tags.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {editingContact.tags.length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={closeEditModal}
                disabled={savingContact}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveContact}
                disabled={savingContact || !editFormData.firstName || !editFormData.lastName || !editFormData.email}
                className="gap-2"
              >
                {savingContact ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Create New Contact</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={creatingContact}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={createFormData.firstName}
                  onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                  placeholder="John"
                  disabled={creatingContact}
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={createFormData.lastName}
                  onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                  placeholder="Doe"
                  disabled={creatingContact}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder="john.doe@example.com"
                  disabled={creatingContact}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number (Optional)
                </label>
                <Input
                  type="tel"
                  value={createFormData.phoneNumber}
                  onChange={(e) => setCreateFormData({ ...createFormData, phoneNumber: e.target.value })}
                  placeholder="5551234567 (10 digits)"
                  maxLength={10}
                  disabled={creatingContact}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={creatingContact}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateContact}
                disabled={creatingContact || !createFormData.firstName || !createFormData.lastName || !createFormData.email}
                className="gap-2"
              >
                {creatingContact ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Contact
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {showUploadCSVModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Upload CSV</h2>
              </div>
              <button
                onClick={() => {
                  setShowUploadCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={uploadingCSV}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">CSV Format Requirements:</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                  <li>Required columns: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">firstName</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lastName</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">email</code></li>
                  <li>Optional column: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">phoneNumber</code> (10 digits only, e.g., 5551234567)</li>
                  <li>First row must be headers</li>
                  <li>Phone numbers must be exactly 10 digits (no + or country code needed)</li>
                </ul>
              </div>

              {/* Download Template Button */}
              <Button
                variant="outline"
                onClick={downloadCSVTemplate}
                className="w-full gap-2"
                disabled={uploadingCSV}
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select CSV File <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFileSelect}
                    disabled={uploadingCSV}
                    id="csv-file-input"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                    disabled={uploadingCSV}
                  >
                    Select file
                  </Button>
                  <span className="text-sm text-muted-foreground flex-1">
                    {csvFile ? csvFile.name : 'No file selected'}
                  </span>
                </div>
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Preview (first 5 rows):</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">First Name</th>
                            <th className="px-4 py-2 text-left font-medium">Last Name</th>
                            <th className="px-4 py-2 text-left font-medium">Email</th>
                            <th className="px-4 py-2 text-left font-medium">Phone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {csvPreview.map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="px-4 py-2">{row.firstname || row.firstName || '-'}</td>
                              <td className="px-4 py-2">{row.lastname || row.lastName || '-'}</td>
                              <td className="px-4 py-2">{row.email || '-'}</td>
                              <td className="px-4 py-2">{row.phonenumber || row.phoneNumber || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                }}
                disabled={uploadingCSV}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadCSV}
                disabled={uploadingCSV || !csvFile}
                className="gap-2"
              >
                {uploadingCSV ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Sequence by Tag Modal */}
      {showSendByTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <TagIcon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Send Sequence by Tag</h2>
              </div>
              <button
                onClick={closeSendByTagModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={sendingByTag}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Tag Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select a tag <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTagForSend}
                  onChange={(e) => setSelectedTagForSend(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  disabled={sendingByTag}
                >
                  <option value="">-- Select a tag --</option>
                  {allTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sequence Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select a sequence <span className="text-red-500">*</span>
                </label>
                {sequences.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No active sequences found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create and activate a sequence first
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedSequenceId}
                    onChange={(e) => setSelectedSequenceId(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={sendingByTag}
                  >
                    <option value="">-- Select a sequence --</option>
                    {sequences.map((seq) => (
                      <option key={seq.id} value={seq.id}>
                        {seq.name}
                        {seq.description ? ` - ${seq.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ This will send the selected sequence to ALL contacts with the selected tag.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={closeSendByTagModal}
                disabled={sendingByTag}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendSequenceByTag}
                disabled={sendingByTag || !selectedTagForSend || !selectedSequenceId}
                className="gap-2"
              >
                {sendingByTag ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send to All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Tags Modal */}
      {showManageTagsModal && managingTagsContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <TagIcon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Manage Tags</h2>
              </div>
              <button
                onClick={closeManageTagsModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={savingTags}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Contact Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Contact:</p>
                <p className="font-semibold">
                  {managingTagsContact.firstName} {managingTagsContact.lastName}
                </p>
              </div>

              {/* Tags Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Tags
                </label>
                {allTags.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <TagIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No tags available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create tags in the Tags page first
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagsForContact.includes(tag.id)}
                          onChange={() => toggleTagSelection(tag.id)}
                          disabled={savingTags}
                          className="h-4 w-4"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <span className="flex-1">{tag.name}</span>
                        {tag.category && (
                          <Badge variant="secondary" className="text-xs">
                            {tag.category}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={closeManageTagsModal}
                disabled={savingTags}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveContactTags}
                disabled={savingTags}
                className="gap-2"
              >
                {savingTags ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Tags'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Sending Sequence by Tag */}
      {showConfirmSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-semibold">Confirm Send Sequence</h2>
              </div>
              <button
                onClick={() => setShowConfirmSendModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={sendingByTag}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-amber-900 dark:text-amber-100">
                  <strong>Warning:</strong> This will send the selected sequence to <strong>ALL</strong> contacts with the 
                  <strong className="mx-1">
                    "{allTags.find(t => t.id === selectedTagForSend)?.name}"
                  </strong>
                  tag.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tag:</span>
                  <span className="font-medium">
                    {allTags.find(t => t.id === selectedTagForSend)?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sequence:</span>
                  <span className="font-medium">
                    {sequences.find(s => s.id === selectedSequenceId)?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Recipients:</span>
                  <span className="font-medium">
                    {allTags.find(t => t.id === selectedTagForSend)?.userCount || 0} contacts
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Are you sure you want to continue?
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={() => setShowConfirmSendModal(false)}
                disabled={sendingByTag}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSendSequenceByTag}
                disabled={sendingByTag}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {sendingByTag ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Yes, Send to All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

