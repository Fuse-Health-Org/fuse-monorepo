import { Card, CardBody, CardHeader, Button, Spinner } from "@heroui/react"
import { Icon } from "@iconify/react"

interface LikesAnalytics {
  totalLikes: number
  userLikes: number
  anonymousLikes: number
  dailyLikes: { date: string; count: number }[]
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

interface ProductDetailViewProps {
  productDetails: ProductDetailAnalytics
  likesAnalytics?: LikesAnalytics | null
  likesLoading?: boolean
  onBack: () => void
}

export function ProductDetailView({ productDetails, likesAnalytics, likesLoading, onBack }: ProductDetailViewProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  if (!productDetails || !productDetails.summary) {
    return (
      <Card>
        <CardBody>
          <p className="text-center py-12 text-muted-foreground">No data available</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      {/* Product Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Product Views</h3>
            <Icon icon="lucide:eye" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatNumber(productDetails.summary.totalViews || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total form views
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Conversions</h3>
            <Icon icon="lucide:shopping-cart" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatNumber(productDetails.summary.totalConversions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed purchases
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Conversion Rate</h3>
            <Icon icon="lucide:percent" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatPercentage(productDetails.summary.overallConversionRate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Product conversion rate
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Drop-Off Stages */}
      {productDetails.summary.dropOffRates && (
        <Card className="mb-8">
          <CardHeader className="flex flex-col items-start">
            <h2 className="text-xl font-semibold">Drop Off %</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Percentage of users who viewed the form and dropped off during each stage
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              {/* Product Stage */}
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold mb-2">
                  {formatPercentage(productDetails.summary.dropOffRates.product)}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Product
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(productDetails.summary.dropOffs?.product || 0)} drop-offs
                </div>
              </div>

              {/* Separator */}
              <div className="h-16 w-px bg-border"></div>

              {/* Payment Stage */}
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold mb-2">
                  {formatPercentage(productDetails.summary.dropOffRates.payment)}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Payment
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(productDetails.summary.dropOffs?.payment || 0)} drop-offs
                </div>
              </div>

              {/* Separator */}
              <div className="h-16 w-px bg-border"></div>

              {/* Account Stage */}
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold mb-2">
                  {formatPercentage(productDetails.summary.dropOffRates.account)}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Account
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(productDetails.summary.dropOffs?.account || 0)} drop-offs
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Product Likes */}
      <Card className="mb-8">
        <CardHeader className="flex flex-col items-start">
          <h2 className="text-xl font-semibold">Product Likes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customer engagement and likes analytics
          </p>
        </CardHeader>
        <CardBody>
          {likesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : likesAnalytics ? (
            <div className="space-y-6">
              {/* Likes Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="lucide:heart" className="text-base text-red-500" />
                    <span className="text-xs font-medium text-muted-foreground">Total Likes</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatNumber(likesAnalytics.totalLikes)}
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="lucide:heart" className="text-base text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Logged-in Users</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(likesAnalytics.userLikes)}
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="lucide:heart" className="text-base text-gray-500" />
                    <span className="text-xs font-medium text-muted-foreground">Anonymous Visitors</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {formatNumber(likesAnalytics.anonymousLikes)}
                  </div>
                </div>
              </div>

              {/* Daily Likes Chart */}
              {likesAnalytics.dailyLikes && likesAnalytics.dailyLikes.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon icon="lucide:trending-up" className="text-base text-muted-foreground" />
                    <span className="text-sm font-medium">Likes Over Last 30 Days</span>
                  </div>
                  <div className="h-48 flex items-end gap-1">
                    {(() => {
                      const maxCount = Math.max(...likesAnalytics.dailyLikes.map(d => d.count), 1)
                      return likesAnalytics.dailyLikes.map((day) => (
                        <div
                          key={day.date}
                          className="flex-1 bg-gradient-to-t from-red-500 to-pink-400 rounded-t hover:from-red-600 hover:to-pink-500 transition-colors cursor-pointer group relative"
                          style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                          title={`${day.date}: ${day.count} likes`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                            {day.date}: {day.count}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}

              {/* Conversion Insight */}
              {likesAnalytics.totalLikes > 0 && productDetails.summary.totalConversions > 0 && (
                <div className="p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="lucide:trending-up" className="text-base text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Engagement Insight</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {((productDetails.summary.totalConversions / likesAnalytics.totalLikes) * 100).toFixed(1)}% of users who liked this product have placed an order.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Icon icon="lucide:heart" className="text-5xl mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">No likes data available yet</p>
              <p className="text-xs mt-1">Likes will appear here once customers start liking this product</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Forms Performance */}
      <Card>
        <CardHeader className="flex flex-col items-start">
          <h2 className="text-xl font-semibold">Form Performance</h2>
        </CardHeader>
        <CardBody>
          {!productDetails.forms || productDetails.forms.length === 0 ? (
            <div className="text-center py-12">
              <Icon
                icon="lucide:trending-up"
                className="text-5xl text-muted-foreground mx-auto mb-4"
              />
              <h3 className="text-lg font-medium mb-2">
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
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">
                      Form URL
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Views
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Conversions
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Conversion Rate
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <div>Product</div>
                      <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <div>Payment</div>
                      <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <div>Account</div>
                      <div className="text-xs font-normal text-muted-foreground">Drop-offs</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productDetails.forms.map((form) => (
                    <tr
                      key={form.formId}
                      className="border-b hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-3 px-4">
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
        </CardBody>
      </Card>
    </>
  )
}

