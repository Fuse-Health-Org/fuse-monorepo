import React from "react";
import { motion } from "framer-motion";
import { 
  Card, 
  CardBody, 
  Button, 
  Input, 
  Tabs, 
  Tab,
  Avatar,
  Divider,
  Switch,
  Chip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import { getAvatarEmoji } from "../lib/avatarUtils";

interface PaymentMethod {
  id: string;
  type: "card" | "paypal";
  name: string;
  lastFour?: string;
  expiryDate?: string;
  isDefault: boolean;
}

// TODO: Add BillingHistory interface when implementing billing tab
// interface BillingHistory {
//   id: string;
//   date: string;
//   description: string;
//   amount: number;
//   status: "paid" | "pending" | "failed";
// }

export const AccountPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = React.useState("profile");
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  
  // Password change states
  const [passwordData, setPasswordData] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState("");
  
  const [personalInfo, setPersonalInfo] = React.useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phoneNumber || "",
    dateOfBirth: user?.dob || "",
    address: user?.address || "",
    city: user?.city || "",
    state: user?.state || "",
    zipCode: user?.zipCode || ""
  });
  
  const [paymentMethods] = React.useState<PaymentMethod[]>([
    {
      id: "1",
      type: "card",
      name: "Visa ending in 4242",
      lastFour: "4242",
      expiryDate: "09/25",
      isDefault: true
    },
    {
      id: "2",
      type: "paypal",
      name: "PayPal - john.doe@example.com",
      isDefault: false
    }
  ]);
  
  // TODO: Implement billing history when needed
  // const [billingHistory] = React.useState<BillingHistory[]>([]);
  
  const [notificationSettings, setNotificationSettings] = React.useState({
    emailAppointments: true,
    emailRefills: true,
    emailPromotions: false,
    smsAppointments: true,
    smsRefills: false,
    smsPromotions: false
  });

  // Sync user data when auth context updates
  React.useEffect(() => {
    if (user) {
      console.log('User data received in AccountPage:', user); // Debug log
      setPersonalInfo(prev => ({
        ...prev,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        dateOfBirth: user.dob || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        zipCode: user.zipCode || "",
      }));
    }
  }, [user]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Limit phone number to 10 digits (numbers only)
    if (name === 'phone') {
      const numericValue = value.replace(/\D/g, ''); // Remove non-numeric characters
      if (numericValue.length <= 10) {
        setPersonalInfo(prev => ({
          ...prev,
          [name]: numericValue
        }));
      }
      setError(""); // Clear any previous errors
      return;
    }
    
    setPersonalInfo(prev => ({
      ...prev,
      [name]: value
    }));
    setError(""); // Clear any previous errors
  };
  
  const handleSavePersonalInfo = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // HIPAA Compliance: Validate required fields
      if (!personalInfo.firstName || !personalInfo.lastName) {
        throw new Error('First name and last name are required');
      }

      // Update profile via API
      const result = await authApi.updateProfile({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phoneNumber: personalInfo.phone || undefined,
        dob: personalInfo.dateOfBirth || undefined,
        address: personalInfo.address || undefined,
        city: personalInfo.city || undefined,
        state: personalInfo.state || undefined,
        zipCode: personalInfo.zipCode || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }
      
      setIsEditing(false);
      console.log('Profile updated successfully'); // Safe - no PHI in logs
      
    } catch (err) {
      // HIPAA Compliance: Don't log actual error details
      console.error('Profile update failed');
      setError(err instanceof Error ? err.message : 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleNotification = (key: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const handlePasswordInputChange = (field: keyof typeof passwordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    setPasswordError("");
    setPasswordSuccess("");
  };
  
  const handleChangePassword = async () => {
    setIsChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    
    // Validation
    if (!passwordData.currentPassword) {
      setPasswordError("Current password is required");
      setIsChangingPassword(false);
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      setIsChangingPassword(false);
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords don't match");
      setIsChangingPassword(false);
      return;
    }
    
    try {
      const result = await authApi.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
      }
      
      setPasswordSuccess("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-foreground-500">Manage your personal information and preferences</p>
      </div>
      
      {/* Horizontal Tabs */}
      <div className="border-b border-content3">
        <Tabs 
          selectedKey={selectedTab} 
          onSelectionChange={(key) => setSelectedTab(key as string)}
          variant="underlined"
          color="primary"
          classNames={{
            base: "w-full",
            tabList: "gap-4",
            cursor: "w-full",
            tab: "px-0 h-12",
          }}
        >
          <Tab key="profile" title="Profile" />
          <Tab key="notifications" title="Notifications" />
          <Tab key="security" title="Security" />
          <Tab key="billing" title="Billing & Insurance" />
        </Tabs>
      </div>
      
      {/* Profile Tab Content */}
      {selectedTab === "profile" && (
        <div className="space-y-6">
          {error && (
            <Card className="border border-danger-200 bg-danger-50">
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:alert-circle" className="text-danger text-xl flex-shrink-0" />
                  <p className="text-danger-600">{error}</p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Personal Information Card */}
          <Card className="border border-content3">
            <CardBody className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Personal Information</h2>
                <Button 
                  variant="flat" 
                  color="primary"
                  onPress={() => setIsEditing(true)}
                  startContent={<Icon icon="lucide:edit" />}
                  className="bg-primary-50"
                  isDisabled={!user}
                >
                  Edit
                </Button>
              </div>
              
              <div className="flex flex-col md:flex-row gap-8">
                {/* Profile Photo */}
                <div className="flex-shrink-0">
                  <Avatar 
                    name={user?.firstName || user?.email || 'User'}
                    className="w-28 h-28"
                    fallback={
                      <span className="text-5xl">{getAvatarEmoji(user)}</span>
                    }
                  />
                </div>
                
                {/* Personal Information Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">First Name</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.firstName || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">Last Name</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.lastName || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">Email</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.email || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">Phone</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.phone || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">Date of Birth</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.dateOfBirth || 'Not provided'}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
          
          {/* Address Information Card */}
          <Card className="border border-content3">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-6">Address Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-500 mb-1">Address</label>
                  <div className="p-3 text-foreground font-medium">
                    {personalInfo.address || 'Not provided'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">City</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.city || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">State</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.state || 'Not provided'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-foreground-500 mb-1">ZIP Code</label>
                    <div className="p-3 text-foreground font-medium">
                      {personalInfo.zipCode || 'Not provided'}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
      
      {/* Notifications Tab Content */}
      {selectedTab === "notifications" && (
        <Card className="border border-content3">
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold mb-6">Notification Settings</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Appointment Reminders</p>
                      <p className="text-sm text-foreground-500">Receive email reminders about upcoming appointments</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.emailAppointments}
                      onValueChange={() => handleToggleNotification('emailAppointments')}
                      color="primary"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Prescription Refills</p>
                      <p className="text-sm text-foreground-500">Get notified when your prescriptions are ready for refill</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.emailRefills}
                      onValueChange={() => handleToggleNotification('emailRefills')}
                      color="primary"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Promotions and News</p>
                      <p className="text-sm text-foreground-500">Receive updates about new treatments and special offers</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.emailPromotions}
                      onValueChange={() => handleToggleNotification('emailPromotions')}
                      color="primary"
                    />
                  </div>
                </div>
              </div>
              
              <Divider />
              
              <div>
                <h3 className="text-lg font-medium mb-4">SMS Notifications</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Appointment Reminders</p>
                      <p className="text-sm text-foreground-500">Receive text reminders about upcoming appointments</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.smsAppointments}
                      onValueChange={() => handleToggleNotification('smsAppointments')}
                      color="primary"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Prescription Refills</p>
                      <p className="text-sm text-foreground-500">Get text notifications when your prescriptions are ready for refill</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.smsRefills}
                      onValueChange={() => handleToggleNotification('smsRefills')}
                      color="primary"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Promotions and News</p>
                      <p className="text-sm text-foreground-500">Receive text updates about new treatments and special offers</p>
                    </div>
                    <Switch 
                      isSelected={notificationSettings.smsPromotions}
                      onValueChange={() => handleToggleNotification('smsPromotions')}
                      color="primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      
      {/* Security Tab Content */}
      {selectedTab === "security" && (
        <Card className="border border-content3">
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold mb-6">Security Settings</h2>
            
            {passwordError && (
              <Card className="border border-danger-200 bg-danger-50 mb-4">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon icon="lucide:alert-circle" className="text-danger text-xl flex-shrink-0" />
                    <p className="text-danger-600">{passwordError}</p>
                  </div>
                </CardBody>
              </Card>
            )}
            
            {passwordSuccess && (
              <Card className="border border-success-200 bg-success-50 mb-4">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon icon="lucide:check-circle" className="text-success text-xl flex-shrink-0" />
                    <p className="text-success-600">{passwordSuccess}</p>
                  </div>
                </CardBody>
              </Card>
            )}
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Password</label>
                    <Input 
                      type="password"
                      placeholder="Enter your current password"
                      value={passwordData.currentPassword}
                      onValueChange={(value) => handlePasswordInputChange("currentPassword", value)}
                      isDisabled={isChangingPassword}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">New Password</label>
                    <Input 
                      type="password"
                      placeholder="Enter your new password"
                      value={passwordData.newPassword}
                      onValueChange={(value) => handlePasswordInputChange("newPassword", value)}
                      isDisabled={isChangingPassword}
                      description="Must be at least 8 characters long"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                    <Input 
                      type="password"
                      placeholder="Confirm your new password"
                      value={passwordData.confirmPassword}
                      onValueChange={(value) => handlePasswordInputChange("confirmPassword", value)}
                      isDisabled={isChangingPassword}
                    />
                  </div>
                  
                  <Button 
                    color="primary"
                    onPress={handleChangePassword}
                    isLoading={isChangingPassword}
                    isDisabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  >
                    {isChangingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </div>
              
              <Divider />
              
              <div>
                <h3 className="text-lg font-medium mb-4">Two-Factor Authentication</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Enable Two-Factor Authentication</p>
                    <p className="text-sm text-foreground-500">Add an extra layer of security to your account</p>
                  </div>
                  <Switch 
                    color="primary"
                  />
                </div>
              </div>
              
              <Divider />
              
              <div>
                <h3 className="text-lg font-medium mb-4">Session Management</h3>
                <p className="text-sm text-foreground-500 mb-4">You're currently signed in on these devices:</p>
                
                <Card className="border border-content3">
                  <CardBody className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-content2 rounded-md">
                          <Icon icon="lucide:laptop" className="text-xl" />
                        </div>
                        <div>
                          <p className="font-medium">MacBook Pro</p>
                          <p className="text-xs text-foreground-500">San Francisco, CA • Current session</p>
                        </div>
                      </div>
                      <Button size="sm" variant="flat" color="danger">
                        Sign Out
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      
      {/* Billing Tab Content */}
      {selectedTab === "billing" && (
        <Card className="border border-content3">
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold mb-6">Billing & Insurance</h2>
            
            <div className="space-y-6">
              {/* Payment Methods */}
              <div>
                <h3 className="text-lg font-medium mb-4">Payment Methods</h3>
                <div className="space-y-4">
                  {paymentMethods.map(method => (
                    <Card key={method.id} className="border border-content3">
                      <CardBody className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-content2 rounded-md">
                              <Icon 
                                icon={method.type === "card" ? "lucide:credit-card" : "logos:paypal"} 
                                className="text-2xl" 
                              />
                            </div>
                            <div>
                              <p className="font-medium">{method.name}</p>
                              {method.expiryDate && (
                                <p className="text-sm text-foreground-500">Expires {method.expiryDate}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {method.isDefault && (
                              <Chip color="primary" variant="flat" size="sm">Default</Chip>
                            )}
                            <Button isIconOnly variant="light" size="sm">
                              <Icon icon="lucide:more-vertical" />
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
              
              <Divider />
              
              {/* Insurance Information */}
              <div>
                <h3 className="text-lg font-medium mb-4">Insurance Information</h3>
                <p className="text-foreground-500">No insurance information on file.</p>
                <Button 
                  color="primary"
                  variant="flat"
                  className="mt-4"
                  startContent={<Icon icon="lucide:plus" />}
                >
                  Add Insurance
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      
      {/* Edit Modal */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-content1 rounded-large w-full max-w-2xl p-6"
          >
            <h2 className="text-xl font-semibold mb-6">Edit Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Input 
                label="First Name"
                name="firstName"
                value={personalInfo.firstName}
                onChange={handleInputChange}
              />
              
              <Input 
                label="Last Name"
                name="lastName"
                value={personalInfo.lastName}
                onChange={handleInputChange}
              />
              
              <Input 
                label="Email"
                name="email"
                type="email"
                value={personalInfo.email}
                onChange={handleInputChange}
              />
              
              <Input 
                label="Phone"
                name="phone"
                value={personalInfo.phone}
                onChange={handleInputChange}
              />
              
              <Input 
                label="Date of Birth"
                name="dateOfBirth"
                value={personalInfo.dateOfBirth}
                onChange={handleInputChange}
              />
            </div>
            
            <h3 className="text-lg font-medium mb-4">Address</h3>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <Input 
                label="Street Address"
                name="address"
                value={personalInfo.address}
                onChange={handleInputChange}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input 
                  label="City"
                  name="city"
                  value={personalInfo.city}
                  onChange={handleInputChange}
                />
                
                <Input 
                  label="State"
                  name="state"
                  value={personalInfo.state}
                  onChange={handleInputChange}
                />
                
                <Input 
                  label="ZIP Code"
                  name="zipCode"
                  value={personalInfo.zipCode}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            {error && (
              <Card className="border border-danger-200 bg-danger-50 mb-4">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon icon="lucide:alert-circle" className="text-danger text-xl flex-shrink-0" />
                    <p className="text-danger-600">{error}</p>
                  </div>
                </CardBody>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="flat" 
                color="danger"
                onPress={() => {
                  setIsEditing(false);
                  setError("");
                }}
                isDisabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                color="primary"
                onPress={handleSavePersonalInfo}
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};