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
  Tag as TagIcon,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Users,
  AlertTriangle
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Tag {
  id: string
  name: string
  description?: string
  category?: string
  color?: string
  isActive: boolean
  userCount?: number
}

const CATEGORY_OPTIONS = [
  { value: 'treatment', label: 'Treatment' },
  { value: 'status', label: 'Status' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'other', label: 'Other' }
]

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
]

export default function Tags() {
  const { user, token } = useAuth()
  const { toasts, dismiss, success: showSuccess, error: showError } = useToast()
  
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    color: COLOR_OPTIONS[0]
  })

  useEffect(() => {
    if (token) {
      fetchTags()
    }
  }, [token])

  const fetchTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch tags')

      const data = await response.json()
      setTags(data.data || [])
    } catch (error) {
      console.error('Error fetching tags:', error)
      showError('Failed to load tags')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTag = async () => {
    if (!formData.name.trim()) {
      showError('Tag name is required')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create tag')
      }

      showSuccess('Tag created successfully')
      setShowCreateModal(false)
      resetForm()
      fetchTags()
    } catch (error: any) {
      console.error('Error creating tag:', error)
      showError(error.message || 'Failed to create tag')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTag = async () => {
    if (!selectedTag || !formData.name.trim()) {
      showError('Tag name is required')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/tags/${selectedTag.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update tag')
      }

      showSuccess('Tag updated successfully')
      setShowEditModal(false)
      resetForm()
      setSelectedTag(null)
      fetchTags()
    } catch (error: any) {
      console.error('Error updating tag:', error)
      showError(error.message || 'Failed to update tag')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag)
    setShowDeleteModal(true)
  }

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return

    try {
      setDeleting(true)
      const response = await fetch(`${API_URL}/tags/${tagToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete tag')
      }

      showSuccess('Tag deleted successfully')
      setShowDeleteModal(false)
      setTagToDelete(null)
      fetchTags()
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      showError(error.message || 'Failed to delete tag')
    } finally {
      setDeleting(false)
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (tag: Tag) => {
    setSelectedTag(tag)
    setFormData({
      name: tag.name,
      description: tag.description || '',
      category: tag.category || 'other',
      color: tag.color || COLOR_OPTIONS[0]
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'other',
      color: COLOR_OPTIONS[0]
    })
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Please log in to manage tags.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Head>
        <title>Tag Management - Fuse Health</title>
      </Head>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <TagIcon className="h-8 w-8 text-blue-600" />
                Tag Management
              </h1>
              <p className="text-muted-foreground mt-1">Organize and segment your contacts</p>
            </div>
            <Button onClick={openCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Tag
            </Button>
          </div>

          {/* Tags Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : tags.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TagIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No tags yet</h3>
                <p className="text-muted-foreground mb-4">Create your first tag to start organizing contacts</p>
                <Button onClick={openCreateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tag
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map((tag) => (
                <Card key={tag.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <h3 className="font-semibold text-foreground">{tag.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(tag)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTag(tag)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {tag.description && (
                      <p className="text-sm text-muted-foreground mb-3">{tag.description}</p>
                    )}

                    <div className="flex items-center justify-between">
                      {tag.category && (
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_OPTIONS.find(c => c.value === tag.category)?.label || tag.category}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{tag.userCount || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Tag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Create New Tag</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tag Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HRT, Weight Loss, New Patient"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color
                          ? 'border-foreground scale-110'
                          : 'border-border hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTag}
                disabled={submitting || !formData.name.trim()}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Tag'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditModal && selectedTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Edit Tag</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tag Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HRT, Weight Loss, New Patient"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color
                          ? 'border-foreground scale-110'
                          : 'border-border hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTag}
                disabled={submitting || !formData.name.trim()}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tag'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && tagToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Delete Tag</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setTagToDelete(null)
                }}
                className="text-muted-foreground hover:text-foreground"
                disabled={deleting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-medium mb-2">
                    Are you sure you want to delete "{tagToDelete.name}"?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. The tag will be removed from all contacts.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setTagToDelete(null)
                }}
                disabled={deleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteTag}
                disabled={deleting}
                variant="destructive"
                className="flex-1"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Tag
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastManager toasts={toasts} onDismiss={dismiss} />
    </Layout>
  )
}

