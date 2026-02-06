import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import {
    ShoppingCart,
    DollarSign,
    Clock,
    TrendingUp,
    Search,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    Package,
    MapPin,
    CreditCard,
    Calendar,
    User,
    Link as LinkIcon,
    CheckCircle,
    AlertCircle,
    X,
    RefreshCw
} from 'lucide-react'
import { loadConnectAndInitialize } from '@stripe/connect-js'

interface Order {
    id: string
    orderNumber: string
    status: string
    totalAmount: number
    brandAmount: number
    platformFeeAmount: number
    doctorAmount: number
    pharmacyWholesaleAmount: number
    stripeAmount: number
    createdAt: string
    shippedAt?: string
    deliveredAt?: string
    user?: {
        id: string
        firstName: string
        lastName: string
        email: string
    }
    orderItems?: Array<{
        id: string
        quantity: number
        unitPrice: number
        totalPrice: number
        pharmacyPrice: number  // Price from Products table (pharmacy's price)
        brandPrice: number     // Price from TenantProducts table (brand's price)
        product: {
            id: string
            name: string
            category?: string
        }
    }>
    shippingAddress?: {
        address: string
        apartment?: string
        city: string
        state: string
        zipCode: string
        country: string
    }
    payment?: {
        status: string
        paymentMethod: string
    }
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [refundingOrders, setRefundingOrders] = useState<Set<string>>(new Set())
    const [refundSuccess, setRefundSuccess] = useState<string | null>(null)
    const { user, token } = useAuth()

    // Stripe Connect states
    const [showConnectModal, setShowConnectModal] = useState(false)
    const [connectStatus, setConnectStatus] = useState<any>(null)
    const [connectLoading, setConnectLoading] = useState(false)
    const [connectInstance, setConnectInstance] = useState<any>(null)
    const [merchantModel, setMerchantModel] = useState<'platform' | 'direct'>('platform')
    const [connectError, setConnectError] = useState<string | null>(null)

    useEffect(() => {
        fetchOrders()
        fetchConnectStatus()
    }, [token, user])

    // Fetch Stripe Connect status
    const fetchConnectStatus = async () => {
        if (!token) return

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/stripe/connect/status`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setConnectStatus(data.data)
                }
            }
        } catch (err) {
            console.error('Error fetching Stripe Connect status:', err)
        }
    }

    // Initialize Stripe Connect
    const initializeStripeConnect = async () => {
        if (!token || connectInstance) return

        setConnectLoading(true)
        setConnectError(null) // Clear any previous errors
        
        // First, fetch the client secret to check for errors
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/stripe/connect/session`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        merchantModel: merchantModel
                    })
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('Failed to fetch client secret:', response.status, errorData)
                const errorMessage = errorData.message || 'Failed to fetch client secret'
                setConnectError(errorMessage)
                setConnectLoading(false)
                return
            }

            const data = await response.json()
            if (!data.data?.client_secret) {
                setConnectError('Client secret not returned from server')
                setConnectLoading(false)
                return
            }

            const clientSecret = data.data.client_secret

            // Now initialize Stripe Connect with the client secret
            const instance = loadConnectAndInitialize({
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
                fetchClientSecret: async () => clientSecret,
                appearance: {
                    variables: {
                        colorPrimary: '#000000',
                    }
                }
            })

            setConnectInstance(instance)
        } catch (err: any) {
            console.error('Error initializing Stripe Connect:', err)
            setConnectError(err.message || 'Failed to initialize Stripe Connect. Please try again.')
        } finally {
            setConnectLoading(false)
        }
    }

    // Open Connect Modal
    const openConnectModal = async () => {
        setShowConnectModal(true)
        setMerchantModel('platform') // Reset to default
        setConnectInstance(null) // Clear any existing instance
        setConnectError(null) // Clear any previous errors
    }

    // Go back to merchant model selection
    const goBackToSelection = () => {
        setConnectInstance(null)
        setConnectLoading(false)
        setConnectError(null) // Clear any errors when going back
    }

    // Close modal and refresh status
    const closeConnectModal = () => {
        setShowConnectModal(false)
        fetchConnectStatus() // Refresh status after closing
    }

    const fetchOrders = async () => {
        if (!token || !user) return

        try {
            setLoading(true)
            setError(null)
            const userWithClinic: any = user
            const clinicId = userWithClinic?.clinicId

            if (!clinicId) {
                setError('No clinic access. Please contact support.')
                return
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/orders/by-clinic/${clinicId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setOrders(data.data.orders || [])
                } else {
                    setError(data.message || 'Failed to load orders')
                    setOrders([])
                }
            } else {
                setError('Failed to fetch orders')
                setOrders([])
            }
        } catch (err) {
            console.error('Error fetching orders:', err)
            setError('An error occurred while fetching orders')
            setOrders([])
        } finally {
            setLoading(false)
        }
    }

    const handleRefund = async (orderId: string, orderNumber: string) => {
        if (!token) return

        const confirmRefund = confirm(`Are you sure you want to refund order ${orderNumber}? This action cannot be undone.`)
        if (!confirmRefund) return

        try {
            setRefundingOrders(prev => new Set(prev).add(orderId))
            setError(null)
            setRefundSuccess(null)

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/refunds`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        orderId: orderId
                    })
                }
            )

            const data = await response.json()

            if (response.ok && data.success) {
                setRefundSuccess(`Order ${orderNumber} has been refunded successfully!`)
                // Refresh orders to show updated status
                fetchOrders()
                // Clear success message after 5 seconds
                setTimeout(() => setRefundSuccess(null), 5000)
            } else {
                setError(data.message || 'Failed to process refund')
            }
        } catch (err) {
            console.error('Error processing refund:', err)
            setError('An error occurred while processing the refund')
        } finally {
            setRefundingOrders(prev => {
                const newSet = new Set(prev)
                newSet.delete(orderId)
                return newSet
            })
        }
    }

    // Calculate brand revenue for an order
    const calculateBrandRevenue = (order: Order) => {
        // Use brandAmount directly from backend if available
        if (order.brandAmount !== undefined && order.brandAmount !== null) {
            return Number(order.brandAmount)
        }

        // Fallback to calculating from order items if brandAmount not available
        if (!order.orderItems || order.orderItems.length === 0) return 0

        return order.orderItems.reduce((total, item) => {
            const markup = item.brandPrice - item.pharmacyPrice
            const itemBrandRevenue = markup * item.quantity
            return total + itemBrandRevenue
        }, 0)
    }

    // Calculate stats for ALL orders
    const stats = {
        totalOrders: orders.length,
        brandRevenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + calculateBrandRevenue(o), 0),
        pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'payment_due').length,
        avgOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) / orders.length : 0
    }

    // Filter orders
    const filteredOrders = orders.filter(order => {
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter
        const matchesSearch = searchTerm === '' ||
            order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${order.user?.firstName} ${order.user?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.user?.email.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesStatus && matchesSearch
    })

    const toggleRow = (orderId: string) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId)
        } else {
            newExpanded.add(orderId)
        }
        setExpandedRows(newExpanded)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getStatusBadge = (status: string) => {
        return <Badge variant="outline" className="text-xs font-medium">{status}</Badge>
    }

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading orders...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <Head>
                <title>Orders - Fuse Admin</title>
            </Head>

            <div className="min-h-screen bg-background p-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-semibold text-foreground mb-2">Orders</h1>
                            <p className="text-sm text-muted-foreground">Track and manage customer orders</p>
                        </div>

                        {/* Stripe Connect Button */}
                        <button
                            onClick={openConnectModal}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${connectStatus?.onboardingComplete
                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {connectStatus?.onboardingComplete ? (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Stripe Connected</span>
                                </>
                            ) : (
                                <>
                                    <LinkIcon className="h-4 w-4" />
                                    <span>Connect Stripe Account</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Stats Cards - Overview */}
                    <div className="mb-3">
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overview</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Orders</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.totalOrders}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-green-100">
                                        <DollarSign className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand Revenue</p>
                                        <p className="text-2xl font-semibold text-green-600 mt-1">{formatCurrency(stats.brandRevenue)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <Clock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Orders</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.pendingOrders}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Order Value</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">{formatCurrency(stats.avgOrderValue)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters & Search */}
                    <div className="mb-6 space-y-4">
                        {/* Search Bar */}
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by order #, customer name, or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                            />
                        </div>

                        {/* Status Filters */}
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'] as StatusFilter[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${statusFilter === status
                                        ? 'bg-foreground text-background'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Success Message */}
                    {refundSuccess && (
                        <div className="mb-6 p-4 border border-green-200 rounded-md bg-green-50">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <p className="text-green-700 text-sm">{refundSuccess}</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 border border-red-200 rounded-md bg-red-50">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Orders Table */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="border-b border-border">
                            <CardTitle className="text-lg font-semibold">All Orders ({filteredOrders.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {filteredOrders.length === 0 ? (
                                <div className="p-12 text-center">
                                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Orders will appear here when customers place them'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-muted/50 border-b border-border">
                                            <tr>
                                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order #</th>
                                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                                                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                                                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand Revenue</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredOrders.map((order) => {
                                                const isExpanded = expandedRows.has(order.id)
                                                return (
                                                    <>
                                                        <tr
                                                            key={order.id}
                                                            onClick={() => toggleRow(order.id)}
                                                            className="hover:bg-muted/50 cursor-pointer transition-colors"
                                                        >
                                                            <td className="p-4">
                                                                <span className="font-medium text-foreground">{order.orderNumber}</span>
                                                            </td>
                                                            <td className="p-4">
                                                                <div>
                                                                    <div className="font-medium text-foreground">
                                                                        {order.user?.firstName} {order.user?.lastName}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">{order.user?.email}</div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="text-sm text-foreground">{formatDate(order.createdAt)}</span>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="text-sm text-muted-foreground">
                                                                    {order.orderItems?.length || 0} item{order.orderItems?.length !== 1 ? 's' : ''}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                {getStatusBadge(order.status)}
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <span className="font-semibold text-foreground">{formatCurrency(order.totalAmount)}</span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <span className="font-semibold text-green-600">{formatCurrency(calculateBrandRevenue(order))}</span>
                                                            </td>
                                                            <td className="p-4">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Row Details */}
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan={8} className="p-0">
                                                                    <div className="bg-muted/30 p-6 border-t border-border">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                            {/* Order Items */}
                                                                            <div>
                                                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Order Items</h4>
                                                                                <div className="space-y-3">
                                                                                    {order.orderItems?.map((item) => {
                                                                                        const itemMarkup = item.brandPrice - item.pharmacyPrice
                                                                                        const itemBrandRevenue = itemMarkup * item.quantity
                                                                                        return (
                                                                                            <div key={item.id} className="flex justify-between items-start p-3 bg-card border border-border rounded-lg">
                                                                                                <div className="flex-1">
                                                                                                    <div className="font-medium text-foreground">{item.product.name}</div>
                                                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                                                        Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                                                                                                    </div>
                                                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                                                        Pharmacy: {formatCurrency(item.pharmacyPrice)} | Brand: {formatCurrency(item.brandPrice)} | Markup: {formatCurrency(itemMarkup)}
                                                                                                    </div>
                                                                                                    {(() => {
                                                                                                        const categories = Array.isArray((item.product as any)?.categories) && (item.product as any).categories.length > 0
                                                                                                            ? (item.product as any).categories as string[]
                                                                                                            : item.product.category
                                                                                                                ? [item.product.category]
                                                                                                                : []
                                                                                                        if (categories.length === 0) return null
                                                                                                        return (
                                                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                                                {categories.map((category) => (
                                                                                                                    <Badge key={category} variant="outline" className="text-xs font-normal">
                                                                                                                        {category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                                                                                    </Badge>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        )
                                                                                                    })()}
                                                                                                </div>
                                                                                                <div className="text-right">
                                                                                                    <div className="font-semibold text-foreground">
                                                                                                        {formatCurrency(item.totalPrice)}
                                                                                                    </div>
                                                                                                    <div className="text-xs font-medium text-green-600 mt-1">
                                                                                                        Revenue: {formatCurrency(calculateBrandRevenue(order))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            </div>

                                                                            {/* Shipping & Payment Info */}
                                                                            <div className="space-y-4">
                                                                                {/* Shipping Address */}
                                                                                {order.shippingAddress && (
                                                                                    <div>
                                                                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Shipping Address</h4>
                                                                                        <div className="p-3 bg-card border border-border rounded-lg">
                                                                                            <div className="flex items-start gap-2">
                                                                                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                                                <div className="text-sm text-foreground">
                                                                                                    <div>{order.shippingAddress.address}</div>
                                                                                                    {order.shippingAddress.apartment && <div>{order.shippingAddress.apartment}</div>}
                                                                                                    <div>
                                                                                                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                                                                                    </div>
                                                                                                    <div>{order.shippingAddress.country || 'US'}</div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Payment Info */}
                                                                                {order.payment && (
                                                                                    <div>
                                                                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment</h4>
                                                                                        <div className="p-3 bg-card border border-border rounded-lg space-y-3">
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                                                                <span className="text-foreground">
                                                                                                    {order.payment.paymentMethod || 'Card'} • {order.payment.status}
                                                                                                </span>
                                                                                            </div>
                                                                                            
                                                                                            {/* Refund Button - Only show for paid/captured orders that are not already refunded */}
                                                                                            {(order.payment.status === 'succeeded' || 
                                                                                              order.payment.status === 'paid' || 
                                                                                              order.payment.status === 'captured') && 
                                                                                             order.status !== 'refunded' && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation()
                                                                                                        handleRefund(order.id, order.orderNumber)
                                                                                                    }}
                                                                                                    disabled={refundingOrders.has(order.id)}
                                                                                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                                                                        refundingOrders.has(order.id)
                                                                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                                                            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                                                                                    }`}
                                                                                                >
                                                                                                    {refundingOrders.has(order.id) ? (
                                                                                                        <>
                                                                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                                                                            Processing Refund...
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <RefreshCw className="h-4 w-4" />
                                                                                                            Issue Refund
                                                                                                        </>
                                                                                                    )}
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Timeline */}
                                                                                <div>
                                                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Timeline</h4>
                                                                                    <div className="space-y-2">
                                                                                        <div className="flex items-center gap-2 text-sm">
                                                                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                            <span className="text-muted-foreground">Created:</span>
                                                                                            <span className="font-medium text-foreground">{formatDate(order.createdAt)}</span>
                                                                                        </div>
                                                                                        {order.shippedAt && (
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                                <span className="text-muted-foreground">Shipped:</span>
                                                                                                <span className="font-medium text-foreground">{formatDate(order.shippedAt)}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {order.deliveredAt && (
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                                <span className="text-muted-foreground">Delivered:</span>
                                                                                                <span className="font-medium text-foreground">{formatDate(order.deliveredAt)}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stripe Connect Modal */}
                    {showConnectModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                                {/* Modal Header */}
                                <div className="flex items-center justify-between p-6 border-b">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-900">Stripe Connect</h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Connect your Stripe account to receive payouts
                                        </p>
                                    </div>
                                    <button
                                        onClick={closeConnectModal}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X className="h-5 w-5 text-gray-500" />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                                    {/* Error Message */}
                                    {connectError && (
                                        <div className="mb-6 p-4 border border-red-200 rounded-lg bg-red-50">
                                            <div className="flex gap-3">
                                                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-red-900 mb-1">Connection Error</h4>
                                                    <p className="text-sm text-red-700">{connectError}</p>
                                                </div>
                                                <button
                                                    onClick={() => setConnectError(null)}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!connectInstance && !connectLoading && !connectStatus?.onboardingComplete ? (
                                        <div className="py-6">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Your Payment Model</h3>
                                            <p className="text-sm text-gray-600 mb-6">
                                                Select how you want to handle payments and payouts
                                            </p>

                                            {/* Merchant Model Options */}
                                            <div className="space-y-3">
                                                {/* Option 1: Platform MOR */}
                                                <button
                                                    onClick={() => {
                                                        setMerchantModel('platform')
                                                        initializeStripeConnect()
                                                    }}
                                                    className="w-full text-left p-4 border-2 border-blue-500 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="w-4 h-4 rounded-full border-2 border-blue-600 bg-blue-600 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                                                </div>
                                                                <h4 className="font-semibold text-gray-900">Fuse is the Merchant of Record</h4>
                                                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Recommended</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 ml-6">
                                                                Fuse handles all payments and compliance. You receive automatic payouts based on your revenue share.
                                                            </p>
                                                            <ul className="mt-2 ml-6 space-y-1 text-sm text-gray-600">
                                                                <li>✓ Simple setup - just connect to receive payouts</li>
                                                                <li>✓ Fuse handles disputes and chargebacks</li>
                                                                <li>✓ Automatic revenue sharing</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Option 2: Direct MOR (Coming Soon) */}
                                                <div className="relative">
                                                    <div className="w-full text-left p-4 border-2 border-gray-300 rounded-lg bg-gray-50 opacity-60 cursor-not-allowed">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className="w-4 h-4 rounded-full border-2 border-gray-400"></div>
                                                                    <h4 className="font-semibold text-gray-700">You are the Merchant of Record</h4>
                                                                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">Coming Soon</span>
                                                                </div>
                                                                <p className="text-sm text-gray-500 ml-6">
                                                                    Accept payments directly to your Stripe account. You handle all compliance and operations.
                                                                </p>
                                                                <ul className="mt-2 ml-6 space-y-1 text-sm text-gray-500">
                                                                    <li>○ Direct control over payments</li>
                                                                    <li>○ You handle disputes and chargebacks</li>
                                                                    <li>○ More complex setup required</li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
                                                            <span className="text-sm font-medium text-gray-700">Coming Soon</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : connectLoading ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-gray-600">Loading Stripe Connect...</p>
                                        </div>
                                    ) : connectStatus?.onboardingComplete ? (
                                        <div className="text-center py-12">
                                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                            </div>
                                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                                Stripe Account Connected
                                            </h3>
                                            <p className="text-gray-600 mb-6">
                                                Your account is fully set up and ready to receive payouts.
                                            </p>
                                            <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                                                <div className="space-y-2 text-sm text-left">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Account ID:</span>
                                                        <span className="font-mono text-gray-900">
                                                            {connectStatus.accountId?.substring(0, 20)}...
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Charges:</span>
                                                        <span className={connectStatus.chargesEnabled ? 'text-green-600' : 'text-red-600'}>
                                                            {connectStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Payouts:</span>
                                                        <span className={connectStatus.payoutsEnabled ? 'text-green-600' : 'text-red-600'}>
                                                            {connectStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            {/* Back Button */}
                                            <button
                                                onClick={goBackToSelection}
                                                className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Back to payment model selection
                                            </button>

                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                                <div className="flex gap-3">
                                                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-medium text-blue-900 mb-1">
                                                            Complete your Stripe onboarding
                                                        </h4>
                                                        <p className="text-sm text-blue-700">
                                                            You'll need to provide some information about your business to start receiving payouts.
                                                            This process is secure and handled directly by Stripe.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stripe Connect Component Container */}
                                            {connectInstance && (
                                                <StripeConnectAccountOnboarding
                                                    stripeConnectInstance={connectInstance}
                                                    onExit={closeConnectModal}
                                                />
                                            )}
                                        </div>
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

// Stripe Connect Account Onboarding Component
function StripeConnectAccountOnboarding({
    stripeConnectInstance,
    onExit
}: {
    stripeConnectInstance: any,
    onExit: () => void
}) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!stripeConnectInstance) {
            console.error('Stripe Connect instance is not available')
            return
        }

        if (!containerRef.current) {
            console.error('Container ref is not available')
            return
        }

        let accountOnboarding: any = null
        let mounted = false

        const mountComponent = async () => {
            try {
                // Wait for next frame to ensure DOM is fully rendered
                await new Promise(resolve => requestAnimationFrame(resolve))
                await new Promise(resolve => setTimeout(resolve, 200))

                const container = containerRef.current
                if (!container) {
                    console.error('❌ Container element not found')
                    return
                }

                // Clear any existing content
                container.innerHTML = ''

                console.log('🔄 Creating account-onboarding component...')
                
                // Create the component - check if create returns an element or a component instance
                try {
                    accountOnboarding = stripeConnectInstance.create('account-onboarding', {
                        onExit: () => {
                            console.log('Account onboarding exited')
                            onExit()
                        }
                    })

                    if (!accountOnboarding) {
                        console.error('❌ Failed to create account-onboarding component')
                        return
                    }

                    // Verify container still exists
                    if (!containerRef.current) {
                        console.error('❌ Container disappeared before mounting')
                        return
                    }
                    
                    // Try mounting - check if it has a mount method or if it's already a DOM element
                    if (typeof accountOnboarding.mount === 'function') {
                        // It's a component instance with mount method
                        accountOnboarding.mount(containerRef.current)
                    } else if (accountOnboarding instanceof HTMLElement) {
                        // It's a DOM element directly
                        containerRef.current.appendChild(accountOnboarding)
                    } else {
                        console.error('❌ Unexpected component type:', typeof accountOnboarding)
                        return
                    }
                    
                    mounted = true
                    console.log('✅ Account onboarding component mounted')

                } catch (createError: any) {
                    console.error('❌ Error creating Stripe Connect component:', createError)
                    // Try alternative approach - create without options first
                    if (createError.message?.includes('CORS') || createError.message?.includes('fetch')) {
                        console.error('⚠️ CORS or fetch error detected. This may be due to client secret not being available.')
                    }
                    throw createError
                }

            } catch (error: any) {
                console.error('❌ Error mounting Stripe Connect component:', error)
                // Show user-friendly error message
                if (containerRef.current) {
                    containerRef.current.innerHTML = `
                        <div class="p-4 border border-red-200 rounded-lg bg-red-50">
                            <p class="text-red-800 text-sm font-medium">Error loading Stripe Connect</p>
                            <p class="text-red-600 text-xs mt-1">${error.message || 'Please try again or contact support.'}</p>
                        </div>
                    `
                }
            }
        }

        mountComponent()

        // Cleanup
        return () => {
            if (mounted && accountOnboarding) {
                try {
                    // Unmount the component using the unmount method
                    if (typeof accountOnboarding.unmount === 'function') {
                        accountOnboarding.unmount()
                    }
                    console.log('🧹 Unmounted Stripe Connect component')
                } catch (error) {
                    console.error('Error unmounting component:', error)
                }
            }
        }
    }, [stripeConnectInstance, onExit])

    return <div ref={containerRef} id="stripe-connect-container" className="min-h-[400px]" />
}

