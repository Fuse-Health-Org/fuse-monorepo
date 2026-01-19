import React from "react";
import {
    Card,
    CardBody,
    RadioGroup,
    Radio,
    Chip,
    Button,
    Input,
    Select,
    SelectItem,
    Divider,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Elements } from "@stripe/react-stripe-js";
import { StripePaymentForm } from "../../StripePaymentForm";
import { CheckoutViewProps } from "../types";
import { US_STATES } from "@fuse/enums";


export const CheckoutView: React.FC<CheckoutViewProps> = ({
    plans,
    selectedPlan,
    onPlanChange,
    paymentStatus,
    clientSecret,
    shippingInfo,
    onShippingInfoChange,
    onRetryPaymentSetup,
    onCreateSubscription,
    onPaymentSuccess,
    onPaymentError,
    onPaymentConfirm,
    stripePromise,
    theme,
    questionnaireProducts,
    selectedProducts,
    treatmentName,
    pharmacyCoverages = [],
    // Program props
    programData,
    selectedProgramProducts = {},
    onProgramProductToggle,
    onCreateProgramSubscription,
}) => {
    const selectedPlanData = plans.find((plan) => plan.id === selectedPlan);
    const isProgramCheckout = !!programData;
    const hasPerProductPricing = programData?.hasPerProductPricing || false;

    // Calculate program total - handles both unified and per-product pricing
    const calculateProgramTotal = () => {
        if (!programData) return 0;

        const selectedProducts = programData.products.filter(p => selectedProgramProducts[p.id]);
        const productsTotal = selectedProducts.reduce((sum, p) => sum + p.displayPrice, 0);

        // For per-product pricing, sum up each product's individual non-medical services fee
        if (hasPerProductPricing) {
            const nonMedicalTotal = selectedProducts.reduce((sum, p) => {
                // Use the product's individual program fee if available, otherwise 0
                return sum + (p.perProductProgram?.nonMedicalServicesFee || 0);
            }, 0);
            return productsTotal + nonMedicalTotal;
        }

        // For unified pricing, use the parent program's non-medical services fee
        return productsTotal + programData.nonMedicalServicesFee;
    };

    // Calculate total non-medical services fee based on selected products
    const calculateNonMedicalServicesFee = () => {
        if (!programData) return 0;

        if (hasPerProductPricing) {
            const selectedProducts = programData.products.filter(p => selectedProgramProducts[p.id]);
            return selectedProducts.reduce((sum, p) => {
                return sum + (p.perProductProgram?.nonMedicalServicesFee || 0);
            }, 0);
        }

        return programData.nonMedicalServicesFee;
    };

    const programTotal = isProgramCheckout ? calculateProgramTotal() : 0;
    const currentNonMedicalServicesFee = isProgramCheckout ? calculateNonMedicalServicesFee() : 0;
    const dueIfApproved = isProgramCheckout ? programTotal : (selectedPlanData?.price ?? 0);
    const hasSelectedProgramProducts = isProgramCheckout && Object.values(selectedProgramProducts).some(v => v);

    // Get the display program name (per-product overrides when applicable)
    const getDisplayProgramName = () => {
        if (!programData) return '';
        if (hasPerProductPricing) {
            const selectedProducts = programData.products.filter(p => selectedProgramProducts[p.id]);
            const names = selectedProducts
                .map(p => p.perProductProgram?.programName)
                .filter((n): n is string => Boolean(n));
            if (names.length === 1) return names[0];
            if (names.length > 1) return names.join(', ');
        }
        return programData.name;
    };

    // Get enabled non-medical services for display - handles both unified and per-product pricing
    const getEnabledNonMedicalServices = () => {
        if (!programData) return [];

        // For per-product pricing, aggregate services from all selected products
        if (hasPerProductPricing) {
            const selectedProducts = programData.products.filter(p => selectedProgramProducts[p.id]);
            const aggregatedServices: { name: string; price: number; productName?: string }[] = [];

            for (const product of selectedProducts) {
                const perProduct = product.perProductProgram;
                if (!perProduct) continue;

                const productLabel = selectedProducts.length > 1 ? ` (${product.name})` : '';
                const nms = perProduct.nonMedicalServices;

                if (nms.patientPortal.enabled) {
                    aggregatedServices.push({ name: `Patient Portal${productLabel}`, price: nms.patientPortal.price, productName: product.name });
                }
                if (nms.bmiCalculator.enabled) {
                    aggregatedServices.push({ name: `BMI Calculator${productLabel}`, price: nms.bmiCalculator.price, productName: product.name });
                }
                if (nms.proteinIntakeCalculator.enabled) {
                    aggregatedServices.push({ name: `Protein Intake Calculator${productLabel}`, price: nms.proteinIntakeCalculator.price, productName: product.name });
                }
                if (nms.calorieDeficitCalculator.enabled) {
                    aggregatedServices.push({ name: `Calorie Deficit Calculator${productLabel}`, price: nms.calorieDeficitCalculator.price, productName: product.name });
                }
                if (nms.easyShopping.enabled) {
                    aggregatedServices.push({ name: `Easy Shopping${productLabel}`, price: nms.easyShopping.price, productName: product.name });
                }
            }

            return aggregatedServices;
        }

        // For unified pricing, use the parent program's services
        const services: { name: string; price: number }[] = [];
        if (programData.nonMedicalServices.patientPortal.enabled) {
            services.push({ name: 'Patient Portal', price: programData.nonMedicalServices.patientPortal.price });
        }
        if (programData.nonMedicalServices.bmiCalculator.enabled) {
            services.push({ name: 'BMI Calculator', price: programData.nonMedicalServices.bmiCalculator.price });
        }
        if (programData.nonMedicalServices.proteinIntakeCalculator.enabled) {
            services.push({ name: 'Protein Intake Calculator', price: programData.nonMedicalServices.proteinIntakeCalculator.price });
        }
        if (programData.nonMedicalServices.calorieDeficitCalculator.enabled) {
            services.push({ name: 'Calorie Deficit Calculator', price: programData.nonMedicalServices.calorieDeficitCalculator.price });
        }
        if (programData.nonMedicalServices.easyShopping.enabled) {
            services.push({ name: 'Easy Shopping', price: programData.nonMedicalServices.easyShopping.price });
        }
        return services;
    };

    // 15-minute countdown timer
    const [timeRemaining, setTimeRemaining] = React.useState<number>(15 * 60); // 15 minutes in seconds

    React.useEffect(() => {
        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Require shipping fields before enabling payment setup
    const canContinue = Boolean(
        selectedPlan &&
        (shippingInfo.address || '').trim() &&
        (shippingInfo.city || '').trim() &&
        (shippingInfo.state || '').trim() &&
        (shippingInfo.zipCode || '').trim()
    );

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Medication Reserved Timer */}
                <div className="flex items-center gap-2 p-4 rounded-lg" style={{ backgroundColor: theme.primaryLighter }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
                        <Icon icon="lucide:check" className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: theme.primary }}>
                            Your medication is reserved
                        </div>
                        <div className="text-xs" style={{ color: theme.primary }}>
                            Complete checkout to secure your prescription
                        </div>
                    </div>
                    <div className="text-sm font-mono" style={{ color: timeRemaining <= 60 ? '#EF4444' : theme.primary }}>
                        {formatTime(timeRemaining)}
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Complete Your Subscription</h2>
                    <p className="text-gray-600">Secure checkout for your {treatmentName} subscription</p>
                </div>

                {/* Program Product Selection - Only for programs */}
                {isProgramCheckout && programData && (
                    <Card>
                        <CardBody className="p-6">
                            {(() => {
                                const productOfferType = programData.productOfferType || programData.medicalTemplate?.productOfferType || 'multiple_choice';
                                const isSingleChoice = productOfferType === 'single_choice';

                                // Helper function to calculate full price (product + services) for each product
                                const getProductFullPrice = (product: any) => {
                                    const productPrice = product.displayPrice;
                                    const servicesFee = hasPerProductPricing
                                        ? (product.perProductProgram?.nonMedicalServicesFee || 0)
                                        : programData.nonMedicalServicesFee;
                                    return productPrice + servicesFee;
                                };

                                return (
                                    <>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            {isSingleChoice ? 'Select Your Product' : 'Select Your Products'}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-6">
                                            {isSingleChoice
                                                ? 'Choose one product for your subscription'
                                                : 'Choose which products you\'d like to include in your subscription'}
                                        </p>

                                        <div className="space-y-3">
                                            {programData.products.map((product) => {
                                                const fullPrice = getProductFullPrice(product);
                                                return (
                                                    <div
                                                        key={product.id}
                                                        className={`relative rounded-lg border-2 p-4 transition-all cursor-pointer ${paymentStatus === 'processing' || !!clientSecret
                                                            ? 'opacity-60 cursor-not-allowed bg-gray-50'
                                                            : ''
                                                            } ${selectedProgramProducts[product.id]
                                                                ? 'border-success-500 bg-success-50'
                                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                                            }`}
                                                        onClick={() => {
                                                            if (paymentStatus !== 'processing' && !clientSecret && onProgramProductToggle) {
                                                                onProgramProductToggle(product.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type={isSingleChoice ? "radio" : "checkbox"}
                                                                name={isSingleChoice ? "program-product-selection" : undefined}
                                                                checked={!!selectedProgramProducts[product.id]}
                                                                onChange={() => { }}
                                                                disabled={paymentStatus === 'processing' || !!clientSecret}
                                                                className={`w-5 h-5 ${isSingleChoice ? '' : 'rounded'} border-gray-300`}
                                                                style={{ accentColor: theme.primary }}
                                                            />
                                                            {product.imageUrl && (
                                                                <img
                                                                    src={product.imageUrl}
                                                                    alt={product.name}
                                                                    className="w-12 h-12 rounded-lg object-cover"
                                                                />
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                            </div>
                                                            <div className="text-lg font-semibold" style={{ color: theme.primary }}>
                                                                ${fullPrice.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Program Name + Non-Medical Services */}
                            {(hasPerProductPricing ? currentNonMedicalServicesFee > 0 : programData.nonMedicalServicesFee > 0) && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h4 className="text-md font-medium text-gray-900">Program Name</h4>
                                    <div className="text-sm font-semibold mb-3" style={{ color: theme.primary }}>
                                        {getDisplayProgramName()}
                                    </div>
                                    <h4 className="text-md font-medium text-gray-900 mb-3">Included Services</h4>
                                    <div className="space-y-2">
                                        {getEnabledNonMedicalServices().map((service, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <Icon icon="lucide:check-circle" className="w-4 h-4" style={{ color: theme.primary }} />
                                                <span className="text-gray-700">{service.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Program Total */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-medium text-gray-900">Monthly Total</span>
                                    <span className="text-2xl font-bold" style={{ color: theme.primary }}>
                                        ${programTotal.toFixed(2)}/mo
                                    </span>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                )}

                {/* Regular Plan Selection - Only for non-programs */}
                {!isProgramCheckout && (
                    <Card>
                        <CardBody className="p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-6">Choose Your Plan</h3>
                            <RadioGroup
                                value={selectedPlan}
                                onValueChange={onPlanChange}
                                className="space-y-4"
                                isDisabled={paymentStatus === 'processing' || !!clientSecret}
                            >
                                {plans.map((plan) => (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-lg border-2 p-4 transition-all ${paymentStatus === 'processing' || !!clientSecret ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''} ${selectedPlan === plan.id ? 'border-success-500 bg-success-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Radio value={plan.id} className="mt-1" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <label className="font-medium text-gray-900 cursor-pointer">
                                                        {plan.name}
                                                    </label>
                                                    {plan.badge && (
                                                        <Chip color={plan.badgeColor} size="sm" variant="flat">
                                                            {plan.badge}
                                                        </Chip>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-600 mb-2">{plan.description}</div>
                                                <div className="flex items-baseline gap-2 mb-3">
                                                    <span className="text-xl font-semibold" style={{ color: theme.primary }}>
                                                        ${plan.price.toFixed(2)}/mo
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-sm text-gray-600">
                                                    <div className="font-medium">Includes:</div>
                                                    {plan.features?.map((feature, index) => (
                                                        <div key={index} className="flex items-center gap-2">
                                                            <Icon icon="lucide:check" className="w-3 h-3" style={{ color: theme.primary }} />
                                                            <span>{feature}</span>
                                                        </div>
                                                    ))}

                                                    {/* Display pharmacy coverages if multiple exist */}
                                                    {pharmacyCoverages && pharmacyCoverages.length > 1 && (
                                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                                            <div className="font-medium mb-2">Contains products:</div>
                                                            <div className="space-y-2">
                                                                {pharmacyCoverages.map((coverage) => (
                                                                    <div key={coverage.id} className="pl-2">
                                                                        <div className="font-medium text-gray-900">{coverage.customName}</div>
                                                                        <div className="text-xs text-gray-500">Note: {coverage.customSig}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </RadioGroup>
                        </CardBody>
                    </Card>
                )}

                <Card>
                    <CardBody className="p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.primary }}>
                                <div className="w-full h-full flex items-center justify-center">
                                    <Icon icon="lucide:check" className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Shipping Information</h3>
                        </div>

                        <div className="space-y-4">
                            <Input
                                label="Street Address"
                                placeholder="Enter address"
                                value={shippingInfo.address}
                                onValueChange={(value) => onShippingInfoChange('address', value)}
                                variant="bordered"
                                isRequired
                            />

                            <Input
                                label="Apartment / Suite / Unit (optional)"
                                value={shippingInfo.apartment}
                                onValueChange={(value) => onShippingInfoChange('apartment', value)}
                                variant="bordered"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="City"
                                    value={shippingInfo.city}
                                    onValueChange={(value) => onShippingInfoChange('city', value)}
                                    variant="bordered"
                                    isRequired
                                />
                                {shippingInfo.country === 'us' ? (
                                    <Select
                                        label="State"
                                        placeholder="Select State"
                                        selectedKeys={shippingInfo.state ? [shippingInfo.state] : []}
                                        onSelectionChange={(keys) => {
                                            const selectedKey = Array.from(keys)[0] as string;
                                            onShippingInfoChange('state', selectedKey);
                                        }}
                                        variant="bordered"
                                        isRequired
                                    >
                                        {US_STATES.map((state) => (
                                            <SelectItem key={state.key}>{state.name}</SelectItem>
                                        ))}
                                    </Select>
                                ) : (
                                    <Input
                                        label="State/Province"
                                        placeholder="Enter state or province"
                                        value={shippingInfo.state}
                                        onValueChange={(value) => onShippingInfoChange('state', value)}
                                        variant="bordered"
                                        isRequired
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Zip Code"
                                    value={shippingInfo.zipCode}
                                    onValueChange={(value) => onShippingInfoChange('zipCode', value)}
                                    variant="bordered"
                                    isRequired
                                />
                                <Select
                                    label="Country"
                                    selectedKeys={[shippingInfo.country]}
                                    onSelectionChange={(keys) => {
                                        const selectedKey = Array.from(keys)[0] as string;
                                        onShippingInfoChange('country', selectedKey);
                                    }}
                                    variant="bordered"
                                >
                                    <SelectItem key="us">🇺🇸 United States</SelectItem>
                                </Select>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Icon icon="lucide:shield" className="w-5 h-5" style={{ color: theme.primary }} />
                            <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
                            <Icon icon="lucide:shield" className="w-4 h-4 text-gray-400" />
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <Icon icon="lucide:credit-card" className="w-4 h-4" style={{ color: theme.primary }} />
                            <span className="font-medium">Card</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm" style={{ color: theme.primary }}>
                            <Icon icon="lucide:shield" className="w-4 h-4" />
                            <span>Secure, fast checkout with Link</span>
                        </div>

                        {paymentStatus === 'processing' && (
                            <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg text-center">
                                <Icon icon="lucide:loader-2" className="text-4xl text-blue-500 mx-auto mb-3 animate-spin" />
                                <h4 className="text-lg font-semibold text-blue-800 mb-2">Initializing Payment</h4>
                                <p className="text-blue-600">Setting up secure payment processing...</p>
                                <div className="mt-3 flex justify-center">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2" style={{ backgroundColor: theme.primary }}></div>
                                        <div className="w-2 h-2" style={{ backgroundColor: theme.primary, animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2" style={{ backgroundColor: theme.primary, animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentStatus === 'failed' && (
                            <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
                                <Icon icon="lucide:alert-circle" className="text-4l text-red-500 mx-auto mb-3" />
                                <h4 className="text-lg font-semibold text-red-800 mb-2">Payment Setup Failed</h4>
                                <p className="text-red-600 mb-4">Unable to initialize payment processing</p>
                                <Button
                                    color="danger"
                                    variant="light"
                                    onPress={onRetryPaymentSetup}
                                    startContent={<Icon icon="lucide:refresh-cw" />}
                                >
                                    Try Again
                                </Button>
                            </div>
                        )}

                        {!clientSecret && paymentStatus === 'processing' && (
                            <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
                                <Icon icon="lucide:loader-2" className="text-3xl text-blue-500 mx-auto mb-2 animate-spin" />
                                <p className="text-lg font-medium text-blue-900 mb-1">Setting up your subscription...</p>
                                <p className="text-sm text-blue-700">Please wait while we prepare your payment</p>
                            </div>
                        )}

                        {/* Regular product flow */}
                        {!isProgramCheckout && !clientSecret && paymentStatus === 'idle' && selectedPlan && (
                            <div className="space-y-4">
                                <div className="text-center py-6 bg-blue-50 rounded-lg border border-blue-200">
                                    <Icon icon="lucide:check-circle" className="text-3xl text-blue-500 mx-auto mb-2" />
                                    <p className="text-lg font-medium text-blue-900 mb-1">Plan Selected</p>
                                    <p className="text-sm text-blue-700">
                                        {selectedPlanData?.name} - ${selectedPlanData?.price}/mo
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full"
                                    isDisabled={!canContinue}
                                    onPress={() => onCreateSubscription(selectedPlan)}
                                >
                                    Continue with {selectedPlanData?.name} - ${selectedPlanData?.price}/mo
                                </Button>
                                {!canContinue && (
                                    <div className="text-center text-xs text-gray-500">
                                        Fill out shipping address to continue
                                    </div>
                                )}
                            </div>
                        )}

                        {!isProgramCheckout && !clientSecret && paymentStatus === 'idle' && !selectedPlan && (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                <Icon icon="lucide:mouse-pointer-click" className="text-3xl text-gray-400 mx-auto mb-2" />
                                <p className="text-lg font-medium text-gray-700 mb-1">Select a Plan Above</p>
                                <p className="text-sm text-gray-500">Choose your preferred billing cycle to continue</p>
                            </div>
                        )}

                        {/* Program flow */}
                        {isProgramCheckout && !clientSecret && paymentStatus === 'idle' && hasSelectedProgramProducts && (
                            <div className="space-y-4">
                                <div className="text-center py-6 bg-blue-50 rounded-lg border border-blue-200">
                                    <Icon icon="lucide:check-circle" className="text-3xl text-blue-500 mx-auto mb-2" />
                                    <p className="text-lg font-medium text-blue-900 mb-1">Products Selected</p>
                                    <p className="text-sm text-blue-700">
                                        {Object.values(selectedProgramProducts).filter(v => v).length} product(s) - ${programTotal.toFixed(2)}/mo
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full"
                                    isDisabled={!canContinue}
                                    onPress={() => onCreateProgramSubscription?.()}
                                >
                                    Continue - ${programTotal.toFixed(2)}/mo
                                </Button>
                                {!canContinue && (
                                    <div className="text-center text-xs text-gray-500">
                                        Fill out shipping address to continue
                                    </div>
                                )}
                            </div>
                        )}

                        {isProgramCheckout && !clientSecret && paymentStatus === 'idle' && !hasSelectedProgramProducts && (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                <Icon icon="lucide:mouse-pointer-click" className="text-3xl text-gray-400 mx-auto mb-2" />
                                <p className="text-lg font-medium text-gray-700 mb-1">
                                    {(programData?.productOfferType || programData?.medicalTemplate?.productOfferType) === 'single_choice'
                                        ? 'Select a Product Above'
                                        : 'Select Products Above'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {(programData?.productOfferType || programData?.medicalTemplate?.productOfferType) === 'single_choice'
                                        ? 'Choose one product to continue'
                                        : 'Choose at least one product to continue'}
                                </p>
                            </div>
                        )}

                        {clientSecret && paymentStatus === 'idle' && (
                            <div className="space-y-4">
                                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
                                    <Icon icon="lucide:shield-check" className="text-2l text-green-500 mx-auto mb-1" />
                                    <p className="text-sm text-green-700 font-medium">Secure Payment Ready</p>
                                </div>
                                <Elements stripe={stripePromise} options={{ clientSecret }}>
                                    <StripePaymentForm
                                        amount={isProgramCheckout ? programTotal : (selectedPlanData?.price || 0)}
                                        onSuccess={onPaymentSuccess}
                                        onError={onPaymentError}
                                        onConfirm={onPaymentConfirm}
                                        loading={false}
                                    />
                                </Elements>
                            </div>
                        )}

                        {paymentStatus === 'succeeded' && (
                            <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
                                <Icon icon="lucide:check-circle" className="text-4l text-green-500 mx-auto mb-3" />
                                <h4 className="text-lg font-semibold text-green-800 mb-2">Payment Successful!</h4>
                                <p className="text-green-600 mb-4">Your order has been processed successfully</p>
                                <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-4">
                                    <Icon icon="lucide:shield-check" />
                                    <span>Secure payment completed</span>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-gray-500">
                            By providing your card information, you allow the clinic to charge your card for future payments in
                            accordance with their terms.
                        </p>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="p-6">
                        <div className="space-y-4 text-xs text-gray-500 leading-relaxed">
                            <p>
                                By completing checkout, you agree to our{' '}
                                <a href="/terms" className="text-success-600 hover:underline">
                                    Terms of Service
                                </a>{' '}
                                and{' '}
                                <a href="/privacy" className="text-success-600 hover:underline">
                                    Privacy Policy
                                </a>
                                .
                            </p>

                            <p>
                                <strong>Payment Authorization:</strong> We'll securely pre-authorize your payment method for the amount shown. You'll only be charged if a licensed physician prescribes your medication after reviewing your medical information.
                            </p>

                            <p>
                                <strong>Medical Disclaimer:</strong> By submitting this form, I confirm that all information provided is accurate and complete to the best of my knowledge. I understand that providing incomplete and/or inaccurate information is essential for safe treatment.
                            </p>

                            <p>
                                *Product packaging may vary. California residents: prescriptions may contain only semaglutide as the active ingredient.
                            </p>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <div className="lg:col-span-1">
                <Card className="sticky top-8">
                    <CardBody className="p-6">
                        <h3 className="font-medium text-gray-900 mb-4">Order Summary</h3>

                        {/* Program Order Summary */}
                        {isProgramCheckout && programData && (
                            <>
                                <div className="space-y-3 mb-4">
                                    {programData.products
                                        .filter((product) => selectedProgramProducts[product.id])
                                        .map((product) => {
                                            // Calculate full price including services for this product
                                            const productPrice = product.displayPrice;
                                            const servicesFee = hasPerProductPricing
                                                ? (product.perProductProgram?.nonMedicalServicesFee || 0)
                                                : programData.nonMedicalServicesFee;
                                            const fullPrice = productPrice + servicesFee;

                                            return (
                                                <div key={product.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="w-10 h-10 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                                            <Icon icon="lucide:pill" className="w-5 h-5 text-gray-600" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                                                        <div className="text-sm font-medium" style={{ color: theme.primary }}>
                                                            ${fullPrice.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>

                                <Divider className="my-4" />

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-gray-900">Due Today</span>
                                        <span className="text-xl font-semibold">$0.00</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Due if approved</span>
                                        <span className="text-sm font-medium" style={{ color: theme.primary }}>${programTotal.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Only charged if prescribed by a licensed physician. We'll securely hold your payment method. No charge until prescribed.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Regular Order Summary */}
                        {!isProgramCheckout && (
                            <>
                                <div className="space-y-3 mb-4">
                                    {questionnaireProducts?.filter((product) => (selectedProducts[product.id] || 0) > 0).map((product) => (
                                        <div key={product.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                                <Icon icon="lucide:pill" className="w-5 h-5 text-gray-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                                                <div className="text-xs text-gray-600 mb-1">{product.description}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">Qty: {selectedProducts[product.id]}</span>
                                                    <span className="text-sm font-medium text-gray-900">
                                                        ${(product.price * (selectedProducts[product.id] || 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Divider className="my-4" />

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Selected Plan: {selectedPlanData?.name || 'None'}</span>
                                        <span className="font-medium">${selectedPlanData?.price.toFixed(2) || '0.00'}/mo</span>
                                    </div>
                                </div>

                                <Divider className="my-4" />

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-gray-900">Due Today</span>
                                        <span className="text-xl font-semibold">$0.00</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Due if approved</span>
                                        <span className="text-sm font-medium" style={{ color: theme.primary }}>${dueIfApproved.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Only charged if prescribed by a licensed physician. We'll securely hold your payment method. No charge until prescribed.
                                    </p>
                                </div>
                            </>
                        )}

                        <Divider className="my-4" />

                        <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">What's Included</h4>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-success-500"></div>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        <div className="text-sm font-medium text-gray-900">Medical consultation</div>
                                        <div className="text-xs text-gray-500 leading-snug">Board-certified physicians licensed in your state</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-success-500"></div>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        <div className="text-sm font-medium text-gray-900">Expedited shipping</div>
                                        <div className="text-xs text-gray-500 leading-snug">2-day delivery included with every order</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-success-500"></div>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        <div className="text-sm font-medium text-gray-900">Money-back guarantee</div>
                                        <div className="text-xs text-gray-500 leading-snug">If you don't get approved for this program, you'll be refunded automatically.</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-success-500"></div>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        <div className="text-sm font-medium text-gray-900">Secure payment processing</div>
                                        <div className="text-xs text-gray-500 leading-snug">Bank-level encryption & security</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
};

