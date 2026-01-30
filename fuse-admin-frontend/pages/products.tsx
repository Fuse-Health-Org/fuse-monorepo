import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import Tutorial from '@/components/ui/tutorial'
import {
    Package,
    Plus,
    CheckCircle,
    XCircle,
    ChevronRight,
    Filter,
    X,
    Loader2,
    Check,
    Edit,
    Star
} from 'lucide-react'

interface Product {
    id: string
    name: string
    price: number
    pharmacyProductId?: string
    pharmacyWholesaleCost?: number
    placeholderSig?: string
    imageUrl?: string | null
    clinicId?: string
    active: boolean
    category?: string
    categories?: string[]
    createdAt: string
    updatedAt: string
    brandId?: string | null
    treatments?: Array<{
        id: string
        name: string
    }>
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

const PRODUCT_CATEGORIES = [
    { value: 'weight_loss', label: 'Weight Loss' },
    { value: 'hair_growth', label: 'Hair Growth' },
    { value: 'performance', label: 'Performance' },
    { value: 'sexual_health', label: 'Sexual Health' },
    { value: 'skincare', label: 'Skincare' },
    { value: 'wellness', label: 'Wellness' },
    { value: 'other', label: 'Other' },
]

interface SubscriptionInfo {
    id: string
    status: string
    plan?: { name: string; price: number; type: string; maxProducts?: number }
    nextBillingDate?: string | null
    lastProductChangeAt?: string | null
    productsChangedAmountOnCurrentCycle?: number
    customFeatures?: {
        canAddCustomProducts?: boolean
    } | null
    tierConfig?: {
        canAddCustomProducts?: boolean
    } | null
}

export default function Products() {
    const [products, setProducts] = useState<Product[]>([])
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [activeTab, setActiveTab] = useState<'my' | 'select' | 'favorites'>(() => {
        const tab = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null)
        if (tab === 'select') return 'select'
        if (tab === 'favorites') return 'favorites'
        return 'my'
    })
    const [, setAssignments] = useState<Array<{ productId: string; questionnaireId: string }>>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [quickEditMode, setQuickEditMode] = useState(false)
    const [editingPrices, setEditingPrices] = useState<Map<string, string>>(new Map())
    const [savingPrices, setSavingPrices] = useState(false)
    const [showSaved, setShowSaved] = useState(false)
    const { user, token } = useAuth()
    const router = useRouter()

    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
    const [tenantProductCount, setTenantProductCount] = useState<number>(0)
    const [enabledProductIds, setEnabledProductIds] = useState<Set<string>>(new Set())
    const [tenantProducts, setTenantProducts] = useState<Array<{ id: string; productId: string; price: number }>>([])
    const [, setClinicName] = useState<string>("")
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [retryLoading, setRetryLoading] = useState<boolean>(false)
    const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set())

    // Fetch favorites from API on mount
    const fetchFavorites = useCallback(async () => {
        if (!token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/favorites/ids`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success && Array.isArray(data.data)) {
                    setFavoriteProductIds(new Set(data.data))
                    // Also update localStorage for quick access
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('productFavorites', JSON.stringify(data.data))
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch favorites from API:', e)
            // Fallback to localStorage
            if (typeof window !== 'undefined') {
                const storedFavorites = localStorage.getItem('productFavorites')
                if (storedFavorites) {
                    try {
                        const parsed = JSON.parse(storedFavorites)
                        if (Array.isArray(parsed)) {
                            setFavoriteProductIds(new Set(parsed))
                        }
                    } catch (parseError) {
                        console.error('Failed to parse favorites from localStorage:', parseError)
                    }
                }
            }
        }
    }, [token])

    // Load favorites on mount
    useEffect(() => {
        fetchFavorites()
    }, [fetchFavorites])

    // Toggle favorite and sync with API
    const toggleFavorite = async (productId: string) => {
        // Optimistic update
        setFavoriteProductIds(prev => {
            const newFavorites = new Set(prev)
            if (newFavorites.has(productId)) {
                newFavorites.delete(productId)
            } else {
                newFavorites.add(productId)
            }
            // Update localStorage immediately for fast UI
            if (typeof window !== 'undefined') {
                localStorage.setItem('productFavorites', JSON.stringify(Array.from(newFavorites)))
            }
            return newFavorites
        })

        // Sync with API
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/favorites/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productId })
            })

            if (!res.ok) {
                console.error('Failed to sync favorite with API')
                // Revert on failure
                setFavoriteProductIds(prev => {
                    const reverted = new Set(prev)
                    if (reverted.has(productId)) {
                        reverted.delete(productId)
                    } else {
                        reverted.add(productId)
                    }
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('productFavorites', JSON.stringify(Array.from(reverted)))
                    }
                    return reverted
                })
            }
        } catch (e) {
            console.error('Error syncing favorite with API:', e)
        }
    }

    // Cast user to include clinicId property
    const userWithClinic = user as any

    const fetchProducts = useCallback(async () => {
        console.log('🔍 🔄 STARTING PRODUCTS FETCH PROCESS (ALL PRODUCTS)')
        console.log('🔍 User data:', user)
        console.log('🔍 Token present:', !!token)

        setLoading(true)
        setError(null)

        if (!token) {
            console.log('❌ No token available, skipping fetch')
            setError('No authentication token found')
            setLoading(false)
            return
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const controller = new AbortController()
            const timeoutId = setTimeout(() => {
                console.log('⏰ Request timed out after 30 seconds')
                controller.abort()
            }, 30000)

            // Fetch ALL products with pagination from products-management
            const baseParams = new URLSearchParams()
            baseParams.append('page', '1')
            baseParams.append('limit', '100')
            // Show active products by default
            baseParams.append('isActive', 'true')

            console.log('🔍 Fetching first page of products-management...')
            const firstRes = await fetch(`${baseUrl}/products-management?${baseParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            })
            const firstJson = await firstRes.json().catch(() => null)
            if (!firstRes.ok || !firstJson) {
                clearTimeout(timeoutId)
                throw new Error(firstJson?.message || 'Failed to load products')
            }

            const firstPageProducts: Product[] = firstJson?.data?.products || []
            const totalPages: number = firstJson?.data?.pagination?.totalPages || 1

            let combined = [...firstPageProducts]
            if (totalPages > 1) {
                const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
                console.log('🔍 Fetching remaining pages:', pageNumbers)
                const pageRequests = pageNumbers.map((page) => {
                    const params = new URLSearchParams(baseParams.toString())
                    params.set('page', String(page))
                    return fetch(`${baseUrl}/products-management?${params.toString()}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).then(r => r.json()).catch(() => null)
                })
                const pages = await Promise.all(pageRequests)
                const rest: Product[] = pages.flatMap(p => (p?.data?.products || []))
                combined = [...combined, ...rest]
            }

            clearTimeout(timeoutId)
            console.log('✅ Loaded products (combined):', combined.length)

            // Fetch pharmacy coverages for each product
            const productsWithCoverages = await Promise.all(
                combined.map(async (product) => {
                    try {
                        const coverageRes = await fetch(`${baseUrl}/public/products/${product.id}/pharmacy-coverages`)
                        if (coverageRes.ok) {
                            const coverageData = await coverageRes.json()
                            const coverages = coverageData.data || []
                            return {
                                ...product,
                                pharmacyCoverages: coverages
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Error fetching coverages for product ${product.id}:`, error)
                    }
                    return product
                })
            )

            setAllProducts(productsWithCoverages)
        } catch (err: any) {
            console.error('❌ Failed to load products:', err)
            setError(err?.message || 'Failed to load products')
        } finally {
            setLoading(false)
        }
    }, [token])

    const fetchAssignments = useCallback(async () => {
        try {
            if (!token) return
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/questionnaires/templates/assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) return
            const data = await res.json().catch(() => null)
            const rows = Array.isArray(data?.data) ? data.data : []
            setAssignments(rows)
        } catch (e) {
            console.warn('Failed to load assignments', e)
        }
    }, [token])

    const fetchSubscription = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/subscriptions/current`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) return
            const data = await res.json().catch(() => null)
            console.log('📦 [Products] Fetched subscription:', data)
            console.log('📊 [Products] Subscription details:', {
                productsChangedAmount: data?.productsChangedAmountOnCurrentCycle,
                retriedSelection: data?.retriedProductSelectionForCurrentCycle,
                maxProducts: data?.plan?.maxProducts
            })
            setSubscription(data || null)
        } catch { }
    }, [token])

    const fetchTenantProductCount = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tenant-products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) return
            const data = await res.json().catch(() => null)
            const rows = Array.isArray(data?.data) ? data.data : []
            setTenantProductCount(rows.length)
            setEnabledProductIds(new Set(rows.map((r: any) => r.productId).filter(Boolean)))
            setTenantProducts(rows.map((r: any) => ({ id: r.id, productId: r.productId, price: r.price || 0 })))
        } catch { }
    }, [token])

    const fetchClinicName = useCallback(async () => {
        if (!token || !userWithClinic?.clinicId) return
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/clinic/${userWithClinic.clinicId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) return
            const data = await res.json().catch(() => null)
            const name = data?.data?.name
            if (typeof name === 'string') setClinicName(name)
        } catch { }
    }, [token, userWithClinic?.clinicId])

    useEffect(() => {
        console.log('🔍 Products useEffect running')
        fetchProducts()
    }, [fetchProducts])

    useEffect(() => {
        // After products are loaded, fetch assignments and build My Products
        fetchAssignments()
        fetchSubscription()
        fetchTenantProductCount()
        fetchClinicName()
    }, [fetchAssignments, allProducts, fetchSubscription, fetchTenantProductCount, fetchClinicName])

    // Build My Products from TenantProduct mappings (enabledProductIds)
    useEffect(() => {
        const my = allProducts.filter(p => enabledProductIds.has(p.id))
        setProducts(my)
    }, [allProducts, enabledProductIds])

    // React to query param changes to set the tab (e.g., after enabling redirect)
    useEffect(() => {
        const tab = router.query.tab
        if (tab === 'select' || tab === 'my' || tab === 'favorites') {
            setActiveTab(tab as 'my' | 'select' | 'favorites')
        }
    }, [router.query.tab])

    // When switching to Select tab, refresh enabled set and counts
    useEffect(() => {
        if (activeTab === 'select') {
            fetchTenantProductCount()
        }
    }, [activeTab, fetchTenantProductCount])


    const handleCreateProduct = async () => {
        if (!token) return

        const skeletonProduct = {
            name: "New Product",
            description: "Edit product details below",
            price: 1, // Minimum positive price
            placeholderSig: "TBD",
            activeIngredients: ["TBD"], // At least one required
            active: false, // Start as inactive
        }

        console.log('🔄 Creating skeleton product:', skeletonProduct)

        try {
            // Create a skeleton product with minimum required fields
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/products-management`, {
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

                setError(`Error: ${errorMessage}`)
                return
            }

            console.log('✅ Product created successfully:', data.data.id)
            // Navigate to the custom product editor
            router.push(`/custom-products/${data.data.id}`)
        } catch (error: any) {
            console.error("❌ Exception creating product:", error)
            setError(`Error: ${error.message || "Failed to create product"}`)
        }
    }

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
            return
        }

        try {
            setLoading(true)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/products-management/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.message || 'Failed to delete product')
                return
            }

            // Remove product from local state
            setAllProducts(prev => prev.filter(p => p.id !== productId))
            setProducts(prev => prev.filter(p => p.id !== productId))

            setError('✅ Product deleted successfully!')
            setTimeout(() => setError(null), 3000)
        } catch (error: any) {
            console.error('Error deleting product:', error)
            setError(error.message || 'Failed to delete product')
        } finally {
            setLoading(false)
        }
    }

    const handleImportFromIronSail = async () => {
        if (!confirm('This will import all products from the IronSail spreadsheet. Products with the same name will be skipped. Continue?')) {
            return
        }

        try {
            setLoading(true)
            setError('📥 Importing products from IronSail spreadsheet...')

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/pharmacies/ironsail/import-products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (!response.ok) {
                setError(`❌ ${data.message || 'Failed to import products'}`)
                return
            }

            // Show success message with summary
            const imported = data.data?.imported?.length || 0
            const skipped = data.data?.skipped?.length || 0
            const errors = data.data?.errors?.length || 0
            setError(`✅ Import completed! Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`)

            // Refresh products list
            await fetchProducts()

            setTimeout(() => setError(null), 5000)
        } catch (error: any) {
            console.error('Error importing products:', error)
            setError(`❌ ${error.message || 'Failed to import products'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAllFromIronSail = async () => {
        if (!confirm('⚠️ WARNING: This will permanently delete ALL auto-imported products from IronSail (products with [Auto-Imported] prefix). This action CANNOT be undone. Continue?')) {
            return
        }

        try {
            setLoading(true)
            setError('🗑️ Deleting all auto-imported products...')

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/pharmacies/ironsail/delete-all-imported`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (!response.ok) {
                setError(`❌ ${data.message || 'Failed to delete products'}`)
                return
            }

            // Show success message
            const deletedCount = data.data.deleted
            const coverageCount = data.data.deletedCoverage
            setError(`✅ Deleted ${deletedCount} products and ${coverageCount} pharmacy coverage records`)

            // Refresh products list
            await fetchProducts()

            setTimeout(() => setError(null), 5000)
        } catch (error: any) {
            console.error('Error deleting products:', error)
            setError(`❌ ${error.message || 'Failed to delete products'}`)
        } finally {
            setLoading(false)
        }
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price)
    }

    const getCategoryBadgeColors = (category?: string) => {
        switch (category) {
            case 'weight_loss':
                return 'bg-orange-500/15 text-orange-300 border-orange-500/40'
            case 'hair_growth':
                return 'bg-purple-500/15 text-purple-300 border-purple-500/40'
            case 'performance':
                return 'bg-blue-500/15 text-blue-300 border-blue-500/40'
            case 'sexual_health':
                return 'bg-pink-500/15 text-pink-300 border-pink-500/40'
            case 'skincare':
                return 'bg-teal-500/15 text-teal-300 border-teal-500/40'
            case 'wellness':
                return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            case 'other':
                return 'bg-muted text-muted-foreground border-border'
            default:
                return 'bg-muted text-muted-foreground border-border'
        }
    }

    const handleDisableProduct = async (productId: string, productName: string) => {
        if (!confirm(`Disable "${productName}"? You can re-enable it anytime from Select Products.`)) {
            return
        }

        try {
            // Find the tenant product ID for this product
            const tenantProduct = tenantProducts.find(tp => tp.productId === productId)

            if (!tenantProduct) {
                setError('Product not found in My Products')
                return
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tenant-products/${tenantProduct.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    console.log('✅ Product disabled successfully')
                    // Refresh the tenant products list
                    fetchTenantProductCount()
                } else {
                    setError(data.message || 'Failed to disable product')
                }
            } else {
                await response.text()
                setError(`Failed to disable product: ${response.status} ${response.statusText}`)
            }
        } catch (err) {
            console.error('Error disabling product:', err)
            setError('Failed to disable product')
        }
    }

    const handleEnableProduct = async (productId: string) => {
        try {
            // Check subscription limits
            const max = subscription?.plan?.maxProducts
            const isUnlimited = max === -1 || max === undefined
            const used = subscription?.productsChangedAmountOnCurrentCycle ?? tenantProductCount

            if (!isUnlimited && used >= (max as number)) {
                setError(`Product limit reached (${max}). Please upgrade your plan to enable more products.`)
                return
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tenant-products/update-selection`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    products: [{ productId }]
                })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    console.log('✅ Product enabled successfully')
                    // Refresh counters immediately
                    await Promise.all([
                        fetchSubscription(),
                        fetchTenantProductCount()
                    ])
                } else {
                    setError(data.message || 'Failed to enable product')
                }
            } else {
                await response.text()
                setError(`Failed to enable product: ${response.status} ${response.statusText}`)
            }
        } catch (err) {
            console.error('Error enabling product:', err)
            setError('Failed to enable product')
        }
    }

    const handleQuickEditSave = async () => {
        if (editingPrices.size === 0) {
            setQuickEditMode(false)
            return
        }

        try {
            setSavingPrices(true)
            setError(null)

            let successCount = 0
            let failCount = 0

            // Update each product price
            for (const [productId, priceStr] of Array.from(editingPrices.entries())) {
                const tenantProduct = tenantProducts.find(tp => tp.productId === productId)

                if (!tenantProduct) {
                    console.error('No tenant product found for:', productId)
                    failCount++
                    continue
                }

                const price = parseFloat(priceStr)
                if (isNaN(price) || price <= 0) {
                    console.error('Invalid price for product:', productId, priceStr)
                    failCount++
                    continue
                }

                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tenant-products/update`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            tenantProductId: tenantProduct.id,
                            price
                        })
                    })

                    if (response.ok) {
                        const data = await response.json()
                        if (data.success) {
                            successCount++
                        } else {
                            console.error('API returned success=false for:', productId, data.message)
                            failCount++
                        }
                    } else {
                        const errorData = await response.json().catch(() => ({}))
                        console.error('Failed to update price for:', productId, response.status, errorData)
                        failCount++
                    }
                } catch (err) {
                    console.error('Error updating price for:', productId, err)
                    failCount++
                }
            }

            // Refresh tenant products to get updated prices
            await fetchTenantProductCount()

            if (successCount > 0) {
                // Show success state
                setShowSaved(true)
                setEditingPrices(new Map())

                // After 2 seconds, exit edit mode
                setTimeout(() => {
                    setQuickEditMode(false)
                    setShowSaved(false)
                }, 2000)
            } else if (failCount > 0) {
                setError(`Failed to update prices. Please try again or check individual products.`)
                setQuickEditMode(false)
                setEditingPrices(new Map())
            }
        } catch (err) {
            console.error('Quick edit save error:', err)
            setError('Failed to update prices')
            setQuickEditMode(false)
            setEditingPrices(new Map())
        } finally {
            setSavingPrices(false)
        }
    }

    const handleQuickEditCancel = () => {
        setQuickEditMode(false)
        setEditingPrices(new Map())
        setShowSaved(false)
    }

    const visibleProducts = activeTab === 'my'
        ? products
        : activeTab === 'favorites'
            ? allProducts.filter(p => favoriteProductIds.has(p.id))
            : allProducts

    // Apply category filter (case-insensitive)
    const filteredProducts = selectedCategory
        ? visibleProducts.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase())
        : visibleProducts

    // For Select tab, sort enabled products first
    const displayedProducts = activeTab === 'select'
        ? [...filteredProducts].sort((a, b) => {
            const aEnabled = enabledProductIds.has(a.id)
            const bEnabled = enabledProductIds.has(b.id)
            if (aEnabled === bEnabled) return a.name.localeCompare(b.name)
            return aEnabled ? -1 : 1
        })
        : filteredProducts

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading products...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <Head>
                <title>Products - Fuse Admin</title>
                <meta name="description" content="Manage your clinic products" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
            </Head>
            <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-2xl font-semibold mb-1">Products</h1>
                            <p className="text-sm text-muted-foreground">Enable or disable products for your clinic</p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 text-sm font-medium"
                                onClick={() => {
                                    console.log('🔍 Manual trigger of fetchProducts')
                                    fetchProducts()
                                }}
                            >
                                <Package className="h-4 w-4 mr-1.5" />
                                Refresh
                            </Button>
                            {/* Hidden: Import from IronSail and Delete All from IronSail buttons */}
                            {/* <Button
                                size="sm"
                                className="h-9 px-3 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleImportFromIronSail}
                                disabled={loading}
                            >
                                <Package className="h-4 w-4 mr-1.5" />
                                Import from IronSail
                            </Button>
                            <Button
                                size="sm"
                                className="h-9 px-3 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleDeleteAllFromIronSail}
                                disabled={loading}
                            >
                                <X className="h-4 w-4 mr-1.5" />
                                Delete All from IronSail
                            </Button> */}
                            {/* COMMENTED OUT: Add Product button
                            {(() => {
                                // Check tier configuration first, then custom features, then default to false
                                const tierConfigAllows = subscription?.tierConfig?.canAddCustomProducts === true
                                const hasCustomFeature = subscription?.customFeatures?.canAddCustomProducts === true
                                const canAddProducts = tierConfigAllows || hasCustomFeature
                                const isDisabled = !canAddProducts

                                return (
                                    <div className="relative group">
                                        <Button
                                            size="sm"
                                            className="h-9 px-3 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={handleCreateProduct}
                                            disabled={isDisabled}
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" />
                                            Add Product
                                        </Button>
                                        {isDisabled && (
                                            <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 z-10">
                                                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                                                    <p className="font-semibold mb-1">Feature Not Available</p>
                                                    <p>Creating custom products is not available on your current plan. Contact support or <a href="/plans" className="underline hover:text-indigo-300">upgrade now</a></p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                            */}
                        </div>
                    </div>

                    {/* COMMENTED OUT: Custom Products Feature Notice
                    {(() => {
                        // Check tier configuration first, then custom features
                        const tierConfigAllows = subscription?.tierConfig?.canAddCustomProducts === true
                        const hasCustomFeature = subscription?.customFeatures?.canAddCustomProducts === true
                        const canAddProducts = tierConfigAllows || hasCustomFeature

                        if (!canAddProducts) {
                            return (
                                <div className="mb-6 px-5 py-4 rounded-lg border-2 border-amber-200 bg-amber-50">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                            <Package className="h-5 w-5 text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-semibold text-amber-900 mb-1">
                                                Unlock Custom Products
                                            </h3>
                                            <p className="text-sm text-amber-800 mb-3">
                                                Creating custom products is not available on your current plan. Contact support or upgrade to add your own products to the catalog.
                                            </p>
                                            <a
                                                href="/plans"
                                                className="inline-flex items-center text-sm font-medium text-amber-900 hover:text-amber-700 underline"
                                            >
                                                View Plans & Upgrade
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        return null
                    })()}
                    */}

                    {/* Subscription/product limit summary - Compact */}
                    <div className="mb-6 px-4 py-3 rounded-lg border border-border bg-card">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Product Slots:</span>
                                <span className="font-medium">
                                    {subscription?.productsChangedAmountOnCurrentCycle ?? 0} / {subscription?.plan?.maxProducts === -1 || subscription?.plan?.maxProducts === undefined ? 'Unlimited' : subscription?.plan?.maxProducts}
                                </span>
                            </div>
                            {(() => {
                                const max = subscription?.plan?.maxProducts
                                const isUnlimited = max === -1 || max === undefined
                                const used = subscription?.productsChangedAmountOnCurrentCycle ?? 0
                                const reached = !isUnlimited && used >= (max as number)
                                if (!reached) return null
                                const canRetry = subscription && (subscription as any).retriedProductSelectionForCurrentCycle === false
                                const nextBilling = subscription?.nextBillingDate
                                const tooltipEnabled = `Clear all enabled products and reset your product choices for this billing cycle.${nextBilling ? ` Next cycle begins ${new Date(nextBilling).toLocaleString()}.` : ''}`
                                const tooltipDisabled = `You can only retry once per billing cycle.${nextBilling ? ` Next cycle begins ${new Date(nextBilling).toLocaleString()}.` : ''}`
                                return (
                                    <div className="flex items-center gap-3">
                                        <button
                                            className={`${canRetry ? 'border py-0 px-2 rounded-sm border-amber-700 text-amber-700 hover:underline' : 'border-0 text-gray-400 cursor-not-allowed'} text-sm font-medium p-0 m-0 bg-transparent`}
                                            title={canRetry ? tooltipEnabled : tooltipDisabled}
                                            disabled={!canRetry || retryLoading}
                                            onClick={async () => {
                                                if (!canRetry || retryLoading) return
                                                if (!confirm('Retry product selection? This will clear all your current selections for this cycle.')) return
                                                try {
                                                    setRetryLoading(true)
                                                    setError(null)
                                                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tenant-products/retry-selection`, {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    })
                                                    const json = await res.json().catch(() => ({}))
                                                    if (!res.ok || !json?.success) {
                                                        setError(json?.message || 'Failed to retry selection')
                                                    } else {
                                                        await Promise.all([fetchSubscription(), fetchTenantProductCount()])
                                                    }
                                                } catch (e) {
                                                    setError('Failed to retry selection')
                                                } finally {
                                                    setRetryLoading(false)
                                                }
                                            }}
                                        >
                                            {retryLoading ? 'Retrying…' : 'Retry selection'}
                                        </button>
                                        <div className="text-sm text-amber-700">
                                            Limit reached. <a href="/plans" className="underline">Upgrade plan</a>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mb-6 border-b border-border">
                        <div className="flex gap-8">
                            <button
                                id="my-products-btn"
                                className={`pb-3 border-b-2 transition-colors text-sm font-medium ${activeTab === 'my' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                onClick={() => {
                                    // Switch to My Products tab
                                    setActiveTab('my');

                                    // If tutorial is running on step 6 (My Products tab), advance the tutorial
                                    const tutorialAdvance = (window as any).__tutorialAdvance;
                                    const tutorialStep = (window as any).__tutorialCurrentStep;
                                    if (tutorialAdvance && tutorialStep === 6) {
                                        console.log('📍 Tutorial active on My Products tab - advancing');
                                        setTimeout(() => {
                                            tutorialAdvance();
                                        }, 200);
                                    }
                                }}
                            >
                                My Products
                            </button>
                            <button
                                id="select-products-btn"
                                className={`pb-3 border-b-2 transition-colors text-sm font-medium ${activeTab === 'select' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                onClick={() => {
                                    // Switch to Select Products tab
                                    setActiveTab('select');

                                    // If tutorial is running on step 3 (Select Products tab), advance the tutorial
                                    const tutorialAdvance = (window as any).__tutorialAdvance;
                                    const tutorialStep = (window as any).__tutorialCurrentStep;
                                    if (tutorialAdvance && tutorialStep === 3) {
                                        console.log('📍 Tutorial active on Select Products tab - advancing');
                                        setTimeout(() => {
                                            tutorialAdvance();
                                        }, 200);
                                    }
                                }}
                            >
                                Select Products
                            </button>
                            <button
                                id="favorites-btn"
                                className={`pb-3 border-b-2 transition-colors text-sm font-medium flex items-center gap-1.5 ${activeTab === 'favorites' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setActiveTab('favorites')}
                            >
                                <Star className={`h-3.5 w-3.5 ${activeTab === 'favorites' ? 'fill-primary' : ''}`} />
                                Favorites
                                {favoriteProductIds.size > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-muted">
                                        {favoriteProductIds.size}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Category Filters */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Filter className="h-4 w-4" />
                                <span className="font-medium">Filter:</span>
                            </div>
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === null
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                All
                            </button>
                            {PRODUCT_CATEGORIES.map((category) => (
                                <button
                                    key={category.value}
                                    onClick={() => setSelectedCategory(category.value)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    {category.label}
                                </button>
                            ))}
                            {selectedCategory && (
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className="ml-2 p-1.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                    title="Clear filter"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Error Message - Only show actual errors, not success messages */}
                    {error && !error.includes('✅') && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                            <div className="flex">
                                <XCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm text-destructive">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Edit Mode Controls - Only show on My Products tab */}
                    {activeTab === 'my' && displayedProducts.length > 0 && (
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                {quickEditMode ? (
                                    <span className="font-medium">Quick edit mode active - Update prices below</span>
                                ) : (
                                    <span>Quickly update customer pricing for all products</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {quickEditMode ? (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleQuickEditCancel}
                                            disabled={savingPrices || showSaved}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleQuickEditSave}
                                            disabled={savingPrices || showSaved || editingPrices.size === 0}
                                        >
                                            {savingPrices ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : showSaved ? (
                                                <>
                                                    <Check className="h-3 w-3 mr-1.5" />
                                                    Saved
                                                </>
                                            ) : (
                                                `Save ${editingPrices.size} Change${editingPrices.size !== 1 ? 's' : ''}`
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setQuickEditMode(true)}
                                    >
                                        <Package className="h-4 w-4 mr-1.5" />
                                        Quick Edit Pricing
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    {displayedProducts.length > 0 ? (
                        <>
                            <div className="bg-card rounded-lg border border-border overflow-hidden product-card">
                                {displayedProducts.map((product, index) => {
                                    const isEnabled = enabledProductIds.has(product.id)
                                    const categoryValues = Array.isArray(product.categories) && product.categories.length > 0
                                        ? product.categories
                                        : product.category
                                            ? [product.category]
                                            : []
                                    const primaryCategory = categoryValues[0]
                                    const primaryLabel = primaryCategory
                                        ? PRODUCT_CATEGORIES.find(c => c.value === primaryCategory)?.label || primaryCategory
                                        : 'General'
                                    const additionalCount = Math.max(categoryValues.length - 1, 0)
                                    const badgeLabel = additionalCount > 0 ? `${primaryLabel} +${additionalCount}` : primaryLabel
                                    return (
                                        <div
                                            key={product.id}
                                            id={index === 0 ? 'first-product-item' : undefined}
                                            className={`flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors ${quickEditMode ? 'cursor-default' : 'cursor-pointer'} ${index !== 0 ? 'border-t border-border' : ''}`}
                                            onClick={() => !quickEditMode && router.push(product.brandId ? `/custom-products/${product.id}` : `/products/${product.id}`)}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {/* Favorite Star */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(product.id);
                                                    }}
                                                    className="flex-shrink-0 p-1 rounded-full hover:bg-accent transition-colors"
                                                    title={favoriteProductIds.has(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <Star
                                                        className={`h-4 w-4 transition-colors ${favoriteProductIds.has(product.id)
                                                            ? 'fill-amber-400 text-amber-400'
                                                            : 'text-muted-foreground hover:text-amber-400'
                                                            }`}
                                                    />
                                                </button>

                                                {/* Avatar/Image */}
                                                <div className="flex-shrink-0">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                const parent = target.parentElement;
                                                                if (parent && !parent.querySelector('.fallback-icon')) {
                                                                    const icon = document.createElement('div');
                                                                    icon.className = 'w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center fallback-icon';
                                                                    icon.innerHTML = '<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
                                                                    parent.appendChild(icon);
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                                            <Package className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name & Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h3 className="text-sm font-medium text-foreground truncate">{product.name}</h3>
                                                        {product.brandId && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                Custom Product
                                                            </span>
                                                        )}
                                                    </div>
                                                    {product.pharmacyCoverages && product.pharmacyCoverages.length > 0 ? (
                                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                                            {product.pharmacyCoverages.map((coverage, idx) => (
                                                                <div key={coverage.id} className="truncate">
                                                                    <span className="font-medium text-foreground">{coverage.customName || coverage.pharmacyProduct?.pharmacyProductName || 'Product'}</span>
                                                                    {coverage.customSig && <span className="text-muted-foreground"> - {coverage.customSig}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {product.placeholderSig || 'No Placeholder Sig specified'}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Category Badge */}
                                                <div className="flex-shrink-0 w-32">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryBadgeColors(primaryCategory)}`}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>

                                                {/* Pharmacy Wholesale Price */}
                                                <div className="flex-shrink-0 w-28">
                                                    <div className="text-xs text-muted-foreground mb-0.5">Pharmacy</div>
                                                    <span className="text-sm font-medium">{formatPrice(product.pharmacyWholesaleCost ?? product.price)}</span>
                                                </div>

                                                {/* Clinic Retail Price */}
                                                <div className="flex-shrink-0 w-28" onClick={(e) => quickEditMode && e.stopPropagation()}>
                                                    <div className="text-xs text-muted-foreground mb-0.5">Non-Medical Service Fee</div>
                                                    {(() => {
                                                        const tenantProduct = tenantProducts.find(tp => tp.productId === product.id)

                                                        if (quickEditMode && isEnabled) {
                                                            const currentValue = editingPrices.get(product.id) ?? (tenantProduct?.price || '')
                                                            return (
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={currentValue}
                                                                        onChange={(e) => {
                                                                            const newPrices = new Map(editingPrices)
                                                                            newPrices.set(product.id, e.target.value)
                                                                            setEditingPrices(newPrices)
                                                                        }}
                                                                        placeholder="0.00"
                                                                        className="w-24 pl-5 pr-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                                    />
                                                                </div>
                                                            )
                                                        }

                                                        return tenantProduct && tenantProduct.price > 0 ? (
                                                            <span className="text-sm font-medium">{formatPrice(tenantProduct.price)}</span>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">Not set</span>
                                                        )
                                                    })()}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex-shrink-0 flex items-center gap-2 group">
                                                    {isEnabled ? (
                                                        // Product is enabled - Show Enabled badge, changes to Remove text on hover
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDisableProduct(product.id, product.name);
                                                            }}
                                                            className="relative transition-all duration-300 ease-in-out"
                                                            title="Click to disable"
                                                        >
                                                            {/* Enabled badge (default state) */}
                                                            <div className="group-hover:opacity-0 transition-all duration-300 ease-in-out">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                                    Enabled
                                                                </span>
                                                            </div>
                                                            {/* Remove text (hover state) */}
                                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 ease-in-out">
                                                                <span className="text-sm font-medium text-red-600 whitespace-nowrap">Remove</span>
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        // Product is not enabled - Show Activate button
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();

                                                                // Activate the product
                                                                handleEnableProduct(product.id);

                                                                // If tutorial is running on step 4 or 5, jump to step 6 (My Products)
                                                                // This skips the orphaned "Activate" button step since we just activated the product
                                                                const tutorialJumpToStep = (window as any).__tutorialJumpToStep;
                                                                const tutorialStep = (window as any).__tutorialCurrentStep;
                                                                if (tutorialJumpToStep && (tutorialStep === 4 || tutorialStep === 5)) {
                                                                    console.log('📍 Tutorial active - jumping to My Products tab step');
                                                                    setTimeout(() => {
                                                                        tutorialJumpToStep(6); // Jump to "My Products" step
                                                                    }, 300);
                                                                }
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 text-white enable-product-btn"
                                                        >
                                                            Activate
                                                        </Button>
                                                    )}

                                                    {/* Edit and Delete buttons for custom products created by current user */}
                                                    {product.brandId && product.brandId === userWithClinic?.id && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/custom-products/${product.id}`);
                                                                }}
                                                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300"
                                                            >
                                                                <Edit className="h-3 w-3 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteProduct(product.id, product.name);
                                                                }}
                                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                                            >
                                                                Delete
                                                            </Button>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        className="p-2 transition-all duration-300 ease-in-out group-hover:translate-x-4"
                                                    >
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Add More Products Button - Only show on My Products tab */}
                            {activeTab === 'my' && (
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        className="w-full h-12 text-sm font-medium border-2 border-dashed border-border hover:border-primary/60"
                                        onClick={() => setActiveTab('select')}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add more products
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-card rounded-lg border border-border p-16 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                    {activeTab === 'favorites' ? (
                                        <Star className="h-6 w-6 text-muted-foreground" />
                                    ) : (
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-base font-medium mb-1">
                                        {activeTab === 'favorites' ? 'No favorites yet' : 'No products found'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {activeTab === 'my'
                                            ? 'Enable products from the "Select Products" tab to get started.'
                                            : activeTab === 'favorites'
                                                ? 'Click the star icon on any product to add it to your favorites.'
                                                : 'No products available. Contact your administrator.'}
                                    </p>
                                    {activeTab === 'my' && (
                                        <Button
                                            size="sm"
                                            className="h-9 px-4 text-sm font-medium"
                                            onClick={() => setActiveTab('select')}
                                        >
                                            <Package className="h-4 w-4 mr-1.5" />
                                            Browse Products
                                        </Button>
                                    )}
                                    {activeTab === 'favorites' && (
                                        <Button
                                            size="sm"
                                            className="h-9 px-4 text-sm font-medium"
                                            onClick={() => setActiveTab('select')}
                                        >
                                            <Package className="h-4 w-4 mr-1.5" />
                                            Browse Products
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}