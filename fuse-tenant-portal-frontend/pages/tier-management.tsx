import { useState, useEffect } from 'react';
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Check, X } from 'lucide-react';

interface TierConfig {
  id: string;
  brandSubscriptionPlanId: string;
  canAddCustomProducts: boolean;
  hasAccessToAnalytics: boolean;
  canUploadCustomProductImages: boolean;
  hasCustomPortal: boolean;
  hasPrograms: boolean;
}

interface Plan {
  id: string;
  planType: string;
  name: string;
  description: string;
  monthlyPrice: string;
  maxProducts: number;
  isActive: boolean;
  sortOrder: number;
}

interface TierWithConfig {
  plan: Plan;
  config: TierConfig | null;
}

export default function TierManagement() {
  const { token } = useAuth();
  const [tiers, setTiers] = useState<TierWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchTiers();
    }
  }, [token]);

  const fetchTiers = async () => {
    try {
      console.log('🔐 [Tier Frontend] Token exists:', !!token);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tiers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [Tier Frontend] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Tier Frontend] Response not OK:', errorText);
        throw new Error('Failed to fetch tiers');
      }

      const result = await response.json();
      console.log('📦 [Tier Frontend] Fetched result:', result);
      console.log('📦 [Tier Frontend] Tiers data:', result.data);
      console.log('📦 [Tier Frontend] Tiers count:', result.data?.length);
      setTiers(result.data || []);
    } catch (error) {
      console.error('❌ [Tier Frontend] Error fetching tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = async (planId: string, featureName: 'canAddCustomProducts' | 'hasAccessToAnalytics' | 'canUploadCustomProductImages' | 'hasCustomPortal' | 'hasPrograms', currentValue: boolean) => {
    if (!token) return;

    setSaving(planId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tiers/${planId}/config`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [featureName]: !currentValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tier configuration');
      }

      const result = await response.json();
      console.log('✅ Updated tier config:', result.data);

      // Update local state
      setTiers(prevTiers => prevTiers.map(tier => {
        if (tier.plan.id === planId) {
          return {
            ...tier,
            config: result.data,
          };
        }
        return tier;
      }));
    } catch (error) {
      console.error('Error updating tier configuration:', error);
      alert('Failed to update tier configuration');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">Tier Configuration</h1>
                  <p className="text-sm text-[#6B7280]">Manage feature access for each subscription tier</p>
                </div>
              </div>
            </div>

            {/* Tiers List */}
            {loading ? (
              <Card className="p-8">
                <div className="text-center text-[#6B7280]">Loading tiers...</div>
              </Card>
            ) : tiers.length === 0 ? (
              <Card className="p-8">
                <div className="text-center text-[#6B7280]">No active subscription tiers found</div>
              </Card>
            ) : (
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <Card key={tier.plan.id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      {/* Plan Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-[#1F2937]">
                            {tier.plan.name}
                          </h3>
                          <span className="px-3 py-1 text-xs font-medium text-[#4FA59C] bg-[#E5F5F3] rounded-full">
                            {tier.plan.planType}
                          </span>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-3">
                          {tier.plan.description}
                        </p>
                        <div className="flex items-center space-x-6 text-sm">
                          <div>
                            <span className="text-[#9CA3AF]">Price:</span>{' '}
                            <span className="font-semibold text-[#1F2937]">
                              ${tier.plan.monthlyPrice}/month
                            </span>
                          </div>
                          <div>
                            <span className="text-[#9CA3AF]">Max Products:</span>{' '}
                            <span className="font-semibold text-[#1F2937]">
                              {tier.plan.maxProducts === -1 ? 'Unlimited' : tier.plan.maxProducts}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="ml-8 flex flex-col items-end space-y-3">
                        <div className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">
                          Features
                        </div>

                        {/* Can Add Custom Products Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-[#6B7280]">
                            Can Add Custom Products
                          </span>
                          <button
                            onClick={() => handleToggleFeature(
                              tier.plan.id,
                              'canAddCustomProducts',
                              tier.config?.canAddCustomProducts || false
                            )}
                            disabled={saving === tier.plan.id}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                ${tier.config?.canAddCustomProducts
                                ? 'bg-[#4FA59C]'
                                : 'bg-[#D1D5DB]'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.canAddCustomProducts ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.canAddCustomProducts ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-[#9CA3AF]" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Access To Analytics Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-[#6B7280]">
                            Has Access To Analytics
                          </span>
                          <button
                            onClick={() => handleToggleFeature(
                              tier.plan.id,
                              'hasAccessToAnalytics',
                              tier.config?.hasAccessToAnalytics || false
                            )}
                            disabled={saving === tier.plan.id}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                ${tier.config?.hasAccessToAnalytics
                                ? 'bg-[#4FA59C]'
                                : 'bg-[#D1D5DB]'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasAccessToAnalytics ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasAccessToAnalytics ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-[#9CA3AF]" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Custom Portal Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-[#6B7280]">
                            Has Custom Portal
                          </span>
                          <button
                            onClick={() => handleToggleFeature(
                              tier.plan.id,
                              'hasCustomPortal',
                              tier.config?.hasCustomPortal || false
                            )}
                            disabled={saving === tier.plan.id}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                ${tier.config?.hasCustomPortal
                                ? 'bg-[#4FA59C]'
                                : 'bg-[#D1D5DB]'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasCustomPortal ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasCustomPortal ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-[#9CA3AF]" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Programs Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-[#6B7280]">
                            Has Programs
                          </span>
                          <button
                            onClick={() => handleToggleFeature(
                              tier.plan.id,
                              'hasPrograms',
                              tier.config?.hasPrograms || false
                            )}
                            disabled={saving === tier.plan.id}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                ${tier.config?.hasPrograms
                                ? 'bg-[#4FA59C]'
                                : 'bg-[#D1D5DB]'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasPrograms ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasPrograms ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-[#9CA3AF]" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

