import { Card, CardBody, CardHeader } from "@heroui/react"
import { Icon } from "@iconify/react"

interface SummaryCardsProps {
  totalViews: number
  totalConversions: number
  conversionRate: number
  totalOrders: number
  totalRevenue: number
}

export function AnalyticsSummaryCards({
  totalViews,
  totalConversions,
  conversionRate,
  totalOrders,
  totalRevenue,
}: SummaryCardsProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  return (
    <>
      {/* Analytics Cards - Views & Conversions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Views</h3>
            <Icon icon="lucide:eye" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatNumber(totalViews)}
            </div>
            <p className="text-xs text-muted-foreground">
              Form views across all products
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Conversions</h3>
            <Icon icon="lucide:shopping-cart" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatNumber(totalConversions)}
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
              {formatPercentage(conversionRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall conversion rate
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Order Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Orders</h3>
            <Icon icon="lucide:shopping-bag" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatNumber(totalOrders)}
            </div>
            <p className="text-xs text-muted-foreground">
              All orders from your affiliate links
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Affiliate Revenue</h3>
            <Icon icon="lucide:dollar-sign" className="text-xl text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Your commission from paid orders
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

