import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Package, FileText, X, Image as ImageIcon, Grid, List, Trash2, ChevronLeft, ChevronRight, PowerOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { CATEGORY_OPTIONS } from "@fuse/enums"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  description: string
  price: number
  placeholderSig: string
  activeIngredients: string[]
  category?: string
  categories?: string[]
  medicationSize?: string
  pharmacyProvider?: string
  pharmacyWholesaleCost?: number
  suggestedRetailPrice?: number
  pharmacyProductId?: string
  requiredDoctorQuestions?: any[]
  isActive: boolean
  isAutoImported?: boolean
  createdAt: string
  imageUrl?: string
  brandId?: string | null
  brandName?: string
  pharmacyCoverages?: PharmacyCoverage[]
}

interface PharmacyCoverage {
  id: string
  customName: string
  customSig: string
  pharmacyProduct?: {
    pharmacyProductName: string
  }
}

interface PharmacyVendor {
  id: string
  name: string
  baseUrl: string
  description: string
}



export default function Products() {
  const router = useRouter()
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [pharmacyProviders, setPharmacyVendors] = useState<PharmacyVendor[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [selectedPharmacies, setSelectedPharmacies] = useState<Set<string>>(new Set())
  const [filterAutoImported, setFilterAutoImported] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'selected' | 'all'>('selected')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [availableForms, setAvailableForms] = useState<Array<{ id: string; title: string; description: string }>>([])
  const [attachingFormToProduct, setAttachingFormToProduct] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(300)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    placeholderSig: "",
    activeIngredients: [] as string[],
    categories: [] as string[],
    medicationSize: "",
    pharmacyProvider: "",
    pharmacyProductId: "",
    requiredDoctorQuestions: [] as any[],
    isActive: true,
  })

  useEffect(() => {
    fetchProducts()
    fetchPharmacyVendors()
    fetchCategories()
    fetchAvailableForms()
  }, [selectedCategory, showActiveOnly, selectedPharmacies, filterAutoImported])

  useEffect(() => {
    setShowActiveOnly(activeTab === 'selected')
  }, [activeTab])

  const fetchProducts = async () => {
    if (!token) return
    setLoading(true)

    try {
      // Always use pagination; fetch all pages and merge so we show ALL products
      const baseParams = new URLSearchParams()
      baseParams.append("page", "1")
      baseParams.append("limit", "100") // server max is 100
      if (selectedCategory) baseParams.append("category", selectedCategory)
      if (activeTab === 'selected') baseParams.append("isActive", "true")
      if (selectedPharmacies.size > 0) {
        baseParams.append("pharmacyProvider", Array.from(selectedPharmacies).join(','))
      }
      if (filterAutoImported !== null) {
        baseParams.append("isAutoImported", String(filterAutoImported))
      }

      const firstRes = await fetch(`${baseUrl}/products-management?${baseParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!firstRes.ok) {
        if (firstRes.status === 401) throw new Error("Session expired. Please sign in again.")
        throw new Error("Failed to fetch products")
      }
      const firstJson = await firstRes.json()
      const firstPageProducts: Product[] = firstJson?.data?.products || []
      const totalPages: number = firstJson?.data?.pagination?.totalPages || 1

      let allProducts: Product[] = []

      if (totalPages <= 1) {
        allProducts = firstPageProducts
      } else {
        // Fetch remaining pages in parallel
        const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
        const requests = pageNumbers.map((page) => {
          const params = new URLSearchParams(baseParams.toString())
          params.set("page", String(page))
          return fetch(`${baseUrl}/products-management?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.json()).catch(() => null)
        })
        const pages = await Promise.all(requests)
        const restProducts: Product[] = pages.flatMap(p => (p?.data?.products || []))
        allProducts = [...firstPageProducts, ...restProducts]
      }

      // Sort products: standard products first, then custom products (with brandId)
      const sortedProducts = allProducts.sort((a, b) => {
        const aIsCustom = !!a.brandId
        const bIsCustom = !!b.brandId

        // If one is custom and the other isn't, standard comes first
        if (aIsCustom && !bIsCustom) return 1
        if (!aIsCustom && bIsCustom) return -1

        // Otherwise maintain original order
        return 0
      })

      // Fetch pharmacy coverages for each product
      const productsWithCoverages = await Promise.all(
        sortedProducts.map(async (product) => {
          try {
            const coverageRes = await fetch(`${baseUrl}/public/products/${product.id}/pharmacy-coverages`)
            if (coverageRes.ok) {
              const coverageData = await coverageRes.json()
              const coverages = coverageData.data || []
              console.log(`✅ Fetched ${coverages.length} coverages for product ${product.id}:`, product.name)
              return {
                ...product,
                pharmacyCoverages: coverages
              }
            } else {
              console.warn(`⚠️ Failed to fetch coverages for product ${product.id}: ${coverageRes.status}`)
            }
          } catch (error) {
            console.error(`❌ Error fetching coverages for product ${product.id}:`, error)
          }
          return product
        })
      )

      setProducts(productsWithCoverages)
    } catch (error: any) {
      console.error("❌ Error fetching products:", error)
      setSaveMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPharmacyVendors = async () => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/products-management/vendors/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Session expired. Please sign in again.")
        throw new Error("Failed to fetch pharmacy vendors")
      }

      const data = await response.json()
      setPharmacyVendors(data.data || [])
    } catch (error: any) {
      console.error("❌ Error fetching pharmacy vendors:", error)
    }
  }

  const fetchCategories = async () => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/products-management/categories/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error("Session expired. Please sign in again.")
        throw new Error("Failed to fetch categories")
      }

      const data = await response.json()
      setCategories(data.data || [])
    } catch (error: any) {
      console.error("❌ Error fetching categories:", error)
    }
  }

  const handleCreateProduct = async () => {
    if (!token) return

    const skeletonProduct = {
      name: "New Product",
      description: "Edit product details below",
      price: 1, // Minimum positive price
      placeholderSig: "TBD",
      activeIngredients: ["TBD"], // At least one required
      isActive: false, // Start as inactive
    }

    console.log('🔄 Creating skeleton product:', skeletonProduct)

    try {
      // Create a skeleton product with minimum required fields
      const response = await fetch(`${baseUrl}/products-management`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(skeletonProduct),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Failed to create product')
        console.error('Response status:', response.status, response.statusText)
        console.error('Response data:', data)

        // Show specific validation errors if available
        let errorMessage = data.message || "Failed to create product"
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((e: any) => {
            if (typeof e === 'string') return e
            if (e.message) return e.message
            return JSON.stringify(e)
          })
          errorMessage = errorMessages.join("; ")
        } else if (data.errors && typeof data.errors === 'object') {
          errorMessage = Object.entries(data.errors).map(([key, val]) => `${key}: ${val}`).join("; ")
        }

        setSaveMessage(`Error: ${errorMessage}`)
        setTimeout(() => setSaveMessage(null), 8000)
        return
      }

      console.log('✅ Product created successfully:', data.data.id)
      // Navigate to the product editor
      router.push(`/products/editor/${data.data.id}`)
    } catch (error: any) {
      console.error("❌ Exception creating product:", error)
      setSaveMessage(`Error: ${error.message || "Failed to create product"}`)
      setTimeout(() => setSaveMessage(null), 8000)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      placeholderSig: product.placeholderSig,
      activeIngredients: product.activeIngredients || [],
      categories: Array.isArray(product.categories) && product.categories.length > 0
        ? product.categories
        : product.category
          ? [product.category]
          : [],
      medicationSize: product.medicationSize || "",
      pharmacyProvider: product.pharmacyProvider || "",
      pharmacyProductId: product.pharmacyProductId || "",
      requiredDoctorQuestions: product.requiredDoctorQuestions || [],
      isActive: product.isActive,
    })
    setShowModal(true)
  }

  const handleSaveProduct = async () => {
    if (!token) return
    setSaveMessage(null)

    const url = editingProduct
      ? `${baseUrl}/products-management/${editingProduct.id}`
      : `${baseUrl}/products-management`
    const method = editingProduct ? "PUT" : "POST"

    try {
      // Clean up the data before sending
      const cleanedData: any = {
        ...formData,
        // Remove empty strings
        pharmacyProvider: formData.pharmacyProvider || undefined,
        pharmacyProductId: formData.pharmacyProductId || undefined,
        medicationSize: formData.medicationSize || undefined,
        categories: formData.categories,
        category: formData.categories[0] || undefined,
      }

      console.log('📤 Sending product data:', cleanedData)

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cleanedData),
      })

      const data = await response.json()
      console.log('📥 Server response:', data)

      if (!response.ok) {
        const errorMsg = data.message || data.error || "Failed to save product"
        const validationErrors = data.errors ? JSON.stringify(data.errors) : ""
        throw new Error(`${errorMsg} ${validationErrors}`)
      }

      setSaveMessage(data.message || "Product saved successfully")
      setShowModal(false)
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error saving product:", error)
      setSaveMessage(error.message)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!token || !confirm("Are you sure you want to deactivate this product?")) return

    try {
      const response = await fetch(`${baseUrl}/products-management/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error("Failed to delete product")

      const data = await response.json()
      setSaveMessage(data.message || "Product deactivated successfully")
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error deleting product:", error)
      setSaveMessage(error.message)
    }
  }

  const handleToggleActive = async (product: Product) => {
    if (!token) return

    // If activating (product is currently inactive), navigate to product editor
    if (!product.isActive) {
      router.push(`/products/editor/${product.id}`)
      return
    }

    // If deactivating, do it directly
    try {
      const response = await fetch(`${baseUrl}/products-management/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: false }),
      })

      if (!response.ok) throw new Error("Failed to deactivate product")

      const data = await response.json()
      setSaveMessage(data.message || "Product deactivated")
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error deactivating product:", error)
      setSaveMessage(error.message)
    }
  }

  const handlePermanentDelete = async (product: Product) => {
    if (!token) return

    const confirmMessage = `Are you sure you want to PERMANENTLY DELETE "${product.name}"? This action cannot be undone and will remove all associated data.`
    if (!confirm(confirmMessage)) return

    try {
      const response = await fetch(`${baseUrl}/products-management/${product.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Portal-Context': 'tenant-admin',
        },
      })

      if (!response.ok) throw new Error("Failed to delete product")

      const data = await response.json()
      setSaveMessage(data.message || "Product permanently deleted")
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error deleting product:", error)
      setSaveMessage(error.message)
    }
  }

  const handleQuickActivate = async (product: Product) => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/products-management/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: true }),
      })

      if (!response.ok) throw new Error("Failed to activate product")

      const data = await response.json()
      setSaveMessage(data.message || "Product activated successfully")
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error activating product:", error)
      setSaveMessage(error.message)
    }
  }

  const getProductCategories = (product: Product): string[] => {
    if (Array.isArray(product.categories) && product.categories.length > 0) {
      return product.categories
    }
    return product.category ? [product.category] : []
  }

  const handleUpdateCategories = async (productId: string, nextCategories: string[]) => {
    if (!token) return

    const normalized = Array.from(new Set(nextCategories.filter(Boolean)))

    // Optimistic update
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? {
          ...p,
          categories: normalized,
          category: normalized[0] ?? undefined,
        }
        : p
    ))

    try {
      const response = await fetch(`${baseUrl}/products-management/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categories: normalized,
          category: normalized[0] ?? null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update categories')
      }

      toast.success('Categories saved')
    } catch (error: any) {
      console.error("❌ Error updating categories:", error)
      toast.error(error.message || 'Failed to update categories')
      fetchProducts()
    }
  }

  const toggleProductCategory = async (product: Product, categoryValue: string) => {
    const current = new Set(getProductCategories(product))
    if (current.has(categoryValue)) {
      current.delete(categoryValue)
    } else {
      current.add(categoryValue)
    }
    await handleUpdateCategories(product.id, Array.from(current))
  }

  const handleImportFromIronSail = async () => {
    if (!token) return

    if (!confirm('This will import all products from the IronSail spreadsheet. Products with the same name will be skipped. Continue?')) {
      return
    }

    try {
      setLoading(true)
      setSaveMessage('📥 Importing products from IronSail spreadsheet...')

      const response = await fetch(`${baseUrl}/pharmacies/ironsail/import-products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        setSaveMessage(`Error: ${data.message || 'Failed to import products'}`)
        setTimeout(() => setSaveMessage(null), 5000)
        return
      }

      // Show success message with summary
      const imported = data.data?.imported?.length || 0
      const skipped = data.data?.skipped?.length || 0
      const errors = data.data?.errors?.length || 0
      setSaveMessage(`✅ Import completed! Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`)
      toast.success(`Successfully imported ${imported} products from IronSail!`)

      // Refresh products list
      await fetchProducts()

      setTimeout(() => setSaveMessage(null), 5000)
    } catch (error: any) {
      console.error('Error importing products:', error)
      setSaveMessage(`Error: ${error.message || 'Failed to import products'}`)
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAllFromIronSail = async () => {
    if (!token) return

    if (!confirm('⚠️ WARNING: This will permanently delete ALL auto-imported products from IronSail (products with [Auto-Imported] prefix). This action CANNOT be undone. Continue?')) {
      return
    }

    try {
      setLoading(true)
      setSaveMessage('🗑️ Deleting all auto-imported products...')

      const response = await fetch(`${baseUrl}/pharmacies/ironsail/delete-all-imported`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Portal-Context': 'tenant-admin',
        }
      })

      const data = await response.json()

      if (!response.ok) {
        setSaveMessage(`Error: ${data.message || 'Failed to delete products'}`)
        setTimeout(() => setSaveMessage(null), 5000)
        return
      }

      // Show success message
      const deletedCount = data.data.deleted
      const coverageCount = data.data.deletedCoverage
      setSaveMessage(`✅ Deleted ${deletedCount} products and ${coverageCount} pharmacy coverage records`)
      toast.success(`Successfully deleted ${deletedCount} auto-imported products!`)

      // Refresh products list
      await fetchProducts()

      setTimeout(() => setSaveMessage(null), 5000)
    } catch (error: any) {
      console.error('Error deleting products:', error)
      setSaveMessage(`Error: ${error.message || 'Failed to delete products'}`)
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivateAll = async () => {
    if (!token) return
    if (!confirm("Are you sure you want to deactivate ALL products? This will affect all products in the system.")) return

    try {
      const activeProducts = products.filter(p => p.isActive)

      if (activeProducts.length === 0) {
        setSaveMessage("No active products to deactivate")
        return
      }

      // Deactivate each product
      const promises = activeProducts.map(product =>
        fetch(`${baseUrl}/products-management/${product.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: false }),
        })
      )

      await Promise.all(promises)
      setSaveMessage(`Successfully deactivated ${activeProducts.length} products`)
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error deactivating all products:", error)
      setSaveMessage(error.message)
    }
  }

  const handleBulkDelete = async () => {
    if (!token || selectedProducts.size === 0) return

    const confirmMessage = `Are you sure you want to PERMANENTLY DELETE ${selectedProducts.size} selected product(s)? This action cannot be undone.`
    if (!confirm(confirmMessage)) return

    try {
      setLoading(true)
      const deletePromises = Array.from(selectedProducts).map(productId =>
        fetch(`${baseUrl}/products-management/${productId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Portal-Context': 'tenant-admin',
          },
        })
      )

      const results = await Promise.all(deletePromises)
      const successCount = results.filter(r => r.ok).length

      if (successCount === selectedProducts.size) {
        toast.success(`Successfully deleted ${successCount} product(s)`)
        setSaveMessage(`Successfully deleted ${successCount} product(s)`)
      } else {
        toast.warning(`Deleted ${successCount} of ${selectedProducts.size} product(s)`)
        setSaveMessage(`Deleted ${successCount} of ${selectedProducts.size} product(s)`)
      }

      setSelectedProducts(new Set())
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error bulk deleting products:", error)
      toast.error(error.message || 'Failed to delete products')
      setSaveMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkDeactivate = async () => {
    if (!token || selectedProducts.size === 0) return

    const confirmMessage = `Are you sure you want to DEACTIVATE ${selectedProducts.size} selected product(s)?`
    if (!confirm(confirmMessage)) return

    try {
      setLoading(true)
      const deactivatePromises = Array.from(selectedProducts).map(productId =>
        fetch(`${baseUrl}/products-management/${productId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: false }),
        })
      )

      const results = await Promise.all(deactivatePromises)
      const successCount = results.filter(r => r.ok).length

      if (successCount === selectedProducts.size) {
        toast.success(`Successfully deactivated ${successCount} product(s)`)
        setSaveMessage(`Successfully deactivated ${successCount} product(s)`)
      } else {
        toast.warning(`Deactivated ${successCount} of ${selectedProducts.size} product(s)`)
        setSaveMessage(`Deactivated ${successCount} of ${selectedProducts.size} product(s)`)
      }

      setSelectedProducts(new Set())
      fetchProducts()
    } catch (error: any) {
      console.error("❌ Error bulk deactivating products:", error)
      toast.error(error.message || 'Failed to deactivate products')
      setSaveMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)))
    }
  }

  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  // Pagination logic
  const paginatedProducts = () => {
    if (itemsPerPage === 'all') {
      return products
    }
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return products.slice(startIndex, endIndex)
  }

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(products.length / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleItemsPerPageChange = (value: number | 'all') => {
    setItemsPerPage(value)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  const calculateProfitMargin = (wholesale: number, retail: number) => {
    if (!wholesale || !retail) return 0
    return ((retail - wholesale) / wholesale * 100).toFixed(1)
  }

  const fetchAvailableForms = async () => {
    if (!token) return

    try {
      const res = await fetch(`${baseUrl}/questionnaires/templates/product-forms`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        const forms = Array.isArray(data?.data) ? data.data : []
        setAvailableForms(forms.map((f: any) => ({
          id: f.id,
          title: f.title || 'Untitled Form',
          description: f.description || ''
        })))
      }
    } catch (error) {
      console.error('Failed to fetch available forms:', error)
    }
  }

  const handleAttachFormToProduct = async (productId: string, formId: string) => {
    if (!token || !formId) return

    setAttachingFormToProduct(productId)

    try {
      // First, check if the product has a questionnaire
      const productRes = await fetch(`${baseUrl}/questionnaires/product/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const productData = await productRes.json()
      const existingQuestionnaires = Array.isArray(productData?.data) ? productData.data : []

      let questionnaireId: string | null = null

      if (existingQuestionnaires.length > 0) {
        // Product already has a questionnaire - import template steps into it
        questionnaireId = existingQuestionnaires[0].id
        console.log(`📋 Importing template ${formId} into existing questionnaire ${questionnaireId}...`)

        const response = await fetch(`${baseUrl}/questionnaires/${questionnaireId}/import-template-steps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ templateId: formId }),
        })

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null)
          throw new Error(errorPayload?.message || errorPayload?.error || 'Failed to import template')
        }

        toast.success('Product questions updated successfully!')
      } else {
        // Product has no questionnaire - need to create one first by cloning the template
        console.log(`📋 Cloning template ${formId} for product ${productId}...`)

        const response = await fetch(`${baseUrl}/questionnaires/templates/${formId}/clone-for-product`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId: productId }),
        })

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null)
          throw new Error(errorPayload?.message || errorPayload?.error || 'Failed to clone template')
        }

        toast.success('Product questions added successfully!')
      }
    } catch (error: any) {
      console.error("❌ Error attaching form to product:", error)
      toast.error(error.message || 'Failed to attach template')
    } finally {
      setAttachingFormToProduct(null)
    }
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#1F2937] mb-2">Product Management</h1>
              <p className="text-[#6B7280] text-base">
                Manage your product catalog with our Pharmacy & State Coverage system.
              </p>
            </div>
            <div className="flex flex-col gap-3 items-end">
              {/* Primary Actions Row */}
              <div className="flex gap-3">
                <Button
                  onClick={handleImportFromIronSail}
                  disabled={loading}
                  className="rounded-full px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <Package className="mr-2 h-5 w-5" /> Import from IronSail
                </Button>
                <Button
                  onClick={handleCreateProduct}
                  className="rounded-full px-6 bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all"
                >
                  <Plus className="mr-2 h-5 w-5" /> Product Builder
                </Button>
              </div>

              {/* Bulk Actions Row */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDeactivateAll}
                  size="sm"
                  className="rounded-full px-4 border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all text-sm"
                >
                  Deactivate All
                </Button>
                <Button
                  onClick={handleDeleteAllFromIronSail}
                  disabled={loading}
                  size="sm"
                  className="rounded-full px-4 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50 text-sm"
                >
                  <X className="mr-2 h-4 w-4" /> Delete All IronSail
                </Button>
              </div>
            </div>
          </div>

          {saveMessage && (
            <div className={`rounded-2xl p-4 ${saveMessage.startsWith('Error:')
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
              } shadow-sm`}>
              <p className="text-sm font-medium">{saveMessage}</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 w-fit shadow-sm border border-[#E5E7EB]">
              <button
                onClick={() => setActiveTab('selected')}
                className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === 'selected'
                  ? 'bg-[#4FA59C] text-white shadow-sm'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
              >
                Selected Products
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === 'all'
                  ? 'bg-[#4FA59C] text-white shadow-sm'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
              >
                All Products
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-[#E5E7EB]">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-xl transition-all ${viewMode === 'card'
                  ? 'bg-[#4FA59C] text-white shadow-sm'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
                title="Card View"
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition-all ${viewMode === 'list'
                  ? 'bg-[#4FA59C] text-white shadow-sm'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
                title="List View"
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#4B5563]">Filter by Category</label>
              <select
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1F2937] shadow-sm hover:border-[#4FA59C] transition-all focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map((cat: { value: string; label: string }) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#4B5563]">Filter by Pharmacy</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'absoluterx', name: 'AbsoluteRx' },
                  { id: 'ironsail', name: 'IronSail' },
                  { id: 'truepill', name: 'Truepill' },
                  { id: 'pillpack', name: 'PillPack' },
                ].map((pharmacy) => {
                  const isSelected = selectedPharmacies.has(pharmacy.id)
                  return (
                    <button
                      key={pharmacy.id}
                      onClick={() => {
                        const newSelected = new Set(selectedPharmacies)
                        if (isSelected) {
                          newSelected.delete(pharmacy.id)
                        } else {
                          newSelected.add(pharmacy.id)
                        }
                        setSelectedPharmacies(newSelected)
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isSelected
                          ? 'bg-[#4FA59C] text-white shadow-md'
                          : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#4FA59C] hover:text-[#4FA59C]'
                        }`}
                    >
                      {pharmacy.name}
                      {isSelected && <X className="inline-block ml-1.5 h-3 w-3" />}
                    </button>
                  )
                })}
                {selectedPharmacies.size > 0 && (
                  <button
                    onClick={() => setSelectedPharmacies(new Set())}
                    className="px-4 py-2 rounded-full text-sm font-medium text-[#EF4444] border border-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#4B5563]">Filter by Auto Imported</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterAutoImported(filterAutoImported === true ? null : true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterAutoImported === true
                      ? 'bg-[#4FA59C] text-white shadow-md'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#4FA59C] hover:text-[#4FA59C]'
                    }`}
                >
                  Auto Imported
                  {filterAutoImported === true && <X className="inline-block ml-1.5 h-3 w-3" />}
                </button>
                {filterAutoImported !== null && (
                  <button
                    onClick={() => setFilterAutoImported(null)}
                    className="px-4 py-2 rounded-full text-sm font-medium text-[#EF4444] border border-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-[#6B7280]">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#4FA59C]" />
              <span className="text-base">Loading products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-16">
              <div className="flex flex-col items-center justify-center text-[#6B7280]">
                <div className="bg-[#F3F4F6] rounded-full p-6 mb-4">
                  <Package className="h-12 w-12 text-[#9CA3AF]" />
                </div>
                <p className="text-lg text-[#4B5563]">No products found. Create your first product to get started.</p>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              {/* Bulk Selection Actions - Always visible */}
              <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-[#E5E7EB] px-6 py-3">
                <span className="text-sm text-[#6B7280] font-medium">
                  {selectedProducts.size > 0 ? `${selectedProducts.size} product(s) selected` : 'No products selected'}
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={handleBulkDeactivate}
                    disabled={selectedProducts.size === 0 || loading}
                    size="sm"
                    className="rounded-lg px-4 bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <PowerOff className="mr-2 h-4 w-4" /> Deactivate Selected
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={selectedProducts.size === 0 || loading}
                    size="sm"
                    className="rounded-lg px-4 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                {/* Pagination controls at top */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#6B7280]">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50"
                    >
                      <option value="300">300</option>
                      <option value="600">600</option>
                      <option value="1000">1000</option>
                      <option value="all">All</option>
                    </select>
                    <span className="text-sm text-[#6B7280]">
                      Showing {itemsPerPage === 'all' ? products.length : Math.min((currentPage - 1) * (itemsPerPage as number) + 1, products.length)} - {itemsPerPage === 'all' ? products.length : Math.min(currentPage * (itemsPerPage as number), products.length)} of {products.length}
                    </span>
                  </div>

                  {itemsPerPage !== 'all' && totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 7) {
                            pageNum = i + 1
                          } else if (currentPage <= 4) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i
                          } else {
                            pageNum = currentPage - 3 + i
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentPage === pageNum
                                ? 'bg-[#4FA59C] text-white'
                                : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                                }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-[#D1D5DB] text-[#4FA59C] focus:ring-[#4FA59C]"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {paginatedProducts().map((product) => (
                      <tr key={product.id} className={`hover:bg-[#F9FAFB] transition-colors ${!product.isActive ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleSelectProduct(product.id)}
                            className="h-4 w-4 rounded border-[#D1D5DB] text-[#4FA59C] focus:ring-[#4FA59C]"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <div className="h-10 w-10 bg-[#F3F4F6] rounded-lg flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-[#9CA3AF]" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-[#1F2937]">{product.name}</p>
                              {product.brandId && (
                                <span className="text-xs text-purple-600">Custom</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-[#6B7280] line-clamp-2 max-w-md">{product.description}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-[#1F2937]">{product.medicationSize || '—'}</p>
                        </td>
                        <td className="px-4 py-4">
                          {product.isActive ? (
                            <span className="inline-flex px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 bg-[#FEF3C7] text-[#92400E] text-xs font-medium rounded-full border border-[#FDE68A]">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => router.push(`/products/editor/${product.id}`)}
                              className="px-3 py-1.5 rounded-lg bg-[#4FA59C] text-white text-xs font-medium hover:bg-[#478F87] transition-all"
                            >
                              {product.isActive ? 'Manage' : 'Configure'}
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(product)}
                              className="px-3 py-1.5 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination controls at bottom */}
                {itemsPerPage !== 'all' && totalPages > 1 && (
                  <div className="flex items-center justify-center px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 7) {
                            pageNum = i + 1
                          } else if (currentPage <= 4) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i
                          } else {
                            pageNum = currentPage - 3 + i
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentPage === pageNum
                                ? 'bg-[#4FA59C] text-white'
                                : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                                }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Selection Actions - Always visible */}
              <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-[#E5E7EB] px-6 py-3">
                <span className="text-sm text-[#6B7280] font-medium">
                  {selectedProducts.size > 0 ? `${selectedProducts.size} product(s) selected` : 'No products selected'}
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={handleBulkDeactivate}
                    disabled={selectedProducts.size === 0 || loading}
                    size="sm"
                    className="rounded-lg px-4 bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <PowerOff className="mr-2 h-4 w-4" /> Deactivate Selected
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={selectedProducts.size === 0 || loading}
                    size="sm"
                    className="rounded-lg px-4 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`relative bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden transition-all hover:shadow-md hover:border-[#4FA59C] ${!product.isActive ? "opacity-60" : ""} ${selectedProducts.has(product.id) ? 'ring-2 ring-[#4FA59C]' : ''}`}
                  >
                    {/* Checkbox overlay */}
                    <div className="absolute top-4 left-4 z-10">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="h-5 w-5 rounded border-[#D1D5DB] text-[#4FA59C] focus:ring-[#4FA59C] bg-white shadow-sm"
                      />
                    </div>
                    {/* Product Image Header */}
                    {product.imageUrl && (
                      <div className="w-full h-48 overflow-hidden bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {!product.imageUrl && (
                      <div className="w-full h-48 bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] border-b border-[#E5E7EB] flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-[#D1D5DB]" />
                      </div>
                    )}

                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-[#1F2937] mb-1 truncate">{product.name}</h3>
                          <p className="text-sm text-[#6B7280] line-clamp-2">{product.description}</p>
                          {product.brandId && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200">
                                Custom product from {product.brandName || 'Brand'}
                              </span>
                            </div>
                          )}
                        </div>
                        {!product.isActive && (
                          <span className="px-3 py-1 bg-[#FEF3C7] text-[#92400E] text-xs font-medium rounded-full border border-[#FDE68A] whitespace-nowrap">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Pharmacy Coverages - Show if bundle has multiple medications */}
                        <div className="bg-[#F0F9FF] rounded-xl p-2.5 border border-[#BAE6FD]">
                          <p className="text-[10px] font-semibold text-[#0369A1] mb-1.5 uppercase tracking-wide">
                            {product.pharmacyCoverages && product.pharmacyCoverages.length > 1
                              ? `Bundle (${product.pharmacyCoverages.length} medications)`
                              : 'Single Medication'}
                          </p>

                          <div className="space-y-1">
                            {product.pharmacyCoverages && product.pharmacyCoverages.length > 0 ? (
                              product.pharmacyCoverages.map((coverage, idx) => (
                                <div key={coverage.id} className="text-xs">
                                  <p className="font-semibold text-[#0C4A6E] leading-tight">
                                    • {coverage.customName || coverage.pharmacyProduct?.pharmacyProductName || 'Product'}
                                  </p>
                                  {coverage.customSig && (
                                    <p className="text-[10px] text-[#64748B] leading-tight ml-2 truncate" title={coverage.customSig}>
                                      {coverage.customSig}
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <>
                                <div className="text-xs">
                                  <p className="font-semibold text-[#0C4A6E] leading-tight">
                                    • {product.name}
                                  </p>
                                  {product.placeholderSig && (
                                    <p className="text-[10px] text-[#64748B] leading-tight ml-2 truncate" title={product.placeholderSig}>
                                      {product.placeholderSig}
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {product.pharmacyCoverages && product.pharmacyCoverages.length <= 1 && <div className="h-[32px]"></div>}

                        <div className="space-y-1.5 relative z-10">
                          <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Medical Questions</label>
                          <select
                            value=""
                            onChange={(e) => handleAttachFormToProduct(product.id, e.target.value)}
                            disabled={attachingFormToProduct === product.id}
                            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] hover:border-[#4FA59C] transition-all focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ zIndex: 1000 }}
                          >
                            <option value="" disabled>
                              {attachingFormToProduct === product.id ? 'Attaching...' : 'Choose Template...'}
                            </option>
                            {availableForms.map((form) => (
                              <option key={form.id} value={form.id}>
                                {form.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
                            <p className="text-xs font-medium text-[#9CA3AF] mb-1">Medication Size</p>
                            <p className="text-sm font-semibold text-[#1F2937]">{product.medicationSize || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {product.isActive ? (
                          <>
                            <button
                              onClick={() => router.push(`/products/editor/${product.id}`)}
                              className="flex-1 rounded-full px-4 py-2.5 bg-[#4FA59C] text-white text-sm font-medium shadow-sm hover:bg-[#478F87] transition-all flex items-center justify-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              Manage
                            </button>
                            {activeTab === 'all' ? (
                              <button
                                onClick={() => handlePermanentDelete(product)}
                                className="rounded-full px-4 py-2.5 bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] transition-all"
                              >
                                Delete
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleActive(product)}
                                className="rounded-full px-4 py-2.5 border border-[#E5E7EB] text-[#EF4444] text-sm font-medium hover:bg-[#FEF2F2] transition-all"
                              >
                                Deactivate
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleActive(product)}
                              className="flex-1 rounded-full px-4 py-2.5 bg-[#4FA59C] text-white text-sm font-medium shadow-sm hover:bg-[#478F87] transition-all"
                            >
                              Configure
                            </button>
                            {activeTab === 'all' && (
                              <>
                                <button
                                  onClick={() => handleQuickActivate(product)}
                                  className="rounded-full px-4 py-2.5 bg-[#10B981] text-white text-sm font-medium hover:bg-[#059669] transition-all"
                                >
                                  Activate
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(product)}
                                  className="rounded-full px-4 py-2.5 bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] transition-all"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-[#E5E7EB]">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
                <h2 className="text-2xl font-semibold text-[#1F2937]">{editingProduct ? "Edit Product" : "Create Product"}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-full px-4 py-2 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all text-sm font-medium"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Product Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Semaglutide 2.5mg"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Categories</label>
                  <div className="space-y-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    {CATEGORY_OPTIONS.filter((cat) => cat.value).map((cat) => {
                      const checked = formData.categories.includes(cat.value)
                      return (
                        <label key={cat.value} className="flex items-center gap-3 text-sm text-[#1F2937]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(formData.categories)
                              if (e.target.checked) {
                                next.add(cat.value)
                              } else {
                                next.delete(cat.value)
                              }
                              setFormData({
                                ...formData,
                                categories: Array.from(next),
                              })
                            }}
                            className="h-4 w-4 rounded border-[#D1D5DB] text-[#4FA59C] focus:ring-[#4FA59C]"
                          />
                          <span>{cat.label}</span>
                        </label>
                      )
                    })}
                    {formData.categories.length === 0 && (
                      <p className="text-xs text-[#9CA3AF]">Select one or more categories if applicable.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-[#4B5563]">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed product description..."
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Placeholder Sig *</label>
                  <input
                    value={formData.placeholderSig}
                    onChange={(e) => setFormData({ ...formData, placeholderSig: e.target.value })}
                    placeholder="e.g., 2.5mg/0.5ml"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Medication Size</label>
                  <input
                    value={formData.medicationSize}
                    onChange={(e) => setFormData({ ...formData, medicationSize: e.target.value })}
                    placeholder="e.g., 10ml vial, 30 tablets"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Active Ingredients *</label>
                  <input
                    value={formData.activeIngredients.join(", ")}
                    onChange={(e) =>
                      setFormData({ ...formData, activeIngredients: e.target.value.split(",").map((s) => s.trim()) })
                    }
                    placeholder="Comma separated: Ingredient1, Ingredient2"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Pharmacy Vendor</label>
                  <select
                    value={formData.pharmacyProvider}
                    onChange={(e) => setFormData({ ...formData, pharmacyProvider: e.target.value })}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  >
                    <option value="">Select vendor...</option>
                    {pharmacyProviders.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Pharmacy Product ID</label>
                  <input
                    value={formData.pharmacyProductId}
                    onChange={(e) => setFormData({ ...formData, pharmacyProductId: e.target.value })}
                    placeholder="SKU or ID from pharmacy system"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#4B5563]">Pharmacy Wholesale Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  />
                  <p className="text-xs text-[#9CA3AF]">The wholesale price from the pharmacy</p>
                </div>

                <div className="flex items-center space-x-3 md:col-span-2 bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-[#E5E7EB] text-[#4FA59C] focus:ring-[#4FA59C] focus:ring-2 focus:ring-opacity-50"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-[#1F2937] cursor-pointer">
                    Product is active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-full px-6 py-2.5 border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="rounded-full px-6 py-2.5 bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium"
                >
                  {editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

