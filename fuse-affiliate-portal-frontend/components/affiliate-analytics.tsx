import { useState, useEffect, useCallback } from 'react'
import { Spinner, Card, CardBody, Button } from "@heroui/react"
import { apiCall } from "../lib/api"
import { useAuth } from "../contexts/AuthContext"
import { AnalyticsSummaryCards } from "./analytics/AnalyticsSummaryCards"
import { ProductPerformanceCard } from "./analytics/ProductPerformanceCard"
import { ProductDetailView } from "./analytics/ProductDetailView"

interface AffiliateOrder {
  orderId: string
  orderNumber: string
  status: string
  totalAmount: number
  productName: string
  productId: string | null
  customerEmail: string
  customerName: string
  createdAt: string
}

interface ProductStats {
  id: string
  name: string
  views: number
  conversions: number
  conversionRate: number
  orders: number
  revenue: number
  likes: number
}

interface AnalyticsOverview {
  timeRange: string
  startDate: string
  endDate: string
  summary: {
    totalViews: number
    totalConversions: number
    conversionRate: number
    totalOrders: number
    paidOrders: number
    totalRevenue: number
  }
  products: ProductStats[]
  orders: AffiliateOrder[]
}

interface FormAnalytics {
  formId: string
  views: number
  conversions: number
  conversionRate: number
  formUrl: string
  dropOffs?: {
    product: number
    payment: number
    account: number
    total: number
  }
  dropOffRates?: {
    product: number
    payment: number
    account: number
  }
}

interface LikesAnalytics {
  totalLikes: number
  userLikes: number
  anonymousLikes: number
  dailyLikes: { date: string; count: number }[]
}

interface ProductDetailAnalytics {
  productId: string
  tenantProductId?: string
  timeRange: string
  startDate: string
  endDate: string
  summary: {
    totalViews: number
    totalConversions: number
    overallConversionRate: number
    dropOffs?: {
      product: number
      payment: number
      account: number
      total: number
    }
    dropOffRates?: {
      product: number
      payment: number
      account: number
    }
  }
  forms: FormAnalytics[]
}

const TIME_RANGES = [
  { value: '1d', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 3 Months' },
  { value: '180d', label: 'Last 6 Months' },
  { value: '365d', label: 'Last Year' },
]


export function AffiliateAnalytics() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductDetailAnalytics | null>(null)
  const [likesAnalytics, setLikesAnalytics] = useState<LikesAnalytics | null>(null)
  const [likesLoading, setLikesLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('📊 [FRONTEND] Fetching affiliate analytics...')
      const response = await apiCall(
        `/analytics/affiliate/overview?timeRange=${timeRange}`,
        { method: 'GET' }
      )

      console.log('📊 [FRONTEND] Full response:', JSON.stringify(response, null, 2))

      if (response.success && response.data) {
        // The response structure might be nested - extract the actual data
        const data = response.data.data || response.data
        
        console.log('📊 [FRONTEND] Extracted data:', {
          summary: data.summary,
          productsLength: data.products?.length,
          products: data.products,
          ordersLength: data.orders?.length,
        })

        // Ensure the data structure is correct
        const analyticsData = {
          timeRange: data.timeRange || timeRange,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          summary: {
            totalViews: data.summary?.totalViews || 0,
            totalConversions: data.summary?.totalConversions || 0,
            conversionRate: data.summary?.conversionRate || 0,
            totalOrders: data.summary?.totalOrders || 0,
            paidOrders: data.summary?.paidOrders || 0,
            totalRevenue: data.summary?.totalRevenue || 0,
          },
          products: data.products || [],
          orders: data.orders || [],
        }
        
        console.log('📊 [FRONTEND] Final analyticsData:', analyticsData)
        setOverview(analyticsData)
      } else {
        setError(response.error || 'Failed to fetch analytics')
      }
    } catch (err: any) {
      console.error('❌ [FRONTEND] Error fetching analytics:', err)
      setError(err.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    if (!selectedProduct) {
      fetchOverview()
    }
  }, [timeRange, selectedProduct, fetchOverview])

  const fetchProductLikes = useCallback(async (tenantProductId: string) => {
    if (!user?.clinicId) {
      console.warn('⚠️ No clinic ID available for fetching likes')
      return
    }

    setLikesLoading(true)
    try {
      console.log('💗 [FRONTEND] Fetching likes for tenantProductId:', tenantProductId, 'affiliateId (clinicId):', user.clinicId)
      const response = await apiCall(
        `/likes/public/analytics/${tenantProductId}?affiliateId=${user.clinicId}`,
        { method: 'GET' }
      )

      console.log('💗 [FRONTEND] Likes response:', response)
      console.log('💗 [FRONTEND] response.data:', response.data)
      console.log('💗 [FRONTEND] response.data.data:', response.data?.data)

      if (response.success && response.data) {
        // Handle potential double nesting
        const likesData = response.data.data || response.data
        console.log('💗 [FRONTEND] Setting likesAnalytics:', likesData)
        setLikesAnalytics(likesData)
      }
    } catch (err) {
      console.error('Error fetching product likes:', err)
    } finally {
      setLikesLoading(false)
    }
  }, [user?.clinicId])

  const fetchProductDetails = useCallback(async (productId: string) => {
    setLoading(true)
    setError(null)
    try {
      console.log('📊 [FRONTEND] Fetching product details for:', productId)
      const response = await apiCall(
        `/analytics/affiliate/products/${productId}?timeRange=${timeRange}`,
        { method: 'GET' }
      )

      console.log('📊 [FRONTEND] Product details response:', response)

      if (response.success && response.data) {
        // Extract the actual data (might be nested)
        const productData = response.data.data || response.data
        console.log('📊 [FRONTEND] Setting selected product:', productData)
        setSelectedProduct(productData)
        
        // Fetch likes for this specific product
        if (productData.tenantProductId) {
          fetchProductLikes(productData.tenantProductId)
        }
      } else {
        setError(response.error || 'Failed to fetch product analytics')
      }
    } catch (err: any) {
      console.error('❌ [FRONTEND] Error fetching product analytics:', err)
      setError(err.message || 'Failed to fetch product analytics')
    } finally {
      setLoading(false)
    }
  }, [timeRange, fetchProductLikes])

  const handleProductClick = (productId: string) => {
    fetchProductDetails(productId)
  }

  const handleBackToOverview = () => {
    setSelectedProduct(null)
    setLikesAnalytics(null)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {selectedProduct && (
            <Button
              variant="flat"
              onClick={handleBackToOverview}
              className="flex items-center gap-2"
            >
              ← Back to Overview
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold">
              {selectedProduct ? 'Product Analytics' : 'Analytics Overview'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedProduct
                ? 'View detailed analytics for this product'
                : 'Track your product performance and conversions'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            {TIME_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-danger">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      )}

      {loading && !overview && !selectedProduct && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {!selectedProduct && overview && overview.summary && (
        <>
          <AnalyticsSummaryCards
            totalViews={overview.summary.totalViews || 0}
            totalConversions={overview.summary.totalConversions || 0}
            conversionRate={overview.summary.conversionRate || 0}
            totalOrders={overview.summary.totalOrders || 0}
            totalRevenue={overview.summary.totalRevenue || 0}
          />

          <ProductPerformanceCard 
            productStats={overview.products || []}
            onProductClick={handleProductClick}
          />
        </>
      )}

      {selectedProduct && (
        <ProductDetailView
          productDetails={selectedProduct}
          likesAnalytics={likesAnalytics}
          likesLoading={likesLoading}
          onBack={handleBackToOverview}
        />
      )}
    </div>
  )
}
