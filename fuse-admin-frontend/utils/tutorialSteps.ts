export const tutorialSteps = [
  {
    target: "#tutorial-step-1",
    content:
      "Welcome! Here you can customize your company logo. Click to upload an image.",
    placement: "left" as const,
    disableBeacon: true,
  },
  {
    target: "#tutorial-step-2",
    content: "Here you can configure all your organization information.",
    placement: "top" as const,
    disableScrolling: true,
    // Hide overlay/spotlight for this step to prevent blinking when scrolling
    styles: {
      overlay: {
        opacity: 0,
        pointerEvents: 'none' as const,
      },
      spotlight: {
        opacity: 0,
      },
    },
  },
  {
    target: "#tutorial-step-3",
    content: "Great! Now let's set up your products. Click here to go to the products page.",
    placement: "right" as const,
  },
  {
    target: "#select-products-btn",
    content: "Here you can select products from our catalog.",
    placement: "right" as const,
  },
  {
    target: ".product-card",
    content: "Perfect! Here you can add new products to your catalog.",
    placement: "top" as const,
  },
  {
    target: ".enable-product-btn",
    content: "Let's enable your first product!",
    placement: "top" as const,
  },
  {
    target: "#my-products-btn",
    content: "After enabling your product, you can view it in your My Products tab.",
    placement: "right" as const,
  },
  {
    target: ".product-card",
    content: "Perfect! Here is your product enabled.",
    placement: "top" as const,
  },
];

export const enableProductSteps = [
  {
    target: "#enable-product-for-clinic",
    content: "Perfect! Now let's enable the product for your clinic.",
    placement: "right" as const,
    disableBeacon: true,
  },
];