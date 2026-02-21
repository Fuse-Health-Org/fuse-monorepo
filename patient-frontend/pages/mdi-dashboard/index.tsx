import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { Button, Avatar, Card, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarEmoji } from "../../lib/avatarUtils";
import { apiCall } from "../../lib/api";
import { DashboardSelector } from "../../components/DashboardSelector";

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch { return null }
}
function formatCountdown(s: number): string {
  if (s <= 0) return 'Expired'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  return `${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
}

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
  { id: "prescriptions", label: "Prescriptions", icon: "lucide:pill" },
  { id: "messages", label: "Doctor Messages", icon: "lucide:message-circle" },
  { id: "support-messages", label: "Support Messages", icon: "lucide:headphones" },
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
  
  // Count total prescriptions across all cases
  const totalPrescriptions = cases.reduce((count, c) => {
    return count + (c.mdPrescriptions?.length || 0);
  }, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">
        Welcome back, {user?.firstName || 'there'}!
      </h1>
      <p className="text-foreground-500 mb-8">
        Here's an overview of your prescription cases
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
                <div className="text-sm text-foreground-500">Pending</div>
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

        <Card 
          className="bg-content1 hover:bg-content2 transition-colors cursor-pointer"
          isPressable
          onPress={() => setActiveTab('prescriptions')}
        >
          <CardBody className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon icon="lucide:pill" className="text-xl text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{loading ? '-' : totalPrescriptions}</div>
                <div className="text-sm text-foreground-500">Prescriptions</div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <h3 className="font-medium">My Cases</h3>
                  <p className="text-xs text-foreground-500">Track case status</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            isPressable
            className="bg-content1 hover:bg-content2 transition-colors"
            onPress={() => setActiveTab('prescriptions')}
          >
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Icon icon="lucide:pill" className="text-lg text-success" />
                </div>
                <div>
                  <h3 className="font-medium">Prescriptions</h3>
                  <p className="text-xs text-foreground-500">View medications</p>
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
                  <h3 className="font-medium">Doctor Messages</h3>
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
                  <p className="text-xs text-foreground-500">Manage profile</p>
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

interface MDPrescription {
  id: string;
  title?: string;
  name?: string;
  directions?: string;
  quantity?: string;
  refills?: number;
  days_supply?: number;
  pharmacy_name?: string;
  status?: string;
  created_at?: string;
  product?: {
    name?: string;
    ndc?: string;
  };
}

interface MDOffering {
  id: string;
  case_offering_id?: string;
  title?: string;
  name?: string;
  directions?: string;
  status?: string;
  order_status?: string;
  thank_you_note?: string;
  clinical_note?: string;
  product?: {
    name?: string;
    directions?: string;
    quantity?: string;
    refills?: number;
  };
}

interface MDPendingAction {
  accessLink: string;
  requestedAt: string;
}

interface MDPendingActions {
  driversLicense?: MDPendingAction;
  introVideo?: MDPendingAction;
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
  mdPrescriptions?: MDPrescription[];
  mdOfferings?: MDOffering[];
  hasPrescriptions?: boolean;
  mdPendingActions?: MDPendingActions;
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
  // Stored data from our database (via webhooks)
  storedPrescriptions?: MDPrescription[];
  storedOfferings?: MDOffering[];
  orderNumber?: string;
  orderStatus?: string;
  approvedByDoctor?: boolean;
  pendingActions?: MDPendingActions;
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

              {/* Required Actions - Show prominently if there are pending actions */}
              {(caseItem.mdPendingActions?.driversLicense || caseItem.mdPendingActions?.introVideo || 
                caseDetails?.pendingActions?.driversLicense || caseDetails?.pendingActions?.introVideo) && (
                <>
                  <Card className="bg-warning-50 border border-warning-200">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2 text-warning-700">
                        <Icon icon="lucide:alert-triangle" className="text-warning" />
                        Action Required
                      </h3>
                      <p className="text-sm text-warning-600 mb-4">
                        Please complete the following to continue with your consultation:
                      </p>
                      <div className="space-y-3">
                        {(caseItem.mdPendingActions?.driversLicense || caseDetails?.pendingActions?.driversLicense) && (
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-warning-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                                <Icon icon="lucide:id-card" className="text-lg text-warning" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Upload Driver's License</p>
                                <p className="text-xs text-foreground-500">Required for patient verification</p>
                              </div>
                            </div>
                            <Button
                              color="warning"
                              size="sm"
                              as="a"
                              href={(caseItem.mdPendingActions?.driversLicense || caseDetails?.pendingActions?.driversLicense)?.accessLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              endContent={<Icon icon="lucide:external-link" />}
                            >
                              Upload Now
                            </Button>
                          </div>
                        )}
                        {(caseItem.mdPendingActions?.introVideo || caseDetails?.pendingActions?.introVideo) && (
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-warning-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                                <Icon icon="lucide:video" className="text-lg text-warning" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Record Intro Video</p>
                                <p className="text-xs text-foreground-500">Required for your consultation</p>
                              </div>
                            </div>
                            <Button
                              color="warning"
                              size="sm"
                              as="a"
                              href={(caseItem.mdPendingActions?.introVideo || caseDetails?.pendingActions?.introVideo)?.accessLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              endContent={<Icon icon="lucide:external-link" />}
                            >
                              Record Now
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </>
              )}

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

              {/* Prescriptions Section */}
              {((caseItem.mdPrescriptions && caseItem.mdPrescriptions.length > 0) || 
                (caseDetails?.storedPrescriptions && caseDetails.storedPrescriptions.length > 0)) && (
                <>
                  <Divider />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon icon="lucide:pill" className="text-secondary" />
                      Prescriptions
                    </h3>
                    <div className="space-y-3">
                      {(caseItem.mdPrescriptions || caseDetails?.storedPrescriptions || []).map((rx, idx) => (
                        <Card key={rx.id || idx} className="bg-content2">
                          <CardBody className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                                  <Icon icon="lucide:pill" className="text-lg text-success" />
                                </div>
                                <div>
                                  <h4 className="font-medium">
                                    {rx.title || rx.name || rx.product?.name || 'Prescription'}
                                  </h4>
                                  {rx.directions && (
                                    <p className="text-sm text-foreground-500 mt-1">
                                      {rx.directions}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-foreground-400">
                                    {rx.quantity && (
                                      <span className="flex items-center gap-1">
                                        <Icon icon="lucide:package" className="text-xs" />
                                        Qty: {rx.quantity}
                                      </span>
                                    )}
                                    {rx.refills !== undefined && (
                                      <span className="flex items-center gap-1">
                                        <Icon icon="lucide:refresh-cw" className="text-xs" />
                                        Refills: {rx.refills}
                                      </span>
                                    )}
                                    {rx.days_supply && (
                                      <span className="flex items-center gap-1">
                                        <Icon icon="lucide:calendar" className="text-xs" />
                                        {rx.days_supply} day supply
                                      </span>
                                    )}
                                    {rx.pharmacy_name && (
                                      <span className="flex items-center gap-1">
                                        <Icon icon="lucide:building" className="text-xs" />
                                        {rx.pharmacy_name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {rx.status && (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={rx.status === 'completed' ? 'success' : 'warning'}
                                >
                                  {rx.status}
                                </Chip>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Offerings Section */}
              {((caseItem.mdOfferings && caseItem.mdOfferings.length > 0) || 
                (caseDetails?.storedOfferings && caseDetails.storedOfferings.length > 0)) && (
                <>
                  <Divider />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon icon="lucide:clipboard-list" className="text-secondary" />
                      Offerings
                    </h3>
                    <div className="space-y-3">
                      {(caseItem.mdOfferings || caseDetails?.storedOfferings || []).map((offering, idx) => (
                        <Card key={offering.id || idx} className="bg-content2">
                          <CardBody className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon icon="lucide:package" className="text-lg text-secondary" />
                                </div>
                                <div>
                                  <h4 className="font-medium">
                                    {offering.title || offering.name || offering.product?.name || 'Treatment'}
                                  </h4>
                                  {offering.directions && (
                                    <p className="text-sm text-foreground-500 mt-1">
                                      {offering.directions}
                                    </p>
                                  )}
                                  {offering.thank_you_note && (
                                    <div className="mt-2 p-2 bg-success/10 rounded text-sm text-foreground-600">
                                      <span className="font-medium">Clinician note: </span>
                                      {offering.thank_you_note}
                                    </div>
                                  )}
                                  {offering.product && (
                                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-foreground-400">
                                      {offering.product.quantity && (
                                        <span>Qty: {offering.product.quantity}</span>
                                      )}
                                      {offering.product.refills !== undefined && (
                                        <span>Refills: {offering.product.refills}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {offering.status && (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={offering.status === 'approved' || offering.status === 'completed' ? 'success' : 'warning'}
                                >
                                  {offering.status}
                                </Chip>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      ))}
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
            const hasPendingActions = caseItem.mdPendingActions?.driversLicense || caseItem.mdPendingActions?.introVideo;
            return (
              <Card 
                key={caseItem.orderId} 
                isPressable
                className={`bg-content1 hover:bg-content2 transition-colors cursor-pointer ${hasPendingActions ? 'border-2 border-warning' : ''}`}
                onPress={() => handleCaseClick(caseItem)}
              >
                <CardBody className="p-4">
                  {/* Action Required Banner */}
                  {hasPendingActions && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-warning-50 rounded-lg text-warning-700 text-sm">
                      <Icon icon="lucide:alert-triangle" className="text-warning" />
                      <span className="font-medium">Action required</span>
                      <span className="text-warning-600">—</span>
                      <span className="text-warning-600">
                        {caseItem.mdPendingActions?.driversLicense && 'Upload driver\'s license'}
                        {caseItem.mdPendingActions?.driversLicense && caseItem.mdPendingActions?.introVideo && ' & '}
                        {caseItem.mdPendingActions?.introVideo && 'Record intro video'}
                      </span>
                    </div>
                  )}
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
                      {hasPendingActions && (
                        <Chip
                          color="warning"
                          variant="flat"
                          size="sm"
                          startContent={<Icon icon="lucide:alert-triangle" className="text-sm" />}
                        >
                          Action Needed
                        </Chip>
                      )}
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

// Aggregated prescription from a case
interface AggregatedPrescription {
  id: string;
  prescription: MDPrescription;
  caseId: string;
  orderNumber: string;
  orderId: string;
  productName: string;
  createdAt: string;
  classification: 'approved' | 'pending';
}

function MDIPrescriptionsContent() {
  const [prescriptions, setPrescriptions] = useState<AggregatedPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall('/md/offerings');
      if (response.success && response.data?.data) {
        // Aggregate all prescriptions from all cases
        const allPrescriptions: AggregatedPrescription[] = [];
        
        (response.data.data as MDCase[]).forEach((caseItem: MDCase) => {
          if (caseItem.caseId && caseItem.mdPrescriptions && caseItem.mdPrescriptions.length > 0) {
            caseItem.mdPrescriptions.forEach((rx) => {
              allPrescriptions.push({
                id: rx.id || `${caseItem.caseId}-${rx.name || rx.title}`,
                prescription: rx,
                caseId: caseItem.caseId!,
                orderNumber: caseItem.orderNumber,
                orderId: caseItem.orderId,
                productName: caseItem.tenantProduct?.name || caseItem.title || 'Prescription',
                createdAt: rx.created_at || caseItem.createdAt,
                classification: caseItem.classification,
              });
            });
          }
        });
        
        // Sort by date, newest first
        allPrescriptions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setPrescriptions(allPrescriptions);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      console.error('Error fetching prescriptions:', err);
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

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
            <Button color="danger" variant="flat" size="sm" className="mt-4" onPress={fetchPrescriptions}>
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
          <h1 className="text-2xl font-bold mb-1">My Prescriptions</h1>
          <p className="text-foreground-500">
            View all your approved prescriptions across cases
          </p>
        </div>
        <Button
          variant="flat"
          size="sm"
          startContent={<Icon icon="lucide:refresh-cw" />}
          onPress={fetchPrescriptions}
        >
          Refresh
        </Button>
      </div>

      {prescriptions.length === 0 ? (
        <Card className="bg-content2">
          <CardBody className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:pill" className="text-3xl text-secondary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Prescriptions Yet</h2>
            <p className="text-foreground-500 max-w-md mx-auto">
              Your prescriptions will appear here once your cases have been reviewed and approved by a clinician.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((item) => {
            const rx = item.prescription;
            return (
              <Card key={item.id} className="bg-content1">
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                        <Icon icon="lucide:pill" className="text-xl text-success" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">
                          {rx.title || rx.name || rx.product?.name || 'Prescription'}
                        </h3>
                        {rx.directions && (
                          <p className="text-sm text-foreground-600 mb-2">
                            {rx.directions}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-500">
                          {rx.quantity && (
                            <span className="flex items-center gap-1">
                              <Icon icon="lucide:package" className="text-xs" />
                              Qty: {rx.quantity}
                            </span>
                          )}
                          {rx.refills !== undefined && (
                            <span className="flex items-center gap-1">
                              <Icon icon="lucide:refresh-cw" className="text-xs" />
                              Refills: {rx.refills}
                            </span>
                          )}
                          {rx.days_supply && (
                            <span className="flex items-center gap-1">
                              <Icon icon="lucide:calendar" className="text-xs" />
                              {rx.days_supply} day supply
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-foreground-400">
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:file-text" className="text-xs" />
                            {item.productName}
                          </span>
                          <span className="text-foreground-300">•</span>
                          <span className="flex items-center gap-1">
                            <Icon icon="lucide:hash" className="text-xs" />
                            {item.orderNumber}
                          </span>
                          <span className="text-foreground-300">•</span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {rx.pharmacy_name && (
                          <div className="mt-2">
                            <Chip size="sm" variant="flat" startContent={<Icon icon="lucide:building" className="text-xs" />}>
                              {rx.pharmacy_name}
                            </Chip>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Chip
                        color={item.classification === 'approved' ? 'success' : 'warning'}
                        variant="flat"
                        size="sm"
                        startContent={<Icon icon={item.classification === 'approved' ? 'lucide:check-circle' : 'lucide:clock'} className="text-sm" />}
                      >
                        {item.classification === 'approved' ? 'Approved' : 'Pending'}
                      </Chip>
                      {rx.status && (
                        <span className="text-xs text-foreground-400">
                          {rx.status}
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Message {
  id: string;
  patient_id: string;
  channel: string;
  text: string;
  user_type: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    specialty?: string;
    profile_url?: string;
  } | null;
}

// Helper function to normalize text and convert URLs to clickable links
const renderMessageWithLinks = (text: string): (string | JSX.Element)[] => {
  // First, normalize the text: remove excessive whitespace and normalize line breaks
  // Replace multiple spaces with single space, normalize line breaks, and trim
  let normalizedText = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace characters with single space
    .replace(/\n\s+/g, '\n') // Remove spaces after newlines
    .replace(/\s+\n/g, '\n') // Remove spaces before newlines
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with just 2
    .trim(); // Remove leading/trailing whitespace

  // URL regex pattern - matches http, https, and www URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let linkIndex = 0;
  let hasUrls = false;

  // Reset regex lastIndex to avoid issues with global regex
  urlRegex.lastIndex = 0;

  while ((match = urlRegex.exec(normalizedText)) !== null) {
    hasUrls = true;
    // Add text before the URL
    if (match.index > lastIndex) {
      const textBefore = normalizedText.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push(textBefore);
      }
    }

    // Extract the URL
    let url = match[0];
    // Add protocol if it starts with www
    if (url.startsWith('www.')) {
      url = `https://${url}`;
    }

    // Add the link component
    parts.push(
      <a
        key={`link-${linkIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 hover:text-primary-700 underline font-medium"
      >
        this link
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < normalizedText.length) {
    parts.push(normalizedText.substring(lastIndex));
  }

  // If no URLs were found, return array with just the normalized text
  if (!hasUrls) {
    return [normalizedText];
  }

  return parts;
};

function MDIMessagesContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall('/messages?per_page=50');
      
      if (response.success && response.data) {
        // Handle nested response structure: { success: true, data: { data: Message[], links: {}, meta: {} } }
        // The actual messages array is in response.data.data
        const messagesData = response.data.data?.data || response.data.data || response.data;
        
        // Ensure messages is always an array
        const messagesArray = Array.isArray(messagesData) ? messagesData : [];
        
        // Sort messages by created_at in ascending order (oldest first, newest last)
        const sortedMessages = [...messagesArray].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateA - dateB;
        });
        
        setMessages(sortedMessages);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[MDI-MESSAGES] Fetched messages:', {
            count: messagesArray.length,
            structure: Array.isArray(messagesData) ? 'array' : typeof messagesData,
            rawResponse: response,
            messagesData: messagesData,
          });
        }
      } else if (response.error && !response.error.includes('404')) {
        setError(response.error);
      } else {
        // No messages found or empty response - set empty array
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to load messages');
      setMessages([]); // Ensure messages is always an array even on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length, loading]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Optimistically add the message to the UI immediately
    const optimisticMessage: Message = {
      id: tempId,
      patient_id: user?.id || '',
      channel: 'patient',
      text: messageText,
      user_type: 'patient',
      user_id: user?.id || '',
      user_name: null,
      created_at: new Date().toISOString(),
      user: null
    };

    // Add optimistic message to the list and sort
    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      // Sort by created_at to maintain order
      return updated.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateA - dateB;
      });
    });
    setNewMessage('');
    setSending(true);
    
    // Scroll to bottom after adding optimistic message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const response = await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'patient',
          text: messageText
        })
      });
      
      if (response.success) {
        // If the API returns the created message, replace the optimistic one
        if (response.data?.data) {
          const createdMessage = response.data.data;
          setMessages(prev => {
            // Remove the optimistic message and add the real one, then sort
            const filtered = prev.filter(msg => msg.id !== tempId);
            const updated = [...filtered, createdMessage];
            // Sort by created_at to maintain order
            return updated.sort((a, b) => {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              return dateA - dateB;
            });
          });
          // Scroll to bottom after adding new message
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          // If no message returned, just remove the optimistic one and fetch the latest
          // This is a fallback - ideally the API should return the created message
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          // Silently fetch in the background to get the real message
          fetchMessages();
        }
      } else {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setNewMessage(messageText); // Restore the message text
        alert('Failed to send message. Please try again.');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText); // Restore the message text
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
        <h1 className="text-2xl font-bold mb-1">Doctor Messages</h1>
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
          ) : !Array.isArray(messages) || messages.length === 0 ? (
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
              {Array.isArray(messages) && messages.map((msg) => {
                // Patient messages: user_type contains 'Patient' OR user_id matches current user
                const isFromUser = msg.user_type?.includes('Patient') || msg.user_id === user?.id;
                // System messages: user_type is 'system' OR no user
                const isSystemMessage = msg.user_type === 'system' || !msg.user;
                // Doctor/Clinician messages: user_type contains 'Clinician' AND not from patient, AND not system
                const isDoctorMessage = !isFromUser && !isSystemMessage && msg.user_type?.includes('Clinician');
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isFromUser ? 'order-2' : 'order-1'}`}>
                      {!isFromUser && !isSystemMessage && msg.user && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={isDoctorMessage ? 'ring-2 ring-green-300 rounded-full' : ''}>
                            <Avatar
                              size="sm"
                              name={`${msg.user.first_name} ${msg.user.last_name}`}
                              src={msg.user.profile_url}
                              classNames={{
                                base: isDoctorMessage ? 'bg-green-100' : '',
                                name: isDoctorMessage ? 'text-green-900 font-semibold' : '',
                              }}
                            />
                          </div>
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
                      {isSystemMessage && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                            <Icon icon="lucide:info" className="text-xs text-blue-600" />
                          </div>
                          <span className="text-xs text-blue-600 font-medium">System Message</span>
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          isFromUser
                            ? 'bg-content2 text-foreground rounded-br-md'
                            : isSystemMessage
                            ? 'bg-blue-50 border border-blue-200 text-foreground rounded-bl-md'
                            : isDoctorMessage
                            ? 'bg-green-100 text-green-900 border border-green-200 rounded-bl-md'
                            : 'bg-content2 text-foreground rounded-bl-md'
                        }`}
                      >
                        {isSystemMessage ? (
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {renderMessageWithLinks(msg.text)}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>
                      <p className={`text-xs text-foreground-400 mt-1 ${isFromUser ? 'text-right' : ''}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Scroll anchor for auto-scrolling to bottom */}
              <div ref={messagesEndRef} />
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

function MDISupportMessagesContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall('/messages?channel=support&per_page=50');
      
      if (response.success && response.data) {
        // Handle nested response structure: { success: true, data: { data: Message[], links: {}, meta: {} } }
        // The actual messages array is in response.data.data
        const messagesData = response.data.data?.data || response.data.data || response.data;
        
        // Ensure messages is always an array
        const messagesArray = Array.isArray(messagesData) ? messagesData : [];
        
        // Sort messages by created_at in ascending order (oldest first, newest last)
        const sortedMessages = [...messagesArray].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateA - dateB;
        });
        
        setMessages(sortedMessages);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[MDI-SUPPORT-MESSAGES] Fetched messages:', {
            count: messagesArray.length,
            structure: Array.isArray(messagesData) ? 'array' : typeof messagesData,
            rawResponse: response,
            messagesData: messagesData,
          });
        }
      } else if (response.error && !response.error.includes('404')) {
        setError(response.error);
      } else {
        // No messages found or empty response - set empty array
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Error fetching support messages:', err);
      setError(err.message || 'Failed to load messages');
      setMessages([]); // Ensure messages is always an array even on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length, loading]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Optimistically add the message to the UI immediately
    const optimisticMessage: Message = {
      id: tempId,
      patient_id: user?.id || '',
      channel: 'support',
      text: messageText,
      user_type: 'patient',
      user_id: user?.id || '',
      user_name: null,
      created_at: new Date().toISOString(),
      user: null
    };

    // Add optimistic message to the list and sort
    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      // Sort by created_at to maintain order
      return updated.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateA - dateB;
      });
    });
    setNewMessage('');
    setSending(true);
    
    // Scroll to bottom after adding optimistic message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const response = await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'support',
          text: messageText
        })
      });
      
      if (response.success) {
        // If the API returns the created message, replace the optimistic one
        if (response.data?.data) {
          const createdMessage = response.data.data;
          setMessages(prev => {
            // Remove the optimistic message and add the real one, then sort
            const filtered = prev.filter(msg => msg.id !== tempId);
            const updated = [...filtered, createdMessage];
            // Sort by created_at to maintain order
            return updated.sort((a, b) => {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              return dateA - dateB;
            });
          });
          // Scroll to bottom after adding new message
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          // If no message returned, just remove the optimistic one and fetch the latest
          // This is a fallback - ideally the API should return the created message
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          // Silently fetch in the background to get the real message
          fetchMessages();
        }
      } else {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setNewMessage(messageText); // Restore the message text
        alert('Failed to send message. Please try again.');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText); // Restore the message text
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
        <h1 className="text-2xl font-bold mb-1">Support Messages</h1>
        <p className="text-foreground-500">
          Get help from our support team
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
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                <Icon icon="lucide:headphones" className="text-3xl text-secondary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No Support Messages Yet</h2>
              <p className="text-foreground-500 max-w-sm mx-auto">
                Reach out to our support team for help with any questions or issues.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(messages) && messages.map((msg) => {
                // System messages: user_type is 'system' OR no user
                const isSystemMessage = msg.user_type === 'system' || !msg.user;
                // Patient messages: user_type contains 'Patient' OR user_id matches current user OR user_id matches patient_id
                const isFromUser = msg.user_type?.includes('Patient') || msg.user_id === user?.id || msg.user_id === msg.patient_id;
                // Support messages: user_type contains 'SupportStaff' or 'Support' or 'Clinician', AND not from patient, AND not system
                const isSupportMessage = !isFromUser && !isSystemMessage && (msg.user_type?.includes('SupportStaff') || msg.user_type?.includes('Support') || msg.user_type?.includes('Clinician'));
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isFromUser ? 'order-2' : 'order-1'}`}>
                      {!isFromUser && !isSystemMessage && msg.user && (
                        <div className="flex items-center gap-2 mb-1">
                          <div className={isSupportMessage ? 'ring-2 ring-purple-300 rounded-full' : ''}>
                            <Avatar
                              size="sm"
                              name={`${msg.user.first_name} ${msg.user.last_name}`}
                              src={msg.user.profile_url}
                              classNames={{
                                base: isSupportMessage ? 'bg-purple-100' : '',
                                name: isSupportMessage ? 'text-purple-900 font-semibold' : '',
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {msg.user.first_name} {msg.user.last_name}
                          </span>
                          {msg.user.specialty && (
                            <span className="text-xs text-foreground-400">
                              {msg.user.specialty}
                            </span>
                          )}
                        </div>
                      )}
                      {isSystemMessage && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                            <Icon icon="lucide:info" className="text-xs text-blue-600" />
                          </div>
                          <span className="text-xs text-blue-600 font-medium">System Message</span>
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          isFromUser
                            ? 'bg-content2 text-foreground rounded-br-md'
                            : isSystemMessage
                            ? 'bg-blue-50 border border-blue-200 text-foreground rounded-bl-md'
                            : isSupportMessage
                            ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-bl-md'
                            : 'bg-content2 text-foreground rounded-bl-md'
                        }`}
                      >
                        {isSystemMessage ? (
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {renderMessageWithLinks(msg.text)}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>
                      <p className={`text-xs text-foreground-400 mt-1 ${isFromUser ? 'text-right' : ''}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Scroll anchor for auto-scrolling to bottom */}
              <div ref={messagesEndRef} />
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
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (!token) { setSecondsLeft(null); return; }
    const expiry = getTokenExpiry(token);
    if (!expiry) { setSecondsLeft(null); return; }
    const update = () => {
      const remaining = Math.max(0, expiry - Math.floor(Date.now() / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) signOut();
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Initialize activeTab from URL query parameter
  React.useEffect(() => {
    const tabFromQuery = router.query.tab as string;
    if (tabFromQuery && ['dashboard', 'cases', 'prescriptions', 'messages', 'support-messages', 'account'].includes(tabFromQuery)) {
      setActiveTab(tabFromQuery);
    }
  }, [router.query.tab]);

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
      case "prescriptions":
        return <MDIPrescriptionsContent />;
      case "messages":
        return <MDIMessagesContent />;
      case "support-messages":
        return <MDISupportMessagesContent />;
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
              {secondsLeft !== null && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium tabular-nums border ${
                  secondsLeft === 0 ? 'bg-danger-100 border-danger-300 text-danger'
                  : secondsLeft <= 300 ? 'bg-warning-100 border-warning-300 text-warning-700'
                  : 'bg-default-100 border-default-300 text-default-600'}`}
                  title="Time until your session expires">
                  <Icon icon="lucide:timer" className="h-3 w-3 shrink-0" />
                  {formatCountdown(secondsLeft)}
                </div>
              )}
              {/* Dashboard Selector - Switch between Fuse and MDI dashboards */}
              <DashboardSelector />
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
