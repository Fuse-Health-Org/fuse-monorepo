import React, { useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Input,
  Tabs,
  Tab,
  Divider,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall, ApiResponse } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { getClinicSlugFromDomain } from "../hooks/useClinicFromDomain";
import { QuestionnaireModal } from "./QuestionnaireModal";
import { OrderTrackingCard } from "./OrderTrackingCard";

interface Treatment {
  id: string;
  name: string;
  treatmentLogo?: string;
  subtitle?: string;
  placeholderSig?: string;
  refills?: number;
  status?: "paused" | "active" | "cancelled";
  expiryDate?: string;
  image?: string;
  doctor?: {
    name: string;
    specialty: string;
    avatar: string;
  };
  instructions?: string;
  nextRefillDate?: string;
}

export const TreatmentsPage: React.FC = () => {
  const [treatments, setTreatments] = React.useState<Treatment[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(true);
  const [editingTreatment, setEditingTreatment] = React.useState<Treatment | null>(null);
  const [treatmentName, setTreatmentName] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [savingTreatment, setSavingTreatment] = React.useState(false);
  const [selectedTreatmentForQuestionnaire, setSelectedTreatmentForQuestionnaire] = React.useState<Treatment | null>(null);
  const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(new Set());
  const [expandedTreatments, setExpandedTreatments] = React.useState<Set<string>>(new Set());
  const { user } = useAuth();

  // Modal controls
  const { isOpen: isAddModalOpen, onOpen: onAddModalOpen, onOpenChange: onAddModalOpenChange } = useDisclosure();
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onOpenChange: onEditModalOpenChange } = useDisclosure();
  const { isOpen: isQuestionnaireModalOpen, onOpen: onQuestionnaireModalOpen, onOpenChange: onQuestionnaireModalOpenChange } = useDisclosure();

  useEffect(() => {
    setIsLoading(false);
  }, [treatments]);

  // Function to get clinic slug from subdomain

  // Load treatments for clinic
  // React.useEffect(() => {
  //   const initialLoadTreatments = async () => {
  //     if (!user) {
  //       setIsLoading(false);
  //       return;
  //     }

  //     setIsLoading(true);
  //     await loadTreatments();
  //     setIsLoading(false);
  //   };

  //   initialLoadTreatments();
  // }, [user]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTab, setSelectedTab] = React.useState("all");

  // Handle opening edit modal
  const handleEditTreatment = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setTreatmentName(treatment.name);
    setSelectedFile(null);
    onEditModalOpen();
  };

  const fetchTreatments = async () => {
    if (!user) return;

    const response = await apiCall('/getTreatments');

    if (response.success && response.data?.data) {
      setTreatments(response.data.data);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;

    setIsLoadingOrders(true);
    try {
      const response = await apiCall('/orders');

      console.log('📦 Orders API Response:', response);

      if (response.success && response.data) {
        // The API returns { success: true, data: { success: true, data: [...orders] } }
        // So we need to access response.data.data
        const ordersData = response.data.data || response.data;
        console.log('📦 Orders array:', ordersData);
        console.log('📦 Number of orders:', ordersData.length);
        setOrders(ordersData);
      } else {
        console.warn('⚠️ Failed to fetch orders:', response);
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  React.useEffect(() => {
    fetchTreatments();
    fetchOrders();
  }, [user]);
  // Handle opening add modal
  const handleAddTreatment = () => {
    setEditingTreatment(null);
    setTreatmentName("");
    setSelectedFile(null);
    onAddModalOpen();
  };

  // Handle opening questionnaire modal
  const handleOpenQuestionnaire = (treatment: Treatment) => {
    setSelectedTreatmentForQuestionnaire(treatment);
    onQuestionnaireModalOpen();
  };

  // Handle closing questionnaire modal
  const handleCloseQuestionnaire = () => {
    setSelectedTreatmentForQuestionnaire(null);
    onQuestionnaireModalOpenChange();
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload logo to treatment
  const uploadTreatmentLogo = async (treatmentId: string): Promise<string | null> => {
    if (!selectedFile) return null;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', selectedFile);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/treatment/${treatmentId}/upload-logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        return result.data.treatmentLogo;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save new treatment
  const handleSaveNewTreatment = async () => {
    if (!treatmentName.trim()) {
      alert('Please enter a treatment name');
      return;
    }

    setSavingTreatment(true);
    try {
      // Create treatment first
      const result = await apiCall('/treatments', {
        method: 'POST',
        body: JSON.stringify({ name: treatmentName }),
      });

      if (result.success) {
        const newTreatment = result.data;

        // Upload logo if one was selected
        if (selectedFile) {
          const logoUrl = await uploadTreatmentLogo(newTreatment.id);
          console.log('📷 Logo upload result:', logoUrl);
          if (logoUrl) {
            newTreatment.treatmentLogo = logoUrl;
            console.log('📷 Updated treatment object:', newTreatment);
          }
        }

        // Add the new treatment to the local state immediately
        setTreatments(prevTreatments => [...prevTreatments, newTreatment]);

        // Close modal and reset form
        onAddModalOpenChange();
        setTreatmentName("");
        setSelectedFile(null);

        alert('Treatment created successfully!');
      } else {
        throw new Error(result.error || 'Failed to create treatment');
      }
    } catch (error) {
      console.error('Error creating treatment:', error);
      alert('Failed to create treatment');
    } finally {
      setSavingTreatment(false);
    }
  };

  // Save edited treatment
  const handleSaveEditedTreatment = async () => {
    if (!editingTreatment || !treatmentName.trim()) {
      alert('Please enter a treatment name');
      return;
    }

    setSavingTreatment(true);
    try {
      // Update treatment name
      const result = await apiCall(`/treatments/${editingTreatment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: treatmentName }),
      });

      if (result.success) {
        let logoUrl = editingTreatment.treatmentLogo;

        // Upload logo if one was selected
        if (selectedFile) {
          const newLogoUrl = await uploadTreatmentLogo(editingTreatment.id);
          console.log('📷 Edit logo upload result:', newLogoUrl);
          if (newLogoUrl) {
            logoUrl = newLogoUrl;
            console.log('📷 Updated logo URL:', logoUrl);
          }
        }

        // Update the treatment in local state immediately
        setTreatments(prevTreatments =>
          prevTreatments.map(treatment =>
            treatment.id === editingTreatment.id
              ? { ...treatment, name: treatmentName.trim(), treatmentLogo: logoUrl }
              : treatment
          )
        );

        // Close modal and reset form
        onEditModalOpenChange();
        setEditingTreatment(null);
        setTreatmentName("");
        setSelectedFile(null);

        alert('Treatment updated successfully!');
      } else {
        throw new Error(result.error || 'Failed to update treatment');
      }
    } catch (error) {
      console.error('Error updating treatment:', error);
      alert('Failed to update treatment');
    } finally {
      setSavingTreatment(false);
    }
  };

  // Extract loadTreatments function for reuse
  // const loadTreatments = async () => {
  //   if (!user) return;

  //   try {
  //     let result: ApiResponse<any> | undefined;

  //     // If user is a doctor with a clinicId, fetch by clinic ID
  //     if (user.role === 'doctor' && user.clinicId) {
  //       result = await apiCall(`/treatments/by-clinic-id/${user.clinicId}`);
  //     } else {
  //       // Otherwise, try to get by clinic slug from subdomain
  //       const clinicSlug = getClinicSlugFromDomain();
  //       if (clinicSlug) {
  //         result = await apiCall(`/treatments/by-clinic-slug/${clinicSlug}`);
  //       }
  //     }

  //     if (result && result.success && result.data) {
  //       setTreatments(result.data.data || result.data || []);
  //     }
  //   } catch (error) {
  //     console.error('Error loading treatments:', error);
  //   }
  // };

  const filteredTreatments = React.useMemo(() => {
    return treatments
      .filter(treatment => {
        // Filter by search query
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          treatment.name.toLowerCase().includes(query) ||
          (treatment.subtitle && treatment.subtitle.toLowerCase().includes(query));

        // Get treatment status
        let treatmentStatus = "active";
        if (typeof treatment.status === "string") {
          treatmentStatus = treatment.status;
        }

        // Filter by tab
        const matchesTab =
          selectedTab === "all" ||
          treatmentStatus === selectedTab;

        return matchesSearch && matchesTab;
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
  }, [treatments, searchQuery, selectedTab]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "paused":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "paused":
        return "Paused";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  // Helper to get treatment status from active field or status field
  const getTreatmentDisplayStatus = (treatment: Treatment): string => {
    if (treatment.status) {
      return treatment.status;
    }
    // If no status field, use active boolean
    return treatment.status || "active";
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold">Treatments & Orders</h1>
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN - Active Orders */}
        {user?.role !== 'doctor' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">Active Orders</h2>
            {isLoadingOrders ? (
              <Card className="border border-content3">
                <CardBody className="p-8 text-center">
                  <div className="flex justify-center mb-3">
                    <Icon icon="lucide:loader-2" className="text-3xl text-primary animate-spin" />
                  </div>
                  <p className="text-foreground-500">Loading your orders...</p>
                </CardBody>
              </Card>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
              {orders
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((order) => {
                  // Status configuration with distinctive colors
                  const orderStatusConfig: Record<string, any> = {
                    pending: { color: "warning", icon: "lucide:clock", label: "Pending", borderClass: "border-l-warning" },
                    paid: { color: "primary", icon: "lucide:check-circle", label: "Payment Captured", borderClass: "border-l-primary" },
                    created: { color: "primary", icon: "lucide:file-text", label: "Order Created", borderClass: "border-l-primary" },
                    assigned: { color: "secondary", icon: "lucide:user-check", label: "Assigned", borderClass: "border-l-secondary" },
                    approved: { color: "secondary", icon: "lucide:clipboard-check", label: "Approved", borderClass: "border-l-secondary" },
                    processing: { color: "primary", icon: "lucide:package", label: "Processing", borderClass: "border-l-primary" },
                    waiting: { color: "warning", icon: "lucide:pause-circle", label: "Waiting", borderClass: "border-l-warning" },
                    filled: { color: "primary", icon: "lucide:package-check", label: "Filled", borderClass: "border-l-primary" },
                    shipped: { color: "success", icon: "lucide:truck", label: "Shipped", borderClass: "border-l-success" },
                    delivered: { color: "success", icon: "lucide:home", label: "Delivered", borderClass: "border-l-success" },
                    completed: { color: "success", icon: "lucide:check-circle-2", label: "Completed", borderClass: "border-l-success" },
                    cancelled: { color: "danger", icon: "lucide:x-circle", label: "Cancelled", borderClass: "border-l-danger" },
                    rejected: { color: "danger", icon: "lucide:ban", label: "Rejected", borderClass: "border-l-danger" },
                    problem: { color: "danger", icon: "lucide:alert-triangle", label: "Issue", borderClass: "border-l-danger" }
                  };

                  const shippingOrder = order.shippingOrders?.[0];
                  const currentStatus = shippingOrder?.status?.toLowerCase() || order.status?.toLowerCase() || 'pending';
                  const statusInfo = orderStatusConfig[currentStatus] || orderStatusConfig.pending;

                  // Get progress percentage based on status
                  const getProgress = () => {
                    const statusOrder = ['pending', 'paid', 'created', 'assigned', 'approved', 'processing', 'filled', 'shipped', 'delivered', 'completed'];
                    const currentIndex = statusOrder.indexOf(currentStatus);
                    if (currentIndex === -1) return 0;
                    return ((currentIndex + 1) / statusOrder.length) * 100;
                  };

                  const progress = getProgress();
                  
                  // Get border color class from config
                  const borderColorClass = statusInfo.borderClass || 'border-l-primary';

                  const formatDate = (dateString: string) => {
                    return new Date(dateString).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                  };

                  const isExpanded = expandedOrders.has(order.id);

                  const toggleExpanded = () => {
                    const newExpanded = new Set(expandedOrders);
                    if (isExpanded) {
                      newExpanded.delete(order.id);
                    } else {
                      newExpanded.add(order.id);
                    }
                    setExpandedOrders(newExpanded);
                  };

                  return (
                    <Card
                      key={order.id}
                      className={`w-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 ${borderColorClass} group`}
                      isPressable
                      onPress={toggleExpanded}
                    >
                      <CardBody className="p-4">
                        {/* Header - Always visible */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base text-foreground">{order.orderNumber}</h3>
                            <p className="text-xs text-foreground-500">Ordered {formatDate(order.createdAt)}</p>
                            <p className="text-sm font-semibold text-foreground mt-1">
                              ${typeof order.totalAmount === 'number'
                                ? order.totalAmount.toFixed(2)
                                : parseFloat(order.totalAmount || '0').toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip color={statusInfo.color as any} size="sm" variant="flat" className="text-xs">
                              <div className="flex items-center gap-1">
                                <Icon icon={statusInfo.icon} width={14} />
                                <span>{statusInfo.label}</span>
                              </div>
                            </Chip>
                            <Icon 
                              icon="lucide:chevron-down" 
                              className={`text-foreground-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                              width={20}
                            />
                          </div>
                        </div>

                        {/* Progress Bar - Always visible */}
                        {!['cancelled', 'rejected', 'problem'].includes(currentStatus) && (
                          <div className="w-full mb-3">
                            <div className="h-1.5 bg-content2 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full ${
                                  statusInfo.color === 'success' ? 'bg-success' :
                                  statusInfo.color === 'warning' ? 'bg-warning' :
                                  statusInfo.color === 'danger' ? 'bg-danger' :
                                  statusInfo.color === 'secondary' ? 'bg-secondary' :
                                  'bg-primary'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action Button - Always visible when collapsed */}
                        {!isExpanded && (
                          <Link href={`/fuse-dashboard/offerings/${order.id}`} className="block">
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              className="w-full"
                              startContent={<Icon icon="lucide:eye" width={14} />}
                            >
                              View Details
                            </Button>
                          </Link>
                        )}

                        {/* Expandable content */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Divider className="my-3" />

                            {/* Products/Items */}
                            <div className="mb-3">
                          <h4 className="text-xs font-semibold mb-2 text-foreground-500">Items</h4>
                          <div className="space-y-2">
                            {order.orderItems && order.orderItems.length > 0 ? (
                              order.orderItems.map((item: any, index: number) => (
                                <div key={index} className="space-y-1.5">
                                  <div className="flex justify-between items-start text-xs">
                                    <div className="flex-1">
                                      <p className="font-medium text-foreground">{item.product?.name || 'Product'}</p>
                                      {item.product?.placeholderSig && !item.product?.pharmacyCoverages?.length && (
                                        <p className="text-xs text-foreground-400 mt-0.5">{item.product.placeholderSig}</p>
                                      )}
                                    </div>
                                    <p className="text-foreground-500 ml-2">Qty: {item.quantity}</p>
                                  </div>
                                  {/* Show pharmacy coverages if available */}
                                  {item.product?.pharmacyCoverages && item.product.pharmacyCoverages.length > 0 && (
                                    <div className="ml-3 space-y-1">
                                      {item.product.pharmacyCoverages.map((coverage: any) => (
                                        <div key={coverage.id} className="text-xs bg-blue-50 rounded p-2 border border-blue-100">
                                          <p className="font-semibold text-blue-900">
                                            • {coverage.customName || coverage.pharmacyProduct?.pharmacyProductName || 'Medication'}
                                          </p>
                                          {coverage.customSig && (
                                            <p className="text-[10px] text-blue-700 mt-0.5">
                                              <span className="font-medium">SIG:</span> {coverage.customSig}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-foreground">{order.tenantProduct?.product?.name || 'Order Item'}</p>
                            )}
                          </div>
                        </div>

                        {/* Tracking Information */}
                        {shippingOrder && (
                          <>
                            <Divider className="my-3" />
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-foreground-500">Tracking Details</h4>
                              <div className="space-y-1.5">
                                {shippingOrder.pharmacyOrderId && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Icon icon="lucide:package" className="text-foreground-400" width={12} />
                                    <span className="text-foreground-500">Pharmacy:</span>
                                    <span className="font-medium text-foreground">{shippingOrder.pharmacyOrderId}</span>
                                  </div>
                                )}
                                {shippingOrder.trackingNumber && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Icon icon="lucide:truck" className="text-foreground-400" width={12} />
                                    <span className="text-foreground-500">Tracking:</span>
                                    {shippingOrder.trackingUrl ? (
                                      <a
                                        href={shippingOrder.trackingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {shippingOrder.trackingNumber}
                                      </a>
                                    ) : (
                                      <span className="font-medium text-foreground font-mono">{shippingOrder.trackingNumber}</span>
                                    )}
                                  </div>
                                )}
                                {shippingOrder.shippedAt && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Icon icon="lucide:calendar" className="text-foreground-400" width={12} />
                                    <span className="text-foreground-500">Shipped:</span>
                                    <span className="font-medium text-foreground">{formatDate(shippingOrder.shippedAt)}</span>
                                  </div>
                                )}
                                {shippingOrder.deliveredAt && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Icon icon="lucide:calendar-check" className="text-foreground-400" width={12} />
                                    <span className="text-foreground-500">Delivered:</span>
                                    <span className="font-medium text-foreground">{formatDate(shippingOrder.deliveredAt)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Shipping Address */}
                        {order.shippingAddress && (
                          <>
                            <Divider className="my-3" />
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-foreground-500">Delivery Address</h4>
                              <div className="text-xs text-foreground-600 space-y-0.5">
                                <p>{order.shippingAddress.address}</p>
                                {order.shippingAddress.apartment && <p>{order.shippingAddress.apartment}</p>}
                                <p>
                                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                </p>
                              </div>
                            </div>
                          </>
                        )}

                            {/* Total Amount */}
                            <Divider className="my-3" />
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-foreground">Total Amount</span>
                              <span className="text-lg font-bold text-foreground">
                                ${typeof order.totalAmount === 'number'
                                  ? order.totalAmount.toFixed(2)
                                  : parseFloat(order.totalAmount || '0').toFixed(2)}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border border-content3">
                <CardBody className="p-8 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 rounded-full bg-content2">
                      <Icon icon="lucide:package-open" className="text-3xl text-foreground-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium mb-1">No Orders Yet</h3>
                  <p className="text-foreground-500">
                    When you order treatments, you'll see them here with tracking information
                  </p>
                </CardBody>
              </Card>
            )}
          </motion.div>
        )}

        {/* RIGHT COLUMN - Treatments */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-semibold">Treatments</h2>

          {/* Treatments List */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
                {isLoading ? (
                <div className="text-center py-8">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 rounded-full bg-content2">
                      <Icon icon="lucide:loader-2" className="text-3xl text-primary animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium">Loading treatments...</h3>
                  <p className="text-foreground-500">Please wait while we fetch your treatments</p>
                </div>
              ) : filteredTreatments.length > 0 ? (
                filteredTreatments.map((treatment) => {
                  const statusColor = getStatusColor(getTreatmentDisplayStatus(treatment));
                  const borderColorClass = statusColor === 'success' 
                    ? 'border-l-success' 
                    : statusColor === 'warning' 
                    ? 'border-l-warning' 
                    : statusColor === 'danger' 
                    ? 'border-l-danger' 
                    : 'border-l-primary';

                  const isExpanded = expandedTreatments.has(treatment.id);

                  const toggleExpanded = () => {
                    const newExpanded = new Set(expandedTreatments);
                    if (isExpanded) {
                      newExpanded.delete(treatment.id);
                    } else {
                      newExpanded.add(treatment.id);
                    }
                    setExpandedTreatments(newExpanded);
                  };

                  return (
                    <motion.div key={treatment.id} variants={item}>
                      <Card 
                        className={`w-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 ${borderColorClass} group`}
                        isPressable
                        onPress={toggleExpanded}
                      >
                        <CardBody className="p-4">
                          {/* Header - Always visible */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3 flex-1">
                              <div className="h-12 w-12 rounded-md overflow-hidden flex-shrink-0 bg-primary-100 flex items-center justify-center">
                                {treatment.treatmentLogo || treatment.image ? (
                                  <img
                                    src={treatment.treatmentLogo || treatment.image}
                                    alt={treatment.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Icon 
                                    icon="lucide:pill" 
                                    className="text-primary" 
                                    width={24}
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base text-foreground line-clamp-1">{treatment.name}</h3>
                                <p className="text-xs text-foreground-500 line-clamp-1">{treatment.subtitle || "Treatment"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Chip
                                color={statusColor as any}
                                variant="flat"
                                size="sm"
                              >
                                <div className="flex items-center gap-1">
                                  <span>{getStatusLabel(getTreatmentDisplayStatus(treatment))}</span>
                                </div>
                              </Chip>
                              <Icon 
                                icon="lucide:chevron-down" 
                                className={`text-foreground-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                                width={20}
                              />
                            </div>
                          </div>

                          {/* Expandable content */}
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Divider className="my-3" />

                              <div className="space-y-2">
                                <div className="flex items-start gap-2 text-xs text-foreground-500">
                                  <Icon icon="lucide:pill" width={14} className="mt-0.5 flex-shrink-0" />
                                  <span>{treatment.placeholderSig || "As prescribed"}</span>
                                </div>
                                
                                <div className="flex items-center gap-4 text-xs text-foreground-500">
                                  <div className="flex items-center gap-1">
                                    <Icon icon="lucide:repeat" width={12} />
                                    <span>{treatment.refills || 0} refills remaining</span>
                                  </div>
                                  {treatment.expiryDate && (
                                    <div className="flex items-center gap-1">
                                      <Icon icon="lucide:calendar" width={12} />
                                      <span>Expires: {treatment.expiryDate}</span>
                                    </div>
                                  )}
                                </div>

                                {treatment.nextRefillDate && (
                                  <div className="flex items-center gap-2 text-xs text-foreground-500">
                                    <Icon icon="lucide:calendar-clock" width={12} />
                                    <span>Next Refill: {treatment.nextRefillDate}</span>
                                  </div>
                                )}

                                {treatment.doctor && (
                                  <>
                                    <Divider className="my-2" />
                                    <div>
                                      <h4 className="text-xs font-semibold mb-2 text-foreground-500">Prescribing Doctor</h4>
                                      <div className="flex items-center gap-2">
                                        <Avatar 
                                          name={treatment.doctor.name}
                                          size="sm"
                                          className="h-6 w-6"
                                          fallback={<span className="text-xs">👨‍⚕️</span>}
                                        />
                                        <div className="text-xs">
                                          <p className="font-medium text-foreground">{treatment.doctor.name}</p>
                                          <p className="text-foreground-400">{treatment.doctor.specialty}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {treatment.instructions && (
                                  <>
                                    <Divider className="my-2" />
                                    <div>
                                      <h4 className="text-xs font-semibold mb-1 text-foreground-500">Instructions</h4>
                                      <p className="text-xs text-foreground-600">{treatment.instructions}</p>
                                    </div>
                                  </>
                                )}

                                <Divider className="my-3" />
                                <div className="flex gap-2">
                                  {user?.role === 'doctor' ? (
                                    <Button
                                      size="sm"
                                      color="primary"
                                      variant="flat"
                                      startContent={<Icon icon="lucide:edit" width={14} />}
                                      className="flex-1"
                                      onPress={() => {
                                        handleEditTreatment(treatment);
                                      }}
                                    >
                                      Edit Treatment
                                    </Button>
                                  ) : (
                                    getTreatmentDisplayStatus(treatment) === "active" && (
                                      <Button
                                        size="sm"
                                        color="primary"
                                        variant="flat"
                                        startContent={<Icon icon="lucide:refresh-cw" width={14} />}
                                        className="flex-1"
                                        onPress={() => {
                                          if (treatment.name.includes("NAD+") || treatment.name === "Weight Loss 2" || treatment.name.includes("Weight Loss")) {
                                            handleOpenQuestionnaire(treatment);
                                          } else {
                                            alert("Refill request submitted for " + treatment.name);
                                          }
                                        }}
                                      >
                                        Request Refill
                                      </Button>
                                    )
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </CardBody>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-8 p-4 rounded-md bg-white shadow-md">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 rounded-full bg-content2">
                      <Icon icon="lucide:search-x" className="text-3xl text-foreground-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium">No treatments found</h3>
                  <p className="text-foreground-500">
                    {searchQuery || selectedTab !== "all"
                      ? "Try adjusting your search or filters"
                      : "No treatments available for your clinic"}
                  </p>
                </div>
              )}
          </motion.div>
        </motion.div>
        
      </div>

      {/* Add Treatment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onOpenChange={onAddModalOpenChange}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Add New Treatment</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  label="Treatment Name"
                  placeholder="Enter treatment name"
                  value={treatmentName}
                  onValueChange={setTreatmentName}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Treatment Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {selectedFile && (
                    <p className="text-sm text-foreground-600">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSaveNewTreatment}
                  isLoading={savingTreatment || uploadingLogo}
                  isDisabled={!treatmentName.trim()}
                >
                  {uploadingLogo ? 'Uploading...' : savingTreatment ? 'Creating...' : 'Add Treatment'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Treatment Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onOpenChange={onEditModalOpenChange}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Edit Treatment</ModalHeader>
              <ModalBody>
                <Input
                  autoFocus
                  label="Treatment Name"
                  placeholder="Enter treatment name"
                  value={treatmentName}
                  onValueChange={setTreatmentName}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Treatment Logo</label>
                  {editingTreatment?.treatmentLogo && (
                    <div className="flex items-center gap-2">
                      <img
                        src={editingTreatment.treatmentLogo}
                        alt="Current logo"
                        className="w-16 h-16 rounded-md object-cover"
                      />
                      <span className="text-sm text-foreground-600">Current logo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {selectedFile && (
                    <p className="text-sm text-foreground-600">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSaveEditedTreatment}
                  isLoading={savingTreatment || uploadingLogo}
                  isDisabled={!treatmentName.trim()}
                >
                  {uploadingLogo ? 'Uploading...' : savingTreatment ? 'Saving...' : 'Save Changes'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Questionnaire Modal */}
      {selectedTreatmentForQuestionnaire && (
        <QuestionnaireModal
          isOpen={isQuestionnaireModalOpen}
          onClose={handleCloseQuestionnaire}
          treatmentId={selectedTreatmentForQuestionnaire.id}
          treatmentName={selectedTreatmentForQuestionnaire.name}
        />
      )}
    </div>
  );
};