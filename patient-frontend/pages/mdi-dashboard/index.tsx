import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarEmoji } from "../../lib/avatarUtils";
import { apiCall } from "../../lib/api";

/**
 * MDI Dashboard - MD Integrations Portal
 * 
 * This dashboard uses MD Integrations API for:
 * - Patient management (synced with DoseSpot)
 * - Case/prescription management
 * - Clinician messaging
 * - Prescription status tracking
 */

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
  { id: "cases", label: "My Cases", icon: "lucide:file-text" },
  { id: "messages", label: "Messages", icon: "lucide:message-circle" },
  { id: "account", label: "Account", icon: "lucide:user" },
];

function MDISidebar({ 
  activeTab, 
  setActiveTab,
  isMobile = false,
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  isMobile?: boolean;
}) {
  const { user, signOut } = useAuth();

  return (
    <div className={`
      flex flex-col h-full bg-content1 border-r border-content3
      ${isMobile ? 'w-64' : 'w-64'}
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-content3">
        <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
          <Icon icon="lucide:stethoscope" className="text-secondary" />
        </div>
        <div>
          <div className="font-semibold text-foreground">
            <span className="text-secondary">MDI</span> Portal
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${activeTab === item.id 
                ? 'bg-secondary/10 text-secondary' 
                : 'text-foreground-500 hover:bg-content2 hover:text-foreground'
              }
            `}
          >
            <Icon icon={item.icon} className="text-lg" />
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-content3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar
            name={user?.firstName || user?.email || 'User'}
            size="sm"
            fallback={
              <span className="text-lg">{getAvatarEmoji(user)}</span>
            }
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {user?.firstName || 'User'}
            </div>
            <div className="text-xs text-foreground-400 truncate">
              {user?.email}
            </div>
          </div>
        </div>
        <Button
          variant="light"
          color="danger"
          size="sm"
          className="w-full mt-2"
          startContent={<Icon icon="lucide:log-out" />}
          onPress={signOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function MDIDashboardContent({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { user } = useAuth();
  const [cases, setCases] = useState<MDCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await apiCall('/md/offerings');
        if (response.success && response.data?.data) {
          const mdiCases = (response.data.data as MDCase[]).filter((c: MDCase) => c.caseId);
          setCases(mdiCases);
        }
      } catch (err) {
        console.error('Error fetching cases:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const pendingCases = cases.filter(c => c.classification === 'pending');
  const approvedCases = cases.filter(c => c.classification === 'approved');
  const latestCase = cases[0];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">
        Welcome back, {user?.firstName || 'there'}!
      </h1>
      <p className="text-foreground-500 mb-8">
        Here's an overview of your prescription cases
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-content1">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Icon icon="lucide:file-text" className="text-xl text-secondary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{loading ? '-' : cases.length}</div>
                <div className="text-sm text-foreground-500">Total Cases</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Icon icon="lucide:clock" className="text-xl text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">{loading ? '-' : pendingCases.length}</div>
                <div className="text-sm text-foreground-500">Pending Review</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Icon icon="lucide:check-circle" className="text-xl text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">{loading ? '-' : approvedCases.length}</div>
                <div className="text-sm text-foreground-500">Approved</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Latest Case */}
      {latestCase && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Latest Case</h2>
            <Button
              variant="light"
              size="sm"
              endContent={<Icon icon="lucide:arrow-right" />}
              onPress={() => setActiveTab('cases')}
            >
              View All
            </Button>
          </div>
          <Card className="bg-content1">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Icon icon="lucide:pill" className="text-xl text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {latestCase.tenantProduct?.name || latestCase.title || 'Prescription Case'}
                    </h3>
                    <p className="text-sm text-foreground-500">
                      Created {new Date(latestCase.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Chip
                  color={getStatusConfig(latestCase.status, latestCase.classification).color}
                  variant="flat"
                  size="sm"
                >
                  {getStatusConfig(latestCase.status, latestCase.classification).label}
                </Chip>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            isPressable
            className="bg-content1 hover:bg-content2 transition-colors"
            onPress={() => setActiveTab('cases')}
          >
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Icon icon="lucide:file-text" className="text-lg text-secondary" />
                </div>
                <div>
                  <h3 className="font-medium">View Cases</h3>
                  <p className="text-xs text-foreground-500">Track prescription status</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            isPressable
            className="bg-content1 hover:bg-content2 transition-colors"
            onPress={() => setActiveTab('messages')}
          >
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Icon icon="lucide:message-circle" className="text-lg text-secondary" />
                </div>
                <div>
                  <h3 className="font-medium">Messages</h3>
                  <p className="text-xs text-foreground-500">Chat with clinicians</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            isPressable
            className="bg-content1 hover:bg-content2 transition-colors"
            onPress={() => setActiveTab('account')}
          >
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Icon icon="lucide:user" className="text-lg text-secondary" />
                </div>
                <div>
                  <h3 className="font-medium">Account</h3>
                  <p className="text-xs text-foreground-500">Manage your profile</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Empty State for new users */}
      {!loading && cases.length === 0 && (
        <Card className="bg-content2 mt-8">
          <CardBody className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:stethoscope" className="text-3xl text-secondary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Get Started</h2>
            <p className="text-foreground-500 max-w-md mx-auto mb-6">
              Complete a product checkout to create your first prescription case.
              Our clinicians will review and approve your prescriptions.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

interface MDCase {
  orderId: string;
  orderNumber: string;
  caseId: string | null;
  title: string;
  status: string;
  orderStatus: string;
  classification: 'approved' | 'pending';
  createdAt: string;
  updatedAt: string;
  tenantProduct: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
  } | null;
  mdOfferingsCount: number;
}

function getStatusConfig(status: string, classification: string) {
  const statusLower = status?.toLowerCase() || '';
  const classLower = classification?.toLowerCase() || '';

  if (classLower === 'approved' || statusLower === 'completed' || statusLower === 'shipped') {
    return { color: 'success' as const, label: 'Approved', icon: 'lucide:check-circle' };
  }
  if (statusLower === 'cancelled' || statusLower === 'rejected') {
    return { color: 'danger' as const, label: 'Cancelled', icon: 'lucide:x-circle' };
  }
  if (statusLower === 'processing' || statusLower === 'in_review') {
    return { color: 'warning' as const, label: 'In Review', icon: 'lucide:clock' };
  }
  return { color: 'default' as const, label: 'Pending', icon: 'lucide:hourglass' };
}

interface CaseDetails {
  case_id: string;
  metadata: string;
  patient: {
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    gender: number;
    phone_number: string;
  };
  case_assignment?: {
    created_at: string;
    clinician: {
      first_name: string;
      last_name: string;
      full_name: string;
      specialty: string;
      profile_url?: string;
    };
  };
}

function CaseDetailModal({ 
  isOpen, 
  onClose, 
  caseItem 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  caseItem: MDCase | null;
}) {
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && caseItem?.caseId) {
      const fetchCaseDetails = async () => {
        setLoading(true);
        try {
          const response = await apiCall(`/md/cases/${caseItem.caseId}`);
          if (response.success && response.data?.data) {
            setCaseDetails(response.data.data);
          }
        } catch (err) {
          console.error('Error fetching case details:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchCaseDetails();
    }
  }, [isOpen, caseItem?.caseId]);

  if (!caseItem) return null;

  const statusConfig = getStatusConfig(caseItem.status, caseItem.classification);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Icon icon="lucide:pill" className="text-xl text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {caseItem.tenantProduct?.name || caseItem.title || 'Prescription Case'}
              </h2>
              <p className="text-sm text-foreground-500 font-normal">
                {caseItem.orderNumber}
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" color="secondary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Section */}
              <div className="flex items-center justify-between p-4 bg-content2 rounded-lg">
                <div>
                  <p className="text-sm text-foreground-500 mb-1">Case Status</p>
                  <Chip
                    color={statusConfig.color}
                    variant="flat"
                    size="lg"
                    startContent={<Icon icon={statusConfig.icon} />}
                  >
                    {statusConfig.label}
                  </Chip>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground-500 mb-1">Created</p>
                  <p className="font-medium">{new Date(caseItem.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <Divider />

              {/* Case Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Icon icon="lucide:file-text" className="text-secondary" />
                  Case Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-content2 rounded-lg">
                    <p className="text-xs text-foreground-400 mb-1">Order ID</p>
                    <p className="text-sm font-mono">{caseItem.orderId}</p>
                  </div>
                  <div className="p-3 bg-content2 rounded-lg">
                    <p className="text-xs text-foreground-400 mb-1">MDI Case ID</p>
                    <p className="text-sm font-mono">{caseItem.caseId}</p>
                  </div>
                  {caseItem.tenantProduct?.category && (
                    <div className="p-3 bg-content2 rounded-lg">
                      <p className="text-xs text-foreground-400 mb-1">Category</p>
                      <p className="text-sm">{caseItem.tenantProduct.category}</p>
                    </div>
                  )}
                  <div className="p-3 bg-content2 rounded-lg">
                    <p className="text-xs text-foreground-400 mb-1">Last Updated</p>
                    <p className="text-sm">{new Date(caseItem.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Clinician Assignment */}
              {caseDetails?.case_assignment?.clinician && (
                <>
                  <Divider />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon icon="lucide:stethoscope" className="text-secondary" />
                      Assigned Clinician
                    </h3>
                    <div className="flex items-center gap-4 p-4 bg-content2 rounded-lg">
                      <Avatar
                        name={caseDetails.case_assignment.clinician.full_name}
                        src={caseDetails.case_assignment.clinician.profile_url}
                        size="lg"
                      />
                      <div>
                        <p className="font-semibold">
                          Dr. {caseDetails.case_assignment.clinician.full_name}
                        </p>
                        {caseDetails.case_assignment.clinician.specialty && (
                          <p className="text-sm text-foreground-500">
                            {caseDetails.case_assignment.clinician.specialty}
                          </p>
                        )}
                        <p className="text-xs text-foreground-400 mt-1">
                          Assigned {new Date(caseDetails.case_assignment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Status Timeline */}
              <Divider />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Icon icon="lucide:clock" className="text-secondary" />
                  Status Timeline
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                      <Icon icon="lucide:check" className="text-success text-sm" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Case Created</p>
                      <p className="text-xs text-foreground-400">
                        {new Date(caseItem.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {caseDetails?.case_assignment && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:check" className="text-success text-sm" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Clinician Assigned</p>
                        <p className="text-xs text-foreground-400">
                          {new Date(caseDetails.case_assignment.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {caseItem.classification === 'approved' ? (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:check" className="text-success text-sm" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Case Approved</p>
                        <p className="text-xs text-foreground-400">Prescription sent to pharmacy</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:clock" className="text-warning text-sm" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Awaiting Review</p>
                        <p className="text-xs text-foreground-400">Clinician will review your case</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" variant="flat" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function MDICasesContent() {
  const [cases, setCases] = useState<MDCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<MDCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall('/md/offerings');
      if (response.success && response.data?.data) {
        // Filter to only show orders that have an mdCaseId (actual MDI cases)
        const mdiCases = (response.data.data as MDCase[]).filter((c: MDCase) => c.caseId);
        setCases(mdiCases);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      console.error('Error fetching cases:', err);
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleCaseClick = (caseItem: MDCase) => {
    setSelectedCase(caseItem);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Spinner size="lg" color="secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="bg-danger-50 border border-danger-200">
          <CardBody className="p-6 text-center">
            <Icon icon="lucide:alert-circle" className="text-3xl text-danger mx-auto mb-2" />
            <p className="text-danger">{error}</p>
            <Button color="danger" variant="flat" size="sm" className="mt-4" onPress={fetchCases}>
              Try Again
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">My Cases</h1>
          <p className="text-foreground-500">
            Track your prescription cases and their status
          </p>
        </div>
        <Button
          variant="flat"
          size="sm"
          startContent={<Icon icon="lucide:refresh-cw" />}
          onPress={fetchCases}
        >
          Refresh
        </Button>
      </div>

      {cases.length === 0 ? (
        <Card className="bg-content2">
          <CardBody className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:file-text" className="text-3xl text-secondary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Cases Yet</h2>
            <p className="text-foreground-500 max-w-md mx-auto">
              Your prescription cases will appear here after you complete a checkout.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((caseItem) => {
            const statusConfig = getStatusConfig(caseItem.status, caseItem.classification);
            return (
              <Card 
                key={caseItem.orderId} 
                isPressable
                className="bg-content1 hover:bg-content2 transition-colors cursor-pointer"
                onPress={() => handleCaseClick(caseItem)}
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:pill" className="text-xl text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">
                          {caseItem.tenantProduct?.name || caseItem.title || 'Prescription Case'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-500">
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:hash" className="text-xs" />
                            {caseItem.orderNumber || caseItem.orderId.slice(0, 8)}
                          </span>
                          <span className="text-foreground-300">•</span>
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:calendar" className="text-xs" />
                            {new Date(caseItem.createdAt).toLocaleDateString()}
                          </span>
                          {caseItem.caseId && (
                            <>
                              <span className="text-foreground-300">•</span>
                              <span className="flex items-center gap-1 text-xs font-mono bg-content2 px-2 py-0.5 rounded">
                                Case: {caseItem.caseId.slice(0, 8)}...
                              </span>
                            </>
                          )}
                        </div>
                        {caseItem.tenantProduct?.category && (
                          <div className="mt-2">
                            <Chip size="sm" variant="flat" className="text-xs">
                              {caseItem.tenantProduct.category}
                            </Chip>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip
                        color={statusConfig.color}
                        variant="flat"
                        size="sm"
                        startContent={<Icon icon={statusConfig.icon} className="text-sm" />}
                      >
                        {statusConfig.label}
                      </Chip>
                      <Icon icon="lucide:chevron-right" className="text-foreground-400" />
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Case Detail Modal */}
      <CaseDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        caseItem={selectedCase}
      />
    </div>
  );
}

interface Message {
  id: string;
  patient_id: string;
  channel: string;
  text: string;
  user_type: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    specialty?: string;
    profile_url?: string;
  };
}

function MDIMessagesContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall('/messages?channel=support&per_page=50');
      if (response.success && response.data?.data) {
        setMessages(response.data.data);
      } else if (response.error && !response.error.includes('404')) {
        setError(response.error);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'support',
          text: newMessage.trim()
        })
      });
      if (response.success) {
        setNewMessage('');
        await fetchMessages(); // Refresh messages
      } else {
        alert('Failed to send message. Please try again.');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Spinner size="lg" color="secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-200px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">Messages</h1>
        <p className="text-foreground-500">
          Communicate with your assigned clinicians
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardBody className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="text-center py-8">
              <Icon icon="lucide:alert-circle" className="text-3xl text-danger mx-auto mb-2" />
              <p className="text-danger">{error}</p>
              <Button color="danger" variant="flat" size="sm" className="mt-4" onPress={fetchMessages}>
                Try Again
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                <Icon icon="lucide:message-circle" className="text-3xl text-secondary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No Messages Yet</h2>
              <p className="text-foreground-500 max-w-sm mx-auto">
                Start a conversation with your clinician. They'll respond to any questions about your prescriptions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isFromUser = msg.user_type === 'patient' || msg.user_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isFromUser ? 'order-2' : 'order-1'}`}>
                      {!isFromUser && (
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar
                            size="sm"
                            name={`${msg.user.first_name} ${msg.user.last_name}`}
                            src={msg.user.profile_url}
                          />
                          <span className="text-sm font-medium">
                            Dr. {msg.user.first_name} {msg.user.last_name}
                          </span>
                          {msg.user.specialty && (
                            <span className="text-xs text-foreground-400">
                              {msg.user.specialty}
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isFromUser
                            ? 'bg-secondary text-white rounded-br-md'
                            : 'bg-content2 text-foreground rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <p className={`text-xs text-foreground-400 mt-1 ${isFromUser ? 'text-right' : ''}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>

        {/* Message Input */}
        <div className="border-t border-content3 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-content2 border border-content3 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              disabled={sending}
            />
            <Button
              color="secondary"
              isIconOnly
              onPress={handleSendMessage}
              isLoading={sending}
              isDisabled={!newMessage.trim()}
            >
              <Icon icon="lucide:send" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MDIAccountContent() {
  const { user } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Account</h1>
      <p className="text-foreground-500 mb-8">
        Manage your account settings
      </p>

      <Card>
        <CardBody className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar
              name={user?.firstName || user?.email || 'User'}
              size="lg"
              fallback={
                <span className="text-2xl">{getAvatarEmoji(user)}</span>
              }
            />
            <div>
              <h2 className="text-lg font-semibold">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-foreground-500">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-content3">
              <div>
                <div className="font-medium">Email</div>
                <div className="text-sm text-foreground-500">{user?.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-content3">
              <div>
                <div className="font-medium">Phone</div>
                <div className="text-sm text-foreground-500">{(user as any)?.phoneNumber || 'Not set'}</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg bg-content1 border border-content3">
      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
        <Icon icon={icon} className="text-xl text-secondary" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-foreground-500">{description}</p>
    </div>
  );
}

function MDIDashboardPage() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);

  // Detect mobile view
  React.useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Close mobile menu when tab changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <MDIDashboardContent setActiveTab={setActiveTab} />;
      case "cases":
        return <MDICasesContent />;
      case "messages":
        return <MDIMessagesContent />;
      case "account":
        return <MDIAccountContent />;
      default:
        return <MDIDashboardContent setActiveTab={setActiveTab} />;
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col md:flex-row h-screen bg-background">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between h-16 border-b border-content3 bg-content1 px-4">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Icon icon={isMobileMenuOpen ? "lucide:x" : "lucide:menu"} className="text-lg" />
            </Button>
            <div className="font-semibold text-lg text-foreground">
              <span className="text-secondary">MDI</span> Portal
            </div>
          </div>
          <Dropdown>
            <DropdownTrigger>
              <Avatar
                name={user?.firstName || user?.email || 'User'}
                className="cursor-pointer"
                size="sm"
                fallback={
                  <span className="text-xl">{getAvatarEmoji(user)}</span>
                }
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">{user?.firstName || 'User'}</p>
                <p className="text-sm text-foreground-500">{user?.email}</p>
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<Icon icon="lucide:log-out" />}
                onPress={signOut}
              >
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-overlay/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Hidden on mobile unless menu is open */}
        <div className={`
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 fixed md:relative z-50 h-full transition-transform duration-300 ease-in-out
          md:h-screen md:flex md:flex-col
        `}>
          <MDISidebar activeTab={activeTab} setActiveTab={setActiveTab} isMobile={isMobileView} />
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between h-16 border-b border-content3 bg-content1 px-6">
            <div className="text-lg font-medium text-foreground capitalize">
              {activeTab === "dashboard" ? "Dashboard" : navItems.find(n => n.id === activeTab)?.label || activeTab}
            </div>
            <div className="flex items-center gap-4">
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="light" className="gap-2">
                    <Avatar
                      name={user?.firstName || user?.email || 'User'}
                      size="sm"
                      fallback={
                        <span className="text-lg">{getAvatarEmoji(user)}</span>
                      }
                    />
                    <span className="hidden lg:inline">{user?.firstName || 'User'}</span>
                    <Icon icon="lucide:chevron-down" className="text-foreground-400" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="User menu">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-foreground-500">{user?.email}</p>
                  </DropdownItem>
                  <DropdownItem 
                    key="account" 
                    startContent={<Icon icon="lucide:user" />}
                    onPress={() => setActiveTab("account")}
                  >
                    Account Settings
                  </DropdownItem>
                  <DropdownItem
                    key="logout"
                    color="danger"
                    startContent={<Icon icon="lucide:log-out" />}
                    onPress={signOut}
                  >
                    Sign Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          {/* Content Area */}
          <motion.main
            className="flex-1 overflow-y-auto p-4 md:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            key={activeTab}
          >
            {renderContent()}
          </motion.main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden flex items-center justify-around border-t border-content3 bg-content1 h-16">
            {navItems.map((item) => (
              <Button
                key={item.id}
                isIconOnly
                variant="light"
                className={activeTab === item.id ? "text-secondary" : "text-foreground-500"}
                onPress={() => setActiveTab(item.id)}
                aria-label={item.label}
              >
                <Icon icon={item.icon} className="text-xl" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function MDIDashboardRoute() {
  return <MDIDashboardPage />;
}
