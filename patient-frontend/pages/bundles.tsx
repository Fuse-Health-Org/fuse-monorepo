import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { extractClinicSlugFromDomain } from '../lib/clinic-utils';
import { apiCall } from '../lib/api';
import GetStartedButton from '../components/GetStartedButton';
import { useDashboardPrefix } from '../hooks/useClinicFromDomain';

interface CustomWebsite {
    portalTitle?: string;
    portalDescription?: string;
    primaryColor?: string;
    fontFamily?: string;
    logo?: string;
    heroImageUrl?: string;
    heroTitle?: string;
    heroSubtitle?: string;
}

interface IncludedItem {
    id: string;
    customName: string;
    customSig: string;
    pharmacyName: string;
}

interface Bundle {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    categories?: string[];
    price: number;
    wholesalePrice?: number;
    slug?: string;
    formId?: string;
    includedItems: IncludedItem[];
}

export default function BundlesPage() {
    const router = useRouter();
    const { dashboardPrefix } = useDashboardPrefix();
    const [customWebsite, setCustomWebsite] = useState<CustomWebsite | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [bundlesLoading, setBundlesLoading] = useState(true);

    useEffect(() => {
        const loadCustomWebsite = async () => {
            try {
                const domainInfo = await extractClinicSlugFromDomain();
                console.log('🔍 Domain info:', domainInfo);

                if (domainInfo.hasClinicSubdomain && domainInfo.clinicSlug) {
                    console.log('🌐 Fetching custom website for slug:', domainInfo.clinicSlug);
                    const result = await apiCall(`/custom-website/by-slug/${domainInfo.clinicSlug}`);
                    console.log('✅ Custom website data:', result);
                    if (result.success && result.data?.data) {
                        setCustomWebsite(result.data.data);
                    } else if (result.success && result.data) {
                        setCustomWebsite(result.data);
                    }
                } else {
                    console.log('🏠 No clinic subdomain detected, loading default custom website for testing...');
                    try {
                        const result = await apiCall('/custom-website/default');
                        console.log('✅ Loaded default custom website:', result);
                        if (result.success && result.data?.data) {
                            setCustomWebsite(result.data.data);
                        } else if (result.success && result.data) {
                            setCustomWebsite(result.data);
                        }
                    } catch (error) {
                        console.log('ℹ️ No custom website found');
                    }
                }
            } catch (error) {
                console.error('❌ Error loading custom website:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadCustomWebsite();
    }, []);

    // Preload logo image
    useEffect(() => {
        if (!customWebsite) return;

        const websiteData = (customWebsite as any)?.data || customWebsite;
        const logoUrl = websiteData?.logo;

        if (logoUrl) {
            const img = new Image();
            img.onload = () => {
                console.log('✅ Logo loaded successfully');
                setLogoLoaded(true);
            };
            img.onerror = () => {
                console.error('❌ Failed to load logo');
                setLogoLoaded(true);
            };
            img.src = logoUrl;
        } else {
            setLogoLoaded(true);
        }
    }, [customWebsite]);

    // Fetch bundles
    useEffect(() => {
        const loadBundles = async () => {
            try {
                const domainInfo = await extractClinicSlugFromDomain();
                const endpoint = domainInfo.hasClinicSubdomain && domainInfo.clinicSlug
                    ? `/public/bundles/${domainInfo.clinicSlug}`
                    : `/public/bundles`;

                console.log('📦 Fetching bundles from:', endpoint);
                const result = await apiCall(endpoint);

                if (result.success && result.data?.data) {
                    setBundles(result.data.data);
                } else if (result.success && result.data) {
                    setBundles(result.data);
                }
                console.log('✅ Loaded bundles:', result);
            } catch (error) {
                console.error('❌ Error loading bundles:', error);
            } finally {
                setBundlesLoading(false);
            }
        };

        loadBundles();
    }, []);

    // Handle nested data structure from API response
    const websiteData = (customWebsite as any)?.data || customWebsite;
    const primaryColor = websiteData?.primaryColor || "#004d4d";
    const fontFamily = websiteData?.fontFamily || "Georgia, serif";
    const logo = websiteData?.logo;

    // Show loading skeleton while fetching data or loading logo
    if (isLoading || !logoLoaded) {
        return (
            <div style={{ minHeight: "100vh", backgroundColor: "#f5f3ef", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                {/* Header Skeleton */}
                <header style={{ borderBottom: "1px solid #e5e5e5", backgroundColor: "white" }}>
                    <div
                        style={{
                            maxWidth: "1400px",
                            margin: "0 auto",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "1rem 2rem",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "3rem" }}>
                            <div style={{ width: "120px", height: "32px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                            <div style={{ display: "flex", gap: "2rem" }}>
                                <div style={{ width: "100px", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                                <div style={{ width: "80px", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <div style={{ width: "100px", height: "36px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                        </div>
                    </div>
                </header>

                {/* Hero Skeleton */}
                <section style={{ backgroundColor: "#f5f3ef", padding: "4rem 2rem", minHeight: "400px" }}>
                    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
                        <div style={{ width: "60px", height: "14px", backgroundColor: "#d0d0d0", borderRadius: "4px", marginBottom: "1rem" }}></div>
                        <div style={{ width: "300px", height: "48px", backgroundColor: "#d0d0d0", borderRadius: "8px", marginBottom: "1rem" }}></div>
                        <div style={{ width: "400px", height: "20px", backgroundColor: "#d0d0d0", borderRadius: "4px" }}></div>
                    </div>
                </section>

                {/* Bundle Cards Skeleton */}
                <section style={{ backgroundColor: "#f5f3ef", padding: "0 2rem 4rem" }}>
                    <div style={{ maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2rem" }}>
                        {[1, 2].map((i) => (
                            <div key={i} style={{ backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden" }}>
                                <div style={{ backgroundColor: "#e8e6e1", height: "300px" }}></div>
                                <div style={{ padding: "2rem" }}>
                                    <div style={{ width: "200px", height: "28px", backgroundColor: "#e0e0e0", borderRadius: "4px", marginBottom: "1rem" }}></div>
                                    <div style={{ width: "120px", height: "20px", backgroundColor: "#e0e0e0", borderRadius: "4px", marginBottom: "1.5rem" }}></div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                                        {[1, 2, 3, 4].map((j) => (
                                            <div key={j} style={{ display: "flex", gap: "1rem" }}>
                                                <div style={{ width: "50px", height: "50px", backgroundColor: "#e0e0e0", borderRadius: "8px" }}></div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ width: "80%", height: "14px", backgroundColor: "#e0e0e0", borderRadius: "4px", marginBottom: "0.5rem" }}></div>
                                                    <div style={{ width: "100%", height: "10px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        );
    }

    // Helper function to render a bundle card
    const renderBundleCard = (bundle: Bundle, index: number) => {
        const crossedOutPrice = (bundle.price * 1.3).toFixed(2);

        return (
            <div
                key={bundle.id}
                style={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Product Image */}
                <div
                    style={{
                        backgroundColor: "#e8e6e1",
                        padding: "3rem",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "550px",
                        position: "relative",
                    }}
                >
                    {bundle.imageUrl ? (
                        <img
                            src={bundle.imageUrl}
                            alt={bundle.name}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: "150px",
                                height: "150px",
                                backgroundColor: primaryColor,
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span style={{ fontFamily, color: "white", fontSize: "1.5rem", textAlign: "center", padding: "1rem" }}>
                                {bundle.name.substring(0, 20)}
                            </span>
                        </div>
                    )}
                    <GetStartedButton
                        formId={bundle.formId}
                        slug={bundle.slug}
                        primaryColor={primaryColor}
                        variant="pill"
                        style={{
                            position: "absolute",
                            bottom: "1.5rem",
                            right: "1.5rem",
                        }}
                    />
                </div>

                {/* Product Info */}
                <div style={{ padding: "2rem" }}>
                    <h3
                        style={{
                            fontSize: "1.75rem",
                            fontFamily,
                            fontWeight: "400",
                            marginBottom: "0.5rem",
                        }}
                    >
                        {bundle.name}
                    </h3>
                    <div style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
                        <span style={{ fontWeight: "600" }}>From ${bundle.price.toFixed(2)}/mo</span>
                        <span
                            style={{
                                textDecoration: "line-through",
                                color: "#999",
                                marginLeft: "0.5rem",
                                fontSize: "0.95rem",
                            }}
                        >
                            ${crossedOutPrice}
                        </span>
                    </div>

                    {bundle.description && (
                        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>
                            {bundle.description}
                        </p>
                    )}

                    <div
                        style={{
                            fontSize: "0.7rem",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#666",
                            marginBottom: "1rem",
                            fontWeight: "500",
                        }}
                    >
                        WHAT'S INCLUDED ({bundle.includedItems.length} items)
                    </div>

                    {/* Included Items - 2x2 Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
                        {bundle.includedItems.map((item, itemIndex) => (
                            <div key={item.id} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                <div
                                    style={{
                                        width: "50px",
                                        height: "50px",
                                        backgroundColor: itemIndex % 2 === 0 ? primaryColor : "#8b7355",
                                        borderRadius: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <span style={{ color: "white", fontSize: "0.75rem", fontWeight: "600" }}>
                                        {itemIndex + 1}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                        {item.customName}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                        {item.customSig}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>
                                        via {item.pharmacyName}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#f5f3ef", fontFamily: fontFamily || "system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <header
                style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e5e5e5",
                    padding: "1rem 2rem",
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                }}
            >
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    {/* Logo */}
                    {logo ? (
                        <img src={logo} alt="Logo" style={{ height: "2rem", objectFit: "contain" }} />
                    ) : (
                        <div style={{ fontSize: "2rem", fontWeight: "300", letterSpacing: "0.05em", fontFamily }}>AG1</div>
                    )}

                    {/* Navigation */}
                    <nav style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
                        <a href="#" style={{ textDecoration: "none", color: "#000", fontSize: "0.9rem" }}>
                            AG1 for Daily Health
                        </a>
                        <a
                            href="#"
                            style={{
                                textDecoration: "none",
                                color: "#000",
                                fontSize: "0.9rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            AGZ for Rest
                            <span
                                style={{
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                    padding: "0.15rem 0.4rem",
                                    fontSize: "0.7rem",
                                    fontWeight: "600",
                                    borderRadius: "3px",
                                }}
                            >
                                NEW
                            </span>
                        </a>
                        <a href="#" style={{ textDecoration: "none", color: "#000", fontSize: "0.9rem" }}>
                            Learn More
                        </a>
                    </nav>

                    {/* Right side buttons */}
                    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                        <button
                            onClick={() => router.push('/all-products')}
                            style={{
                                backgroundColor: primaryColor,
                                color: "#fff",
                                border: "none",
                                padding: "0.5rem 1.5rem",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                borderRadius: "0.125rem",
                                cursor: "pointer",
                            }}
                        >
                            Shop All
                        </button>
                        <button
                            onClick={() => router.push(dashboardPrefix)}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0.5rem",
                            }}
                        >
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="8" r="5" />
                                <path d="M20 21a8 8 0 1 0-16 0" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section
                style={{
                    backgroundColor: "#f5f3ef",
                    padding: "4rem 2rem",
                    minHeight: "500px",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "4rem",
                        alignItems: "center",
                    }}
                >
                    {/* Left Content */}
                    <div>
                        <div
                            style={{
                                fontSize: "0.875rem",
                                color: "#737373",
                                marginBottom: "0.5rem",
                            }}
                        >
                            SHOP
                        </div>
                        <h1
                            style={{
                                fontSize: "3rem",
                                fontFamily,
                                fontWeight: "400",
                                marginBottom: "0.75rem",
                            }}
                        >
                            Bundle & Save
                        </h1>
                        <p style={{ color: "#404040" }}>
                            Our best offerings and all include Welcome Kit and Shaker**
                        </p>
                    </div>

                    {/* Right Image */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                width: "100%",
                                maxWidth: "500px",
                                aspectRatio: "1",
                                backgroundColor: "#fff",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/ag1-product-box-with-supplements-inside.webp"
                                alt="AG1 Bundle Box"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Filter Tabs */}
            <section style={{ backgroundColor: "#f5f3ef", padding: "0 2rem 3rem" }}>
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                        display: "flex",
                        gap: "0.5rem",
                    }}
                >
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "white",
                            color: "inherit",
                            border: "1px solid #d4d4d4",
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                        }}
                    >
                        All
                    </button>
                    <button
                        style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: primaryColor,
                            color: "white",
                            border: "none",
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                        }}
                    >
                        Bundles
                    </button>
                    <button
                        style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "white",
                            color: "inherit",
                            border: "1px solid #d4d4d4",
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                        }}
                    >
                        Daily Health
                    </button>
                    <button
                        style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "white",
                            color: "inherit",
                            border: "1px solid #d4d4d4",
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                        }}
                    >
                        Rest & Restore
                    </button>
                </div>
            </section>

            {/* Bundle Cards */}
            <section style={{ backgroundColor: "#f5f3ef", padding: "0 2rem 4rem" }}>
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                    }}
                >
                    {bundlesLoading ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2rem" }}>
                            {[1, 2].map((i) => (
                                <div key={i} style={{ backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden" }}>
                                    <div style={{ backgroundColor: "#e8e6e1", height: "300px" }}></div>
                                    <div style={{ padding: "2rem" }}>
                                        <div style={{ width: "200px", height: "28px", backgroundColor: "#e0e0e0", borderRadius: "4px", marginBottom: "1rem" }}></div>
                                        <div style={{ width: "120px", height: "20px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "2rem",
                            }}
                        >
                            {/* Dynamic bundles from database */}
                            {bundles.map(renderBundleCard)}

                            {/* Full Foundation Stack - Placeholder - HIDDEN */}
                            {false && <div
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                {/* Product Image */}
                                <div
                                    style={{
                                        backgroundColor: "#e8e6e1",
                                        padding: "3rem",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        height: "550px",
                                        position: "relative",
                                    }}
                                >
                                    <img
                                        src="/ag1-pouch-with-ag-omega-bottle-travel-packs-canist.webp"
                                        alt="Full Foundation Stack"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                        }}
                                    />
                                    <GetStartedButton
                                        primaryColor={primaryColor}
                                        variant="pill"
                                        style={{
                                            position: "absolute",
                                            bottom: "1.5rem",
                                            right: "1.5rem",
                                        }}
                                    />
                                </div>

                                {/* Product Info */}
                                <div style={{ padding: "2rem" }}>
                                    <h3
                                        style={{
                                            fontSize: "1.75rem",
                                            fontFamily,
                                            fontWeight: "400",
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        Full Foundation Stack
                                    </h3>
                                    <div
                                        style={{
                                            fontSize: "1.1rem",
                                            marginBottom: "1.5rem",
                                        }}
                                    >
                                        <span style={{ fontWeight: "600" }}>$108/mo</span>
                                        <span
                                            style={{
                                                textDecoration: "line-through",
                                                color: "#999",
                                                marginLeft: "0.5rem",
                                                fontSize: "0.95rem",
                                            }}
                                        >
                                            $138¹
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            color: "#666",
                                            marginBottom: "1rem",
                                            fontWeight: "500",
                                        }}
                                    >
                                        WHAT'S INCLUDED
                                    </div>

                                    {/* Included Items */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem" }}>
                                        {/* AG1 Pouch */}
                                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    backgroundColor: "#e8e6e1",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <img src="/ag1-pouch-icon.webp" alt="AG1 Pouch" style={{ width: "35px" }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>AG1: Pouch</div>
                                                <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                                    Nutrients and gut health support in one Daily Health Drink™ — 30 servings shipped every 30 days.
                                                </div>
                                            </div>
                                        </div>

                                        {/* AG Omega3 */}
                                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    backgroundColor: "#e8e6e1",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <img src="/omega3-bottle-icon.webp" alt="AG Omega3" style={{ width: "35px" }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>AG Omega3</div>
                                                <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                                    Complements AG1 for added brain support with high quality fish oil — 30 servings shipped every 30 days.
                                                </div>
                                            </div>
                                        </div>

                                        {/* Free Bottle of AG Vitamin D3+K2 */}
                                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    backgroundColor: "#e8e6e1",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <img src="/vitamin-d-dropper-bottle-icon.webp" alt="Vitamin D3+K2" style={{ width: "35px" }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                                    Free Bottle of AG Vitamin D3+K2
                                                </div>
                                                <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                                    Complements AG1 for added immune support with liquid drops.*
                                                </div>
                                            </div>
                                        </div>

                                        {/* More Included */}
                                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    backgroundColor: "#d4b896",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                    fontSize: "1.2rem",
                                                    fontWeight: "600",
                                                    color: "#fff",
                                                }}
                                            >
                                                +2
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                                    More Included!
                                                </div>
                                                <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                                    Learn more to see the complete set of what's in this bundle.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#999",
                                            marginTop: "1.5rem",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        *Value of one-time purchase
                                    </div>
                                </div>
                            </div>}
                        </div>
                    )}
                </div>
            </section>

            {/* Home & Away Pack - Placeholder - HIDDEN */}
            {false &&
                <section
                    style={{
                        backgroundColor: "#f5f3ef",
                        padding: "0 2rem 4rem",
                    }}
                >
                    <div
                        style={{
                            maxWidth: "1400px",
                            margin: "0 auto",
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: "12px",
                                overflow: "hidden",
                                display: "grid",
                                gridTemplateColumns: "400px 1fr",
                                maxWidth: "900px",
                            }}
                        >
                            {/* Product Image */}
                            <div
                                style={{
                                    backgroundColor: "#e8e6e1",
                                    padding: "3rem",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    position: "relative",
                                    minHeight: "550px",
                                }}
                            >
                                <img
                                    src="/ag1-two-pouches-with-travel-packs-canister-shaker-.webp"
                                    alt="Home & Away Pack"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                    }}
                                />
                                <GetStartedButton
                                    primaryColor={primaryColor}
                                    variant="pill"
                                    style={{
                                        position: "absolute",
                                        bottom: "1.5rem",
                                        right: "1.5rem",
                                    }}
                                />
                            </div>

                            {/* Product Info */}
                            <div style={{ padding: "2rem" }}>
                                <h3
                                    style={{
                                        fontSize: "1.75rem",
                                        fontFamily,
                                        fontWeight: "400",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Home & Away Pack
                                </h3>
                                <div
                                    style={{
                                        fontSize: "1.1rem",
                                        marginBottom: "1.5rem",
                                    }}
                                >
                                    <span style={{ fontWeight: "600" }}>$168/ships every 60 days</span>
                                    <span
                                        style={{
                                            textDecoration: "line-through",
                                            color: "#999",
                                            marginLeft: "0.5rem",
                                            fontSize: "0.95rem",
                                        }}
                                    >
                                        $208¹
                                    </span>
                                </div>

                                <div
                                    style={{
                                        fontSize: "0.7rem",
                                        letterSpacing: "0.1em",
                                        textTransform: "uppercase",
                                        color: "#666",
                                        marginBottom: "1rem",
                                        fontWeight: "500",
                                    }}
                                >
                                    WHAT'S INCLUDED
                                </div>

                                {/* Included Items - Two Columns */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    {/* AG1 Pouch */}
                                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                        <div
                                            style={{
                                                width: "45px",
                                                height: "45px",
                                                backgroundColor: "#e8e6e1",
                                                borderRadius: "8px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <img src="/ag1-pouch-icon.webp" alt="AG1 Pouch" style={{ width: "30px" }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.25rem" }}>AG1: Pouch</div>
                                            <div style={{ fontSize: "0.75rem", color: "#666", lineHeight: "1.4" }}>
                                                Nutrients and gut health support in one Daily Health Drink™ — 30 servings shipped every 60 days.
                                            </div>
                                        </div>
                                    </div>

                                    {/* AG1: Travel Packs */}
                                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                        <div
                                            style={{
                                                width: "45px",
                                                height: "45px",
                                                backgroundColor: "#e8e6e1",
                                                borderRadius: "8px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <img src="/travel-packs-icon.webp" alt="Travel Packs" style={{ width: "30px" }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                                                AG1: Travel Packs
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "#666", lineHeight: "1.4" }}>
                                                Take your Daily Health Drink on-the-go with 30 individual Travel Packs — 30 servings shipped every 60 days.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Free Bottle of AG Vitamin D3+K2 */}
                                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                        <div
                                            style={{
                                                width: "45px",
                                                height: "45px",
                                                backgroundColor: "#e8e6e1",
                                                borderRadius: "8px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <img src="/vitamin-d-dropper-bottle-icon.webp" alt="Vitamin D3+K2" style={{ width: "30px" }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                                                Free Bottle of AG Vitamin D3+K2
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "#666", lineHeight: "1.4" }}>
                                                Complements AG1 for added immune support with liquid drops.*
                                            </div>
                                        </div>
                                    </div>

                                    {/* More Included */}
                                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                        <div
                                            style={{
                                                width: "45px",
                                                height: "45px",
                                                backgroundColor: "#d4b896",
                                                borderRadius: "8px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                fontSize: "1rem",
                                                fontWeight: "600",
                                                color: "#fff",
                                            }}
                                        >
                                            +1
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                                                More Included!
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "#666", lineHeight: "1.4" }}>
                                                Learn more to see the complete set of what's in this bundle.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#999",
                                        marginTop: "1.5rem",
                                        fontStyle: "italic",
                                    }}
                                >
                                    *Value of one-time purchase
                                </div>
                            </div>
                        </div>
                    </div>
                </section>}

            {/* Back to Products Button */}
            <section style={{ backgroundColor: "#f5f3ef", padding: "0 2rem 4rem" }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "center" }}>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            backgroundColor: primaryColor,
                            color: "white",
                            padding: "1rem 3rem",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "1rem",
                            fontWeight: 600,
                        }}
                    >
                        Back to All Products
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ backgroundColor: "#0d3d3d", color: "white", padding: "4rem 0 2rem" }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 2rem" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "2rem",
                            marginBottom: "3rem",
                        }}
                    >
                        <div>
                            <h4 style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>Shop</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="#" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        All Products
                                    </a>
                                </li>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="#" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        Bundles
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>Support</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="#" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        Contact Us
                                    </a>
                                </li>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="#" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        FAQ
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>Legal</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="/privacy" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        Privacy Policy
                                    </a>
                                </li>
                                <li style={{ marginBottom: "0.5rem" }}>
                                    <a href="/terms" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.85rem" }}>
                                        Terms of Service
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>Connect</h4>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <a href="#" style={{ color: "white" }}>
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                                    </svg>
                                </a>
                                <a href="#" style={{ color: "white" }}>
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                            paddingTop: "2rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            opacity: 0.7,
                        }}
                    >
                        <div style={{ display: "flex", gap: "2rem" }}>
                            <a href="/privacy" style={{ color: "#fff", textDecoration: "none" }}>
                                Privacy
                            </a>
                            <a href="/terms" style={{ color: "#fff", textDecoration: "none" }}>
                                Terms & Conditions
                            </a>
                        </div>
                        <div>© 2025 All Rights Reserved</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
