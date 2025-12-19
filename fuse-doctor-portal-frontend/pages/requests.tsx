import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { ApiClient, PendingOrder } from '@/lib/api';
import { RequestFilters } from '@/components/RequestFilters';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { toast } from 'sonner';
import { RefreshCw, CheckSquare, Square } from 'lucide-react';

export default function Requests() {
    const { authenticatedFetch } = useAuth();
    const apiClient = new ApiClient(authenticatedFetch);

    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<any>({});
    const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bulkApproving, setBulkApproving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Load orders
    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.fetchPendingOrders(filters);
            if (response.success) {
                setOrders(response.data);
            }
        } catch (error) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadOrders();
        setRefreshing(false);
        toast.success('Orders refreshed');
    };

    const handleFilterChange = (newFilters: any) => {
        setFilters(newFilters);
    };

    const handleFilterReset = () => {
        setFilters({});
    };

    const toggleOrderSelection = (orderId: string) => {
        const newSelection = new Set(selectedOrders);
        if (newSelection.has(orderId)) {
            newSelection.delete(orderId);
        } else {
            newSelection.add(orderId);
        }
        setSelectedOrders(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedOrders.size === orders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(orders.map(o => o.id)));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedOrders.size === 0) {
            toast.error('Please select orders to approve');
            return;
        }

        const confirmMessage = `Are you sure you want to approve ${selectedOrders.size} order(s)?`;
        if (!confirm(confirmMessage)) return;

        setBulkApproving(true);
        try {
            const response = await apiClient.bulkApproveOrders(Array.from(selectedOrders));

            if (response.success) {
                const { succeeded, failed } = response.data.summary;
                if (succeeded > 0) {
                    toast.success(`${succeeded} order(s) approved successfully`);
                }
                if (failed > 0) {
                    toast.error(`${failed} order(s) failed to approve`);
                }

                setSelectedOrders(new Set());
                await loadOrders();
            }
        } catch (error) {
            toast.error('Failed to bulk approve orders');
        } finally {
            setBulkApproving(false);
        }
    };

    const handleOrderClick = (order: PendingOrder) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedOrder(null);
    };

    const handleOrderApproved = () => {
        loadOrders();
    };

    const handleNotesAdded = async () => {
        await loadOrders();
        // Refresh the selected order with updated data
        if (selectedOrder) {
            const response = await apiClient.fetchPendingOrders({ limit: 200 });
            if (response.success) {
                const updatedOrder = response.data.find(o => o.id === selectedOrder.id);
                if (updatedOrder) {
                    setSelectedOrder(updatedOrder);
                }
            }
        }
    };

    const allSelected = orders.length > 0 && selectedOrders.size === orders.length;

    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-semibold text-foreground">Patient Orders</h1>
                                <p className="text-muted-foreground mt-1">Review and manage patient product orders across all clinics</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        {/* Info Note */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> This page displays orders made by patients to purchase products offered by our tenants.
                                Orders without an associated tenant product are not shown here.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Filters Sidebar */}
                            <div className="lg:col-span-1">
                                <RequestFilters
                                    onFilterChange={handleFilterChange}
                                    onReset={handleFilterReset}
                                />
                            </div>

                            {/* Orders List */}
                            <div className="lg:col-span-3">
                                {/* Bulk Actions */}
                                {orders.length > 0 && (
                                    <div className="bg-white border rounded-lg p-4 mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={toggleSelectAll}
                                                className="flex items-center gap-2 text-sm font-medium"
                                            >
                                                {allSelected ? (
                                                    <CheckSquare className="h-5 w-5 text-blue-600" />
                                                ) : (
                                                    <Square className="h-5 w-5" />
                                                )}
                                                Select All ({selectedOrders.size}/{orders.length})
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleBulkApprove}
                                            disabled={selectedOrders.size === 0 || bulkApproving}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {bulkApproving ? 'Approving...' : `Approve Selected (${selectedOrders.size})`}
                                        </button>
                                    </div>
                                )}

                                {/* Loading State */}
                                {loading && (
                                    <div className="bg-white border rounded-lg p-8 text-center">
                                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                                        <p className="mt-4 text-gray-600">Loading requests...</p>
                                    </div>
                                )}

                                {/* Empty State */}
                                {!loading && orders.length === 0 && (
                                    <div className="bg-white border rounded-lg p-8 text-center">
                                        <p className="text-gray-600">No pending requests found</p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Try adjusting your filters or check back later
                                        </p>
                                    </div>
                                )}

                                {/* Orders Table */}
                                {!loading && orders.length > 0 && (
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Select
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Order #
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Patient
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Product
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Date
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                        Approval
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {orders.map((order) => (
                                                    <tr
                                                        key={order.id}
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                        onClick={(e) => {
                                                            if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                                handleOrderClick(order);
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedOrders.has(order.id)}
                                                                onChange={() => toggleOrderSelection(order.id)}
                                                                className="h-4 w-4 rounded border-gray-300"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium">
                                                            {order.orderNumber}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            {order.patient?.firstName} {order.patient?.lastName}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            {(order as any).program?.name || (order as any).tenantProduct?.name || order.treatment?.name || 'N/A'}
                                                            {(order as any).program && (
                                                                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                                                    Program
                                                                </span>
                                                            )}
                                                            {(order as any).tenantProduct?.placeholderSig && !(order as any).program && (
                                                                <span className="ml-2 text-xs text-gray-500">
                                                                    {(order as any).tenantProduct.placeholderSig}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                            {new Date(order.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {order.approvedByDoctor ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                                                        ✓ Approved
                                                                    </span>
                                                                    {order.autoApprovedByDoctor && (
                                                                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                                                            Auto
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                                                    Pending Approval
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Order Detail Modal */}
            <OrderDetailModal
                order={selectedOrder}
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onApprove={handleOrderApproved}
                onNotesAdded={handleNotesAdded}
            />
        </div>
    );
}

