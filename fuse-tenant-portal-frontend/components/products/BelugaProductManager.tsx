import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Link2, Unlink, AlertCircle, Check, Activity } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface BelugaProductManagerProps {
  productId: string
  productName: string
  currentBelugaProductId?: string | null
}

interface BelugaProduct {
  id: string
  name: string
  description?: string
  category?: string
  type?: string
  strength?: string
}

export function BelugaProductManager({ productId, productName, currentBelugaProductId }: BelugaProductManagerProps) {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(true)
  const [availableProducts, setAvailableProducts] = useState<BelugaProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>(currentBelugaProductId || "")
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [linkedProduct, setLinkedProduct] = useState<BelugaProduct | null>(null)

  // Fetch available Beluga products
  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all available Beluga products from Beluga API proxy
      const res = await fetch(`${baseUrl}/beluga/products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()

      if (data.success && data.data) {
        setAvailableProducts(data.data)
        
        // If there's a current linked product, find it in the list
        if (currentBelugaProductId) {
          const linked = data.data.find((p: BelugaProduct) => p.id === currentBelugaProductId)
          if (linked) {
            setLinkedProduct(linked)
          }
        }
      } else {
        setError(data.message || "Failed to load Beluga products")
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Beluga products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId && token) {
      fetchData()
    }
  }, [productId, token, currentBelugaProductId])

  const handleLinkProduct = async () => {
    if (!selectedProductId) {
      setError("Please select a Beluga product")
      return
    }

    setLinking(true)
    setError(null)
    setSuccess(null)

    try {
      // Update the product with the selected Beluga product ID
      const res = await fetch(`${baseUrl}/products-management/${productId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          id: productId,
          belugaProductId: selectedProductId 
        })
      })

      const data = await res.json()

      if (data.success) {
        const linked = availableProducts.find(p => p.id === selectedProductId)
        setLinkedProduct(linked || null)
        setSuccess(`Linked to ${linked?.name || 'Beluga product'}`)
        
        // Refresh the page after a short delay to show updated data
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setError(data.message || "Failed to link Beluga product")
      }
    } catch (err: any) {
      setError(err.message || "Failed to link Beluga product")
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkProduct = async () => {
    setLinking(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${baseUrl}/products-management/${productId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          id: productId,
          belugaProductId: null 
        })
      })

      const data = await res.json()

      if (data.success) {
        setLinkedProduct(null)
        setSelectedProductId("")
        setSuccess("Unlinked from Beluga product")
        
        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setError(data.message || "Failed to unlink Beluga product")
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlink Beluga product")
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-600" />
            Beluga Integration
          </CardTitle>
          <CardDescription>
            Loading Beluga products...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4 border-teal-200 bg-gradient-to-br from-teal-50/50 to-white dark:from-teal-950/20 dark:to-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-600" />
            <CardTitle>Beluga Integration</CardTitle>
          </div>
        </div>
        <CardDescription>
          Link this product to a Beluga product for telehealth integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Success/Error Messages */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-700">{success}</p>
          </div>
        )}

        {/* Currently Linked Product */}
        {linkedProduct ? (
          <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/30 border-2 border-teal-200 dark:border-teal-800 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-teal-600" />
                  <h3 className="font-semibold text-teal-900 dark:text-teal-100">Linked Product</h3>
                </div>
                <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-1">{linkedProduct.name}</p>
                {linkedProduct.description && (
                  <p className="text-xs text-teal-600 dark:text-teal-400 mb-2">{linkedProduct.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-teal-700 dark:text-teal-300">
                  <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/50 rounded-full font-medium">
                    ID: {linkedProduct.id}
                  </span>
                  {linkedProduct.category && (
                    <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/50 rounded-full">
                      {linkedProduct.category}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlinkProduct}
                disabled={linking}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex-shrink-0"
              >
                {linking ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Unlink className="h-3 w-3 mr-1" />
                )}
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-muted/50 border border-dashed border-border rounded-xl">
            <div className="text-center py-2">
              <Unlink className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No Beluga Product Linked</p>
              <p className="text-xs text-muted-foreground mt-1">
                Select a product below to link
              </p>
            </div>
          </div>
        )}

        {/* Link New Product Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {linkedProduct ? "Change Linked Product" : "Link to Existing Beluga Product"}
            </label>
            <div className="flex gap-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={linking}
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
              >
                <option value="">Select a Beluga product...</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.id})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleLinkProduct}
                disabled={!selectedProductId || linking}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {linking ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Link
              </Button>
            </div>
          </div>

          {/* Integration info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-medium mb-1">Beluga Product IDs</p>
                <p className="text-xs">
                  Product IDs are loaded from Beluga and saved into your product's
                  <code className="ml-1 mr-1">belugaProductId</code>
                  field. This ID is used when creating Beluga visits after checkout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
