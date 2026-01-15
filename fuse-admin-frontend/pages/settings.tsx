import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  User,
  CreditCard,
  Check,
  Camera,
  Crown,
  RefreshCw,
  Calendar,
  Shield,
  ArrowRight,
  Globe,
  Link,
  AlertCircle,
  Copy,
  X,
  Palette,
} from "lucide-react";
import Tutorial from "@/components/ui/tutorial";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface PlanFeatures {
  maxProducts: number;
  maxCampaigns: number;
  analyticsAccess: boolean;
  customerSupport: string;
  customBranding: boolean;
  apiAccess?: boolean;
  whiteLabel?: boolean;
  customIntegrations?: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  planType: string;
  interval: string;
  features: PlanFeatures;
  stripePriceId: string;
  description?: string;
}

const getAddressComponent = (
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  useShort = false
) => {
  if (!components) return "";
  const component = components.find((item) => item.types.includes(type));
  if (!component) return "";
  return useShort ? component.short_name : component.long_name;
};

const parsePlaceAddress = (place: google.maps.places.PlaceResult) => {
  const components = place.address_components;
  if (!components) {
    return null;
  }

  const streetNumber = getAddressComponent(components, "street_number");
  const route = getAddressComponent(components, "route");
  const city =
    getAddressComponent(components, "locality") ||
    getAddressComponent(components, "sublocality") ||
    getAddressComponent(components, "administrative_area_level_2");
  const state = getAddressComponent(
    components,
    "administrative_area_level_1",
    true
  );
  const zipCode = getAddressComponent(components, "postal_code");

  const address = [streetNumber, route].filter(Boolean).join(" ");

  return {
    address,
    city,
    state,
    zipCode,
  };
};

const formatCurrency = (amount: number | null | undefined) => {
  if (!amount && amount !== 0) return "—";
  return `$${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

const formatDate = (date?: string | null) => {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  } catch (error) {
    return "—";
  }
};

export default function Settings({
  showToast,
}: {
  showToast: (type: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const {
    user,
    token,
    hasActiveSubscription,
    refreshSubscription,
    authenticatedFetch,
  } = useAuth();
  const [loading, setLoading] = useState(false);

  const [organizationData, setOrganizationData] = useState({
    businessName: "",
    businessType: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    logo: "",
    slug: "",
    isCustomDomain: false,
    customDomain: "",
    defaultFormColor: "",
    patientPortalDashboardFormat: "fuse" as "fuse" | "md-integrations",
  });
  const [organizationErrors, setOrganizationErrors] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [tempLogoPreview, setTempLogoPreview] = useState<string | null>(null);
  const [tempLogoFile, setTempLogoFile] = useState<File | null>(null);
  const [showCNAMEInstructions, setShowCNAMEInstructions] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainVerificationStatus, setDomainVerificationStatus] = useState<{
    verified: boolean | null;
    message: string;
    actualCname?: string;
    error?: string;
  }>({ verified: null, message: "" });

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const buildAuthHeaders = (additional: Record<string, string> = {}) => {
    const authToken =
      token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("admin_token")
        : null);
    const headers: Record<string, string> = { ...additional };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
  };

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      fetchOrganizationData();
      fetchSubscriptionData();
      fetchPlans();
    }
  }, [user]);

  // Show CNAME instructions if custom domain is already configured
  useEffect(() => {
    if (organizationData.isCustomDomain && organizationData.customDomain) {
      setShowCNAMEInstructions(true);
    }
  }, [organizationData.isCustomDomain, organizationData.customDomain]);

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/brand-subscriptions/plans`,
        {
          method: "GET",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.plans) {
          setPlans(
            data.plans.map((plan: any) => ({
              id: plan.id,
              name: plan.name,
              price: plan.monthlyPrice,
              planType: plan.planType,
              interval: plan.interval,
              features: plan.features,
              stripePriceId: plan.stripePriceId,
              description: plan.description,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchSubscriptionData = async () => {
    setSubscriptionLoading(true);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/subscriptions/current`,
        {
          method: "GET",
          skipLogoutOn401: true,
        }
      );

      if (response.status === 401) {
        setSubscriptionData(null);
      } else if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      } else {
        setSubscriptionData(null);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      setSubscriptionData(null);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const fetchOrganizationData = async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/organization`, {
        method: "GET",
        skipLogoutOn401: true,
      });

      if (response.status === 401) {
        setOrganizationData((prev) => ({ ...prev }));
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setOrganizationData({
          businessName: data.clinicName || data.businessName || "",
          businessType: data.businessType || "",
          website: data.website || "",
          phone: data.phone || data.phoneNumber || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zipCode || "",
          logo: data.logo || "",
          slug: data.slug || "",
          isCustomDomain: data.isCustomDomain || false,
          customDomain: data.customDomain || "",
          defaultFormColor: data.defaultFormColor || "",
          patientPortalDashboardFormat: data.patientPortalDashboardFormat || "fuse",
        });
        if (data.logo) {
          setLogoPreview(data.logo);
        }
      }
    } catch (error) {
      console.error("Error fetching organization data:", error);
    }
  };

  const handlePlaceSelected = useCallback(
    (place: google.maps.places.PlaceResult) => {
      const parsed = parsePlaceAddress(place);
      if (!parsed) {
        showToast(
          "error",
          "Unable to read that address. Please try a different search."
        );
        return;
      }

      setOrganizationData((prev) => ({
        ...prev,
        address: parsed.address || prev.address,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        zipCode: parsed.zipCode || prev.zipCode,
      }));

      if (place.formatted_address) {
        setOrganizationData((prev) => ({
          ...prev,
          address: parsed.address || prev.address,
        }));
      }

      showToast("success", "Address details updated from search");
    },
    [showToast]
  );

  // const { inputRef: addressInputRef } = usePlacesAutocomplete({
  //   onPlaceSelected: handlePlaceSelected,
  //   componentRestrictions: { country: "us" },
  // });

  const handleRefreshSubscription = async () => {
    await fetchSubscriptionData();
    await refreshSubscription();
  };

  const handlePlanSelect = async (plan: Plan) => {
    if (!token) {
      alert("You need to be signed in to select a plan.");
      return;
    }

    const hasActiveSub =
      subscriptionData && subscriptionData.status === "active";

    // If user has active subscription, change tier instead of creating new
    if (hasActiveSub) {
      if (
        !confirm(
          `Are you sure you want to change your subscription to ${plan.name}?`
        )
      ) {
        return;
      }

      try {
        setCreatingPlan(plan.planType);
        const response = await authenticatedFetch(
          `${API_URL}/brand-subscriptions/change`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              newPlanId: plan.id,
            }),
          }
        );

        if (response.ok) {
          showToast("success", "Subscription tier changed successfully");
          await fetchSubscriptionData();
          await refreshSubscription();
        } else {
          const errorData = await response.json().catch(() => ({}));
          showToast(
            "error",
            errorData.error || "Failed to change subscription tier"
          );
        }
      } catch (error) {
        showToast("error", "An error occurred while changing subscription");
      } finally {
        setCreatingPlan(null);
      }
      return;
    }

    // No active subscription - go through checkout flow
    const downpaymentAmount = plan.price;

    try {
      setCreatingPlan(plan.planType);
      // @deprecated: Not used
      const response = await authenticatedFetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedPlanCategory: plan.planType,
          selectedPlanType: plan.planType,
          selectedPlanName: plan.name,
          selectedPlanPrice: downpaymentAmount,
          selectedDownpaymentType: `downpayment_${plan.planType}`,
          selectedDownpaymentName: `${plan.name} First Month`,
          selectedDownpaymentPrice: downpaymentAmount,
          planSelectionTimestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        alert("Plan selection failed. Status: " + response.status);
        setCreatingPlan(null);
        return;
      }

      const queryParams = new URLSearchParams({
        planCategory: plan.planType,
        subscriptionPlanType: plan.planType,
        subscriptionPlanName: plan.name,
        subscriptionMonthlyPrice: plan.price.toString(),
        downpaymentPlanType: `downpayment_${plan.planType}`,
        downpaymentName: `${plan.name} First Month`,
        downpaymentAmount: downpaymentAmount.toString(),
        brandSubscriptionPlanId: plan.id,
        stripePriceId: plan.stripePriceId,
      });

      router.push(`/checkout?${queryParams.toString()}`);
    } catch (error) {
      alert(
        "Error saving plan selection: " +
        (error instanceof Error ? error.message : String(error))
      );
      setCreatingPlan(null);
    }
  };

  // Función para redimensionar y comprimir imagen
  const resizeAndCompressImage = (file: File, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.9): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones manteniendo aspecto cuadrado
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Dibujar imagen redimensionada
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir a blob y luego a File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/png',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/png',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo PNG
    if (file.type !== "image/png") {
      showToast(
        "error",
        "Only PNG files are allowed. Please select a .png file"
      );
      e.target.value = "";
      return;
    }

    // Validar tamaño máximo (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showToast(
        "error",
        `File size too large. Maximum size is 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB. The image will be compressed automatically.`
      );
      // Continuar con el proceso para comprimir
    }

    try {
      // Validar que la imagen sea cuadrada (1:1) y redimensionar si es necesario
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        try {
          const width = img.width;
          const height = img.height;

          // Verificar que la imagen sea cuadrada (1:1)
          if (width !== height) {
            URL.revokeObjectURL(objectUrl);
            showToast(
              "error",
              `Image must be square (1:1). Current dimensions: ${width}x${height}px`
            );
            e.target.value = "";
            return;
          }

          // Si la imagen es grande (> 1024x1024 o > 1MB), redimensionar y comprimir
          let processedFile = file;
          if (width > 1024 || height > 1024 || file.size > 1024 * 1024) {
            try {
              showToast("success", "Compressing image...");
              processedFile = await resizeAndCompressImage(file, 1024, 1024, 0.85);
            } catch (compressError) {
              console.error('Error compressing image:', compressError);
              showToast("error", "Failed to compress image. Trying original file...");
            }
          }

          // Limpiar el object URL
          URL.revokeObjectURL(objectUrl);

          // Si el archivo procesado sigue siendo muy grande, intentar más compresión
          if (processedFile.size > maxSize) {
            processedFile = await resizeAndCompressImage(processedFile, 800, 800, 0.7);
          }

          // Actualizar estado con archivo procesado
          setTempLogoFile(processedFile);
          const reader = new FileReader();
          reader.onloadend = () => {
            setTempLogoPreview(reader.result as string);
            if (processedFile.size < file.size) {
              showToast("success", `Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
            }
          };
          reader.readAsDataURL(processedFile);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          showToast("error", "Error processing image. Please try another file.");
          e.target.value = "";
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        showToast("error", "Error loading image. Please try another PNG file.");
        e.target.value = "";
      };

      img.src = objectUrl;
    } catch (error) {
      showToast("error", "An error occurred while processing the file.");
      e.target.value = "";
    }
  };

  const handleConfirmLogoUpload = async () => {
    if (tempLogoFile) {
      setLogoFile(tempLogoFile);
      setLogoPreview(tempLogoPreview);
      await uploadLogo(tempLogoFile);
      setShowLogoModal(false);
      setTempLogoFile(null);
      setTempLogoPreview(null);
    }
  };

  const handleCancelLogoUpload = () => {
    setShowLogoModal(false);
    setTempLogoFile(null);
    setTempLogoPreview(null);
    setUploadProgress(0);
    // Reset file input
    const fileInput = document.getElementById('logo-upload-modal') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const uploadLogo = async (file: File) => {
    setLoading(true);
    setUploadProgress(0);

    try {
      // Validar tamaño final antes de subir
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showToast("error", `File is still too large after compression (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`);
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("logo", file);

      // Usar XMLHttpRequest para poder rastrear el progreso
      const xhr = new XMLHttpRequest();

      return new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const uploadData = JSON.parse(xhr.responseText);
              if (uploadData.success && uploadData.url) {
                setOrganizationData({ ...organizationData, logo: uploadData.url });
                showToast("success", "Logo uploaded successfully!");
                setUploadProgress(100);
              } else {
                throw new Error(uploadData.message || "Upload failed");
              }
            } catch (parseError) {
              showToast("error", "Failed to parse server response");
              reject(parseError);
            }
          } else {
            let errorMessage = "Failed to upload logo";
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.message || errorMessage;
            } catch {
              if (xhr.status === 413) {
                errorMessage = "File too large. Maximum size is 5MB.";
              } else if (xhr.status === 400) {
                errorMessage = "Invalid file format or file too large.";
              } else if (xhr.status === 500) {
                errorMessage = "Server error. Please try again later.";
              }
            }
            showToast("error", errorMessage);
            reject(new Error(errorMessage));
          }
          setLoading(false);
          resolve();
        });

        xhr.addEventListener('error', () => {
          showToast("error", "Network error. Please check your connection and try again.");
          setLoading(false);
          reject(new Error("Network error"));
        });

        xhr.addEventListener('abort', () => {
          showToast("error", "Upload cancelled");
          setLoading(false);
          reject(new Error("Upload cancelled"));
        });

        const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("admin_token") : null);
        xhr.open('POST', `${API_URL}/upload/logo`);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

        // No establecer Content-Type header, dejar que el navegador lo establezca con el boundary correcto
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast("error", error?.message || "An error occurred while uploading");
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleVerifyDomain = async () => {
    if (!organizationData.customDomain || organizationData.customDomain === "app.") {
      showToast("error", "Please enter a valid custom domain first");
      return;
    }

    setVerifyingDomain(true);
    setDomainVerificationStatus({ verified: null, message: "" });

    try {
      const response = await fetch(`${API_URL}/organization/verify-domain`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ customDomain: organizationData.customDomain }),
      });

      if (response.ok) {
        const data = await response.json();

        setDomainVerificationStatus({
          verified: data.verified,
          message: data.message,
          actualCname: data.actualCname,
          error: data.error
        });

        if (data.error === "CNAME_MISMATCH") {
          showToast("error", `This domain is already in use by ${data.actualCname}`);
        } else {
          showToast("success", "Domain is available! " + (data.verified ? "Verified successfully!" : "Ready to configure."));
        }
      } else {
        showToast("error", "Failed to verify domain");
      }
    } catch (error) {
      showToast("error", "An error occurred while verifying domain");
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleOrganizationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear previous errors
    setOrganizationErrors({});

    // Required field validation
    const errors: Record<string, string> = {};
    if (!organizationData.address?.trim()) errors.address = "This field is required";
    if (!organizationData.city?.trim()) errors.city = "This field is required";
    if (!organizationData.state?.trim()) errors.state = "This field is required";
    if (!organizationData.zipCode?.trim()) {
      errors.zipCode = "This field is required";
    } else if (!/^\d{5}(-\d{4})?$/.test(organizationData.zipCode.trim())) {
      errors.zipCode = "Enter a valid ZIP (5 digits or ZIP+4)";
    }

    if (Object.keys(errors).length > 0) {
      setOrganizationErrors(errors);
      const missingList = Object.keys(errors)
        .map((k) => k.replace(/([A-Z])/g, ' $1').toLowerCase())
        .join(", ");
      showToast("error", `Please fix the highlighted fields: ${missingList}`);
      return;
    }

    // Validate custom domain if selected
    if (organizationData.isCustomDomain) {
      const trimmedDomain = organizationData.customDomain.trim();

      // Check if domain is empty, only "app.", or doesn't have content after "app."
      if (!trimmedDomain || trimmedDomain === "app." || trimmedDomain.length <= 4) {
        showToast("error", "Please enter a valid custom domain (e.g., app.yourdomain.com)");
        return;
      }

      // Check if domain only contains "app." without a valid domain after
      if (trimmedDomain.startsWith("app.") && trimmedDomain.substring(4).trim() === "") {
        showToast("error", "Please enter a valid domain after 'app.' (e.g., app.yourdomain.com)");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/organization/update`, {
        method: "PUT",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(organizationData),
      });

      if (response.ok) {
        showToast("success", "Organization settings updated successfully!");

        // Show CNAME instructions if custom domain is enabled
        if (organizationData.isCustomDomain && organizationData.customDomain) {
          setShowCNAMEInstructions(true);
        }
      } else {
        // Attempt to parse server error details
        let serverMsg = "Failed to update organization settings";
        try {
          const errData = await response.json();
          if (errData?.message) serverMsg = errData.message;
          if (errData?.errors && typeof errData.errors === 'object') {
            setOrganizationErrors(errData.errors);
          }
        } catch { }
        showToast("error", serverMsg);
      }
    } catch (error) {
      showToast("error", "An error occurred while updating");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (
      profileData.newPassword &&
      profileData.newPassword !== profileData.confirmPassword
    ) {
      showToast("error", "New passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/profile`, {
        method: "PUT",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          phone: profileData.phone,
          ...(profileData.newPassword && {
            currentPassword: profileData.currentPassword,
            newPassword: profileData.newPassword,
          }),
        }),
      });

      if (response.ok) {
        showToast("success", "Profile updated successfully!");
        setProfileData({
          ...profileData,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const error = await response.json();
        showToast("error", error.message || "Failed to update profile");
      }
    } catch (error) {
      showToast("error", "An error occurred while updating");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;

    setLoading(true);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/brand-subscriptions/cancel`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        showToast("success", "Subscription cancelled successfully");
        fetchSubscriptionData();
      } else {
        showToast("error", "Failed to cancel subscription");
      }
    } catch (error) {
      showToast("error", "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const currentPlanType = subscriptionData?.plan?.type;
  const currentPlan = plans.find((p) => p.planType === currentPlanType);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 h-full">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-foreground mb-2">
                  Settings
                </h1>
                <p className="text-muted-foreground">
                  Manage your organization, profile, and subscription settings
                </p>
              </div>

              {/* Logo Upload - Top Right */}
              <div className="flex-shrink-0">
                <div
                  id="tutorial-step-1"
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setIsHoveringLogo(true)}
                  onMouseLeave={() => setIsHoveringLogo(false)}
                  onClick={() => setShowLogoModal(true)}
                >
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-border bg-muted transition-all group-hover:border-primary">
                    {logoPreview || organizationData.logo ? (
                      <img
                        src={logoPreview || organizationData.logo}
                        alt="Company logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div
                      className={`absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity ${isHoveringLogo ? "opacity-100" : "opacity-0"}`}
                    >
                      <div className="text-center text-white">
                        <Camera className="h-6 w-6 mx-auto mb-1" />
                        <p className="text-xs font-medium">Edit Logo</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Company Logo
                </p>
              </div>
            </div>

            <Tabs defaultValue="organization" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="organization"
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Organization
                </TabsTrigger>
                <TabsTrigger
                  value="profile"
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="subscription"
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Subscription & Billing
                </TabsTrigger>
              </TabsList>

              {/* Organization Settings */}
              <TabsContent value="organization">
                <Card id="tutorial-step-2">
                  <CardHeader>
                    <CardTitle>Organization Settings</CardTitle>
                    <CardDescription>
                      Update your business information and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={handleOrganizationUpdate}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Business Name
                          </label>
                          <input
                            type="text"
                            value={organizationData.businessName}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                businessName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            placeholder="Enter business name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Business Type
                          </label>
                          <input
                            type="text"
                            value={
                              organizationData.businessType || "Not specified"
                            }
                            readOnly
                            disabled
                            className="w-full px-3 py-2 border border-input rounded-md bg-muted text-muted-foreground"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Website</label>
                          <input
                            type="text"
                            value={organizationData.website}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                website: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            placeholder="company.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phone</label>
                          <input
                            type="tel"
                            value={organizationData.phone}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                phone: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            placeholder="(555) 123-4567"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Address</label>
                          <input
                            type="text"
                            value={organizationData.address}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                address: e.target.value,
                              })
                            }
                            className={`w-full px-3 py-2 border rounded-md bg-background ${organizationErrors.address ? 'border-red-300' : 'border-input'}`}
                            placeholder="123 Main St"
                            autoComplete="off"
                          />
                          {organizationErrors.address && (
                            <p className="text-xs text-red-600 mt-1">{organizationErrors.address}</p>
                          )}
                          <p className="text-xs text-muted-foreground pt-1">
                            {typeof window === "undefined"
                              ? "Preparing address suggestions…"
                              : window.google &&
                                window.google.maps &&
                                window.google.maps.places
                                ? "Autocomplete suggestions powered by Google Places"
                                : "Type to search for your address"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">City</label>
                          <input
                            type="text"
                            value={organizationData.city}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                city: e.target.value,
                              })
                            }
                            className={`w-full px-3 py-2 border rounded-md bg-background ${organizationErrors.city ? 'border-red-300' : 'border-input'}`}
                            placeholder="City"
                          />
                          {organizationErrors.city && (
                            <p className="text-xs text-red-600 mt-1">{organizationErrors.city}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">State</label>
                          <input
                            type="text"
                            value={organizationData.state}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                state: e.target.value,
                              })
                            }
                            className={`w-full px-3 py-2 border rounded-md bg-background ${organizationErrors.state ? 'border-red-300' : 'border-input'}`}
                            placeholder="State"
                          />
                          {organizationErrors.state && (
                            <p className="text-xs text-red-600 mt-1">{organizationErrors.state}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            ZIP Code
                          </label>
                          <input
                            type="text"
                            value={organizationData.zipCode}
                            onChange={(e) =>
                              setOrganizationData({
                                ...organizationData,
                                zipCode: e.target.value,
                              })
                            }
                            className={`w-full px-3 py-2 border rounded-md bg-background ${organizationErrors.zipCode ? 'border-red-300' : 'border-input'}`}
                            placeholder="12345"
                          />
                          {organizationErrors.zipCode && (
                            <p className="text-xs text-red-600 mt-1">{organizationErrors.zipCode}</p>
                          )}
                        </div>
                      </div>

                      {/* Domain Configuration Section */}
                      <div className="pt-8 border-t">
                        <h3 className="text-lg font-medium mb-4">Domain Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Subdomain Card */}
                          <Card
                            className={`cursor-pointer transition-all duration-200 ${!organizationData.isCustomDomain
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                              }`}
                            onClick={() => {
                              setOrganizationData(prev => ({
                                ...prev,
                                isCustomDomain: false,
                                customDomain: ""
                              }));
                            }}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${!organizationData.isCustomDomain
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                                  }`}>
                                  <Link className="h-4 w-4" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">Subdomain</CardTitle>
                                  <CardDescription className="text-xs">
                                    Use a subdomain like {organizationData.slug || 'clinic-slug'}.fusehealth.com
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full border-2 ${!organizationData.isCustomDomain
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground'
                                    }`}>
                                    {!organizationData.isCustomDomain && (
                                      <div className="w-1 h-1 bg-white rounded-full m-0.5"></div>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium">
                                    {organizationData.slug ?
                                      `${organizationData.slug}.fusehealth.com` :
                                      'clinic-slug.fusehealth.com'
                                    }
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Quick setup, no additional configuration required
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Custom Domain Card */}
                          <Card
                            className={`cursor-pointer transition-all duration-200 ${organizationData.isCustomDomain
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                              }`}
                            onClick={() => {
                              setOrganizationData(prev => ({
                                ...prev,
                                isCustomDomain: true,
                                customDomain: prev.customDomain || "app."
                              }));
                            }}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${organizationData.isCustomDomain
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                                  }`}>
                                  <Globe className="h-4 w-4" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">Custom Domain</CardTitle>
                                  <CardDescription className="text-xs">
                                    Use your own domain like app.clinic.com
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full border-2 ${organizationData.isCustomDomain
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground'
                                    }`}>
                                    {organizationData.isCustomDomain && (
                                      <div className="w-1 h-1 bg-white rounded-full m-0.5"></div>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium">
                                    {organizationData.customDomain || 'app.yourdomain.com'}
                                  </span>
                                </div>
                                {organizationData.isCustomDomain && (
                                  <div className="space-y-1">
                                    <div className="flex">
                                      <input
                                        type="text"
                                        value={organizationData.customDomain}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (value.startsWith("app.") || value === "") {
                                            setOrganizationData(prev => ({
                                              ...prev,
                                              customDomain: value
                                            }));
                                          }
                                        }}
                                        className="flex-1 px-3 py-2 border border-input rounded-l-md text-xs bg-background border-r-0"
                                        placeholder="app.yourdomain.com"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="px-4 py-2 h-auto text-xs rounded-l-none bg-background border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVerifyDomain();
                                        }}
                                        disabled={verifyingDomain}
                                      >
                                        {verifyingDomain ? "Verifying..." : "Verify"}
                                      </Button>
                                    </div>

                                    <p className="text-xs text-muted-foreground mt-2">
                                      Must start with "app." - DNS configuration required
                                    </p>
                                  </div>
                                )}
                                {!organizationData.isCustomDomain && (
                                  <p className="text-xs text-muted-foreground">
                                    Requires DNS configuration and domain verification
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* CNAME Instructions */}
                      {showCNAMEInstructions && organizationData.isCustomDomain && (
                        <div className={`mt-6 p-6 border rounded-xl relative shadow-sm ${domainVerificationStatus.error === 'CNAME_MISMATCH'
                          ? 'border-red-300 bg-gradient-to-br from-red-50 to-red-100/50'
                          : domainVerificationStatus.verified !== null
                            ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100/50'
                            : 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50'
                          }`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowCNAMEInstructions(false);
                            }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <X className="h-5 w-5" />
                          </button>

                          <div className="flex items-start gap-3 mb-5">
                            <div className="p-2 bg-blue-600 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-blue-900 mb-1">
                                DNS Configuration Required
                              </h4>
                              <p className="text-sm text-blue-800">
                                To use your custom domain, add the following CNAME record to your DNS provider:
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                            {/* Type */}
                            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigator.clipboard.writeText("CNAME");
                                    showToast("success", "Copied to clipboard!");
                                  }}
                                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                              <code className="text-sm font-mono font-semibold text-blue-900 bg-blue-50 px-3 py-2 rounded-md block text-center">
                                CNAME
                              </code>
                            </div>

                            {/* Name / Host */}
                            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name / Host</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(organizationData.customDomain);
                                    showToast("success", "Copied to clipboard!");
                                  }}
                                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                              <code className="text-sm font-mono font-semibold text-blue-900 bg-blue-50 px-3 py-2 rounded-md block break-all text-center">
                                {organizationData.customDomain}
                              </code>
                            </div>

                            {/* Value / Points to */}
                            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Value / Points to</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true';
                                    const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com';
                                    const cnameValue = organizationData.slug ? `${organizationData.slug}.${baseDomain}` : `your-subdomain.${baseDomain}`;
                                    navigator.clipboard.writeText(cnameValue);
                                    showToast("success", "Copied to clipboard!");
                                  }}
                                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                              <code className="text-sm font-mono font-semibold text-blue-900 bg-blue-50 px-3 py-2 rounded-md block break-all text-center">
                                {(() => {
                                  const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === 'true';
                                  const baseDomain = isStaging ? 'fusehealthstaging.xyz' : 'fusehealth.com';
                                  return organizationData.slug ? `${organizationData.slug}.${baseDomain}` : `your-subdomain.${baseDomain}`;
                                })()}
                              </code>
                            </div>
                          </div>

                          {/* Warning only if CNAME is being used by another domain */}
                          {domainVerificationStatus.error === 'CNAME_MISMATCH' && domainVerificationStatus.actualCname && (
                            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-700 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <h5 className="text-sm font-semibold text-red-900 mb-1">
                                    This domain is already in use
                                  </h5>
                                  <p className="text-xs text-red-800">
                                    This custom domain is pointing to: <strong>{domainVerificationStatus.actualCname}</strong>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start gap-2 bg-blue-100/50 border border-blue-300/50 rounded-lg p-3 mt-4">
                            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-800">
                              <strong>Note:</strong> DNS changes can take up to 48 hours to propagate. Once configured, click the "Verify" button to check if your domain is properly set up.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Patient Portal Dashboard Format Section */}
                      <div className="pt-8 border-t">
                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                Patient Portal Dashboard
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                The dashboard experience your patients see when they sign in. This affects the entire patient portal navigation and features.
                              </p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Fuse Dashboard Option */}
                                <div
                                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                                    organizationData.patientPortalDashboardFormat === "fuse"
                                      ? "border-purple-500 bg-white dark:bg-gray-900 shadow-lg ring-2 ring-purple-500/20"
                                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60"
                                  }`}
                                >
                                  {organizationData.patientPortalDashboardFormat === "fuse" && (
                                    <div className="absolute top-3 right-3">
                                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">Fuse Dashboard</span>
                                    {organizationData.patientPortalDashboardFormat === "fuse" && (
                                      <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Active</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Internal messaging, treatments, and subscription management. Best for clinics managing their own patient communications.
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">Messenger</span>
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">Treatments</span>
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">Subscriptions</span>
                                  </div>
                                </div>

                                {/* MD Integrations Dashboard Option */}
                                <div
                                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                                    organizationData.patientPortalDashboardFormat === "md-integrations"
                                      ? "border-purple-500 bg-white dark:bg-gray-900 shadow-lg ring-2 ring-purple-500/20"
                                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60"
                                  }`}
                                >
                                  {organizationData.patientPortalDashboardFormat === "md-integrations" && (
                                    <div className="absolute bottom-3 right-3">
                                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">MD Integrations</span>
                                    {organizationData.patientPortalDashboardFormat === "md-integrations" && (
                                      <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Active</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Telehealth prescriptions via MD Integrations API. Includes clinician messaging and prescription tracking.
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">E-Prescribe</span>
                                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">Telehealth</span>
                                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">DoseSpot</span>
                                  </div>
                                </div>
                              </div>

                              {/* Contact info message */}
                              <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  To change your patient portal dashboard type, please contact the Fuse Health team at <a href="mailto:support@fuse.health" className="font-medium underline hover:no-underline">support@fuse.health</a>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Form Color Section */}
                      <div className="pt-8 border-t">
                        <h3 className="text-lg font-medium mb-2">Default Form Color</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Choose a default color for all your forms. This color will be used as the primary theme color for buttons and accents.
                        </p>
                        <div className="space-y-4">
                          {/* Predefined Color Palette */}
                          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                            {[
                              { name: "Ocean Blue", color: "#0EA5E9" },
                              { name: "Purple", color: "#8B5CF6" },
                              { name: "Emerald", color: "#10B981" },
                              { name: "Rose", color: "#F43F5E" },
                              { name: "Amber", color: "#F59E0B" },
                              { name: "Indigo", color: "#6366F1" },
                              { name: "Teal", color: "#14B8A6" },
                              { name: "Pink", color: "#EC4899" },
                            ].map((preset) => (
                              <button
                                key={preset.color}
                                type="button"
                                onClick={() => {
                                  setOrganizationData((prev) => ({ ...prev, defaultFormColor: preset.color }));
                                }}
                                className={`relative group h-16 rounded-lg transition-all ${organizationData.defaultFormColor === preset.color
                                    ? "ring-2 ring-offset-2 ring-primary scale-105"
                                    : "hover:scale-105 hover:shadow-lg"
                                  }`}
                                style={{ backgroundColor: preset.color }}
                                title={preset.name}
                              >
                                {organizationData.defaultFormColor === preset.color && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="h-6 w-6 text-white drop-shadow-lg" />
                                  </div>
                                )}
                                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {preset.name}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Selected Color Display */}
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                              <Palette className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">Selected Color</div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {organizationData.defaultFormColor || "No color selected"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {organizationData.defaultFormColor && (
                                <div
                                  className="w-12 h-12 rounded-lg border-2 border-white shadow-sm"
                                  style={{ backgroundColor: organizationData.defaultFormColor }}
                                />
                              )}
                              {organizationData.defaultFormColor && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setOrganizationData((prev) => ({ ...prev, defaultFormColor: "" }));
                                  }}
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading}>
                          {loading ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Profile Settings */}
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>
                      Update your personal information and password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  firstName: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  lastName: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <input
                              type="email"
                              value={profileData.email}
                              disabled
                              className="w-full px-3 py-2 border border-input rounded-md bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                              Email cannot be changed
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Phone</label>
                            <input
                              type="tel"
                              value={profileData.phone}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  phone: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t">
                        <h3 className="text-lg font-medium">Change Password</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">
                              Current Password
                            </label>
                            <input
                              type="password"
                              value={profileData.currentPassword}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  currentPassword: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                              placeholder="Enter current password"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              New Password
                            </label>
                            <input
                              type="password"
                              value={profileData.newPassword}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  newPassword: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                              placeholder="Enter new password"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              value={profileData.confirmPassword}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-input rounded-md bg-background"
                              placeholder="Confirm new password"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading}>
                          {loading ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Subscriptions */}
              <TabsContent value="subscription">
                <div className="space-y-6">
                  {/* Current Subscription */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Subscription Overview</CardTitle>
                      <CardDescription>
                        Review your current plan status and explore available
                        subscriptions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {subscriptionData ? (
                        <div className="space-y-4 text-sm text-muted-foreground">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border border-border p-4 bg-muted/40">
                              <div className="flex items-center gap-2 mb-2">
                                <Crown className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">
                                  Current Plan
                                </span>
                              </div>
                              <p className="text-lg font-semibold text-foreground">
                                {currentPlan?.name ||
                                  subscriptionData.plan?.name ||
                                  "—"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {currentPlan?.description ||
                                  "Active subscription"}
                              </p>
                            </div>

                            <div className="rounded-lg border border-border p-4 bg-muted/40">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">
                                  Billing
                                </span>
                              </div>
                              <div className="grid gap-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Monthly price
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatCurrency(
                                      currentPlan?.price ??
                                      subscriptionData.plan?.price
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Status
                                  </span>
                                  <span className="capitalize font-medium text-foreground">
                                    {subscriptionData.status || "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Next billing date
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatDate(
                                      subscriptionData.nextBillingDate
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Identifiers
                              </p>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  Subscription ID:{" "}
                                  <span className="text-foreground font-medium">
                                    {subscriptionData.id}
                                  </span>
                                </p>
                                <p>
                                  Stripe Subscription:{" "}
                                  <span className="text-foreground font-medium">
                                    {subscriptionData.stripeSubscriptionId ||
                                      "N/A"}
                                  </span>
                                </p>
                                <p>
                                  Stripe Price ID:{" "}
                                  <span className="text-foreground font-medium">
                                    {subscriptionData.plan?.stripePriceId ||
                                      subscriptionData.stripePriceId ||
                                      "N/A"}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                variant="outline"
                                onClick={handleRefreshSubscription}
                                disabled={subscriptionLoading}
                              >
                                <RefreshCw
                                  className={`mr-2 h-4 w-4 ${subscriptionLoading ? "animate-spin" : ""}`}
                                />
                                {subscriptionLoading ? "Refreshing" : "Refresh"}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleCancelSubscription}
                                disabled={loading}
                              >
                                Cancel Subscription
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">
                            No active subscription found. Select a plan to get
                            started.
                          </p>
                          <Button asChild>
                            <a href="/plans">Browse Plans</a>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Available Plans */}
                  {subscriptionData && (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <CardTitle>Subscriptions</CardTitle>
                            <CardDescription>
                              Choose the plan that best fits your needs.
                            </CardDescription>
                          </div>
                          {!hasActiveSubscription && (
                            <Badge className="bg-primary text-primary-foreground">
                              Action required
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {plansLoading ? (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-muted-foreground">
                              Loading plans...
                            </p>
                          </div>
                        ) : plans.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">
                              No plans available
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`grid grid-cols-1 ${plans.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-8`}
                          >
                            {plans.map((plan, index) => {
                              const isCurrentPlan =
                                currentPlanType === plan.planType;
                              const isActive =
                                subscriptionData?.status === "active";
                              const isPopular = index === 0;
                              const Icon = index === 0 ? Building2 : Shield;

                              let buttonLabel = "Get started";
                              if (isCurrentPlan) {
                                buttonLabel = isActive
                                  ? "Current Plan"
                                  : "Plan Selected";
                              } else if (isActive && currentPlan) {
                                // Show upgrade/downgrade for existing subscribers
                                buttonLabel =
                                  plan.price > currentPlan.price
                                    ? "Upgrade"
                                    : "Change Plan";
                              }

                              return (
                                <Card
                                  key={plan.id}
                                  className={`relative group transition-all duration-300 flex flex-col ${isPopular
                                    ? "border-primary shadow-lg hover:shadow-2xl hover:scale-[1.02]"
                                    : "border-border hover:border-primary/60 hover:shadow-xl hover:scale-[1.01]"
                                    } ${creatingPlan ? "opacity-75" : ""}`}
                                >
                                  {isPopular && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                      <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                                        Most Popular
                                      </div>
                                    </div>
                                  )}

                                  <div className="absolute top-4 left-4">
                                    <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-md">
                                      Monthly
                                    </div>
                                  </div>

                                  {isCurrentPlan && (
                                    <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full">
                                      Active Plan
                                    </div>
                                  )}

                                  <CardHeader className="pt-12 pb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Icon className="h-5 w-5" />
                                      <CardTitle className="text-xl font-semibold">
                                        {plan.name}
                                      </CardTitle>
                                    </div>
                                    <div className="mb-4">
                                      <span className="text-3xl font-bold text-[#825AD1]">
                                        {formatCurrency(plan.price)}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        / {plan.interval}
                                      </span>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        + 1% transaction fee
                                      </div>
                                    </div>
                                    {plan.description && (
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {plan.description}
                                      </p>
                                    )}
                                  </CardHeader>

                                  <CardContent className="flex flex-col h-full">
                                    <ul className="space-y-3 mb-8 flex-grow">
                                      {plan.planType == "entry" && (
                                        <>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Up to 25 products</span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>
                                              Template forms (our branding)
                                            </span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Instant setup</span>
                                          </li>
                                        </>
                                      )}

                                      {plan.planType == "standard" && (
                                        <>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Everything in Standard</span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>
                                              Template forms with customer
                                              branding
                                            </span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Instant setup</span>
                                          </li>
                                        </>
                                      )}
                                      {plan.planType == "premium" && (
                                        <>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Unlimited products</span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Custom website</span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Done-for-you setup</span>
                                          </li>
                                          <li className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Custom forms</span>
                                          </li>
                                        </>
                                      )}
                                    </ul>

                                    <Button
                                      className={`w-full mt-auto ${isCurrentPlan && isActive
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : isPopular
                                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                                          : "bg-white border border-gray-300 text-foreground hover:bg-gray-50"
                                        }`}
                                      onClick={() => handlePlanSelect(plan)}
                                      disabled={
                                        (isCurrentPlan && isActive) ||
                                        !!creatingPlan
                                      }
                                    >
                                      {creatingPlan === plan.planType
                                        ? "Preparing checkout..."
                                        : buttonLabel}
                                      {!isCurrentPlan &&
                                        creatingPlan !== plan.planType && (
                                          <ArrowRight className="ml-2 h-4 w-4" />
                                        )}
                                    </Button>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Logo Upload Modal */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            {/* Close button */}
            <button
              onClick={handleCancelLogoUpload}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Change Logo
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload your company logo to customize your portal
              </p>
            </div>

            {/* Requirements Card */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Image Requirements
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Format:</strong> PNG files only (.png)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Dimensions:</strong> Square image (1:1 ratio)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Examples:</strong> 512×512px, 1024×1024px</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Size:</strong> Maximum 5MB (will be compressed automatically if larger)</span>
                </li>
              </ul>
            </div>

            {/* File Input */}
            <div className="mb-6">
              <input
                type="file"
                accept="image/png"
                onChange={handleLogoFileSelect}
                className="hidden"
                id="logo-upload-modal"
                disabled={loading}
              />
              <label
                htmlFor="logo-upload-modal"
                className={`block w-full ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-all ${loading ? '' : 'hover:border-primary hover:bg-primary/5'}`}>
                  {tempLogoPreview ? (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <img
                          src={tempLogoPreview}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-green-500"
                        />
                      </div>
                      <div className="text-sm text-green-600 font-medium flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        Valid image - Ready to upload
                      </div>
                      {tempLogoFile && (
                        <div className="text-xs text-muted-foreground">
                          File size: {(tempLogoFile.size / 1024).toFixed(0)} KB
                        </div>
                      )}
                      {!loading && (
                        <button
                          type="button"
                          className="text-sm text-primary hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('logo-upload-modal')?.click();
                          }}
                        >
                          Change image
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <div className="p-3 bg-primary/10 rounded-full">
                          <Building2 className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          Click to select file
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Max 5MB - Images will be automatically compressed if needed
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Upload Progress Bar */}
            {loading && uploadProgress > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                  <span className="text-sm font-medium text-foreground">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCancelLogoUpload}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleConfirmLogoUpload}
                disabled={!tempLogoFile || loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading... {uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : ''}
                  </>
                ) : (
                  "Confirm and Upload"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
