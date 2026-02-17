import { useMemo, useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Package, Activity, Users, Building2, AlertCircle, CheckCircle2, Plus, Edit2, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type BelugaTab = "products" | "visit" | "patient" | "pharmacies";

interface BelugaProduct {
  id: string;
  name: string;
  strength: string;
  quantity: string;
  refills: string;
  daysSupply?: string;
  medId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function BelugaAdmin() {
  const { token } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [activeTab, setActiveTab] = useState<BelugaTab>("products");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState<BelugaProduct[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BelugaProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    strength: "",
    quantity: "1",
    refills: "0",
    daysSupply: "",
    medId: "",
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [visitMasterId, setVisitMasterId] = useState("");
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [visitData, setVisitData] = useState<any>(null);

  const [patientPhone, setPatientPhone] = useState("");
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);

  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyCity, setPharmacyCity] = useState("");
  const [pharmacyState, setPharmacyState] = useState("");
  const [pharmacyZip, setPharmacyZip] = useState("");
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [pharmaciesData, setPharmaciesData] = useState<any>(null);

  const prettyJson = useMemo(() => (data: any) => JSON.stringify(data, null, 2), []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch(`${baseUrl}/beluga-products`, { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || data.error || "Failed to load products");
      }
      setProducts(data.data || []);
      toast.success(`Loaded ${data.count || data.data?.length || 0} Beluga products`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to load Beluga products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      strength: "",
      quantity: "1",
      refills: "0",
      daysSupply: "",
      medId: "",
    });
    setShowProductModal(true);
  };

  const openEditModal = (product: BelugaProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      strength: product.strength,
      quantity: product.quantity,
      refills: product.refills,
      daysSupply: product.daysSupply || "",
      medId: product.medId || "",
    });
    setShowProductModal(true);
  };

  const closeModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({
      name: "",
      strength: "",
      quantity: "1",
      refills: "0",
      daysSupply: "",
      medId: "",
    });
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.strength) {
      toast.error("Name and strength are required");
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        ...productForm,
        medId: productForm.medId || null,
        daysSupply: productForm.daysSupply || null,
      };

      const url = editingProduct
        ? `${baseUrl}/beluga-products/${editingProduct.id}`
        : `${baseUrl}/beluga-products`;
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to save product");
      }

      toast.success(editingProduct ? "Product updated successfully" : "Product created successfully");
      closeModal();
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save product");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingProductId(productId);
    try {
      const response = await fetch(`${baseUrl}/beluga-products/${productId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to delete product");
      }

      toast.success("Product deleted successfully");
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const fetchVisit = async () => {
    const masterId = visitMasterId.trim();
    if (!masterId) {
      toast.error("Enter a masterId");
      return;
    }
    setLoadingVisit(true);
    try {
      const response = await fetch(`${baseUrl}/beluga/visits/${encodeURIComponent(masterId)}`, { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Visit not found");
      }
      setVisitData(data.data);
      toast.success("Beluga visit loaded");
    } catch (error: any) {
      toast.error(error.message || "Failed to load visit");
      setVisitData(null);
    } finally {
      setLoadingVisit(false);
    }
  };

  const fetchPatient = async () => {
    const phone = patientPhone.replace(/\D/g, "");
    if (phone.length !== 10) {
      toast.error("Phone must contain exactly 10 digits");
      return;
    }
    setLoadingPatient(true);
    try {
      const response = await fetch(`${baseUrl}/beluga/patients/${phone}`, { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Patient not found");
      }
      setPatientData(data.data);
      toast.success("Beluga patient loaded");
    } catch (error: any) {
      toast.error(error.message || "Failed to load patient");
      setPatientData(null);
    } finally {
      setLoadingPatient(false);
    }
  };

  const fetchPharmacies = async () => {
    if (!pharmacyName && !pharmacyCity && !pharmacyState && !pharmacyZip) {
      toast.error("Enter at least one search parameter");
      return;
    }

    setLoadingPharmacies(true);
    try {
      const params = new URLSearchParams();
      if (pharmacyName.trim()) params.append("name", pharmacyName.trim());
      if (pharmacyCity.trim()) params.append("city", pharmacyCity.trim());
      if (pharmacyState.trim()) params.append("state", pharmacyState.trim().toUpperCase());
      if (pharmacyZip.trim()) params.append("zip", pharmacyZip.trim());

      const response = await fetch(`${baseUrl}/beluga/pharmacies?${params.toString()}`, { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Pharmacy lookup failed");
      }
      setPharmaciesData(data.data);
      const count = Array.isArray(data?.data?.data) ? data.data.data.length : 0;
      toast.success(`Loaded ${count} pharmacies`);
    } catch (error: any) {
      toast.error(error.message || "Failed to search pharmacies");
      setPharmaciesData(null);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const renderTabButton = (tab: BelugaTab, label: string) => (
    <Button
      key={tab}
      variant={activeTab === tab ? "default" : "outline"}
      className={activeTab === tab ? "bg-teal-600 hover:bg-teal-700" : ""}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </Button>
  );

  // Auto-fetch products on mount
  useEffect(() => {
    if (activeTab === "products" && products.length === 0) {
      fetchProducts();
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Beluga Admin Area</h1>
            <p className="text-muted-foreground">
              Inspect Beluga products and quickly validate key Beluga API resources.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-teal-300 text-teal-700">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Live Beluga Integration
              </Badge>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tools</CardTitle>
              <CardDescription>Products, visit lookup, patient lookup, and pharmacy search</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {renderTabButton("products", "Products")}
              {renderTabButton("visit", "Visit Lookup")}
              {renderTabButton("patient", "Patient Lookup")}
              {renderTabButton("pharmacies", "Pharmacy Search")}
            </CardContent>
          </Card>

          {activeTab === "products" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-teal-600" />
                      Beluga Products
                    </CardTitle>
                    <CardDescription>
                      Manage Beluga product catalog (medId, strength, refills, etc.)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={openCreateModal} variant="default" className="bg-teal-600 hover:bg-teal-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                    <Button onClick={fetchProducts} disabled={loadingProducts} variant="outline">
                      {loadingProducts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {products.length === 0 && !loadingProducts && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No products yet. Click <strong>Add Product</strong> to create one.
                    </p>
                  )}
                  {products.map((product) => (
                    <div key={product.id} className="rounded-lg border p-4 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {product.medId && (
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge className="bg-teal-600">{product.medId}</Badge>
                            </div>
                          )}
                          <p className="font-medium text-foreground text-lg">{product.name}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Strength:</span>
                              <p className="font-medium">{product.strength}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Quantity:</span>
                              <p className="font-medium">{product.quantity}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Refills:</span>
                              <p className="font-medium">{product.refills}</p>
                            </div>
                            {product.daysSupply && (
                              <div>
                                <span className="text-muted-foreground">Days Supply:</span>
                                <p className="font-medium">{product.daysSupply}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(product)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            disabled={deletingProductId === product.id}
                          >
                            {deletingProductId === product.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "visit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-teal-600" />Beluga Visit Lookup</CardTitle>
                <CardDescription>Lookup an existing Beluga visit by masterId</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={visitMasterId} onChange={(e) => setVisitMasterId(e.target.value)} placeholder="Enter masterId" />
                  <Button onClick={fetchVisit} disabled={loadingVisit}>
                    {loadingVisit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search
                  </Button>
                </div>
                {visitData && (
                  <pre className="rounded-lg border p-4 bg-gray-100 dark:bg-gray-900 text-xs overflow-x-auto">
                    {prettyJson(visitData)}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "patient" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-teal-600" />Beluga Patient Lookup</CardTitle>
                <CardDescription>Lookup a patient by 10-digit phone number</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="e.g. 5554567890" />
                  <Button onClick={fetchPatient} disabled={loadingPatient}>
                    {loadingPatient ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search
                  </Button>
                </div>
                {patientData && (
                  <pre className="rounded-lg border p-4 bg-gray-100 dark:bg-gray-900 text-xs overflow-x-auto">
                    {prettyJson(patientData)}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "pharmacies" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-600" />Beluga Pharmacy Search</CardTitle>
                <CardDescription>Search Beluga pharmacies by one or more filters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} placeholder="Name" />
                  <Input value={pharmacyCity} onChange={(e) => setPharmacyCity(e.target.value)} placeholder="City" />
                  <Input value={pharmacyState} onChange={(e) => setPharmacyState(e.target.value)} placeholder="State (CA)" />
                  <Input value={pharmacyZip} onChange={(e) => setPharmacyZip(e.target.value)} placeholder="Zip (90210)" />
                </div>
                <Button onClick={fetchPharmacies} disabled={loadingPharmacies}>
                  {loadingPharmacies ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Search Pharmacies
                </Button>
                {pharmaciesData && (
                  <pre className="rounded-lg border p-4 bg-gray-100 dark:bg-gray-900 text-xs overflow-x-auto">
                    {prettyJson(pharmaciesData)}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Create/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingProduct ? "Edit Beluga Product" : "Add Beluga Product"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. NAD+"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Strength <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={productForm.strength}
                    onChange={(e) => setProductForm({ ...productForm, strength: e.target.value })}
                    placeholder="e.g. 100mg/ml 10ml"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Quantity
                  </label>
                  <Input
                    value={productForm.quantity}
                    onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                    placeholder="e.g. 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Refills
                  </label>
                  <Input
                    value={productForm.refills}
                    onChange={(e) => setProductForm({ ...productForm, refills: e.target.value })}
                    placeholder="e.g. 3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Days Supply
                  </label>
                  <Input
                    value={productForm.daysSupply}
                    onChange={(e) => setProductForm({ ...productForm, daysSupply: e.target.value })}
                    placeholder="e.g. 30 (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Beluga Med ID
                  </label>
                  <Input
                    value={productForm.medId}
                    onChange={(e) => setProductForm({ ...productForm, medId: e.target.value })}
                    placeholder="Beluga-assigned ID (optional)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty until you receive the ID from Beluga
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <Button onClick={closeModal} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleSaveProduct}
                disabled={savingProduct}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {savingProduct ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingProduct ? "Update Product" : "Create Product"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
