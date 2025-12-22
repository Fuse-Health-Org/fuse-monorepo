import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Layout from '@/components/Layout'
import {
  TrendingUp,
  Eye,
  ShoppingCart,
  Percent,
  ChevronRight,
  Loader2,
  Heart,
} from 'lucide-react'

interface ProductAnalytics {
  productId: string
  productName: string
  views: number
  conversions: number
  conversionRate: number
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

interface AnalyticsOverview {
  timeRange: string
  startDate: string
  endDate: string
  summary: {
    totalViews: number
    totalConversions: number
    overallConversionRate: number
  }
  products: ProductAnalytics[]
}

interface ProductDetailAnalytics {
  productId: string
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Analytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductDetailAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token, authenticatedFetch } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (token) {
      fetchOverview()
    }
  }, [token, timeRange])

  const fetchOverview = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authenticatedFetch(
        `${API_URL}/analytics/overview?timeRange=${timeRange}`,
        {
          method: 'GET',
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOverview(data.data)
        } else {
          setError(data.error || 'Failed to fetch analytics')
        }
      } else {
        setError('Failed to fetch analytics')
      }
    } catch (err) {
      console.error('Error fetching analytics overview:', err)
      setError('Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  const fetchProductDetails = async (productId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authenticatedFetch(
        `${API_URL}/analytics/products/${productId}?timeRange=${timeRange}`,
        {
          method: 'GET',
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSelectedProduct(data.data)
        } else {
          setError(data.error || 'Failed to fetch product analytics')
        }
      } else {
        setError('Failed to fetch product analytics')
      }
    } catch (err) {
      console.error('Error fetching product analytics:', err)
      setError('Failed to fetch product analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleProductClick = (productId: string) => {
    fetchProductDetails(productId)
  }

  const handleBackToOverview = () => {
    setSelectedProduct(null)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  return (
    <Layout>
      <Head>
        <title>Analytics - Fuse</title>
      </Head>

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {selectedProduct && (
              <Button
                variant="ghost"
                onClick={handleBackToOverview}
                className="flex items-center gap-2"
              >
                ← Back to Overview
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {selectedProduct ? 'Product Analytics' : 'Analytics Overview'}
              </h1>
              <p className="text-muted-foreground mt-1">
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
              className="px-4 py-2 border border-border rounded-md bg-background text-foreground"
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
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !overview && !selectedProduct && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!selectedProduct && overview && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(overview.summary.totalViews)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Form views across all products
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(overview.summary.totalConversions)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed purchases
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercentage(overview.summary.overallConversionRate)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overall conversion rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Products List */}
            <Card>
              <CardHeader>
                <CardTitle>Product Performance</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on a product to see form-level breakdowns
                </p>
              </CardHeader>
              <CardContent>
                {overview.products.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No analytics data yet
                    </h3>
                    <p className="text-muted-foreground">
                      Analytics will appear here once you start getting views and conversions
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {overview.products.map((product) => (
                      <div
                        key={product.productId}
                        onClick={() => handleProductClick(product.productId)}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">
                            {product.productName}
                          </h3>
                          <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              <span>{formatNumber(product.views)} views</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4" />
                              <span>{formatNumber(product.conversions)} conversions</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Percent className="h-4 w-4" />
                              <span>{formatPercentage(product.conversionRate)}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {selectedProduct && (
          <>
            {/* Product Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Product Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProduct.summary.totalViews)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total form views
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProduct.summary.totalConversions)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed purchases
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercentage(selectedProduct.summary.overallConversionRate)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Product conversion rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Drop-Off Stages */}
            {selectedProduct.summary.dropOffRates && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Drop Off %</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Percentage of users who viewed the form and dropped off during each stage
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    {/* Product Stage */}
                    <div className="flex-1 text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {formatPercentage(selectedProduct.summary.dropOffRates.product)}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Product
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatNumber(selectedProduct.summary.dropOffs?.product || 0)} drop-offs
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="h-16 w-px bg-border"></div>

                    {/* Payment Stage */}
                    <div className="flex-1 text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {formatPercentage(selectedProduct.summary.dropOffRates.payment)}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Payment
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatNumber(selectedProduct.summary.dropOffs?.payment || 0)} drop-offs
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="h-16 w-px bg-border"></div>

                    {/* Account Stage */}
                    <div className="flex-1 text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {formatPercentage(selectedProduct.summary.dropOffRates.account)}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Account
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatNumber(selectedProduct.summary.dropOffs?.account || 0)} drop-offs
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Likes Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Product Likes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total likes from customers viewing this product
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Heart className="h-6 w-6 text-red-500" />
                    <div>
                      <div className="text-2xl font-bold">0</div>
                      <div className="text-xs text-muted-foreground">Total Likes</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    (Likes tracking coming soon)
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forms Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Form Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProduct.forms.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No form analytics yet
                    </h3>
                    <p className="text-muted-foreground">
                      Create forms for this product to track their performance
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium text-foreground">
                            Form URL
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            Views
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            Conversions
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            Conversion Rate
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            <div>Product</div>
                            <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            <div>Payment</div>
                            <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-foreground">
                            <div>Account</div>
                            <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.forms.map((form) => (
                          <tr
                            key={form.formId}
                            className="border-b border-border hover:bg-accent transition-colors"
                          >
                            <td className="py-3 px-4 text-foreground">
                              {form.formUrl || form.formId}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {formatNumber(form.views)}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {formatNumber(form.conversions)}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {formatPercentage(form.conversionRate)}
                            </td>
                            <td className="text-right py-3 px-4">
                              <div className="text-muted-foreground">
                                {formatNumber(form.dropOffs?.product || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({formatPercentage(form.dropOffRates?.product || 0)})
                              </div>
                            </td>
                            <td className="text-right py-3 px-4">
                              <div className="text-muted-foreground">
                                {formatNumber(form.dropOffs?.payment || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({formatPercentage(form.dropOffRates?.payment || 0)})
                              </div>
                            </td>
                            <td className="text-right py-3 px-4">
                              <div className="text-muted-foreground">
                                {formatNumber(form.dropOffs?.account || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({formatPercentage(form.dropOffRates?.account || 0)})
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  )
}


