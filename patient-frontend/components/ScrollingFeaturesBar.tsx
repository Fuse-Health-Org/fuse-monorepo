import React, { useEffect, useRef, useState } from 'react';

const features = [
  { icon: "flask", text: "Compounded in the USA" },
  { icon: "tag", text: "Upfront Pricing" },
  { icon: "headset", text: "Human Support" },
  { icon: "wallet", text: "FSA & HSA Eligible" },
  { icon: "shield", text: "FDA Registered Labs" },
  { icon: "globe", text: "100% Online" },
  { icon: "message", text: "24/7 Provider Messaging" },
  { icon: "sparkle", text: "Customized to your Needs" },
];

const FeatureIcon = ({ icon }: { icon: string }) => {
  switch (icon) {
    case "flask":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6v8l4 7H5l4-7V3z" />
          <path d="M10 3h4" />
        </svg>
      );
    case "tag":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "headset":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      );
    case "wallet":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    case "shield":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "globe":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "message":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
          <path d="M19 12l1 2 1-2 2-1-2-1-1-2-1 2-2 1 2 1z" />
        </svg>
      );
    default:
      return null;
  }
};

interface ScrollingFeaturesBarProps {
  textColor?: string;
  position?: "static" | "absolute";
}

export default function ScrollingFeaturesBar({ textColor = "#004d4d", position = "static" }: ScrollingFeaturesBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const scroll = () => {
      if (scrollRef.current) {
        const scrollWidth = scrollRef.current.scrollWidth;
        const clientWidth = scrollRef.current.clientWidth;
        const maxScroll = scrollWidth / 2; // Half because we have 2 sets

        setScrollPosition((prev) => {
          const newPosition = prev + 0.5; // Speed of scroll (pixels per frame)
          
          // When we reach the end of the first set, reset to 0
          if (newPosition >= maxScroll) {
            return 0;
          }
          
          return newPosition;
        });
      }
      
      animationRef.current = requestAnimationFrame(scroll);
    };

    animationRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: "transparent",
        color: textColor,
        padding: "1rem 0",
        overflow: "hidden",
        position: position,
        bottom: position === "absolute" ? 0 : undefined,
        left: position === "absolute" ? 0 : undefined,
        right: position === "absolute" ? 0 : undefined,
        zIndex: position === "absolute" ? 20 : undefined,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          transform: `translateX(-${scrollPosition}px)`,
          willChange: "transform",
        }}
      >
        {/* First set of features */}
        {features.map((feature, idx) => (
          <div
            key={`first-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0 2rem",
              whiteSpace: "nowrap",
              fontSize: "0.9rem",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            <FeatureIcon icon={feature.icon} />
            <span>{feature.text}</span>
          </div>
        ))}
        {/* Duplicate set for seamless loop */}
        {features.map((feature, idx) => (
          <div
            key={`second-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0 2rem",
              whiteSpace: "nowrap",
              fontSize: "0.9rem",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            <FeatureIcon icon={feature.icon} />
            <span>{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

