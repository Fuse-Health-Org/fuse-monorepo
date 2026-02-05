import { useState, useEffect } from "react"
import { X, Search, Package, Check, ToggleLeft, ToggleRight } from "lucide-react"

interface Product {
    id: string
    name: string
    description?: string | null
    category?: string | null
    imageUrl?: string | null
    isActive?: boolean
    mdOfferingId?: string | null
    belugaProductId?: string | null
}

type ProductOfferType = 'single_choice' | 'multiple_choice'

interface ProductAssignmentModalProps {
    isOpen: boolean
    onClose: () => void
    formTitle: string
    formId: string
    products: Product[]
    assignedProductIds: string[]
    initialProductOfferType?: ProductOfferType
    medicalCompanySource?: 'fuse' | 'md-integrations' | 'beluga'
    onSave: (productIds: string[], productOfferType: ProductOfferType) => Promise<void>
}

export function ProductAssignmentModal({
    isOpen,
    onClose,
    formTitle,
    formId,
    products,
    assignedProductIds,
    initialProductOfferType = 'single_choice',
    medicalCompanySource = 'md-integrations',
    onSave,
}: ProductAssignmentModalProps) {
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set(assignedProductIds))
    const [searchQuery, setSearchQuery] = useState("")
    const [saving, setSaving] = useState(false)
    const [productOfferType, setProductOfferType] = useState<ProductOfferType>(initialProductOfferType)

    useEffect(() => {
        setSelectedProductIds(new Set(assignedProductIds))
        setProductOfferType(initialProductOfferType)
    }, [assignedProductIds, initialProductOfferType, isOpen])

    // Auto-set to single_choice when less than 2 products selected
    useEffect(() => {
        if (selectedProductIds.size < 2) {
            setProductOfferType('single_choice')
        }
    }, [selectedProductIds.size])

    const toggleProduct = (productId: string) => {
        const newSet = new Set(selectedProductIds)
        if (newSet.has(productId)) {
            newSet.delete(productId)
        } else {
            newSet.add(productId)
        }
        setSelectedProductIds(newSet)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Force single_choice if less than 2 products
            const effectiveOfferType = selectedProductIds.size < 2 ? 'single_choice' : productOfferType
            await onSave(Array.from(selectedProductIds), effectiveOfferType)
            onClose()
        } catch (error: any) {
            alert(error.message || "Failed to assign products")
        } finally {
            setSaving(false)
        }
    }

    const canEnableMultipleChoice = selectedProductIds.size >= 2

    const filteredProducts = products
        .filter((product) => {
            // Only show inactive products if they are already selected
            const isInactive = product.isActive === false
            const isSelected = selectedProductIds.has(product.id)
            if (isInactive && !isSelected) return false
            
            // Filter by medical company source - only show products with the corresponding ID
            if (medicalCompanySource === 'md-integrations' && !product.mdOfferingId) {
                // For MDI, only show products that have an MDI offering linked
                return false
            }
            if (medicalCompanySource === 'beluga' && !product.belugaProductId) {
                // For Beluga, only show products that have a Beluga product ID
                return false
            }
            // For Fuse, show all products (or products without MDI/Beluga IDs if you want to be strict)
            
            // Apply search filter
            if (!searchQuery) return true
            return (
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.category?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })
        .sort((a, b) => {
            // Sort selected products to the top
            const aSelected = selectedProductIds.has(a.id)
            const bSelected = selectedProductIds.has(b.id)
            if (aSelected && !bSelected) return -1
            if (!aSelected && bSelected) return 1
            // Then sort alphabetically by name
            return a.name.localeCompare(b.name)
        })

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border p-6 z-10 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-semibold text-card-foreground">
                                Assign Products to Form
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Select products for <span className="font-medium">{formTitle}</span>
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-muted transition-colors"
                        >
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    {/* Selection summary */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                                {selectedProductIds.size} product{selectedProductIds.size !== 1 ? 's' : ''} selected
                            </span>
                            {selectedProductIds.size > 0 && (
                                <button
                                    onClick={() => setSelectedProductIds(new Set())}
                                    className="text-destructive hover:text-destructive/80 font-medium"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Product Offer Type Toggle */}
                        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${
                            canEnableMultipleChoice 
                                ? 'bg-background border-border' 
                                : 'bg-muted/50 border-border/50'
                        }`}>
                            <span className={`text-sm font-medium ${
                                !canEnableMultipleChoice ? 'text-muted-foreground' : 'text-foreground'
                            }`}>
                                Selection Mode:
                            </span>
                            <button
                                onClick={() => canEnableMultipleChoice && setProductOfferType(
                                    productOfferType === 'single_choice' ? 'multiple_choice' : 'single_choice'
                                )}
                                disabled={!canEnableMultipleChoice}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                    !canEnableMultipleChoice 
                                        ? 'cursor-not-allowed opacity-50' 
                                        : 'hover:bg-muted cursor-pointer'
                                }`}
                                title={!canEnableMultipleChoice ? 'Select at least 2 products to enable multiple choice' : ''}
                            >
                                {productOfferType === 'multiple_choice' ? (
                                    <ToggleRight className="h-5 w-5 text-primary" />
                                ) : (
                                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                                )}
                                <span className={`text-sm font-medium ${
                                    productOfferType === 'multiple_choice' 
                                        ? 'text-primary' 
                                        : 'text-muted-foreground'
                                }`}>
                                    {productOfferType === 'multiple_choice' ? 'Multiple Choice' : 'Single Choice'}
                                </span>
                            </button>
                            {!canEnableMultipleChoice && (
                                <span className="text-xs text-muted-foreground italic">
                                    (requires 2+ products)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Products List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <div className="bg-muted rounded-full p-6 mb-4">
                                <Package className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <p className="text-lg text-foreground">
                                {searchQuery ? "No products found matching your search." : "No products available."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {filteredProducts.map((product) => {
                                const isSelected = selectedProductIds.has(product.id)
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => toggleProduct(product.id)}
                                        className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                                ? "border-primary bg-primary/10 shadow-sm"
                                                : "border-border bg-card hover:border-muted-foreground hover:bg-muted"
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <div
                                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
                                                isSelected
                                                    ? "bg-primary border-primary"
                                                    : "bg-background border-border"
                                            }`}
                                        >
                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                        </div>

                                        {/* Product Image */}
                                        {product.imageUrl ? (
                                            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted">
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                                                <Package className="h-6 w-6 text-primary-foreground" />
                                            </div>
                                        )}

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-card-foreground text-sm line-clamp-1">
                                                    {product.name}
                                                </h3>
                                                {product.isActive === false && (
                                                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                                        Deactivated
                                                    </span>
                                                )}
                                            </div>
                                            {product.category && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {product.category}
                                                </p>
                                            )}
                                            {product.description && (
                                                <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                                                    {product.description}
                                                </p>
                                            )}
                                            {/* Medical Platform Badges */}
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <span className="text-[10px] text-muted-foreground font-medium">Platforms:</span>
                                                {!product.mdOfferingId && !product.belugaProductId && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                                        Fuse
                                                    </span>
                                                )}
                                                {product.mdOfferingId && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                                                        MDI
                                                    </span>
                                                )}
                                                {product.belugaProductId && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded">
                                                        Beluga
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-card border-t border-border p-6 rounded-b-2xl">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-full border border-border text-foreground hover:bg-muted font-medium transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                                    Saving...
                                </>
                            ) : (
                                `Save (${selectedProductIds.size} selected)`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

