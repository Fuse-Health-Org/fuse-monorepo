import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

interface TierConfig {
  canAddCustomProducts: boolean;
  hasAccessToAnalytics: boolean;
  canUploadCustomProductImages: boolean;
  hasCustomPortal: boolean;
  hasPrograms: boolean;
  canCustomizeFormStructure: boolean;
  customTierCardText: string[] | null;
  isCustomTierCardTextActive: boolean;
  fuseFeePercent: number | null;
}

interface Plan {
  id: string;
  planType: string;
  name: string;
  description: string;
  monthlyPrice: number;
  regularPrice?: number;
  promotionalPriceText?: string;
  stripePriceId: string;
  introductoryStripePriceId?: string | null;
  maxProducts: number;
  maxCampaigns: number;
  analyticsAccess: boolean;
  customerSupport: string;
  customBranding: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  customIntegrations: boolean;
  sortOrder: number;
  tierConfig: TierConfig | null;
}

interface PricingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: Plan) => void;
}

export default function PricingPlansModal({
  isOpen,
  onClose,
  onSelectPlan,
}: PricingPlansModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/plans`,
      );
      const data = await response.json();

      if (data.success) {
        // Show only the main pricing plans (entry, standard, premium)
        // Filter out supercheap and other test plans
        const filteredPlans = data.plans.filter((plan: Plan) =>
          ["entry", "standard", "premium"].includes(plan.planType),
        );
        setPlans(filteredPlans);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan.id);
    // Save selected plan to localStorage
    localStorage.setItem("selectedPlanType", plan.planType);
    localStorage.setItem("selectedPlanName", plan.name);
    onSelectPlan(plan);
  };

  const getPlanFeatures = (plan: Plan) => {
    // If custom tier card text is active, use that
    if (
      plan.tierConfig?.isCustomTierCardTextActive &&
      plan.tierConfig?.customTierCardText
    ) {
      return plan.tierConfig.customTierCardText;
    }

    // Otherwise, generate features from plan details
    const features: string[] = [];

    if (plan.maxProducts === -1) {
      features.push("Unlimited products");
    } else {
      features.push(`Up to ${plan.maxProducts} products`);
    }

    if (plan.customBranding) {
      features.push("Custom branding");
    }

    if (plan.whiteLabel) {
      features.push("White label");
    }

    if (plan.analyticsAccess) {
      features.push("Analytics access");
    }

    if (plan.apiAccess) {
      features.push("API access");
    }

    if (plan.customIntegrations) {
      features.push("Custom integrations");
    }

    if (plan.tierConfig?.hasCustomPortal) {
      features.push("Custom portal");
    }

    if (plan.tierConfig?.hasPrograms) {
      features.push("Programs");
    }

    return features;
  };

  const getTransactionFee = (plan: Plan) => {
    if (
      plan.tierConfig?.fuseFeePercent !== null &&
      plan.tierConfig?.fuseFeePercent !== undefined
    ) {
      return `${plan.tierConfig.fuseFeePercent}% transaction fee`;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Pricing built for scale.
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Launch your compliant peptide brand with a predictable platform
              fee. No medical overhead, no complex clinic costs—just the
              infrastructure you need to monetize your demand.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const features = getPlanFeatures(plan);
                const transactionFee = getTransactionFee(plan);
                const isPopular = plan.sortOrder === 2; // Middle plan is typically popular

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border transition-all bg-card border-border/60 shadow-sm hover:border-border hover:shadow-md ${selectedPlan === plan.id ? "scale-105" : ""}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                        <span className="glow-button text-white px-3 py-1 rounded-full text-xs font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="p-6 pt-8 flex flex-col h-full">
                      {/* Plan Name */}
                      <h3 className="text-2xl font-bold text-foreground mb-3">
                        {plan.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                        {plan.description}
                      </p>

                      {/* Price */}
                      <div className="mb-8">
                        {/* Regular Price (strikethrough) */}
                        {plan.regularPrice ? (
                          <div className="flex items-baseline mb-0.5 h-3">
                            <span className="text-sm text-muted-foreground/70 line-through">
                              ${Number(plan.regularPrice).toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground/70 ml-1">
                              /month
                            </span>
                          </div>
                        ) : (
                          <div className="h-3" />
                        )}

                        {/* Current Price */}
                        <div className="flex items-baseline flex-wrap">
                          <span className="text-4xl font-bold text-foreground">
                            ${Number(plan.monthlyPrice).toLocaleString()}
                          </span>
                          <span className="text-base text-foreground ml-1">
                            {plan.promotionalPriceText || "/month"}
                          </span>
                        </div>

                        {/* Transaction Fee */}
                        {transactionFee && (
                          <p className="text-sm text-muted-foreground mt-1.5">
                            {transactionFee}
                          </p>
                        )}
                      </div>

                      {/* Features - flex-grow pushes button down */}
                      <div className="flex-grow">
                        <ul className="mb-6">
                          {features.map((feature, index) => (
                            <li 
                              key={index} 
                              className={`flex items-start gap-3 py-3 ${
                                index !== features.length - 1 
                                  ? 'border-b border-border/100' 
                                  : ''
                              }`}
                            >
                              <div
                                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5 ${
                                  isPopular ? "rounded-[3.75px]" : "rounded"
                                }`}
                                style={
                                  isPopular
                                    ? {
                                        background:
                                          "linear-gradient(318deg, rgb(255, 117, 31) 12%, rgb(176, 31, 255) 100%)",
                                      }
                                    : { background: "hsl(var(--muted))" }
                                }
                              >
                                <Check
                                  className={`h-3.5 w-3.5 ${
                                    isPopular
                                      ? "text-white"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </div>
                              <span className="text-sm text-foreground leading-relaxed">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA Button - always at bottom */}
                      {isPopular ? (
                        <div className="relative w-full mt-auto">
                          {/* Outer blur layer */}
                          <div
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background:
                                "linear-gradient(119deg, rgb(255, 255, 255) 19%, rgb(235, 235, 235) 85%)",
                              filter: "blur(0px)",
                            }}
                          />
                          {/* Inner gradient button */}
                          <button
                            onClick={() => handleSelectPlan(plan)}
                            className="text-lg relative w-full py-3 px-4 rounded-[10px] font-bold text-white transition-smooth shadow-[0_1px_4px_0_rgba(0,0,0,0.25)]"
                            style={{
                              background:
                                "linear-gradient(296deg, rgb(255, 117, 31) 0%, rgb(177, 31, 255) 104%)",
                            }}
                          >
                            Start Building
                          </button>
                        </div>
                      ) : (
                        <div className="relative w-full mt-auto">
                          {/* Outer glow layer */}
                          <div
                            className="absolute -inset-[2px] rounded-[12px] opacity-70 blur-sm"
                            style={{
                              background: 'linear-gradient(135deg, rgb(255, 117, 31) 0%, rgb(176, 31, 255) 100%)',
                            }}
                          />
                          {/* Button */}
                          <button
                            onClick={() => handleSelectPlan(plan)}
                            className="relative w-full py-3 px-4 rounded-[10px] font-bold text-foreground transition-smooth text-lg"
                            style={{
                              background: 'rgb(253, 250, 253)',
                              boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 4px 0px',
                            }}
                          >
                            Start Building
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
