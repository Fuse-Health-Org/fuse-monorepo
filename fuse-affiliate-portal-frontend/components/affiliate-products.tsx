import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader, Button, Spinner, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiCall } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Product {
  id: string;
  name: string;
  price: number;
  originalImageUrl: string | null;
  customImageUrl: string | null;
  useCustomImage: boolean;
  displayImageUrl: string | null;
  category: string | null;
  categories: string[];
  active: boolean;
}

export function AffiliateProducts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await apiCall("/affiliate/products", { method: "GET" });

      console.log('📦 Products response:', response);
      console.log('📦 Response.data:', response.data);

      if (response.success && response.data) {
        // The backend returns { success: true, data: [...] }
        // But apiCall wraps it, so response.data contains the backend response
        // We need to extract response.data.data
        const backendResponse = response.data;
        const productsData = Array.isArray(backendResponse.data) 
          ? backendResponse.data 
          : [];
        
        console.log('📦 Setting products:', productsData);
        setProducts(productsData);
      } else {
        showToast('error', response.error || 'Failed to load products');
        setProducts([]); // Set empty array on error
      }
    } catch (error) {
      console.error("Error loading products:", error);
      showToast('error', 'Failed to load products');
      setProducts([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user, loadProducts]);

  const handleImageUpload = async (productId: string, file: File) => {
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;

      const response = await fetch(`${API_URL}/affiliate/products/${productId}/upload-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showToast('success', 'Product image uploaded successfully!');
          // Reload products to get updated data
          await loadProducts();
        } else {
          showToast('error', data.message || 'Failed to upload image');
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to upload image' }));
        showToast('error', errorData.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('error', 'Failed to upload image');
    } finally {
      setUploadingProductId(null);
    }
  };

  const handleToggleImage = async (productId: string, useCustomImage: boolean) => {
    setTogglingProductId(productId);
    try {
      const response = await apiCall(`/affiliate/products/${productId}/toggle-image`, {
        method: "PUT",
        body: JSON.stringify({ useCustomImage }),
      });

      if (response.success) {
        showToast('success', `Now using ${useCustomImage ? 'custom' : 'original'} image`);
        // Update local state
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  useCustomImage,
                  displayImageUrl: useCustomImage ? p.customImageUrl : p.originalImageUrl,
                }
              : p
          )
        );
      } else {
        showToast('error', response.error || 'Failed to toggle image');
      }
    } catch (error) {
      console.error('Error toggling image:', error);
      showToast('error', 'Failed to toggle image');
    } finally {
      setTogglingProductId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  console.log('📦 Rendering products, count:', products.length, products);

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
              toast.type === 'success'
                ? 'bg-success-100 text-success-900'
                : toast.type === 'error'
                ? 'bg-danger-100 text-danger-900'
                : 'bg-primary-100 text-primary-900'
            }`}
          >
            <Icon
              icon={
                toast.type === 'success'
                  ? 'lucide:check-circle'
                  : toast.type === 'error'
                  ? 'lucide:x-circle'
                  : 'lucide:info'
              }
              className="h-5 w-5"
            />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Product Images</h1>
        <p className="text-foreground-500 mt-2">
          Customize product images for your affiliate portal. You can upload your own images or use the original clinic images.
        </p>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Icon icon="lucide:package" className="h-16 w-16 mx-auto text-foreground-300 mb-4" />
            <p className="text-foreground-500">No products available</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="flex-col items-start px-4 pt-4 pb-0">
                <h3 className="text-lg font-semibold text-foreground">{product.name}</h3>
                <p className="text-sm text-foreground-500">${product.price.toFixed(2)}</p>
              </CardHeader>
              <CardBody className="px-4 pb-4 space-y-4">
                {/* Image Preview */}
                <div className="relative aspect-square bg-content2 rounded-lg overflow-hidden">
                  {product.displayImageUrl ? (
                    <img
                      src={product.displayImageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon icon="lucide:image-off" className="h-16 w-16 text-foreground-300" />
                    </div>
                  )}
                  {uploadingProductId === product.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Spinner size="lg" color="white" />
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    id={`file-${product.id}`}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(product.id, file);
                      }
                    }}
                    disabled={uploadingProductId === product.id}
                  />
                  <Button
                    as="label"
                    htmlFor={`file-${product.id}`}
                    color="primary"
                    variant="flat"
                    fullWidth
                    startContent={<Icon icon="lucide:upload" />}
                    isDisabled={uploadingProductId === product.id}
                  >
                    {uploadingProductId === product.id ? 'Uploading...' : 'Upload Custom Image'}
                  </Button>
                </div>

                {/* Toggle Switch (only show if custom image exists) */}
                {product.customImageUrl && (
                  <div className="flex items-center justify-between p-3 bg-content2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Icon icon="lucide:image" className="h-5 w-5 text-foreground-500" />
                      <span className="text-sm text-foreground">Use Custom Image</span>
                    </div>
                    <Switch
                      isSelected={product.useCustomImage}
                      onValueChange={(checked) => handleToggleImage(product.id, checked)}
                      isDisabled={togglingProductId === product.id}
                      size="sm"
                    />
                  </div>
                )}

                {/* Image Source Indicator */}
                <div className="text-xs text-foreground-400 text-center">
                  {product.customImageUrl ? (
                    product.useCustomImage ? (
                      <span className="flex items-center justify-center space-x-1">
                        <Icon icon="lucide:check-circle" className="h-3 w-3 text-success" />
                        <span>Using custom image</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-1">
                        <Icon icon="lucide:building" className="h-3 w-3" />
                        <span>Using clinic image</span>
                      </span>
                    )
                  ) : (
                    <span className="flex items-center justify-center space-x-1">
                      <Icon icon="lucide:building" className="h-3 w-3" />
                      <span>Using clinic image</span>
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

