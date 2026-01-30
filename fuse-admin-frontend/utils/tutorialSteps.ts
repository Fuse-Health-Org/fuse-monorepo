export interface TutorialStep {
  target: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disableBeacon?: boolean;
  hideOverlay?: boolean;
  hideNextButton?: boolean;
}

export const tutorialSteps: TutorialStep[] = [
  {
    target: "#tutorial-step-1",
    content: "Welcome! Here you can customize your company logo. Click to upload an image.",
    placement: "left",
  },
  {
    target: "#tutorial-step-2",
    content: "Here you can configure all your organization information.",
    placement: "top",
  },
  {
    target: "#tutorial-step-3",
    content: "Great! Now let's set up your products. Click here to go to the products page.",
    placement: "right",
  },
  {
    target: "#select-products-btn",
    content: "Here you can select products from our catalog.",
    placement: "right",
  },
  {
    target: "#first-product-item",
    content: "Perfect! Here you can add new products to your catalog. Click \"Activate\".",
    placement: "top",
    hideNextButton: true,
  },
  {
    target: "#my-products-btn",
    content: "After enabling your product, you can view it in your My Products tab.",
    placement: "right",
  },
  {
    target: "#first-product-item",
    content: "Perfect! Here is your product enabled.",
    placement: "top",
  },
];

export const enableProductSteps: TutorialStep[] = [
  {
    target: "#enable-product-for-clinic",
    content: "Perfect! Now let's enable the product for your clinic.",
    placement: "right",
  },
];
