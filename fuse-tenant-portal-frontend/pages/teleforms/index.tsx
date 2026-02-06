import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/router"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Loader2, RefreshCcw, Search, Edit3, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { SORT_OPTIONS } from "@fuse/enums"

export default function Teleforms() {
  const router = useRouter()
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", [])
  const { token } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSort, setSelectedSort] = useState("name_asc")
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [productFormTemplates, setProductFormTemplates] = useState<Array<{ id: string; title: string; description: string }>>([])

  // Fetch product form templates
  const fetchProductFormTemplates = async () => {
    if (!token) return
    setLoading(true)
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductFormTemplates()
  }, [token, baseUrl])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Teleforms</h1>
              <p className="text-muted-foreground text-base">
                Manage medical question templates for telehealth forms.
              </p>
            </div>
            <button 
              onClick={fetchProductFormTemplates} 
              disabled={loading}
              className="rounded-full px-6 py-2.5 border border-border text-foreground hover:bg-muted transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

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

                    router.push(`/teleforms/editor/${template.id}`)
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
                          onClick={() => router.push(`/teleforms/editor/${template.id}`)}
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
                              await fetchProductFormTemplates()
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
        </main>
      </div>
    </div>
  )
}
