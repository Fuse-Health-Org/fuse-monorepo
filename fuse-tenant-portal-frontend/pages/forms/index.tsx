import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/router"
import { useTenant } from "@/contexts/TenantContext"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Loader2, RefreshCcw, Search, Edit3, ExternalLink, Clock, Edit, Layers, Info, GripVertical, Save, Plus, X, Trash2 } from "lucide-react"
import { useTemplates } from "@/hooks/useTemplates"
import { QuestionnaireEditor } from "./QuestionnaireEditor"
import { useQuestionnaires } from "@/hooks/useQuestionnaires"
import { useAuth } from "@/contexts/AuthContext"
import { CATEGORY_OPTIONS, STATUS_OPTIONS, SORT_OPTIONS } from "@fuse/enums"



export default function Forms() {
  const router = useRouter()
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", [])
  const { loading, error, assignments, sections, refresh, page, totalPages, setPage } = useTemplates(baseUrl)
  const { questionnaires, refresh: refreshQuestionnaires } = useQuestionnaires(baseUrl)
  const { token } = useAuth()
  const { selectedTenant } = useTenant()

  const [activeTab, setActiveTab] = useState<"products" | "templates" | "account" | "structure">("structure")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedSort, setSelectedSort] = useState("name_asc")
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateType, setEditingTemplateType] = useState<"personalization" | "account" | "doctor" | null>(null)
  const [creating, setCreating] = useState(false)
  const [configuringProductId, setConfiguringProductId] = useState<string | null>(null)
  const [creatingForProductId, setCreatingForProductId] = useState<string | null>(null)
  const [deletingForProductId, setDeletingForProductId] = useState<string | null>(null)
  const [productQStatus, setProductQStatus] = useState<Record<string, 'unknown' | 'exists' | 'none'>>({})
  const [productInfoById, setProductInfoById] = useState<Record<string, { placeholderSig?: string }>>({})
  const [productFormTemplates, setProductFormTemplates] = useState<Array<{ id: string; title: string; description: string }>>([])
  const fetchedProductsRef = useRef<Set<string>>(new Set())
  const fetchedQStatusRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    refresh()
    refreshQuestionnaires()
  }, [])

  // Fetch product form templates
  useEffect(() => {
    const fetchProductFormTemplates = async () => {
      if (!token) return

      try {
        const res = await fetch(`${baseUrl}/questionnaires/templates/product-forms`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) {
          const data = await res.json()
          const forms = Array.isArray(data?.data) ? data.data : []
          setProductFormTemplates(forms.map((f: any) => ({
            id: f.id,
            title: f.title || 'Untitled Form',
            description: f.description || ''
          })))
        }
      } catch (error) {
        console.error('Failed to fetch product form templates:', error)
      }
    }

    fetchProductFormTemplates()
  }, [token, baseUrl])

  // Probe medical questionnaire existence for current assignments
  useEffect(() => {
    if (!token) return
    const toCheck = (assignments || []).map((a: any) => a.treatmentId).filter(Boolean)
    toCheck.forEach(async (productId: string) => {
      if (!productId) return
      // Skip if already checked
      if (fetchedQStatusRef.current.has(productId)) return
      
      // Mark as being checked
      fetchedQStatusRef.current.add(productId)
      
      try {
        const res = await fetch(`${baseUrl}/questionnaires/product/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          setProductQStatus(prev => ({ ...prev, [productId]: 'none' }))
          return
        }
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data?.data) ? data.data : []
        const existing = list.find((q: any) => q.formTemplateType === 'normal') || list[0]
        setProductQStatus(prev => ({ ...prev, [productId]: existing?.id ? 'exists' : 'none' }))
      } catch {
        setProductQStatus(prev => ({ ...prev, [productId]: 'none' }))
      }
    })
  }, [assignments, token, baseUrl])

  // Fetch product info (e.g., Placeholder Sig) for each assignment's productId
  useEffect(() => {
    if (!token) return
    const toCheck = (assignments || []).map((a: any) => a.treatmentId).filter(Boolean)
    
    toCheck.forEach(async (productId: string) => {
      if (!productId) return
      // Skip if already fetched
      if (fetchedProductsRef.current.has(productId)) return
      
      // Mark as being fetched
      fetchedProductsRef.current.add(productId)
      
      try {
        const res = await fetch(`${baseUrl}/products/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.success && data?.data) {
          setProductInfoById(prev => ({ 
            ...prev, 
            [productId]: { placeholderSig: data.data.placeholderSig || undefined } 
          }))
        }
      } catch {
        // ignore
      }
    })
  }, [assignments, token, baseUrl])

  // Filter and sort assignments
  const filteredAndSortedAssignments = useMemo(() => {
    let filtered = [...assignments]

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((assignment) =>
        assignment.treatment?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((assignment) => assignment.treatment?.category === selectedCategory)
    }

    // Filter by status
    if (selectedStatus === "live") {
      filtered = filtered.filter((assignment) => assignment.publishedUrl && assignment.lastPublishedAt)
    } else if (selectedStatus === "pending") {
      filtered = filtered.filter((assignment) => !assignment.publishedUrl || !assignment.lastPublishedAt)
    }

    // Sort
    filtered.sort((a, b) => {
      const nameA = a.treatment?.name || ""
      const nameB = b.treatment?.name || ""

      switch (selectedSort) {
        case "name_asc":
          return nameA.localeCompare(nameB)
        case "name_desc":
          return nameB.localeCompare(nameA)
        case "updated_desc":
          return new Date(b.lastPublishedAt || 0).getTime() - new Date(a.lastPublishedAt || 0).getTime()
        case "updated_asc":
          return new Date(a.lastPublishedAt || 0).getTime() - new Date(b.lastPublishedAt || 0).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [assignments, searchQuery, selectedCategory, selectedStatus, selectedSort])

  const accountQuestionnaire = useMemo(() => {
    // Pick the first questionnaire that is marked as user_profile (global account template)
    return (questionnaires || []).find((q: any) => q.formTemplateType === 'user_profile') || null
  }, [questionnaires])

  const handleEditForm = (assignmentId: string) => {
    router.push(`/forms/builder/${assignmentId}`)
  }

  const handleConfigureProduct = async (assignment: any) => {
    if (!token) return
    const productId = assignment?.treatmentId
    if (!productId) return
    setConfiguringProductId(productId)
    try {
      // Try to find existing medical questionnaire (prefer formTemplateType: 'normal')
      const res = await fetch(`${baseUrl}/questionnaires/product/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : []
        const existing = list
          .filter((q: any) => q.formTemplateType === 'normal')
          .sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0]
          || list[0]
        if (existing?.id) {
          router.push(`/forms/editor/${existing.id}`)
          return
        }
      }

      // None exists: create one
      const name = `${assignment?.treatment?.name || 'Product'} Form`
      const description = `Questionnaire for ${assignment?.treatment?.name || 'product'}`
      const createRes = await fetch(`${baseUrl}/questionnaires/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: name,
          description,
          productId,
          formTemplateType: 'normal',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err?.message || 'Failed to create medical questionnaire')
      }
      const created = await createRes.json()
      const q = created?.data
      if (q?.id) {
        setProductQStatus(prev => ({ ...prev, [productId]: 'exists' }))
        router.push(`/forms/editor/${q.id}`)
      }
    } catch (e: any) {
      console.error('❌ Configure product failed', e)
      alert(e?.message || 'Failed to configure form')
    } finally {
      setConfiguringProductId(null)
    }
  }

  const handleCreateProductQuestionnaire = async (assignment: any) => {
    if (!token) return
    const productId = assignment?.treatmentId
    if (!productId) return
    setCreatingForProductId(productId)
    try {
      const name = `${assignment?.treatment?.name || 'Product'} Form`
      const description = `Questionnaire for ${assignment?.treatment?.name || 'product'}`
      const createRes = await fetch(`${baseUrl}/questionnaires/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: name, description, productId, formTemplateType: 'normal' }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err?.message || 'Failed to create medical questionnaire')
      }
      const created = await createRes.json()
      const q = created?.data
      // No automatic cloning here; use the Rebuild from Template button in the editor
      setProductQStatus(prev => ({ ...prev, [productId]: 'exists' }))
      router.push(`/forms/editor/${q.id}`)
    } catch (e: any) {
      alert(e?.message || 'Failed to create medical questionnaire')
    } finally {
      setCreatingForProductId(null)
    }
  }

  const handleDeleteProductQuestionnaire = async (assignment: any) => {
    if (!token) return
    const productId = assignment?.treatmentId
    if (!productId) return
    if (!confirm('Delete this medical questionnaire? This cannot be undone.')) return
    setDeletingForProductId(productId)
    try {
      const res = await fetch(`${baseUrl}/questionnaires/product/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      const list = Array.isArray(data?.data) ? data.data : []
      const existing = list.find((q: any) => q.formTemplateType === 'normal') || list[0]
      if (!existing?.id) {
        alert('No questionnaire found to delete')
        return
      }
      const del = await fetch(`${baseUrl}/questionnaires/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const delData = await del.json().catch(() => ({}))
      if (!del.ok || delData?.success === false) {
        throw new Error(delData?.message || 'Failed to delete questionnaire')
      }
      setProductQStatus(prev => ({ ...prev, [productId]: 'none' }))
      await refreshQuestionnaires()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete questionnaire')
    } finally {
      setDeletingForProductId(null)
    }
  }

  const handleViewLive = (assignment: any) => {
    if (assignment.publishedUrl) {
      window.open(assignment.publishedUrl, "_blank")
    }
  }

  const handleCreateTemplate = async (sectionType: "personalization" | "account" | "doctor", category?: string) => {
    if (!token || creating) return

    setCreating(true)
    try {
      const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === category)?.label
      const name = sectionType === "account"
        ? "Universal Account Questions"
        : sectionType === "personalization"
          ? `${categoryLabel} Personalization Questions`
          : `${categoryLabel} Doctor Questions`

      const description = sectionType === "account"
        ? "Standard account creation questions shown in all product forms"
        : sectionType === "personalization"
          ? `Category-specific personalization questions for ${categoryLabel} products`
          : `Doctor-required questions for ${categoryLabel} products`

      // For account templates, clone from master user_profile steps
      if (sectionType === 'account') {
        const cloneRes = await fetch(`${baseUrl}/questionnaires/templates/account-from-master`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
        if (!cloneRes.ok) {
          const err = await cloneRes.json().catch(() => ({}))
          throw new Error(err?.message || 'Failed to clone account template')
        }
        const cloned = await cloneRes.json()
        const q = cloned?.data
        await refreshQuestionnaires()
        if (q?.id) {
          router.push(`/forms/editor/${q.id}`)
        }
        return
      }

      const response = await fetch(`${baseUrl}/questionnaires/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: name,
          description,
          // set category only for non-account templates
          category: category,
          formTemplateType: 'standardized_template',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to create template")
      }

      const data = await response.json()
      const template = data.data

      // Refresh questionnaires to get the new one
      await refreshQuestionnaires()

      // Navigate to editor
      router.push(`/forms/editor/${template.id}`)
    } catch (err: any) {
      console.error("Error creating template:", err)
      alert(err.message || "Failed to create template")
    } finally {
      setCreating(false)
    }
  }

  const isLocked = (assignment: any) => {
    return assignment.lockedUntil && new Date(assignment.lockedUntil) > new Date()
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Global Structures Management</h1>
              <p className="text-muted-foreground text-base">
                Configure product-specific forms and manage standardized question templates.
              </p>
            </div>
            <button 
              onClick={refresh} 
              disabled={loading}
              className="rounded-full px-6 py-2.5 border border-border text-foreground hover:bg-muted transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 bg-card rounded-2xl p-1.5 w-fit shadow-sm border border-border">
            <button
              onClick={() => setActiveTab("structure")}
              className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === "structure"
                  ? "bg-[#4FA59C] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Global Structure
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === "products"
                  ? "bg-[#4FA59C] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Medical Questions Templates
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === "templates"
                  ? "bg-[#4FA59C] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Standardized Questions
            </button>
            <button
              onClick={() => setActiveTab("account")}
              className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === "account"
                  ? "bg-[#4FA59C] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Account Questions
            </button>
          </div>

          {error && (
            <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 shadow-sm">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Medical Questions Templates Tab */}
          {activeTab === "products" && (
            <>
              {/* Filters */}
              <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 pb-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Filter & Sort</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Find the template you want to edit</p>
                </div>
                <div className="p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Search */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Search Templates</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name..."
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                        />
                      </div>
                    </div>

                    {/* Sort */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Sort By</label>
                      <select
                        value={selectedSort}
                        onChange={(e) => setSelectedSort(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Summary and Create Button */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {(() => {
                    const filtered = productFormTemplates.filter((q: any) => {
                      const matchesSearch = !searchQuery ||
                        q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        q.description?.toLowerCase().includes(searchQuery.toLowerCase())
                      return matchesSearch
                    })
                    return filtered.length
                  })()} of {productFormTemplates.length} templates
                </span>
                <div className="flex items-center gap-3">
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("")
                      }}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                    >
                      Clear Filters
                    </button>
                  )}
                    <button 
                    onClick={async () => {
                      if (!token) return
                      setCreating(true)
                      try {
                        const response = await fetch(`${baseUrl}/questionnaires/templates`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            title: `New Template`,
                            description: `Template created on ${new Date().toLocaleDateString()}`,
                            formTemplateType: 'normal',
                          }),
                        })

                        if (!response.ok) {
                          const data = await response.json().catch(() => ({}))
                          throw new Error(data.message || "Failed to create template")
                        }

                        const data = await response.json()
                        const template = data.data

                        router.push(`/forms/editor/${template.id}`)
                      } catch (err: any) {
                        console.error("Error creating template:", err)
                        alert(err.message || "Failed to create template")
                      } finally {
                        setCreating(false)
                      }
                    }}
                    disabled={creating}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium disabled:opacity-50"
                  >
                    <Plus className="h-5 w-5" />
                    {creating ? 'Creating...' : 'Create New Template'}
                    </button>
                </div>
              </div>

              {/* Templates List */}
              {loading ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#4FA59C]" />
                  <span className="text-base">Loading templates...</span>
                </div>
              ) : (() => {
                const filtered = productFormTemplates.filter((q: any) => {
                  const matchesSearch = !searchQuery ||
                    q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.description?.toLowerCase().includes(searchQuery.toLowerCase())
                  return matchesSearch
                }).sort((a: any, b: any) => {
                  const titleA = a.title || ""
                  const titleB = b.title || ""
                  switch (selectedSort) {
                    case "name_asc":
                      return titleA.localeCompare(titleB)
                    case "name_desc":
                      return titleB.localeCompare(titleA)
                    default:
                      return 0
                  }
                })

                return filtered.length === 0 ? (
                <div className="bg-card rounded-2xl shadow-sm border border-border p-16">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="bg-muted rounded-full p-6 mb-4">
                      <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                      <p className="text-lg text-foreground">No templates found matching your filters.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((template: any) => (
                      <div key={template.id} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden hover:shadow-md hover:border-[#4FA59C] transition-all">
                        <div className="p-6 pb-4 border-b border-border">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground">{template.title || "Untitled Template"}</h3>
                              {template.description && !template.description.startsWith('Questionnaire for') && (
                                <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                                )}
                            </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <button
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-sm transition-all bg-[#4FA59C] hover:bg-[#478F87] text-white"
                              onClick={() => router.push(`/forms/editor/${template.id}`)}
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit Template
                            </button>
                              <button
                              className="px-4 py-2.5 rounded-full border border-border text-destructive hover:bg-destructive/10 text-sm font-medium transition-all"
                              onClick={async () => {
                                if (!token) return
                                if (!confirm('Delete this template? This cannot be undone.')) return
                                try {
                                  const res = await fetch(`${baseUrl}/questionnaires/${template.id}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` },
                                  })
                                  const data = await res.json().catch(() => ({}))
                                  if (!res.ok) throw new Error(data?.message || 'Failed to delete template')
                                  // Refetch templates after deletion
                                  const refetchRes = await fetch(`${baseUrl}/questionnaires/templates/product-forms`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  })
                                  if (refetchRes.ok) {
                                    const refetchData = await refetchRes.json()
                                    const forms = Array.isArray(refetchData?.data) ? refetchData.data : []
                                    setProductFormTemplates(forms.map((f: any) => ({
                                      id: f.id,
                                      title: f.title || 'Untitled Form',
                                      description: f.description || ''
                                    })))
                                  }
                                } catch (e: any) {
                                  alert(e?.message || 'Failed to delete template')
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                )
              })()}
            </>
          )}

          {/* Standardized Questions Tab */}
          {activeTab === "templates" && (
            <>
              <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 pb-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Manage Standardized Templates</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Edit templates that are used across multiple product forms. Changes here will update all forms using these templates.
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {/* Category Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Select Category</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full md:w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">Select a category...</option>
                        {CATEGORY_OPTIONS.filter(c => c.value).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCategory && (
                      <div className="space-y-4">
                        {/* Personalization Questions */}
                        <div className="bg-muted/50 rounded-2xl border border-border overflow-hidden">
                          <div className="p-4 border-b border-border">
                            <h3 className="text-base font-semibold text-foreground">Personalization Questions</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Category: {CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label}
                            </p>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-muted-foreground mb-4">
                              These questions are shown in all {CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label} product forms.
                            </p>
                            {(() => {
                              const categoryTemplate = (questionnaires || []).find(
                                (q: any) => q.formTemplateType === 'standardized_template' && q.category === selectedCategory
                              )
                              return (
                                <div className="grid gap-2">
                                  {categoryTemplate && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <button
                                        onClick={() => router.push(`/forms/editor/${categoryTemplate.id}`)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                        Edit Questions
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!token) return
                                          if (!confirm('Delete this personalization template? This cannot be undone.')) return
                                          try {
                                            const res = await fetch(`${baseUrl}/questionnaires/${categoryTemplate.id}`, {
                                              method: 'DELETE',
                                              headers: { Authorization: `Bearer ${token}` },
                                            })
                                            const data = await res.json().catch(() => ({}))
                                            if (!res.ok) throw new Error(data?.message || 'Failed to delete personalization template')
                                            await refreshQuestionnaires()
                                          } catch (e: any) {
                                            alert(e?.message || 'Failed to delete personalization template')
                                          }
                                        }}
                                        className="w-full px-4 py-2.5 rounded-full border border-border text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                  {!categoryTemplate && (
                                    <button
                                      onClick={() => handleCreateTemplate("personalization", selectedCategory)}
                                      disabled={creating}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {creating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Layers className="h-4 w-4" />
                                      )}
                                      {creating ? "Creating..." : "Create Personalization Template"}
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {!selectedCategory && (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="bg-muted rounded-full p-6 mx-auto w-fit mb-4">
                          <Search className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <p>Select a category above to manage its standardized question templates.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "account" && (
            <>
              <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 pb-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Manage Account Questions</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Configure the universal account questions shown in every product form across all categories.
                  </p>
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    These questions are used globally. Changes will impact every product form.
                  </p>
                  {accountQuestionnaire ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => router.push(`/forms/editor/${accountQuestionnaire.id}`)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Account Template
                      </button>
                      <button
                        onClick={async () => {
                          if (!token) return
                          if (!confirm('Delete this account questionnaire? This cannot be undone.')) return
                          try {
                            const res = await fetch(`${baseUrl}/questionnaires/${accountQuestionnaire.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` },
                            })
                            const data = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(data?.message || 'Failed to delete account questionnaire')
                            await refreshQuestionnaires()
                          } catch (e: any) {
                            alert(e?.message || 'Failed to delete account questionnaire')
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-full border border-border text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCreateTemplate("account")}
                      disabled={creating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border text-foreground hover:bg-muted transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Layers className="h-4 w-4" />
                      )}
                      {creating ? "Creating..." : "Create Account Template"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* {activeTab === "tenant" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generate Form for Tenant</CardTitle>
                  <CardDescription>
                    Review the currently selected tenant before generating a tailored form experience.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTenant ? (
                    <div className="space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{selectedTenant.name}</h3>
                          <p className="text-sm text-muted-foreground">Slug: {selectedTenant.slug}</p>
                        </div>
                        <Badge variant="secondary" className="uppercase tracking-wide text-xs">
                          {selectedTenant.status.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Business Type</span>
                          <p className="text-sm font-medium text-foreground">
                            {selectedTenant.businessType || "Not specified"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Activation Status</span>
                          <p className="text-sm font-medium text-foreground">{selectedTenant.active ? "Active" : "Inactive"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Created</span>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(selectedTenant.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Last Updated</span>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(selectedTenant.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {selectedTenant.owner && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground">Primary Contact</h4>
                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <span>{selectedTenant.owner.firstName} {selectedTenant.owner.lastName}</span>
                            <span>{selectedTenant.owner.email}</span>
                            {selectedTenant.owner.phoneNumber && <span>{selectedTenant.owner.phoneNumber}</span>}
                          </div>
                        </div>
                      )}

                      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Form generation actions will appear here. For now, review the tenant details above to confirm you have the correct tenant selected in the header.
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Select a tenant from the header to view tenant information and generate forms.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )} */}

          {/* Global Structure Tab */}
          {activeTab === "structure" && (
            <GlobalStructureTab baseUrl={baseUrl} token={token} />
          )}
        </main>
      </div>
    </div>
  )
}

// Global Structure Tab Component
function GlobalStructureTab({ baseUrl, token }: { baseUrl: string, token: string | null }) {
  interface FormSection {
    id: string
    type: 'product_questions' | 'category_questions' | 'account_creation' | 'product_selection' | 'checkout'
    label: string
    description: string
    order: number
    enabled: boolean
    icon: string
  }

  interface GlobalStructure {
    id: string
    name: string
    description?: string
    sections: FormSection[]
    createdAt?: string
    isDefault?: boolean
  }

  const DEFAULT_SECTIONS: FormSection[] = [
    {
      id: 'product',
      type: 'product_questions',
      label: 'Medical Questions',
      description: 'Medical questionnaire created by doctors for patient assessment',
      order: 1,
      enabled: true,
      icon: '🩺'
    },
    {
      id: 'category',
      type: 'category_questions',
      label: 'Standardized Category Questions',
      description: 'Questions shared across all products in a category (e.g., weight loss, hair growth)',
      order: 2,
      enabled: true,
      icon: '📋'
    },
    {
      id: 'account',
      type: 'account_creation',
      label: 'Create Account',
      description: 'Patient information collection (name, email, phone)',
      order: 3,
      enabled: true,
      icon: '👤'
    },
    {
      id: 'productSelection',
      type: 'product_selection',
      label: 'Product Selection',
      description: 'Patient selects product options before checkout',
      order: 4,
      enabled: true,
      icon: '🛒'
    },
    {
      id: 'checkout',
      type: 'checkout',
      label: 'Payment & Checkout',
      description: 'Billing information, shipping address, and payment processing',
      order: 5,
      enabled: true,
      icon: '💳'
    }
  ]

  const [structures, setStructures] = useState<GlobalStructure[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingStructure, setEditingStructure] = useState<GlobalStructure | null>(null)
  const [sections, setSections] = useState<FormSection[]>(DEFAULT_SECTIONS)
  const [structureName, setStructureName] = useState('')
  const [structureDescription, setStructureDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Load structures on mount
  useEffect(() => {
    loadStructures()
  }, [token])

  const loadStructures = async () => {
    if (!token) return
    setLoading(true)

    try {
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setStructures(data.data)
        }
      }
    } catch (error) {
      console.error('Failed to load structures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingStructure(null)
    setSections(DEFAULT_SECTIONS)
    setStructureName('')
    setStructureDescription('')
    setShowModal(true)
  }

  const handleEdit = (structure: GlobalStructure) => {
    setEditingStructure(structure)
    setSections(structure.sections)
    setStructureName(structure.name)
    setStructureDescription(structure.description || '')
    setShowModal(true)
  }

  const handleSaveStructure = async () => {
    if (!token) return
    
    setSaving(true)
    try {
      const newStructure: GlobalStructure = {
        id: editingStructure?.id || Date.now().toString(),
        name: structureName || 'Untitled Structure',
        description: structureDescription,
        sections: sections.map((s, idx) => ({ ...s, order: idx + 1 })),
        createdAt: editingStructure?.createdAt || new Date().toISOString()
      }

      let updatedStructures
      if (editingStructure) {
        updatedStructures = structures.map(s => s.id === editingStructure.id ? newStructure : s)
      } else {
        updatedStructures = [...structures, newStructure]
      }

      // Save to backend
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ structures: updatedStructures })
      })

      if (response.ok) {
        setStructures(updatedStructures)
        setShowModal(false)
      } else {
        alert('Failed to save structure')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save structure')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this structure?')) return
    if (!token) return

    try {
      const updatedStructures = structures.filter(s => s.id !== id)
      
      // Save to backend
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ structures: updatedStructures })
      })

      if (response.ok) {
        setStructures(updatedStructures)
      } else {
        alert('Failed to delete structure')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete structure')
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newSections = [...sections]
    const draggedSection = newSections[draggedIndex]
    newSections.splice(draggedIndex, 1)
    newSections.splice(index, 0, draggedSection)
    setSections(newSections)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const toggleSection = (id: string) => {
    setSections(sections.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ))
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Add New Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Global Form Structures</h2>
            <p className="text-sm text-muted-foreground mt-1">Create and manage reusable form flows</p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#10B981] hover:bg-[#059669] text-white font-medium shadow-sm transition-all"
          >
            <Plus className="h-5 w-5" />
            Add New Structure
          </button>
        </div>

        {/* Structures List */}
        <div className="space-y-4">
          {structures.map((structure) => (
            <div key={structure.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-foreground">{structure.name}</h3>
                      {structure.isDefault && (
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    {structure.description && (
                      <p className="text-sm text-muted-foreground">{structure.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(structure)}
                      className="px-4 py-2 rounded-full border border-border text-foreground hover:bg-muted text-sm font-medium transition-all"
                    >
                      <Edit className="h-4 w-4 inline mr-1.5" />
                      Edit
                    </button>
                    {!structure.isDefault && (
                      <button
                        onClick={() => handleDelete(structure.id)}
                        className="px-4 py-2 rounded-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium transition-all"
                      >
                        <Trash2 className="h-4 w-4 inline mr-1.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Flow Preview */}
                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Form Flow</p>
                  <div className="flex items-center gap-3 overflow-x-auto">
                    {structure.sections
                      .filter(s => s.enabled)
                      .sort((a, b) => a.order - b.order)
                      .map((section, index, array) => (
                        <div key={section.id} className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-card rounded-lg flex items-center justify-center text-2xl border border-border shadow-sm">
                              {section.icon}
                            </div>
                            <p className="text-xs font-medium text-foreground mt-2 text-center max-w-[100px]">
                              {section.label}
                            </p>
                          </div>
                          {index < array.length - 1 && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted-foreground flex-shrink-0">
                              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for Creating/Editing Structure */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {editingStructure ? 'Edit' : 'Create'} Form Structure
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Define the order and flow of your form sections</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Structure Name and Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Structure Name *</label>
                  <input
                    type="text"
                    value={structureName}
                    onChange={(e) => setStructureName(e.target.value)}
                    placeholder="e.g., Weight Loss Flow, Standard Flow"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    value={structureDescription}
                    onChange={(e) => setStructureDescription(e.target.value)}
                    placeholder="Describe when to use this structure..."
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Drag sections to reorder them. Toggle switches to enable/disable. Account and Checkout sections cannot be disabled.
                  </p>
                </div>
              </div>

              {/* Form Sections */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Form Sections</h3>

        <div className="p-6 space-y-3">
          {sections.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
                      className={`bg-card border-2 rounded-xl p-5 transition-all cursor-move ${draggedIndex === index ? 'border-[#4FA59C] shadow-lg scale-105' : 'border-border hover:border-muted-foreground/50'
              } ${!section.enabled ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Drag Handle */}
                <div className="flex-shrink-0 mt-1">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-2xl">
                    {section.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-foreground">{section.label}</h3>
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                  
                  {/* Section-specific info */}
                  {section.type === 'category_questions' && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <span className="text-xs text-purple-700 dark:text-purple-400">✨ Supports Variants (Variant 1, Variant 2)</span>
                    </div>
                  )}
                  {(section.type === 'account_creation' || section.type === 'product_selection' || section.type === 'checkout') && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <span className="text-xs text-green-700 dark:text-green-400">🔒 Auto-injected by system</span>
                    </div>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => toggleSection(section.id)}
                    disabled={section.type === 'account_creation' || section.type === 'product_selection' || section.type === 'checkout'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${section.enabled ? 'bg-[#4FA59C]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${section.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-full border border-border text-foreground hover:bg-muted font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStructure}
                  disabled={!structureName.trim()}
                  className="px-6 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingStructure ? 'Update' : 'Create'} Structure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}