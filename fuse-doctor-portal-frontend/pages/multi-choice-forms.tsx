import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { Loader2, RefreshCcw, Search, Package } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useProducts } from "@/hooks/useProducts"
import { ProductAssignmentModal } from "@/components/ProductAssignmentModal"

const SORT_OPTIONS = [
  { value: "name_asc", label: "A → Z" },
  { value: "name_desc", label: "Z → A" },
  { value: "updated_desc", label: "Recently Updated" },
  { value: "updated_asc", label: "Oldest First" },
] as const

export default function MultiChoiceForms() {
  const router = useRouter()
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", [])
  const { token } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSort, setSelectedSort] = useState("name_asc")
  const [productFormTemplates, setProductFormTemplates] = useState<Array<{
    id: string;
    title: string;
    description: string;
    createdAt: string;
    productOfferType?: 'single_choice' | 'multiple_choice';
    user?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  }>>([])
  const [selectedFormForProducts, setSelectedFormForProducts] = useState<{
    id: string;
    title: string;
    productOfferType?: 'single_choice' | 'multiple_choice';
  } | null>(null)

  // Use products hook
  const {
    products,
    loading: productsLoading,
    assignProductsToForm,
    getAssignedProducts,
    refresh: refreshProducts,
  } = useProducts(baseUrl)

  // Fetch product form templates
  useEffect(() => {
    const fetchProductFormTemplates = async () => {
      if (!token) return
      setLoading(true)
      setError(null)

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
            description: f.description || '',
            createdAt: f.createdAt || '',
            productOfferType: f.productOfferType || 'single_choice',
            user: f.user || null,
          })))
        } else {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.message || "Failed to load templates")
        }
      } catch (error: any) {
        console.error('Failed to fetch product form templates:', error)
        setError(error.message || 'Failed to load templates')
      } finally {
        setLoading(false)
      }
    }

    fetchProductFormTemplates()
  }, [token, baseUrl])

  const refresh = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

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
          description: f.description || '',
          createdAt: f.createdAt || '',
          productOfferType: f.productOfferType || 'single_choice',
          user: f.user || null,
        })))
      }
    } catch (error) {
      console.error('Failed to fetch product form templates:', error)
    } finally {
      setLoading(false)
    }

    // Also refresh products
    refreshProducts()
  }

  const handleOpenProductAssignment = (template: any) => {
    setSelectedFormForProducts({
      id: template.id,
      title: template.title || "Untitled Form",
      productOfferType: template.productOfferType || 'single_choice',
    })
  }

  const handleSaveProductAssignment = async (productIds: string[], productOfferType: 'single_choice' | 'multiple_choice') => {
    if (!selectedFormForProducts) return
    await assignProductsToForm(selectedFormForProducts.id, productIds, productOfferType)
    // Refresh templates to get updated productOfferType
    refresh()
  }

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = [...productFormTemplates]

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((template) =>
        template.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort - templates with more products always appear first
    filtered.sort((a, b) => {
      // First, sort by number of assigned products (descending)
      const aProductCount = getAssignedProducts(a.id).length
      const bProductCount = getAssignedProducts(b.id).length
      
      if (aProductCount !== bProductCount) {
        return bProductCount - aProductCount
      }

      // Then apply the selected sort option for templates with same product count
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

    return filtered
  }, [productFormTemplates, searchQuery, selectedSort, getAssignedProducts])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">Multi-Choice Forms</h1>
              <p className="text-muted-foreground text-base">
                Assign products to medical question forms. Select which products each form should be available for.
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

          {error && (
            <div className="rounded-2xl p-4 bg-red-50 border border-red-200 text-red-700 shadow-sm">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <div className="flex gap-3">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  How Multi-Choice Forms Work
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Each form template can be assigned to multiple products. When a patient selects a product, 
                  they'll see the associated medical questions. This allows doctors to reuse the same 
                  form across different products instead of creating separate forms for each one.
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-card-foreground">Filter & Sort</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Find the form you want to configure</p>
            </div>
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search Forms</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sort By</label>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary transition-all"
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

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedTemplates.length} of {productFormTemplates.length} forms
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Forms List */}
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
              <span className="text-base">Loading forms...</span>
            </div>
          ) : filteredAndSortedTemplates.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-sm border border-border p-16">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <div className="bg-muted rounded-full p-6 mb-4">
                  <Search className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-lg text-foreground">
                  {productFormTemplates.length === 0
                    ? "No forms found. Forms are created in the Medical Question Templates section."
                    : "No forms found matching your filters."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedTemplates.map((template) => {
                const assignedCount = getAssignedProducts(template.id).length
                return (
                  <div key={template.id} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden hover:shadow-md hover:border-primary transition-all">
                    <div className="p-6 pb-4 border-b border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-card-foreground">{template.title || "Untitled Form"}</h3>
                          {template.description && !template.description.startsWith('Questionnaire for') && (
                            <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      {/* Creator info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {template.user ? (
                          <>
                            <div className="w-5 h-5 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-medium text-white">
                                {template.user.firstName?.charAt(0).toUpperCase() || template.user.email?.charAt(0).toUpperCase() || 'D'}
                              </span>
                            </div>
                            <span className="truncate">
                              Created by {template.user.firstName && template.user.lastName
                                ? `${template.user.firstName} ${template.user.lastName}`
                                : template.user.email}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-medium text-muted-foreground">S</span>
                            </div>
                            <span>System template</span>
                          </>
                        )}
                      </div>

                      {/* Product Assignment Status */}
                      <div className={`flex items-center justify-between py-3 px-4 rounded-xl border-2 ${
                        assignedCount > 0 
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                          : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Package className={`h-5 w-5 ${assignedCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          <div>
                            <p className={`text-sm font-semibold ${assignedCount > 0 ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                              {assignedCount === 0 ? "No Products" : `${assignedCount} Product${assignedCount > 1 ? 's' : ''}`}
                            </p>
                            <p className={`text-xs ${assignedCount > 0 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                              {assignedCount === 0 ? "Assign products to activate" : "Currently assigned"}
                            </p>
                          </div>
                        </div>
                        {assignedCount > 0 && (
                          <div className="bg-green-600 dark:bg-green-500 text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
                            {assignedCount}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-sm transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => handleOpenProductAssignment(template)}
                        >
                          <Package className="h-4 w-4" />
                          {assignedCount > 0 ? 'Manage Products' : 'Assign Products'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Product Assignment Modal */}
      {selectedFormForProducts && (
        <ProductAssignmentModal
          isOpen={!!selectedFormForProducts}
          onClose={() => setSelectedFormForProducts(null)}
          formTitle={selectedFormForProducts.title}
          formId={selectedFormForProducts.id}
          products={products}
          assignedProductIds={getAssignedProducts(selectedFormForProducts.id)}
          initialProductOfferType={selectedFormForProducts.productOfferType}
          onSave={handleSaveProductAssignment}
        />
      )}
    </div>
  )
}

