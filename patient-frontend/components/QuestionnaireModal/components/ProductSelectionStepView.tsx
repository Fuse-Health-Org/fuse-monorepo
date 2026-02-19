import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { ProgressBar } from "./ProgressBar";
import { StepHeader } from "./StepHeader";
import { ProductSelection } from "./ProductSelection";
import { PaymentStatus } from "../types";

interface ProductSelectionStepViewProps {
  progressPercent: number;
  theme: any;
  onPrevious: () => void;
  canGoBack: boolean;
  clinic: { name: string; logo?: string } | null;
  isLoadingClinic: boolean;
  products: any;
  selectedProducts: Record<string, number>;
  onProductQuantityChange: (productId: string, quantity: number) => void;
  onNext: () => void;
  isCheckoutStep: () => boolean;
  paymentStatus: PaymentStatus;
  isLastStep: boolean;
  isProductSelectionStep: () => boolean;
  programData?: any;
  selectedProgramProducts?: Record<string, boolean>;
  onProgramProductToggle?: (productId: string) => void;
}

export const ProductSelectionStepView: React.FC<ProductSelectionStepViewProps> = ({
  progressPercent,
  theme,
  onPrevious,
  canGoBack,
  clinic,
  isLoadingClinic,
  products,
  selectedProducts,
  onProductQuantityChange,
  onNext,
  isCheckoutStep,
  paymentStatus,
  isLastStep,
  isProductSelectionStep,
  programData,
  selectedProgramProducts = {},
  onProgramProductToggle,
}) => {
  const isProgramFlow = !!programData;
  const productOfferType = programData?.productOfferType || programData?.medicalTemplate?.productOfferType || "single_choice";
  const isSingleChoice = productOfferType === "single_choice";
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  // Auto-select top choice product on mount if nothing is selected yet
  useEffect(() => {
    if (isProgramFlow && programData?.products && programData.products.length > 0) {
      const hasAnySelection = Object.values(selectedProgramProducts).some(Boolean);
      if (!hasAnySelection && onProgramProductToggle) {
        console.log('🎯 Auto-selecting top choice product:', programData.products[0].id);
        onProgramProductToggle(programData.products[0].id);
      }
    }
  }, [isProgramFlow, programData?.products, selectedProgramProducts, onProgramProductToggle]);

  return (
    <>
      {/* Progress Bar */}
      <ProgressBar progressPercent={progressPercent} color={theme.primary} />

      {/* Brand and Previous button */}
      <StepHeader
        onPrevious={onPrevious}
        canGoBack={canGoBack}
        clinic={clinic}
        isLoadingClinic={isLoadingClinic}
      />

      <div className="space-y-6">
        {isProgramFlow ? (
          <>
            {/* Top Choice Product */}
            {programData?.products && programData.products.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="rounded-full p-1" style={{ backgroundColor: theme.primary }}>
                    <Icon icon="lucide:check" className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium">Your current match</span>
                </div>
                <div 
                  className={`bg-white rounded-2xl border-2 p-6 transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                    selectedProgramProducts[programData.products[0].id] ? "shadow-md" : "hover:shadow-sm"
                  }`}
                  style={
                    selectedProgramProducts[programData.products[0].id]
                      ? { borderColor: theme.primaryDark, boxShadow: `0 0 0 1px ${theme.primaryDark}` }
                      : hoveredProductId === programData.products[0].id
                        ? { borderColor: theme.primaryLight }
                        : { borderColor: '#e5e7eb' }
                  }
                  onMouseEnter={() => setHoveredProductId(programData.products[0].id)}
                  onMouseLeave={() => setHoveredProductId(null)}
                  onClick={() => onProgramProductToggle?.(programData.products[0].id)}
                >
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {programData.products[0].name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        From ${Number(programData.products[0].displayPrice || 0).toFixed(2)}/mo¹
                      </p>
                    </div>
                    {programData.products[0].imageUrl && (
                      <img
                        src={programData.products[0].imageUrl}
                        alt={programData.products[0].name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* All Treatments Section */}
            {programData?.products && programData.products.length > 0 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">All treatments</h2>
                  <p className="text-sm text-gray-600">
                    {isSingleChoice ? "Choose one option below" : "Select the options that work for you"}
                  </p>
                </div>

                <div className="space-y-3">
                  {programData.products.map((product: any, index: number) => (
                    <div
                      key={product.id}
                      className={`bg-white rounded-2xl border p-4 transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                        selectedProgramProducts[product.id] ? "shadow-md" : "hover:shadow-sm"
                      }`}
                      style={
                        selectedProgramProducts[product.id]
                          ? { borderColor: theme.primaryDark, boxShadow: `0 0 0 1px ${theme.primaryDark}` }
                          : hoveredProductId === product.id
                            ? { borderColor: theme.primaryLight }
                            : { borderColor: '#e5e7eb' }
                      }
                      onMouseEnter={() => setHoveredProductId(product.id)}
                      onMouseLeave={() => setHoveredProductId(null)}
                      onClick={() => onProgramProductToggle?.(product.id)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {product.subtitle && (
                              <p className="text-xs font-semibold text-gray-600">{product.subtitle}</p>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                            <p className="text-sm text-gray-600">
                              From ${Number(product.displayPrice || 0).toFixed(2)}/mo¹
                            </p>
                          </div>
                          
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {product.tags.map((tag: string, i: number) => (
                                <span
                                  key={i}
                                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <Icon icon="lucide:chevron-right" className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl p-6">
            <ProductSelection
              products={products}
              selectedProducts={selectedProducts}
              onChange={onProductQuantityChange}
            />
          </div>
        )}

        {/* Trust indicators */}
        {isProgramFlow && (
          <div className="flex items-center justify-center gap-4 px-4">
            {/* Doctor trusted badge */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <Icon icon="lucide:shield-check" className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-tight">Doctor trusted</p>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200"></div>

            {/* FDA regulated badge */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon icon="lucide:shield-check" className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-gray-900 leading-tight">FDA regulated pharmacy</p>
              </div>
            </div>
          </div>
        )}

        {/* Continue button for product selection */}
        <div className="bg-white rounded-2xl p-6">
          {!(isCheckoutStep() && paymentStatus !== 'succeeded') && (
            <button
              onClick={onNext}
              disabled={isCheckoutStep() && paymentStatus !== 'succeeded'}
              className="w-full text-white font-medium py-4 px-6 rounded-2xl text-base h-auto flex items-center justify-center transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              style={{
                background: theme.primary,
                ...(isCheckoutStep() && paymentStatus !== 'succeeded' ? {} : { boxShadow: `0 10px 20px -10px ${theme.primaryDark}` })
              }}
            >
              {isLastStep ? (isCheckoutStep() ? 'Complete Order' : 'Continue') :
                (isCheckoutStep() && paymentStatus === 'succeeded') ? 'Continue' :
                  isProductSelectionStep() ? 'Continue to Checkout' :
                    isCheckoutStep() ? 'Complete Order' : 'Continue'}
              <Icon icon="lucide:chevron-right" className="ml-2 h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

