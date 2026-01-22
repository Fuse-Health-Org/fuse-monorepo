import { useState, useEffect } from 'react';
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Check, X, Plus, Trash2, Save, Edit2 } from 'lucide-react';

interface TierConfig {
  id: string;
  brandSubscriptionPlanId: string;
  canAddCustomProducts: boolean;
  hasAccessToAnalytics: boolean;
  canUploadCustomProductImages: boolean;
  hasCustomPortal: boolean;
  hasPrograms: boolean;
  canCustomizeFormStructure: boolean;
  customTierCardText: string[] | null;
  isCustomTierCardTextActive: boolean;
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
  const [editingCustomText, setEditingCustomText] = useState<string | null>(null);
  const [customTextDraft, setCustomTextDraft] = useState<string[]>([]);
  const [editingMaxProducts, setEditingMaxProducts] = useState<string | null>(null);
  const [maxProductsDraft, setMaxProductsDraft] = useState<number>(0);

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

  const handleToggleFeature = async (planId: string, featureName: 'canAddCustomProducts' | 'hasAccessToAnalytics' | 'canUploadCustomProductImages' | 'hasCustomPortal' | 'hasPrograms' | 'canCustomizeFormStructure' | 'isCustomTierCardTextActive', currentValue: boolean) => {
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

  const handleStartEditingCustomText = (planId: string, currentText: string[] | null) => {
    setEditingCustomText(planId);
    setCustomTextDraft(currentText || []);
  };

  const handleAddCustomTextLine = () => {
    setCustomTextDraft([...customTextDraft, '']);
  };

  const handleUpdateCustomTextLine = (index: number, value: string) => {
    const newDraft = [...customTextDraft];
    newDraft[index] = value;
    setCustomTextDraft(newDraft);
  };

  const handleRemoveCustomTextLine = (index: number) => {
    setCustomTextDraft(customTextDraft.filter((_, i) => i !== index));
  };

  const handleSaveCustomText = async (planId: string) => {
    if (!token) return;

    setSaving(planId);
    try {
      // Filter out empty strings
      const cleanedText = customTextDraft.filter(line => line.trim() !== '');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tiers/${planId}/config`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customTierCardText: cleanedText.length > 0 ? cleanedText : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update custom text');
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
      
      setEditingCustomText(null);
      setCustomTextDraft([]);
    } catch (error) {
      console.error('Error updating custom text:', error);
      alert('Failed to update custom text');
    } finally {
      setSaving(null);
    }
  };

  const handleCancelEditingCustomText = () => {
    setEditingCustomText(null);
    setCustomTextDraft([]);
  };

  const handleStartEditingMaxProducts = (planId: string, currentMaxProducts: number) => {
    setEditingMaxProducts(planId);
    setMaxProductsDraft(currentMaxProducts);
  };

  const handleSaveMaxProducts = async (planId: string) => {
    if (!token) return;

    setSaving(planId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxProducts: maxProductsDraft,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update max products');
      }

      const result = await response.json();
      console.log('✅ Updated plan:', result.data);

      // Update local state
      setTiers(prevTiers => prevTiers.map(tier => {
        if (tier.plan.id === planId) {
          return {
            ...tier,
            plan: {
              ...tier.plan,
              maxProducts: maxProductsDraft,
            },
          };
        }
        return tier;
      }));

      setEditingMaxProducts(null);
    } catch (error) {
      console.error('Error updating max products:', error);
      alert('Failed to update max products');
    } finally {
      setSaving(null);
    }
  };

  const handleCancelEditingMaxProducts = () => {
    setEditingMaxProducts(null);
    setMaxProductsDraft(0);
  };

  return (
    <div className="flex h-screen bg-background">
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
                  <h1 className="text-2xl font-bold text-foreground">Tier Configuration</h1>
                  <p className="text-sm text-muted-foreground">Manage feature access for each subscription tier</p>
                </div>
              </div>
            </div>

            {/* Tiers List */}
            {loading ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">Loading tiers...</div>
              </Card>
            ) : tiers.length === 0 ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">No active subscription tiers found</div>
              </Card>
            ) : (
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <Card key={tier.plan.id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      {/* Plan Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {tier.plan.name}
                          </h3>
                          <span className="px-3 py-1 text-xs font-medium text-[#4FA59C] bg-teal-50 dark:bg-teal-900/30 rounded-full">
                            {tier.plan.planType}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {tier.plan.description}
                        </p>
                        <div className="flex items-center space-x-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">Price:</span>{' '}
                            <span className="font-semibold text-foreground">
                              ${tier.plan.monthlyPrice}/month
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Max Products:</span>{' '}
                            {editingMaxProducts === tier.plan.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={maxProductsDraft}
                                  onChange={(e) => setMaxProductsDraft(parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-[#4FA59C] bg-background text-foreground"
                                  placeholder="-1 for unlimited"
                                />
                                <button
                                  onClick={() => handleSaveMaxProducts(tier.plan.id)}
                                  disabled={saving === tier.plan.id}
                                  className="p-1 text-[#4FA59C] hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors disabled:opacity-50"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEditingMaxProducts}
                                  className="p-1 text-muted-foreground hover:bg-muted rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-foreground">
                                  {tier.plan.maxProducts === -1 ? 'Unlimited' : tier.plan.maxProducts}
                                </span>
                                <button
                                  onClick={() => handleStartEditingMaxProducts(tier.plan.id, tier.plan.maxProducts)}
                                  className="p-1 text-muted-foreground hover:text-[#4FA59C] hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                                  title="Edit max products"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                            <span className="text-xs text-muted-foreground">(-1 = unlimited)</span>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="ml-8 flex flex-col items-end space-y-3">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Features
                        </div>

                        {/* Can Add Custom Products Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
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
                                : 'bg-gray-300 dark:bg-gray-600'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.canAddCustomProducts ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.canAddCustomProducts ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Access To Analytics Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
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
                                : 'bg-gray-300 dark:bg-gray-600'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasAccessToAnalytics ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasAccessToAnalytics ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Custom Portal Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
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
                                : 'bg-gray-300 dark:bg-gray-600'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasCustomPortal ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasCustomPortal ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Has Programs Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
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
                                : 'bg-gray-300 dark:bg-gray-600'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.hasPrograms ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.hasPrograms ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Can Customize Form Structure Toggle */}
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
                            Can Customize Form Structure
                          </span>
                          <button
                            onClick={() => handleToggleFeature(
                              tier.plan.id,
                              'canCustomizeFormStructure',
                              tier.config?.canCustomizeFormStructure || false
                            )}
                            disabled={saving === tier.plan.id}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                ${tier.config?.canCustomizeFormStructure
                                ? 'bg-[#4FA59C]'
                                : 'bg-gray-300 dark:bg-gray-600'
                              }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                          >
                            <span
                              className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  flex items-center justify-center
                                  ${tier.config?.canCustomizeFormStructure ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            >
                              {tier.config?.canCustomizeFormStructure ? (
                                <Check className="h-3 w-3 text-[#4FA59C]" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Custom Plan Card Text Section */}
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-foreground">Custom Plan Card Text</h4>
                          <p className="text-xs text-muted-foreground">Custom bullet points shown on the plans page (overrides auto-generated text)</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Toggle for using custom text */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Use Custom Text</span>
                            <button
                              onClick={() => handleToggleFeature(
                                tier.plan.id,
                                'isCustomTierCardTextActive',
                                tier.config?.isCustomTierCardTextActive || false
                              )}
                              disabled={saving === tier.plan.id}
                              className={`
                                relative inline-flex h-6 w-10 items-center rounded-full transition-colors
                                ${tier.config?.isCustomTierCardTextActive
                                  ? 'bg-[#4FA59C]'
                                  : 'bg-gray-300 dark:bg-gray-600'
                                }
                                ${saving === tier.plan.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform shadow-sm
                                  ${tier.config?.isCustomTierCardTextActive ? 'translate-x-5' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>
                          {editingCustomText !== tier.plan.id && (
                            <button
                              onClick={() => handleStartEditingCustomText(tier.plan.id, tier.config?.customTierCardText || null)}
                              className="px-3 py-1.5 text-xs font-medium text-[#4FA59C] bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                            >
                              {tier.config?.customTierCardText?.length ? 'Edit Text' : 'Add Custom Text'}
                            </button>
                          )}
                        </div>
                      </div>

                      {editingCustomText === tier.plan.id ? (
                        <div className="space-y-2">
                          {customTextDraft.map((line, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={line}
                                onChange={(e) => handleUpdateCustomTextLine(index, e.target.value)}
                                placeholder="Enter bullet point text..."
                                className="flex-1 px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent bg-background text-foreground"
                              />
                              <button
                                onClick={() => handleRemoveCustomTextLine(index)}
                                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={handleAddCustomTextLine}
                            className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            Add Line
                          </button>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={() => handleSaveCustomText(tier.plan.id)}
                              disabled={saving === tier.plan.id}
                              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-[#4FA59C] hover:bg-[#3d8580] rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditingCustomText}
                              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : tier.config?.customTierCardText?.length ? (
                        <div>
                          {!tier.config?.isCustomTierCardTextActive && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 italic">
                              ⚠️ Custom text is saved but not active. Toggle "Use Custom Text" to display it on the plans page.
                            </p>
                          )}
                          <ul className="space-y-1">
                            {tier.config.customTierCardText.map((line, index) => (
                              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="h-3 w-3 text-[#4FA59C] flex-shrink-0" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No custom text configured. Features will be auto-generated from toggles above.</p>
                      )}
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

