import React from "react";
import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  RadioGroup,
  Radio,
  Select,
  SelectItem,
  Chip,
  Divider
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  badgeColor?: "success" | "primary" | "warning" | "danger";
  features: string[];
}

const plans: Plan[] = [
  {
    id: "monthly",
    name: "Monthly",
    description: "Billed monthly",
    price: 199.00,
    originalPrice: 299.00,
    badge: "Most Popular",
    badgeColor: "success",
    features: [
      "Same active ingredient as Ozempic®",
      "Expedited shipping",
      "HSA + FSA eligible",
      "Home injection kit included"
    ]
  },
  {
    id: "quarterly",
    name: "Quarterly",
    description: "Billed quarterly",
    price: 269.00,
    badge: "Save $69.00",
    badgeColor: "primary",
    features: [
      "Same active ingredient as Ozempic®",
      "Expedited shipping",
      "HSA + FSA eligible",
      "Home injection kit included"
    ]
  },
  {
    id: "biannual",
    name: "Bi-Annually",
    description: "Billed every 6 months",
    price: 249.00,
    badge: "Save $309.00",
    badgeColor: "primary",
    features: [
      "Same active ingredient as Ozempic®",
      "Expedited shipping",
      "HSA + FSA eligible",
      "Home injection kit included"
    ]
  }
];

export default function CheckoutPage() {
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [shippingInfo, setShippingInfo] = useState({
    address: "",
    apartment: "",
    city: "",
    state: "",
    zipCode: "",
    country: "us"
  });
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiryDate: "",
    securityCode: "",
    country: "brazil"
  });
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(15 * 60); // 15 minutes in seconds

  const selectedPlanData = plans.find(plan => plan.id === selectedPlan);

  React.useEffect(() => {
    // 15-minute countdown timer for reservation
    const timer = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
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

  const timeRemaining = formatTime(timeRemainingSeconds);

  const handleCompletePayment = () => {
    // Handle payment completion
    console.log("Processing payment...");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xl font-semibold text-gray-900">heyfeels</div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <button className="flex items-center gap-2 hover:text-gray-900">
              <Icon icon="lucide:arrow-left" className="w-4 h-4" />
              Change Medication
            </button>
            <button className="flex items-center gap-2 hover:text-gray-900">
              <Icon icon="lucide:message-circle" className="w-4 h-4" />
              Live Chat
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Medication Reserved Timer */}
            <div className="flex items-center gap-2 p-4 bg-success-50 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-success-500 flex items-center justify-center">
                <Icon icon="lucide:check" className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-success-800">Your medication is reserved</div>
                <div className="text-xs text-success-600">Complete checkout to secure your prescription</div>
              </div>
              <div className={`text-sm font-mono ${timeRemainingSeconds <= 60 ? 'text-danger-700' : 'text-success-700'}`}>{timeRemaining}</div>
            </div>

            {/* Order Header */}
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Complete Your Order</h1>
              <p className="text-gray-600">Secure checkout for your weight management treatment</p>
            </div>

            {/* Choose Your Plan */}
            <Card>
              <CardBody className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Choose Your Plan</h2>
                <RadioGroup
                  value={selectedPlan}
                  onValueChange={setSelectedPlan}
                  className="space-y-4"
                >
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative rounded-lg border-2 p-4 transition-all ${selectedPlan === plan.id
                        ? "border-success-500 bg-success-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <Radio value={plan.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="font-medium text-gray-900 cursor-pointer">
                              {plan.name}
                            </label>
                            {plan.badge && (
                              <Chip
                                color={plan.badgeColor}
                                size="sm"
                                variant="flat"
                              >
                                {plan.badge}
                              </Chip>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">{plan.description}</div>
                          <div className="flex items-baseline gap-2 mb-3">
                            {plan.originalPrice && (
                              <span className="text-gray-400 line-through text-sm">
                                ${plan.originalPrice.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xl font-semibold text-success-600">
                              ${plan.price.toFixed(2)}/mo
                            </span>
                          </div>
                          {plan.id === "monthly" && (
                            <div className="text-xs text-gray-500 mb-3">
                              (for the first month only)
                            </div>
                          )}
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="font-medium">Includes:</div>
                            {plan.features.map((feature, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Icon icon="lucide:check" className="w-3 h-3 text-success-500" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </CardBody>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardBody className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-6 h-6 rounded-full bg-success-500 flex items-center justify-center">
                    <Icon icon="lucide:check" className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-medium text-gray-900">Shipping Information</h2>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Street Address"
                    placeholder="Enter address"
                    value={shippingInfo.address}
                    onValueChange={(value) => setShippingInfo(prev => ({ ...prev, address: value }))}
                    variant="bordered"
                    isRequired
                  />

                  <Input
                    label="Apartment / Suite / Unit (optional)"
                    value={shippingInfo.apartment}
                    onValueChange={(value) => setShippingInfo(prev => ({ ...prev, apartment: value }))}
                    variant="bordered"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      value={shippingInfo.city}
                      onValueChange={(value) => setShippingInfo(prev => ({ ...prev, city: value }))}
                      variant="bordered"
                      isRequired
                    />
                    <Select
                      label="State"
                      placeholder="Select State"
                      selectedKeys={shippingInfo.state ? [shippingInfo.state] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        setShippingInfo(prev => ({ ...prev, state: selectedKey }));
                      }}
                      variant="bordered"
                      isRequired
                    >
                      <SelectItem key="ca">California</SelectItem>
                      <SelectItem key="ny">New York</SelectItem>
                      <SelectItem key="tx">Texas</SelectItem>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Zip Code"
                      value={shippingInfo.zipCode}
                      onValueChange={(value) => setShippingInfo(prev => ({ ...prev, zipCode: value }))}
                      variant="bordered"
                      isRequired
                    />
                    <Select
                      label="Country"
                      selectedKeys={[shippingInfo.country]}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        setShippingInfo(prev => ({ ...prev, country: selectedKey }));
                      }}
                      variant="bordered"
                    >
                      <SelectItem key="us">🇺🇸 United States</SelectItem>
                    </Select>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardBody className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Icon icon="lucide:shield" className="w-5 h-5 text-success-500" />
                  <h2 className="text-lg font-medium text-gray-900">Payment Information</h2>
                  <Icon icon="lucide:shield" className="w-4 h-4 text-gray-400" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon icon="lucide:credit-card" className="w-4 h-4 text-primary-500" />
                    <span className="font-medium">Card</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-primary-600">
                    <Icon icon="lucide:shield" className="w-4 h-4" />
                    <span>Secure, fast checkout with Link</span>
                  </div>

                  <div className="relative">
                    <Input
                      label="Card number"
                      placeholder="1234 1234 1234 1234"
                      value={paymentInfo.cardNumber}
                      onValueChange={(value) => setPaymentInfo(prev => ({ ...prev, cardNumber: value }))}
                      variant="bordered"
                      endContent={
                        <div className="flex gap-1">
                          <div className="w-6 h-4 bg-primary-600 rounded text-white text-xs flex items-center justify-center font-bold">
                            visa
                          </div>
                          <div className="w-6 h-4 bg-danger-500 rounded"></div>
                        </div>
                      }
                      isRequired
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Expiration date"
                      placeholder="MM / YY"
                      value={paymentInfo.expiryDate}
                      onValueChange={(value) => setPaymentInfo(prev => ({ ...prev, expiryDate: value }))}
                      variant="bordered"
                      isRequired
                    />
                    <Input
                      label="Security code"
                      placeholder="CVC"
                      value={paymentInfo.securityCode}
                      onValueChange={(value) => setPaymentInfo(prev => ({ ...prev, securityCode: value }))}
                      variant="bordered"
                      endContent={
                        <div className="w-6 h-4 border border-gray-300 rounded text-xs flex items-center justify-center">
                          ?
                        </div>
                      }
                      isRequired
                    />
                  </div>

                  <Select
                    label="Country"
                    selectedKeys={[paymentInfo.country]}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as string;
                      setPaymentInfo(prev => ({ ...prev, country: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="brazil">Brazil</SelectItem>
                    <SelectItem key="us">United States</SelectItem>
                  </Select>

                  <p className="text-xs text-gray-500">
                    By providing your card information, you allow HeyFeels LLC to charge your card for future payments in
                    accordance with their terms.
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Complete Payment Button */}
            <Button
              className="w-full bg-success-600 hover:bg-success-700 text-white py-6 text-base font-medium"
              size="lg"
              onPress={handleCompletePayment}
              endContent={<Icon icon="lucide:arrow-right" />}
            >
              Complete Secure Payment
            </Button>

            {/* Legal Disclaimers and Terms */}
            <Card>
              <CardBody className="p-6">
                <div className="space-y-4 text-xs text-gray-500 leading-relaxed">
                  <p>
                    By completing checkout, you agree to our{" "}
                    <a href="/terms" className="text-success-600 hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-success-600 hover:underline">
                      Privacy Policy
                    </a>
                    .
                  </p>

                  <p>
                    <strong>Payment Authorization:</strong> We'll securely pre-authorize your payment method for the amount
                    shown. You'll only be charged if a licensed physician prescribes your medication after reviewing your
                    medical information.
                  </p>

                  <p>
                    <strong>Medical Disclaimer:</strong> By submitting this form, I confirm that all information provided is
                    accurate and complete to the best of my knowledge. I understand that providing incomplete and/or
                    inaccurate information is essential for safe treatment.
                  </p>

                  <p>
                    *Product packaging may vary. California residents: prescriptions may contain only semaglutide as the
                    active ingredient.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardBody className="p-6">
                <h3 className="font-medium text-gray-900 mb-4">Order Summary</h3>

                {/* Product */}
                <div className="flex gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Icon icon="lucide:pill" className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Compounded Semaglutide</div>
                    <div className="text-sm text-gray-600">Same active ingredient as Ozempic®</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Chip size="sm" variant="flat" color="default">Injectable</Chip>
                      <Chip size="sm" variant="flat" color="default">{selectedPlanData?.name} Plan</Chip>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Icon icon="lucide:syringe" className="w-6 h-6 text-gray-600" />
                  </div>
                </div>

                <Divider className="my-4" />

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Billed {selectedPlanData?.description.toLowerCase()}</span>
                    <span className="font-medium">${selectedPlanData?.price.toFixed(2)}/mo</span>
                  </div>

                  {selectedPlan === "monthly" && (
                    <div className="bg-success-50 p-3 rounded-lg">
                      <div className="flex items-center gap-1 text-success-700 text-sm font-medium mb-1">
                        🎉 Special Offer: First Month Only ${selectedPlanData?.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-success-600">
                        Regular price ${selectedPlanData?.originalPrice?.toFixed(2)}/month starts month 2
                      </div>
                    </div>
                  )}
                </div>

                {/* Due Today */}
                <Divider className="my-4" />
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Due Today</span>
                    <span className="text-xl font-semibold">$0.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Due if approved</span>
                    <span className="text-sm font-medium text-primary">${selectedPlanData?.price.toFixed(2) || '0.00'}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Only charged if prescribed by a licensed physician. We'll securely hold your payment method. No
                    charge until prescribed.
                  </p>
                </div>

                {/* What's Included */}
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
      </div>
    </div>
  );
}