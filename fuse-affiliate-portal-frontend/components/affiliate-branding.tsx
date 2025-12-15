import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader, Button, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";

interface BrandingData {
  name: string;
  logo: string | null;
  website: string | null;
}

export function AffiliateBranding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BrandingData | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  
  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const fetchBranding = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiCall("/affiliate/branding", {
          method: "GET",
        });

        if (response.success) {
          // Handle potential nested data structure
          const brandingData = response.data?.data || response.data;
          
          console.log("📖 [Branding] Full response:", {
            response,
            responseData: response.data,
            brandingData,
            name: brandingData?.name,
            website: brandingData?.website,
          });
          
          setData(brandingData);
          
          const fetchedName = brandingData?.name || "";
          const fetchedWebsite = brandingData?.website || "";
          
          console.log("📖 [Branding] Setting form values:", {
            name: fetchedName,
            website: fetchedWebsite,
          });
          
          setName(fetchedName);
          setWebsite(fetchedWebsite);
          
          // Verify it was set
          setTimeout(() => {
            console.log("📖 [Branding] State after setting:", {
              nameState: name,
              websiteState: website,
            });
          }, 100);
        } else {
          setError(response.error || response.message || "Failed to fetch branding");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, []);

  // Sync form fields when data changes
  useEffect(() => {
    if (data) {
      const dataName = data.name || "";
      const dataWebsite = data.website || "";
      
      console.log("🔄 [Branding] Syncing form from data:", {
        data,
        dataName,
        dataWebsite,
        currentName: name,
        currentWebsite: website,
      });
      
      if (dataName !== name) {
        setName(dataName);
      }
      if (dataWebsite !== website) {
        setWebsite(dataWebsite);
      }
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await apiCall("/affiliate/branding", {
        method: "PUT",
        body: JSON.stringify({
          name,
          website,
        }),
      });

      if (response.success) {
        // Handle potential nested data structure
        const brandingData = response.data?.data || response.data;
        
        console.log("💾 [Branding] Save response:", {
          response,
          responseData: response.data,
          brandingData,
        });
        
        setData(brandingData);
        
        // Update form fields with the data returned from backend
        // This ensures the input shows the processed name (e.g., if backend splits it)
        const updatedName = brandingData?.name || "";
        const updatedWebsite = brandingData?.website || "";
        
        console.log("💾 [Branding] Updating form with:", {
          name: updatedName,
          website: updatedWebsite,
        });
        
        setName(updatedName);
        setWebsite(updatedWebsite);
        
        showToast('success', 'Branding updated successfully!');
      } else {
        const errorMessage = response.message || "Failed to update branding";
        setError(errorMessage);
        showToast('error', errorMessage);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Branding Settings</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-danger/10 border border-danger rounded-lg">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Affiliate Name
              </label>
              <Input
                key={`name-${name}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your affiliate name"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name will be displayed alongside the brand logo
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Website (Optional)
              </label>
              <Input
                key={`website-${website}`}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                type="url"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your website URL (optional)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={saving}
                disabled={saving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Preview</h2>
        </CardHeader>
        <CardBody>
          <div className="p-6 bg-content1 rounded-lg border border-content3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-content3 rounded-lg flex items-center justify-center">
                <Icon icon="lucide:building-2" className="text-2xl text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-lg">{name || "Your Name"}</p>
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {website}
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-md animate-slide-in-right ${
              toast.type === 'success' ? 'bg-success-500' :
              toast.type === 'error' ? 'bg-danger-500' :
              'bg-primary-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                icon={
                  toast.type === 'success' ? 'lucide:check-circle' :
                  toast.type === 'error' ? 'lucide:alert-circle' :
                  'lucide:info'
                }
                width={20}
                className="flex-shrink-0 mt-0.5"
              />
              <p className="text-sm flex-1">{toast.message}</p>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <Icon icon="lucide:x" width={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

