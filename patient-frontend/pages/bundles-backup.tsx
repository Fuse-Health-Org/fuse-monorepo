export default function BundlesPage() {
    return (
        <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <header
                style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solidrgb(26, 20, 20)",
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
                    <div style={{ fontSize: "2rem", fontWeight: "300", letterSpacing: "0.05em" }}>AG1</div>

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
                                    backgroundColor: "#00ff00",
                                    color: "#000",
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
                            style={{
                                backgroundColor: "#00ff00",
                                color: "#000",
                                border: "none",
                                padding: "0.75rem 1.5rem",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                borderRadius: "6px",
                                cursor: "pointer",
                            }}
                        >
                            Shop All
                        </button>
                        <button
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0.5rem",
                            }}
                        >
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.6 5.2M17 13l1.6 5.2M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                            </svg>
                        </button>
                        <button
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
                                fontFamily: "Georgia, serif",
                                fontWeight: "400",
                                marginBottom: "0.75rem",
                            }}
                        >
                            Bundle & Save
                        </h1>
                        <p
                            style={{
                                color: "#404040",
                            }}
                        >
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
            <section
                style={{
                    backgroundColor: "#f5f3ef",
                    padding: "0 2rem 3rem",
                }}
            >
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                        display: "flex",
                        gap: "0.5rem",
                    }}
                >
                    <button
                        onClick={() => window.location.href = "/"}
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
                            backgroundColor: "#8b7355",
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
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "2rem",
                    }}
                >
                    {/* Customize Your Own Bundle */}
                    <div
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
                                minHeight: "300px",
                                position: "relative",
                            }}
                        >
                            <img
                                src="/ag1-pouch-with-travel-packs-canister-and-shaker.webp"
                                alt="Customize Bundle"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                }}
                            />
                            <button
                                style={{
                                    position: "absolute",
                                    bottom: "1.5rem",
                                    right: "1.5rem",
                                    backgroundColor: "#004d4d",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "0.9rem",
                                    fontWeight: "500",
                                    borderRadius: "25px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                Add to Cart
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.6 5.2M17 13l1.6 5.2" />
                                </svg>
                            </button>
                        </div>

                        {/* Product Info */}
                        <div style={{ padding: "2rem" }}>
                            <h3
                                style={{
                                    fontSize: "1.75rem",
                                    fontFamily: "Georgia, serif",
                                    fontWeight: "400",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Customize Your Own Bundle
                            </h3>
                            <div
                                style={{
                                    fontSize: "1.1rem",
                                    marginBottom: "1.5rem",
                                }}
                            >
                                <span style={{ fontWeight: "600" }}>Starting at $79/mo</span>
                                <span
                                    style={{
                                        textDecoration: "line-through",
                                        color: "#999",
                                        marginLeft: "0.5rem",
                                        fontSize: "0.95rem",
                                    }}
                                >
                                    $99¹
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

                                {/* Free 3ct Travel Packs */}
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
                                        <img src="/travel-packs-icon.webp" alt="Travel Packs" style={{ width: "35px" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                            Free 3ct Travel Packs
                                        </div>
                                        <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                            Take your Daily Health Drink on-the-go with 3 individual Travel Packs.
                                        </div>
                                    </div>
                                </div>

                                {/* Free Welcome Kit */}
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
                                        <img src="/canister-and-shaker-icon.webp" alt="Welcome Kit" style={{ width: "35px" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: "600", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                            Free Welcome Kit**
                                        </div>
                                        <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.5" }}>
                                            Includes AG1 canister, scoop, and a Shaker.
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

                    {/* Full Foundation Stack */}
                    <div
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
                                minHeight: "300px",
                                position: "relative",
                            }}
                        >
                            <img
                                src="/ag1-pouch-with-ag-omega-bottle-travel-packs-canist.webp"
                                alt="Full Foundation Stack"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                }}
                            />
                            <button
                                style={{
                                    position: "absolute",
                                    bottom: "1.5rem",
                                    right: "1.5rem",
                                    backgroundColor: "#004d4d",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "0.9rem",
                                    fontWeight: "500",
                                    borderRadius: "25px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                Add to Cart
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.6 5.2M17 13l1.6 5.2" />
                                </svg>
                            </button>
                        </div>

                        {/* Product Info */}
                        <div style={{ padding: "2rem" }}>
                            <h3
                                style={{
                                    fontSize: "1.75rem",
                                    fontFamily: "Georgia, serif",
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
                                            Complements AG1 for added brain support with high quality fish oil — 30 servings shipped every 30
                                            days.
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
                    </div>
                </div>
            </section>

            {/* Home & Away Pack - Full Width */}
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
                            }}
                        >
                            <img
                                src="/ag1-two-pouches-with-travel-packs-canister-shaker-.webp"
                                alt="Home & Away Pack"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                }}
                            />
                            <button
                                style={{
                                    position: "absolute",
                                    bottom: "1.5rem",
                                    right: "1.5rem",
                                    backgroundColor: "#004d4d",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "0.9rem",
                                    fontWeight: "500",
                                    borderRadius: "25px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                Add to Cart
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.6 5.2M17 13l1.6 5.2" />
                                </svg>
                            </button>
                        </div>

                        {/* Product Info */}
                        <div style={{ padding: "2rem" }}>
                            <h3
                                style={{
                                    fontSize: "1.75rem",
                                    fontFamily: "Georgia, serif",
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
                                            Take your Daily Health Drink on-the-go with 30 individual Travel Packs — 30 servings shipped every
                                            60 days.
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
            </section>

            {/* Footer */}
            <footer
                style={{
                    backgroundColor: "#003d3d",
                    color: "#fff",
                    padding: "4rem 2rem 2rem",
                }}
            >
                <div
                    style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                    }}
                >
                    {/* Footer Links Grid */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(6, 1fr)",
                            gap: "3rem",
                            marginBottom: "3rem",
                        }}
                    >
                        {/* SHOP */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                SHOP
                            </h4>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        All Products
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Gut Health
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Sleep Support
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Bundles
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* DAILY HEALTH */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                DAILY HEALTH
                            </h4>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        What is AG1?
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Research
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        How Quality & Testing
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Ingredients
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Benefits
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Quiz
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* REST & RESTORE */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                REST & RESTORE
                            </h4>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        What is AGZ?
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AGZ Quality & Testing
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AGZ Ingredients
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AGZ Recipes
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* LEARN MORE */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                LEARN MORE
                            </h4>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        About Us
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Leadership
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Refer Friends
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Partnerships
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Impact Report
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Membership
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Accessibility Statement
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        AG1 Reviews
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Blog
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* CONTACT & SUPPORT */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                CONTACT & SUPPORT
                            </h4>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        My Account
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Track Your Order
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Help
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Careers
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Product Authentication
                                    </a>
                                </li>
                                <li>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        FAQs
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* CONNECT */}
                        <div>
                            <h4
                                style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    marginBottom: "1.5rem",
                                    fontWeight: "600",
                                }}
                            >
                                CONNECT
                            </h4>
                            <div>
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <a href="#" style={{ color: "#fff", textDecoration: "none", fontSize: "0.9rem", opacity: 0.8 }}>
                                        Join Our Newsletter
                                    </a>
                                </div>
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <input
                                        type="email"
                                        placeholder="Your Email"
                                        style={{
                                            width: "100%",
                                            padding: "0.75rem 1rem",
                                            borderRadius: "25px",
                                            border: "none",
                                            fontSize: "0.85rem",
                                            backgroundColor: "#fff",
                                            color: "#000",
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: "1rem", fontSize: "1.2rem" }}>
                                    <a href="#" style={{ color: "#fff", opacity: 0.8 }}>
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
                                        </svg>
                                    </a>
                                    <a href="#" style={{ color: "#fff", opacity: 0.8 }}>
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                                        </svg>
                                    </a>
                                    <a href="#" style={{ color: "#fff", opacity: 0.8 }}>
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                                        </svg>
                                    </a>
                                    <a href="#" style={{ color: "#fff", opacity: 0.8 }}>
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                        </svg>
                                    </a>
                                    <a href="#" style={{ color: "#fff", opacity: 0.8 }}>
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div
                        style={{
                            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                            marginBottom: "2rem",
                        }}
                    />

                    {/* Bottom Section */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "200px 1fr 200px",
                            gap: "3rem",
                            alignItems: "start",
                        }}
                    >
                        {/* AG1 Logo */}
                        <div>
                            <div
                                style={{
                                    fontSize: "5rem",
                                    fontWeight: "300",
                                    letterSpacing: "0.05em",
                                    lineHeight: "1",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                AG1<sup style={{ fontSize: "1.5rem", verticalAlign: "super" }}>®</sup>
                            </div>
                        </div>

                        {/* Legal Text */}
                        <div
                            style={{
                                fontSize: "0.7rem",
                                lineHeight: "1.6",
                                opacity: 0.7,
                            }}
                        >
                            <div
                                style={{
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                    padding: "1rem",
                                    borderRadius: "8px",
                                    marginBottom: "1rem",
                                }}
                            >
                                **These statements have not been evaluated by the Food and Drug Administration. This product is not
                                intended to diagnose, treat, cure, or prevent any disease.
                            </div>
                            <p style={{ marginBottom: "0.75rem" }}>
                                Information on this site is provided for informational purposes only. It is not meant to substitute for
                                medical advice from your physician or other medical professional. You should not use the information
                                contained herein for diagnosing or treating a health problem or disease, or prescribing any medication.
                                Carefully read all product documentation. If you have or suspect that you have a medical problem,
                                promptly contact your regular health care provider.
                            </p>
                            <p style={{ marginBottom: "0.75rem" }}>
                                ¹$79.20 Welcome Kit Offer valid for new AG1 subscribers only. AGZ Starter Offer valid for first AG1...
                            </p>
                            <p style={{ marginBottom: "0.75rem" }}>Annual Packaging: May Vary</p>
                            <p style={{ marginBottom: "0.75rem" }}>
                                *Some shipping for subscription purchases licensed by U.S. customers only.
                            </p>
                        </div>

                        {/* Language and Currency */}
                        <div style={{ textAlign: "right" }}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "1rem",
                                    alignItems: "flex-end",
                                }}
                            >
                                <button
                                    style={{
                                        backgroundColor: "transparent",
                                        border: "1px solid rgba(255, 255, 255, 0.3)",
                                        color: "#fff",
                                        padding: "0.5rem 1rem",
                                        borderRadius: "20px",
                                        cursor: "pointer",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                    </svg>
                                    English
                                </button>
                                <button
                                    style={{
                                        backgroundColor: "transparent",
                                        border: "1px solid rgba(255, 255, 255, 0.3)",
                                        color: "#fff",
                                        padding: "0.5rem 1rem",
                                        borderRadius: "20px",
                                        cursor: "pointer",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    $ United States (USD)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Links */}
                    <div
                        style={{
                            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                            marginTop: "2rem",
                            paddingTop: "2rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.85rem",
                            opacity: 0.7,
                        }}
                    >
                        <div style={{ display: "flex", gap: "2rem" }}>
                            <a href="#" style={{ color: "#fff", textDecoration: "none" }}>
                                Privacy
                            </a>
                            <a href="#" style={{ color: "#fff", textDecoration: "none" }}>
                                Do Not Sell My Personal Info
                            </a>
                            <a href="#" style={{ color: "#fff", textDecoration: "none" }}>
                                Terms & Conditions
                            </a>
                        </div>
                        <div>© 2025 AG1</div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
