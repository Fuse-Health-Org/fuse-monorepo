import { useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Package, Activity, Users, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type BelugaTab = "products" | "visit" | "patient" | "pharmacies";

interface BelugaProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  strength?: string;
}

export default function BelugaAdmin() {
  const { token } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [activeTab, setActiveTab] = useState<BelugaTab>("products");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState<BelugaProduct[]>([]);
  const [productsSource, setProductsSource] = useState<string | null>(null);

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
      const response = await fetch(`${baseUrl}/beluga/products`, { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || data.error || "Failed to load products");
      }
      setProducts(data.data || []);
      setProductsSource(data.source || null);
      toast.success(`Loaded ${data.count || data.data?.length || 0} Beluga products`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to load Beluga products");
    } finally {
      setLoadingProducts(false);
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
                      Pulls product IDs from Beluga for mapping to local products
                    </CardDescription>
                  </div>
                  <Button onClick={fetchProducts} disabled={loadingProducts} className="bg-teal-600 hover:bg-teal-700">
                    {loadingProducts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsSource && (
                  <div className="flex items-start gap-2 text-sm p-3 rounded-lg border bg-blue-50 text-blue-800 border-blue-200">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>Source endpoint: <code>{productsSource}</code></span>
                  </div>
                )}
                <div className="grid gap-3">
                  {products.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No products loaded yet. Click <strong>Refresh</strong>.
                    </p>
                  )}
                  {products.map((product) => (
                    <div key={product.id} className="rounded-lg border p-4 bg-white dark:bg-gray-900">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className="bg-teal-600">{product.id}</Badge>
                        {product.category && <Badge variant="outline">{product.category}</Badge>}
                        {product.type && <Badge variant="outline">{product.type}</Badge>}
                      </div>
                      <p className="font-medium text-foreground">{product.name}</p>
                      {product.description && <p className="text-sm text-muted-foreground mt-1">{product.description}</p>}
                      {product.strength && <p className="text-xs text-muted-foreground mt-2">Strength: {product.strength}</p>}
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
    </div>
  );
}
