import React from "react";
import { useRouter } from "next/router";
import { Card, CardBody, Button, Chip, Spinner, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import { Icon } from "@iconify/react";
import { fetchWithAuth, apiCall } from "../../lib/api";

interface SubscriptionInfo {
    id: string;
    stripeSubscriptionId: string;
    localStatus: string;
    stripeStatus: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
}

export default function OfferingDetailsPage() {
    const router = useRouter();
    const { caseId: orderId } = router.query as { caseId?: string }; // Using caseId param name for backward compatibility
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [order, setOrder] = React.useState<any>(null);
    const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = React.useState(false);
    const [cancelLoading, setCancelLoading] = React.useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();

    // Fetch order details
    React.useEffect(() => {
        if (!orderId) return;
        (async () => {
            try {
                setLoading(true);
                const res: any = await fetchWithAuth(`/orders/${orderId}`);
                const orderData = res?.data || null;
                setOrder(orderData);
                setError(null);
            } catch (e) {
                setError("Failed to load order details");
            } finally {
                setLoading(false);
            }
        })();
    }, [orderId]);

    // Fetch subscription status from Stripe
    React.useEffect(() => {
        if (!orderId || !order) return;
        (async () => {
            try {
                setSubscriptionLoading(true);
                const res: any = await fetchWithAuth(`/orders/${orderId}/subscription`);
                if (res?.data) {
                    setSubscription(res.data);
                }
            } catch (e) {
                // Silently fail - subscription info is optional
                console.error("Failed to fetch subscription status");
            } finally {
                setSubscriptionLoading(false);
            }
        })();
    }, [orderId, order]);

    // Handle cancel subscription
    const handleCancelSubscription = async () => {
        if (!orderId) return;
        try {
            setCancelLoading(true);
            const res = await apiCall(`/orders/${orderId}/subscription/cancel`, {
                method: "POST",
            });
            if (res.success) {
                // Refresh subscription status
                const subRes: any = await fetchWithAuth(`/orders/${orderId}/subscription`);
                if (subRes?.data) {
                    setSubscription(subRes.data);
                }
                onClose();
            } else {
                alert(res.error || "Failed to cancel subscription");
            }
        } catch (e) {
            alert("Failed to cancel subscription");
        } finally {
            setCancelLoading(false);
        }
    };

    // Get subscription status display info
    const getSubscriptionStatusInfo = (status: string) => {
        switch (status) {
            case "active":
                return { color: "success" as const, label: "Active" };
            case "canceled":
            case "cancelled":
                return { color: "danger" as const, label: "Cancelled" };
            case "past_due":
                return { color: "warning" as const, label: "Past Due" };
            case "unpaid":
                return { color: "danger" as const, label: "Unpaid" };
            case "trialing":
                return { color: "primary" as const, label: "Trial" };
            case "incomplete":
                return { color: "warning" as const, label: "Incomplete" };
            case "incomplete_expired":
                return { color: "danger" as const, label: "Expired" };
            case "paused":
                return { color: "warning" as const, label: "Paused" };
            case "deleted":
                return { color: "danger" as const, label: "Deleted" };
            default:
                return { color: "default" as const, label: status };
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="flat" startContent={<Icon icon="lucide:arrow-left" />} onPress={() => router.back()}>
                    Back
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">Order Details</h1>
                {order && <span className="text-xs text-foreground-400 font-mono">{order.orderNumber}</span>}
            </div>

            {loading ? (
                <Card><CardBody className="h-24 flex items-center justify-center"><Spinner label="Loading..." /></CardBody></Card>
            ) : error ? (
                <Card><CardBody className="text-danger">{error}</CardBody></Card>
            ) : !order ? (
                <Card className="border-dashed"><CardBody className="text-foreground-500">Order not found.</CardBody></Card>
            ) : (
                <div className="space-y-4">
                    {/* Order Information Card */}
                    <Card className="transition-shadow hover:shadow-md">
                        <CardBody>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <div className="font-medium text-foreground text-lg">Order Information</div>
                                    <div className="mt-1 text-sm text-foreground-500">Order #{order.orderNumber}</div>
                                </div>
                                <Chip size="sm" variant="flat" color={
                                    order.status === 'delivered' || order.status === 'paid' ? 'success' as any :
                                        order.status === 'cancelled' ? 'danger' as any :
                                            'warning' as any
                                }>
                                    {order.status}
                                </Chip>
                            </div>
                            <Divider className="my-3" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <div><span className="text-foreground-500">Status:</span> {order.status}</div>
                                    <div><span className="text-foreground-500">Total Amount:</span> ${order.totalAmount}</div>
                                    <div><span className="text-foreground-500">Created:</span> {new Date(order.createdAt).toLocaleString()}</div>
                                    {false && <div><span className="text-foreground-500">MD Case ID:</span> <span className="font-mono text-xs">{order.mdCaseId}</span></div>}
                                </div>
                                <div className="space-y-2">
                                    {order.shippingAddress && (
                                        <div>
                                            <span className="text-foreground-500">Shipping Address:</span>
                                            <div className="mt-1 text-foreground-600">
                                                {order.shippingAddress.street}<br />
                                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Subscription Card */}
                    {(subscription || subscriptionLoading) && (
                        <Card className="transition-shadow hover:shadow-md border-2 border-secondary-200">
                            <CardBody>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="lucide:repeat" className="text-secondary" width={20} />
                                    <div className="font-medium text-foreground text-lg">Subscription</div>
                                </div>
                                <Divider className="my-3" />
                                {subscriptionLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Spinner size="sm" label="Loading subscription info..." />
                                    </div>
                                ) : subscription ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-foreground-500">Status:</span>
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={getSubscriptionStatusInfo(subscription.stripeStatus).color}
                                            >
                                                {getSubscriptionStatusInfo(subscription.stripeStatus).label}
                                            </Chip>
                                        </div>
                                        
                                        {subscription.currentPeriodEnd && subscription.stripeStatus === "active" && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-foreground-500">Next Billing Date:</span>
                                                <span className="text-foreground-700">
                                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}

                                        {subscription.canceledAt && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-foreground-500">Cancelled At:</span>
                                                <span className="text-foreground-700">
                                                    {new Date(subscription.canceledAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}

                                        {subscription.cancelAtPeriodEnd && !subscription.canceledAt && (
                                            <div className="bg-warning-50 p-3 rounded-md text-sm text-warning-700">
                                                <Icon icon="lucide:alert-circle" className="inline mr-1" width={14} />
                                                Subscription will be cancelled at end of billing period
                                            </div>
                                        )}

                                        {/* Cancel Button - only show if subscription is active */}
                                        {subscription.stripeStatus === "active" && !subscription.cancelAtPeriodEnd && (
                                            <div className="pt-2">
                                                <Button
                                                    color="danger"
                                                    variant="flat"
                                                    size="sm"
                                                    startContent={<Icon icon="lucide:x-circle" width={16} />}
                                                    onPress={onOpen}
                                                >
                                                    Cancel Subscription
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </CardBody>
                        </Card>
                    )}

                    {/* Questionnaire Answers Card */}
                    {order.questionnaireAnswers && (
                        <Card className="transition-shadow hover:shadow-md">
                            <CardBody>
                                <div className="font-medium text-foreground text-lg mb-3">Questionnaire Answers</div>
                                <Divider className="my-3" />
                                <div className="space-y-3">
                                    {/* Check if structured format */}
                                    {order.questionnaireAnswers.answers && order.questionnaireAnswers.metadata ? (
                                        // Structured format
                                        order.questionnaireAnswers.answers.map((answer: any, index: number) => (
                                            <div key={index} className="bg-content2/40 p-3 rounded-md">
                                                <div className="font-medium text-sm text-foreground">{answer.questionText}</div>
                                                <div className="mt-1 text-sm text-foreground-600">
                                                    {answer.selectedOptions && answer.selectedOptions.length > 0 ? (
                                                        answer.selectedOptions.map((opt: any) => opt.optionText).join(', ')
                                                    ) : (
                                                        String(answer.answer)
                                                    )}
                                                </div>
                                                {answer.stepCategory && (
                                                    <div className="mt-1 text-xs text-foreground-400">
                                                        Category: {answer.stepCategory}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        // Legacy format
                                        Object.entries(order.questionnaireAnswers).map(([question, answer]) => (
                                            <div key={question} className="bg-content2/40 p-3 rounded-md">
                                                <div className="font-medium text-sm text-foreground">{question}</div>
                                                <div className="mt-1 text-sm text-foreground-600">{String(answer)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Doctor Notes Card */}
                    {order.doctorNotes && (
                        <Card className="transition-shadow hover:shadow-md border-2 border-primary-200">
                            <CardBody>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="lucide:stethoscope" className="text-primary" width={20} />
                                    <div className="font-medium text-foreground text-lg">Doctor's Notes</div>
                                </div>
                                <Divider className="my-3" />
                                <div className="bg-primary-50/50 p-4 rounded-md">
                                    <p className="text-sm text-foreground-700 whitespace-pre-wrap">{order.doctorNotes}</p>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Prescriptions Card */}
                    {order.prescriptions && order.prescriptions.length > 0 && (
                        <Card className="transition-shadow hover:shadow-md border-2 border-success-200">
                            <CardBody>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="lucide:pill" className="text-success" width={20} />
                                    <div className="font-medium text-foreground text-lg">Prescriptions</div>
                                </div>
                                <Divider className="my-3" />
                                <div className="space-y-4">
                                    {order.prescriptions.map((prescription: any, idx: number) => (
                                        <div key={prescription.id} className="bg-success-50/50 p-4 rounded-md space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-medium text-foreground">{prescription.name}</div>
                                                    {prescription.doctor && (
                                                        <div className="text-xs text-foreground-500 mt-1">
                                                            Prescribed by: Dr. {prescription.doctor.firstName} {prescription.doctor.lastName}
                                                        </div>
                                                    )}
                                                </div>
                                                <Chip size="sm" variant="flat" color="success">
                                                    Active
                                                </Chip>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <span className="text-foreground-500">Written:</span>{' '}
                                                    <span className="text-foreground-700">
                                                        {new Date(prescription.writtenAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-foreground-500">Expires:</span>{' '}
                                                    <span className="text-foreground-700">
                                                        {new Date(prescription.expiresAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {prescription.prescriptionProducts && prescription.prescriptionProducts.length > 0 && (
                                                <div className="mt-3">
                                                    <div className="text-xs font-medium text-foreground-500 mb-2">Medications:</div>
                                                    <div className="space-y-2">
                                                        {prescription.prescriptionProducts.map((pp: any, ppIdx: number) => (
                                                            <div key={ppIdx} className="bg-white/60 p-3 rounded border border-success-200">
                                                                <div className="flex items-center gap-2">
                                                                    <Icon icon="lucide:pill" className="text-success-600" width={16} />
                                                                    <span className="text-sm font-medium text-foreground">
                                                                        {pp.product?.name || 'Medication'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-foreground-500 mt-1">
                                                                    Quantity: {pp.quantity}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                </div>
            )}

            {/* Cancel Subscription Confirmation Modal */}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Icon icon="lucide:alert-triangle" className="text-danger" width={24} />
                            Cancel Subscription
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-foreground-600">
                            Are you sure you want to cancel this subscription? This action cannot be undone.
                        </p>
                        <p className="text-sm text-foreground-500 mt-2">
                            Your subscription will be cancelled immediately and you will no longer be billed.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={cancelLoading}>
                            Keep Subscription
                        </Button>
                        <Button
                            color="danger"
                            onPress={handleCancelSubscription}
                            isLoading={cancelLoading}
                            startContent={!cancelLoading && <Icon icon="lucide:x-circle" width={16} />}
                        >
                            Cancel Subscription
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
