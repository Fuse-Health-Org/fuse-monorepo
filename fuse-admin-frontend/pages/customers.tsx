import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import { Users, Mail, Phone, Calendar, ShoppingCart, User, Search, AlertTriangle } from 'lucide-react'

interface Customer {
    id: string
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
    createdAt: string
    updatedAt: string
    orderCount?: number
    totalRevenue?: number
    categories?: string[]
    hasActiveSubscription?: boolean
}

// Mock legendary customers for initial setup
const MOCK_CUSTOMERS: Customer[] = [
    {
        id: 'mock-1',
        firstName: 'James',
        lastName: 'Bond',
        email: 'james.bond@mi6.gov.uk',
        phoneNumber: '+44 20 7930 9000',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 7,
        totalRevenue: 2145.50,
        categories: ['performance', 'wellness'],
        hasActiveSubscription: true
    },
    {
        id: 'mock-2',
        firstName: 'George',
        lastName: 'Washington',
        email: 'george.washington@usa.gov',
        phoneNumber: '+1 202 456 1414',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 12,
        totalRevenue: 4280.00,
        categories: ['weight_loss', 'wellness'],
        hasActiveSubscription: true
    },
    {
        id: 'mock-3',
        firstName: 'Marie',
        lastName: 'Curie',
        email: 'marie.curie@science.edu',
        phoneNumber: '+33 1 44 27 67 54',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 5,
        totalRevenue: 1590.25,
        categories: ['skincare', 'wellness'],
        hasActiveSubscription: false
    },
    {
        id: 'mock-4',
        firstName: 'Leonardo',
        lastName: 'da Vinci',
        email: 'leonardo.davinci@renaissance.art',
        phoneNumber: '+39 055 294883',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 3,
        totalRevenue: 875.00,
        categories: ['hair_growth'],
        hasActiveSubscription: true
    },
    {
        id: 'mock-5',
        firstName: 'Cleopatra',
        lastName: 'VII',
        email: 'cleopatra@egypt.ancient',
        phoneNumber: '+20 2 2579 6974',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 15,
        totalRevenue: 5890.75,
        categories: ['weight_loss', 'skincare', 'wellness'],
        hasActiveSubscription: true
    },
    {
        id: 'mock-6',
        firstName: 'Albert',
        lastName: 'Einstein',
        email: 'albert.einstein@relativity.science',
        phoneNumber: '+1 609 734 8000',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        orderCount: 8,
        totalRevenue: 2650.00,
        categories: ['performance', 'sexual_health'],
        hasActiveSubscription: false
    },
]

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isUsingMockData, setIsUsingMockData] = useState(false)
    const { user, token } = useAuth()

    // Detect environment
    const isProduction = process.env.NODE_ENV === 'production'

    useEffect(() => {
        fetchCustomers()
    }, [token, user])

    const fetchCustomers = async () => {
        if (!token || !user) return

        try {
            setLoading(true)
            setError(null) // Clear any previous errors
            const userWithClinic: any = user
            const clinicId = userWithClinic?.clinicId

            if (!clinicId) {
                setError('No clinic ID found')
                return
            }

            // Fetch users (customers) for this clinic
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/users/by-clinic/${clinicId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    // API call successful, clear any errors
                    setError(null)
                    const realCustomers = data.data || []
                    if (realCustomers.length > 0) {
                        // Real data available
                        setCustomers(realCustomers)
                        setIsUsingMockData(false)
                    } else {
                        // No real customers - this is OK, not an error
                        if (isProduction) {
                            // In production: show empty state
                            setCustomers([])
                            setIsUsingMockData(false)
                        } else {
                            // In dev/staging: use mock data with warning
                            setCustomers(MOCK_CUSTOMERS)
                            setIsUsingMockData(true)
                        }
                    }
                } else {
                    // API returned error (success: false)
                    setError('Failed to fetch customers')
                    if (isProduction) {
                        setCustomers([])
                        setIsUsingMockData(false)
                    } else {
                        setCustomers(MOCK_CUSTOMERS)
                        setIsUsingMockData(true)
                    }
                }
            } else {
                // HTTP error (response not ok)
                setError('Failed to fetch customers')
                if (isProduction) {
                    setCustomers([])
                    setIsUsingMockData(false)
                } else {
                    setCustomers(MOCK_CUSTOMERS)
                    setIsUsingMockData(true)
                }
            }
        } catch (err) {
            // Network error or exception
            console.error('Error fetching customers:', err)
            setError('An error occurred while fetching customers')
            if (isProduction) {
                setCustomers([])
                setIsUsingMockData(false)
            } else {
                setCustomers(MOCK_CUSTOMERS)
                setIsUsingMockData(true)
            }
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    const formatCategoryName = (category: string) => {
        return category.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
    }

    const filteredCustomers = customers.filter(customer =>
        searchTerm === '' ||
        `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading customers...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <Head>
                <title>Customers - Fuse Admin</title>
            </Head>

            <div className="min-h-screen bg-background p-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-semibold text-foreground mb-2">Customers</h1>
                        <p className="text-sm text-muted-foreground">View and manage your clinic's customers</p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <Users className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Customers</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">{customers.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Subscribers</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">
                                            {customers.filter(c => c.hasActiveSubscription).length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-muted">
                                        <Calendar className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New This Month</p>
                                        <p className="text-2xl font-semibold text-foreground mt-1">
                                            {customers.filter(c => {
                                                const created = new Date(c.createdAt)
                                                const now = new Date()
                                                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
                                            }).length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search customers by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                            />
                        </div>
                    </div>

                    {/* Mock Data Warning (only in dev/staging) */}
                    {isUsingMockData && (
                        <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                                            Mock Data Displayed
                                        </h4>
                                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                            You are currently viewing sample data for development purposes. Real customer data will appear here once customers place orders.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 border border-red-200 rounded-md bg-red-50 dark:bg-red-900/20">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Customers List */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="border-b border-border">
                            <CardTitle className="text-lg font-semibold">All Customers ({filteredCustomers.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {filteredCustomers.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">
                                        {searchTerm ? 'No customers found' : 'No customers yet'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {searchTerm 
                                            ? 'Try adjusting your search terms' 
                                            : isProduction
                                                ? 'Customers will appear here once they place orders with your clinic'
                                                : 'No real customers found. Mock data is shown in development mode when available.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredCustomers.map((customer) => (
                                        <div
                                            key={customer.id}
                                            className="p-6 hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-4 flex-1">
                                                    {/* Avatar */}
                                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                        <User className="h-6 w-6 text-muted-foreground" />
                                                    </div>

                                                    {/* Customer Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="text-base font-semibold text-foreground">
                                                                {customer.firstName} {customer.lastName}
                                                            </h3>
                                                            {customer.hasActiveSubscription && (
                                                                <Badge variant="outline" className="text-xs font-medium">
                                                                    Active Subscriber
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Mail className="h-3.5 w-3.5" />
                                                                <span>{customer.email}</span>
                                                            </div>
                                                            {customer.phoneNumber && (
                                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                    <Phone className="h-3.5 w-3.5" />
                                                                    <span>{customer.phoneNumber}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                <span>Joined {formatDate(customer.createdAt)}</span>
                                                            </div>
                                                            
                                                            {/* Product Categories */}
                                                            {customer.categories && customer.categories.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {customer.categories.map((category, idx) => (
                                                                        <Badge key={idx} variant="outline" className="text-xs font-normal">
                                                                            {formatCategoryName(category)}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Stats */}
                                                    <div className="flex flex-col gap-4">
                                                        {customer.totalRevenue !== undefined && (
                                                            <div className="text-right">
                                                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Revenue</div>
                                                                <div className="text-xl font-semibold text-foreground">{formatCurrency(customer.totalRevenue)}</div>
                                                            </div>
                                                        )}
                                                        {customer.orderCount !== undefined && (
                                                            <div className="text-right">
                                                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Orders</div>
                                                                <div className="text-xl font-semibold text-foreground">{customer.orderCount}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    )
}

