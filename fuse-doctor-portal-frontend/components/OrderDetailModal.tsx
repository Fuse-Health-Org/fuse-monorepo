import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { PendingOrder, ApiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface OrderDetailModalProps {
    order: PendingOrder | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove?: (orderId: string) => void;
    onCancel?: (orderId: string) => void;
    onNotesAdded?: () => void;
}

export function OrderDetailModal({ order, isOpen, onClose, onApprove, onCancel, onNotesAdded }: OrderDetailModalProps) {
    const { authenticatedFetch } = useAuth();
    const apiClient = new ApiClient(authenticatedFetch);

    const [notes, setNotes] = useState('');
    const [submittingNotes, setSubmittingNotes] = useState(false);
    const [approving, setApproving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [pharmacyCoverages, setPharmacyCoverages] = useState<any[]>([]);
    const [loadingCoverage, setLoadingCoverage] = useState(false);
    const [coverageError, setCoverageError] = useState<string | null>(null);
    const [retryingEmail, setRetryingEmail] = useState(false);
    const [retryingSpreadsheet, setRetryingSpreadsheet] = useState(false);

    // Prescription length state
    const [prescriptionLengthMode, setPrescriptionLengthMode] = useState<'months' | 'custom'>('months');
    const [prescriptionMonths, setPrescriptionMonths] = useState(6);
    const [customDays, setCustomDays] = useState('');

    // Pre-populate notes when order changes
    useEffect(() => {
        if (order?.doctorNotes) {
            setNotes(order.doctorNotes);
        } else {
            setNotes('');
        }
    }, [order?.id]);

    // Fetch pharmacy coverage when order changes
    useEffect(() => {
        if (order?.id && isOpen) {
            fetchPharmacyCoverage();
        }
    }, [order?.id, isOpen]);

    const fetchPharmacyCoverage = async () => {
        if (!order?.id) return;

        setLoadingCoverage(true);
        setCoverageError(null);

        try {
            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/doctor/orders/${order.id}/pharmacy-coverage`);
            const data = await response.json();

            if (data.success && data.hasCoverage && data.data.coverages) {
                setPharmacyCoverages(data.data.coverages);
            } else {
                setCoverageError(data.error || 'No pharmacy coverage found');
                setPharmacyCoverages([]);
            }
        } catch (error) {
            console.error('Failed to fetch pharmacy coverage:', error);
            setCoverageError('Failed to check pharmacy coverage');
            setPharmacyCoverages([]);
        } finally {
            setLoadingCoverage(false);
        }
    };

    if (!isOpen || !order) return null;

    const handleSaveNotes = async () => {
        setSubmittingNotes(true);
        try {
            await apiClient.addOrderNotes(order.id, notes);
            toast.success('Notes saved successfully');
            onNotesAdded?.();
        } catch (error) {
            toast.error('Failed to save notes');
        } finally {
            setSubmittingNotes(false);
        }
    };

    const handleApprove = async () => {
        // Calculate prescription length in days
        let prescriptionDays: number;
        if (prescriptionLengthMode === 'custom' && customDays) {
            prescriptionDays = parseInt(customDays, 10);
            if (isNaN(prescriptionDays) || prescriptionDays < 1) {
                toast.error('Please enter a valid number of days');
                return;
            }
        } else {
            // Convert months to days (approximate: 30 days per month)
            prescriptionDays = prescriptionMonths * 30;
        }

        setApproving(true);
        try {
            await apiClient.bulkApproveOrders([order.id], prescriptionDays);
            toast.success(`Order ${order.orderNumber} approved successfully`);
            onApprove?.(order.id);
            onClose();
        } catch (error) {
            toast.error('Failed to approve order');
        } finally {
            setApproving(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!confirm(`Are you sure you want to cancel order ${order.orderNumber}? This action cannot be undone.`)) {
            return;
        }

        setCancelling(true);
        try {
            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/doctor/orders/${order.id}/cancel`, {
                method: 'POST',
            });
            const data = await response.json();

            if (data.success) {
                toast.success(`Order ${order.orderNumber} cancelled successfully`);
                onCancel?.(order.id);
                onClose();
            } else {
                toast.error(data.message || 'Failed to cancel order');
            }
        } catch (error) {
            toast.error('Failed to cancel order');
        } finally {
            setCancelling(false);
        }
    };

    const handleRetryEmail = async () => {
        setRetryingEmail(true);
        try {
            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/doctor/orders/${order.id}/retry-email`, {
                method: 'POST',
            });
            const data = await response.json();

            if (data.success) {
                toast.success('Email sent successfully!');
            } else {
                toast.error(data.message || 'Failed to send email');
            }
        } catch (error) {
            toast.error('Failed to send email');
        } finally {
            setRetryingEmail(false);
        }
    };

    const handleRetrySpreadsheet = async () => {
        setRetryingSpreadsheet(true);
        try {
            const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/doctor/orders/${order.id}/retry-spreadsheet`, {
                method: 'POST',
            });
            const data = await response.json();

            if (data.success) {
                toast.success('Spreadsheet updated successfully!');
            } else {
                toast.error(data.message || 'Failed to update spreadsheet');
            }
        } catch (error) {
            toast.error('Failed to update spreadsheet');
        } finally {
            setRetryingSpreadsheet(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Order Details</h2>
                        <p className="text-sm text-gray-600">Order #{order.orderNumber}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Patient Information */}
                    <section>
                        <h3 className="text-lg font-semibold mb-3">Patient Information</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-600">Name</p>
                                <p className="font-medium">
                                    {order.patient?.firstName} {order.patient?.lastName}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Email</p>
                                <p className="font-medium">{order.patient?.email}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Phone</p>
                                <p className="font-medium">
                                    {order.patient?.phoneNumber || (
                                        <span className="text-red-600 text-xs">
                                            Missing - need to provide this for Pharmacy request to work
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Date of Birth</p>
                                <p className="font-medium">
                                    {order.patient?.dateOfBirth ? (
                                        new Date(order.patient.dateOfBirth).toLocaleDateString()
                                    ) : (
                                        <span className="text-red-600 text-xs">
                                            Missing - need to provide this for Pharmacy request to work
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Gender</p>
                                <p className="font-medium">
                                    {order.patient?.gender ? (
                                        order.patient.gender.charAt(0).toUpperCase() + order.patient.gender.slice(1)
                                    ) : (
                                        <span className="text-red-600 text-xs">
                                            Missing - need to provide this for Pharmacy request to work
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-gray-600">Patient Shipping Address</p>
                                <p className="font-medium">
                                    {order.shippingAddress?.address && order.shippingAddress?.city && order.shippingAddress?.state && order.shippingAddress?.zipCode ? (
                                        <>
                                            {order.shippingAddress.address}
                                            {order.shippingAddress.apartment && `, ${order.shippingAddress.apartment}`}<br />
                                            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                        </>
                                    ) : (
                                        <span className="text-red-600 text-xs">
                                            Missing - need to provide this for Pharmacy request to work
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Order Date</p>
                                <p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Order Total</p>
                                <p className="font-medium">${order.totalAmount}</p>
                            </div>
                            {order.shippingAddress && (
                                <div className="col-span-2">
                                    <p className="text-sm text-gray-600">Shipping Address</p>
                                    <p className="font-medium">
                                        {order.shippingAddress.street}<br />
                                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Pharmacy Coverage */}
                    <section>
                        <h3 className="text-lg font-semibold mb-3">
                            Pharmacy Coverage
                            {order.program && <span className="ml-2 text-sm font-normal text-purple-600">(Program Order)</span>}
                        </h3>
                        {loadingCoverage ? (
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                <p className="text-blue-800">Checking pharmacy coverage...</p>
                            </div>
                        ) : coverageError ? (
                            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                                <p className="text-red-800 font-semibold mb-2">⚠️ No Pharmacy Coverage</p>
                                <p className="text-red-700 text-sm">{coverageError}</p>
                                <p className="text-red-600 text-xs mt-2">
                                    Please ensure {order.program ? 'all products in this program have' : 'the product has'} pharmacy coverage configured for the patient's state before approving this order.
                                </p>
                            </div>
                        ) : pharmacyCoverages.length > 0 ? (
                            <div className="space-y-4">
                                {pharmacyCoverages.map((pharmacyCoverage, index) => (
                                    <div key={index} className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                                <p className="text-green-800 font-semibold">
                                                    Coverage Available {pharmacyCoverages.length > 1 ? `(${index + 1}/${pharmacyCoverages.length})` : ''}
                                                </p>
                                            </div>
                                            {/* Show which product this coverage is for (useful for programs) */}
                                            {pharmacyCoverage.productName && (
                                                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                                                    {pharmacyCoverage.productName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            {pharmacyCoverage.coverage.customName && (
                                                <div>
                                                    <span className="text-gray-600">Product Name:</span>{' '}
                                                    <span className="font-semibold text-gray-900">{pharmacyCoverage.coverage.customName}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-600">Pharmacy:</span>{' '}
                                                <span className="font-medium text-gray-900">{pharmacyCoverage.pharmacy.name}</span>
                                            </div>
                                            {pharmacyCoverage.coverage.pharmacyProductName && (
                                                <div>
                                                    <span className="text-gray-600">Pharmacy Product:</span>{' '}
                                                    <span className="font-medium text-gray-900">{pharmacyCoverage.coverage.pharmacyProductName}</span>
                                                </div>
                                            )}
                                            {pharmacyCoverage.coverage.pharmacyProductId && (
                                                <div>
                                                    <span className="text-gray-600">SKU:</span>{' '}
                                                    <span className="font-mono text-sm text-gray-900">{pharmacyCoverage.coverage.pharmacyProductId}</span>
                                                </div>
                                            )}
                                            {pharmacyCoverage.coverage.sig && (
                                                <div>
                                                    <span className="text-gray-600">SIG:</span>{' '}
                                                    <span className="font-medium text-gray-900 italic">{pharmacyCoverage.coverage.sig}</span>
                                                </div>
                                            )}
                                            {pharmacyCoverage.coverage.form && (
                                                <div>
                                                    <span className="text-gray-600">Medication Form:</span>{' '}
                                                    <span className="font-medium text-gray-900">{pharmacyCoverage.coverage.form}</span>
                                                </div>
                                            )}
                                            {pharmacyCoverage.coverage.rxId && (
                                                <div>
                                                    <span className="text-gray-600">RX ID:</span>{' '}
                                                    <span className="font-mono text-sm text-gray-900">{pharmacyCoverage.coverage.rxId}</span>
                                                </div>
                                            )}
                                            {pharmacyCoverage.coverage.pharmacyWholesaleCost && (
                                                <div>
                                                    <span className="text-gray-600">Wholesale Cost:</span>{' '}
                                                    <span className="font-medium text-gray-900">${pharmacyCoverage.coverage.pharmacyWholesaleCost}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    {/* Program Information (for program-based orders) */}
                    {order.program && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                <span className="inline-flex items-center gap-2">
                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Program Order</span>
                                    {order.program.name}
                                </span>
                            </h3>
                            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                                {order.program.description && (
                                    <p className="text-sm text-gray-700 mb-4">{order.program.description}</p>
                                )}

                                {/* Order Items (Products in Program) */}
                                {order.orderItems && order.orderItems.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="font-medium text-gray-900 mb-2">Products in Order</h4>
                                        <div className="space-y-2">
                                            {order.orderItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-purple-100">
                                                    <div className="flex items-center gap-3">
                                                        {item.product?.imageUrl && (
                                                            <img
                                                                src={item.product.imageUrl}
                                                                alt={item.product?.name || 'Product'}
                                                                className="w-10 h-10 rounded object-cover"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {item.product?.name || 'Product'}
                                                            </p>
                                                            {item.placeholderSig && (
                                                                <p className="text-xs text-gray-600">SIG: {item.placeholderSig}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-medium text-gray-900">${Number(item.unitPrice).toFixed(2)}</p>
                                                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Non-Medical Services */}
                                {(order.program.hasPatientPortal || order.program.hasBmiCalculator ||
                                    order.program.hasProteinIntakeCalculator || order.program.hasCalorieDeficitCalculator ||
                                    order.program.hasEasyShopping) && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-2">Non-Medical Services Included</h4>
                                            <div className="space-y-1 text-sm">
                                                {order.program.hasPatientPortal && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-700">✓ Patient Portal</span>
                                                        <span className="font-medium">${Number(order.program.patientPortalPrice || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {order.program.hasBmiCalculator && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-700">✓ BMI Calculator</span>
                                                        <span className="font-medium">${Number(order.program.bmiCalculatorPrice || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {order.program.hasProteinIntakeCalculator && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-700">✓ Protein Intake Calculator</span>
                                                        <span className="font-medium">${Number(order.program.proteinIntakeCalculatorPrice || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {order.program.hasCalorieDeficitCalculator && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-700">✓ Calorie Deficit Calculator</span>
                                                        <span className="font-medium">${Number(order.program.calorieDeficitCalculatorPrice || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {order.program.hasEasyShopping && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-700">✓ Easy Shopping</span>
                                                        <span className="font-medium">${Number(order.program.easyShoppingPrice || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </section>
                    )}

                    {/* Treatment Information */}
                    {order.treatment && !order.program && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">Treatment Information</h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="font-medium text-lg">{order.treatment.name}</p>
                                {order.treatment.description && (
                                    <p className="text-sm text-gray-600 mt-2">{order.treatment.description}</p>
                                )}
                                {order.treatment.isCompound && (
                                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                        Compound Medication
                                    </span>
                                )}
                            </div>
                        </section>
                    )}

                    {/* MD Prescriptions */}
                    {order.mdPrescriptions && order.mdPrescriptions.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">Prescriptions (MD Integrations)</h3>
                            <div className="space-y-2">
                                {order.mdPrescriptions.map((rx: any, idx: number) => (
                                    <div key={idx} className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                        <p className="font-medium">{rx.title || rx.name}</p>
                                        {rx.directions && (
                                            <p className="text-sm text-gray-700 mt-1">Directions: {rx.directions}</p>
                                        )}
                                        <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                                            {rx.quantity && <span>Qty: {rx.quantity}</span>}
                                            {rx.refills !== undefined && <span>Refills: {rx.refills}</span>}
                                            {rx.days_supply && <span>Days: {rx.days_supply}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* MD Offerings */}
                    {order.mdOfferings && order.mdOfferings.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">Services/Offerings (MD Integrations)</h3>
                            <div className="space-y-2">
                                {order.mdOfferings.map((offering: any, idx: number) => (
                                    <div key={idx} className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                        <p className="font-medium">{offering.title || offering.name}</p>
                                        {offering.directions && (
                                            <p className="text-sm text-gray-700 mt-1">{offering.directions}</p>
                                        )}
                                        {offering.status && (
                                            <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                {offering.status}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Questionnaire Answers */}
                    {(() => {
                        // Parse questionnaire answers and filter for "normal" category only
                        if (!order.questionnaireAnswers) return null;

                        const qa = order.questionnaireAnswers;
                        let normalAnswers: any[] = [];

                        // Try multiple possible formats
                        let allAnswers: any[] = [];

                        // Format 1: Direct answers array
                        if (qa.answers && Array.isArray(qa.answers)) {
                            allAnswers = qa.answers;
                        }
                        // Format 2: Wrapped with format property
                        else if (qa.format === 'structured' && qa.answers && Array.isArray(qa.answers)) {
                            allAnswers = qa.answers;
                        }
                        // Format 3: Legacy format (key-value pairs) - skip as no category info available
                        else if (typeof qa === 'object' && !qa.answers && !qa.format) {
                            return null;
                        }

                        // Filter for only "normal" category questions
                        normalAnswers = allAnswers.filter((answer: any) => answer.stepCategory === 'normal');

                        // If no normal answers found, don't show this section
                        if (normalAnswers.length === 0) {
                            return null;
                        }

                        return (
                            <section>
                                <h3 className="text-lg font-semibold mb-3">Questionnaire Answers</h3>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                    {normalAnswers.map((answer: any, index: number) => (
                                        <div key={index} className="bg-white border border-gray-200 p-3 rounded-md">
                                            <p className="text-sm font-medium text-gray-900">{answer.questionText}</p>
                                            <p className="text-sm text-gray-700 mt-1">
                                                {answer.selectedOptions && answer.selectedOptions.length > 0 ? (
                                                    answer.selectedOptions.map((opt: any) => opt.optionText).join(', ')
                                                ) : (
                                                    String(answer.answer)
                                                )}
                                            </p>
                                            <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                Product Question
                                            </span>
                                        </div>
                                    ))}
                                    {qa.metadata && (
                                        <div className="text-xs text-gray-500 mt-2">
                                            Completed: {new Date(qa.metadata.completedAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })()}

                    {/* Prescription Length */}
                    <section>
                        <h3 className="text-lg font-semibold mb-3">Prescription Length</h3>
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                            {/* Mode Toggle */}
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="prescriptionMode"
                                        checked={prescriptionLengthMode === 'months'}
                                        onChange={() => setPrescriptionLengthMode('months')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-medium">Use months slider</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="prescriptionMode"
                                        checked={prescriptionLengthMode === 'custom'}
                                        onChange={() => setPrescriptionLengthMode('custom')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm font-medium">Custom days</span>
                                </label>
                            </div>

                            {/* Months Slider */}
                            {prescriptionLengthMode === 'months' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Duration:</span>
                                        <span className="text-lg font-bold text-blue-700">
                                            {prescriptionMonths} {prescriptionMonths === 1 ? 'month' : 'months'}
                                            <span className="text-sm font-normal text-gray-500 ml-2">
                                                (~{prescriptionMonths * 30} days)
                                            </span>
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="12"
                                        value={prescriptionMonths}
                                        onChange={(e) => setPrescriptionMonths(parseInt(e.target.value, 10))}
                                        className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>1 month</span>
                                        <span>6 months</span>
                                        <span>12 months</span>
                                    </div>
                                </div>
                            )}

                            {/* Custom Days Input */}
                            {prescriptionLengthMode === 'custom' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-600">Enter number of days:</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={customDays}
                                            onChange={(e) => setCustomDays(e.target.value)}
                                            placeholder="e.g., 90"
                                            className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <span className="text-sm text-gray-600">days</span>
                                    </div>
                                    {customDays && parseInt(customDays, 10) > 0 && (
                                        <p className="text-sm text-blue-700">
                                            ≈ {(parseInt(customDays, 10) / 30).toFixed(1)} months
                                        </p>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                                This determines how long the prescription is valid. Refills will be processed automatically until the prescription expires.
                            </p>
                        </div>
                    </section>

                    {/* Doctor Notes */}
                    <section>
                        <h3 className="text-lg font-semibold mb-3">Doctor Notes</h3>
                        <textarea
                            className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px]"
                            placeholder="Enter notes about this order..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <button
                            onClick={handleSaveNotes}
                            disabled={submittingNotes}
                            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submittingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                    </section>

                    {/* Auto Approval Info */}
                    {order.autoApprovedByDoctor && (
                        <section>
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                                <p className="font-medium text-yellow-900">Auto-Approved</p>
                                {order.autoApprovalReason && (
                                    <p className="text-sm text-yellow-800 mt-1">{order.autoApprovalReason}</p>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                    <div className="flex justify-between items-center">
                        {/* Left side - Retry buttons (only for IronSail) */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleRetryEmail}
                                disabled={retryingEmail || pharmacyCoverages.length === 0 || !pharmacyCoverages.some(c => c.pharmacy?.slug === 'ironsail')}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!pharmacyCoverages.some(c => c.pharmacy?.slug === 'ironsail') ? 'Only available for IronSail orders' : 'Retry sending email to pharmacy'}
                            >
                                {retryingEmail ? 'Sending...' : '📧 Retry Email'}
                            </button>
                            <button
                                onClick={handleRetrySpreadsheet}
                                disabled={retryingSpreadsheet || pharmacyCoverages.length === 0 || !pharmacyCoverages.some(c => c.pharmacy?.slug === 'ironsail')}
                                className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!pharmacyCoverages.some(c => c.pharmacy?.slug === 'ironsail') ? 'Only available for IronSail orders' : 'Retry adding order to spreadsheet'}
                            >
                                {retryingSpreadsheet ? 'Adding...' : '📊 Retry Spreadsheet'}
                            </button>
                        </div>

                        {/* Right side - Main action buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border rounded-md hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={cancelling || approving}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelling ? 'Cancelling...' : 'Cancel Order'}
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={approving || cancelling || loadingCoverage || !!coverageError || pharmacyCoverages.length === 0}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={coverageError ? 'Cannot approve: ' + coverageError : ''}
                            >
                                {approving ? 'Approving...' : 'Approve Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

