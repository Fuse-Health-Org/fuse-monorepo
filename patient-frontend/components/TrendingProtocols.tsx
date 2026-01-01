import React from 'react';

interface TrendingProtocolsProps {
  primaryColor: string;
}

const TrendingProtocols: React.FC<TrendingProtocolsProps> = ({ primaryColor }) => {
  // Mock data for trending protocols
  const protocols = [
    {
      id: 1,
      name: "AG1 Pouch",
      description: "All-in-one gut and health support in one Daily Health Drink.*",
      price: 79,
      originalPrice: 99,
      color: "#004d4d",
      badges: [{ label: "Recovery", color: "#10b981" }],
    },
    {
      id: 2,
      name: "AG1 Travel Packs",
      description: "Plan your Daily Health Dose on-the-go with 30 individual Travel Packs.",
      price: 89,
      originalPrice: 109,
      color: "#004d4d",
      badges: [
        { label: "Recovery", color: "#10b981" },
        { label: "Flexibility", color: "#a855f7" },
      ],
    },
    {
      id: 3,
      name: "AGZ",
      description: "Individual Travel Packs, 30 servings. Ease your mind & body into restful sleep without feeling groggy, magnesium & adaptogens.*",
      price: 79,
      originalPrice: 99,
      color: "#8b7355",
      badges: [
        { label: "Muscle Growth", color: "#3b82f6" },
        { label: "Fat Loss", color: "#ef4444" },
      ],
    },
    {
      id: 4,
      name: "AG2 Variety Pack (3Pk)",
      description: "Ease your mind and body into restful sleep with calming tones, magnesium & adaptogens. Try 10 individual packs in Berry, Chocolate, Chocolate Mint.*",
      price: 39.99,
      originalPrice: null,
      color: null,
      isVariety: true,
      badges: [],
    },
    {
      id: 5,
      name: "AG Omega3",
      description: "Complements AG1 for added brain support with high quality fish oil.*",
      price: 35,
      originalPrice: 59,
      color: "#004d4d",
      isCircle: true,
      badges: [],
    },
    {
      id: 6,
      name: "AG Vitamin D3+K2",
      description: "Complements AG1 for added immune support with liquid drops.*",
      price: 29,
      originalPrice: null,
      color: "#004d4d",
      isBottle: true,
      badges: [],
    },
  ];

  return (
    <div style={{ marginBottom: "4rem" }}>
      {/* Title Section */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.875rem", color: "#737373", marginBottom: "0.5rem" }}>TRENDING</p>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "3rem", marginBottom: "0.75rem", fontWeight: 400 }}>
          Trending Protocols
        </h2>
        <p style={{ color: "#404040" }}>
          Discover the most popular health protocols from our community.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "3rem" }}>
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
          All
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

      {/* Protocols Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2rem",
        }}
      >
        {protocols.map((protocol) => (
          <div key={protocol.id} style={{ cursor: "pointer", position: "relative" }}>
            {/* Heart Button */}
            <button
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "50%",
                width: "2.5rem",
                height: "2.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

            {/* Product Image */}
            <div
              style={{
                backgroundColor: "#e8e6e1",
                borderRadius: "0.5rem",
                padding: "2rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1/1",
              }}
            >
              {protocol.isVariety ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ width: "2.5rem", height: "10rem", backgroundColor: "#7c3aed", borderRadius: "0.25rem" }}></div>
                  <div style={{ width: "2.5rem", height: "10rem", backgroundColor: "#f9a8d4", borderRadius: "0.25rem" }}></div>
                  <div style={{ width: "2.5rem", height: "10rem", backgroundColor: "#6ee7b7", borderRadius: "0.25rem" }}></div>
                </div>
              ) : protocol.isCircle ? (
                <div
                  style={{
                    width: "8rem",
                    height: "8rem",
                    backgroundColor: protocol.color || "#004d4d",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.5rem" }}>AG</span>
                </div>
              ) : protocol.isBottle ? (
                <div style={{ width: "6rem", height: "10rem", backgroundColor: protocol.color || "#004d4d", borderRadius: "0.5rem" }}></div>
              ) : (
                <div
                  style={{
                    width: "8rem",
                    height: "12rem",
                    backgroundColor: protocol.color || "#004d4d",
                    borderRadius: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontFamily: "Georgia, serif", color: "white", fontSize: "1.875rem" }}>
                    {protocol.name.includes("AGZ") ? "AGZ" : "AG1"}
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 400 }}>
              {protocol.name}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#525252", marginBottom: "0.75rem", minHeight: "2.5rem" }}>
              {protocol.description}
            </p>

            {/* Price */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>
                {protocol.originalPrice ? `From $${protocol.price}/mo` : `$${protocol.price}`}
              </span>
              {protocol.originalPrice && (
                <span style={{ fontSize: "0.875rem", color: "#737373", textDecoration: "line-through" }}>
                  ${protocol.originalPrice}*
                </span>
              )}
            </div>

            {/* Badges */}
            {protocol.badges.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {protocol.badges.map((badge, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: badge.color,
                      color: "white",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "1rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingProtocols;

