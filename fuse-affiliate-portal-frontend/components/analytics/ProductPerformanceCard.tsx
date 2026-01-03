import { Card, CardBody, CardHeader } from "@heroui/react"
import { Icon } from "@iconify/react"

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

interface ProductPerformanceCardProps {
  productStats: ProductStats[]
  onProductClick?: (productId: string) => void
}

export function ProductPerformanceCard({ productStats, onProductClick }: ProductPerformanceCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader className='flex flex-col items-start'>
        <h2 className="text-xl font-semibold">Product Performance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track performance by product from your affiliate links
        </p>
      </CardHeader>
      <CardBody>
        {productStats.length === 0 ? (
          <div className="text-center py-12">
            <Icon
              icon="lucide:trending-up"
              className="text-5xl text-muted-foreground mx-auto mb-4"
            />
            <h3 className="text-lg font-medium mb-2">
              No products available
            </h3>
            <p className="text-muted-foreground">
              Product performance will appear here once the brand adds products
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {productStats.map((product, index) => (
              <div
                key={index}
                onClick={() => onProductClick?.(product.id)}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex-1">
                  <h3 className="font-medium">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:eye" className="text-base" />
                      <span>{formatNumber(product.views)} {product.views === 1 ? 'view' : 'views'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:shopping-bag" className="text-base" />
                      <span>{formatNumber(product.orders)} {product.orders === 1 ? 'order' : 'orders'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:dollar-sign" className="text-base" />
                      <span>{formatCurrency(product.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:heart" className="text-base text-red-500" />
                      <span>{formatNumber(product.likes)} {product.likes === 1 ? 'like' : 'likes'}</span>
                    </div>
                  </div>
                </div>
                <Icon icon="lucide:chevron-right" className="text-xl text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

