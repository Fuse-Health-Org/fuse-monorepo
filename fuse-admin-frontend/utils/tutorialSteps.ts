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
    target: "#tutorial-step-programs",
    content: "Great! Now let's set up your programs. Click here to go to the programs page.",
    placement: "right",
  },
  {
    target: "#first-program-template",
    content: "Here you can use pre-built templates. Click \"Use Template\".",
    placement: "top",
    hideNextButton: true,
  },
  {
    target: "#first-program-card",
    content: "Great! Your program was created successfully.",
    placement: "top",
  },
  {
    target: "#tutorial-step-portal",
    content: "You can find your Portal in the Portal section.",
    placement: "right",
  },
  {
    target: "#brand-portal-url-section",
    content: "Perfect! Here is your Portal URL that you can share with patients.",
    placement: "top",
  },
  {
    target: "#tutorial-step-overview",
    content: "Now click Overview to manage your brand and see analytics.",
    placement: "right",
  },
  {
    target: "#overview-dashboard",
    content: "Here you can view your brand's performance, revenue, recent activity, and key metrics at a glance.",
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
