import { useState, useEffect } from 'react';
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, Save, AlertCircle, RotateCcw } from 'lucide-react';

interface GlobalFees {
  platformFeePercent: number;
  stripeFeePercent: number;
  doctorFlatFeeUsd: number;
  refundProcessingDelayDays: number;
}

export default function GlobalFees() {
  const { token } = useAuth();
  const [fees, setFees] = useState<GlobalFees>({
    platformFeePercent: 0,
    stripeFeePercent: 0,
    doctorFlatFeeUsd: 0,
    refundProcessingDelayDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (token) {
      fetchFees();
    }
  }, [token]);

  const fetchFees = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config/fees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch global fees');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setFees(result.data);
      }
    } catch (error) {
      console.error('Error fetching global fees:', error);
      setMessage({ type: 'error', text: 'Failed to load global fees & refunds configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config/fees`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fees),
      });

      if (!response.ok) {
        throw new Error('Failed to update global fees');
      }

      const result = await response.json();
      console.log('✅ Updated global fees:', result.data);
      
      setMessage({ type: 'success', text: 'Global fees & refunds updated successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error updating global fees:', error);
      setMessage({ type: 'error', text: 'Failed to update global fees & refunds. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof GlobalFees, value: string) => {
    const numValue = field === 'refundProcessingDelayDays'
      ? Math.max(0, Math.floor(parseFloat(value) || 0))
      : parseFloat(value) || 0;
    setFees(prev => ({
      ...prev,
      [field]: numValue,
    }));
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Global Fees & Refunds</h1>
                  <p className="text-sm text-muted-foreground">Manage platform-wide transaction fees and refund settings</p>
                </div>
              </div>
            </div>

            {/* Alert Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl border ${
                message.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' 
                  : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              </div>
            )}

            {/* Configuration Card */}
            {loading ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">Loading configuration...</div>
              </Card>
            ) : (
              <Card className="p-8">
                <div className="space-y-8">
                  {/* Warning Banner */}
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-1">
                          Important: Platform-Wide Configuration
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Changes to these fees and refund settings will affect all new transactions across the entire platform. 
                          Existing orders will not be affected.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fuse Platform Fee */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Fuse Platform Fee (%)
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Percentage of each transaction retained by the Fuse platform
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fees.platformFeePercent}
                        onChange={(e) => handleInputChange('platformFeePercent', e.target.value)}
                        className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent text-foreground text-base bg-background"
                        placeholder="e.g., 1.0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Stripe Fee */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Stripe Transaction Fee (%)
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Percentage charged by Stripe for payment processing
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fees.stripeFeePercent}
                        onChange={(e) => handleInputChange('stripeFeePercent', e.target.value)}
                        className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent text-foreground text-base bg-background"
                        placeholder="e.g., 3.9"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Doctor Flat Fee */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Doctor Flat Fee (USD)
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fixed amount paid to doctors per transaction
                    </p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fees.doctorFlatFeeUsd}
                        onChange={(e) => handleInputChange('doctorFlatFeeUsd', e.target.value)}
                        className="w-full pl-8 pr-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent text-foreground text-base bg-background"
                        placeholder="e.g., 15.00"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        USD
                      </span>
                    </div>
                  </div>

                  {/* Refund Settings Divider */}
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center space-x-2 mb-6">
                      <RotateCcw className="h-5 w-5 text-[#4FA59C]" />
                      <h2 className="text-lg font-semibold text-foreground">Refund Settings</h2>
                    </div>

                    {/* Refund Processing Delay */}
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Refund Processing Delay (Days)
                      </label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Number of days to wait before processing a refund after it is initiated
                      </p>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={fees.refundProcessingDelayDays}
                          onChange={(e) => handleInputChange('refundProcessingDelayDays', e.target.value)}
                          className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent text-foreground text-base bg-background"
                          placeholder="e.g., 7"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fee Breakdown Preview */}
                  <div className="bg-muted/50 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">
                      Example Fee Breakdown (on $100 sale)
                    </h3>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform Fee ({fees.platformFeePercent}%)</span>
                        <span className="font-medium text-foreground">
                          ${((fees.platformFeePercent / 100) * 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stripe Fee ({fees.stripeFeePercent}%)</span>
                        <span className="font-medium text-foreground">
                          ${((fees.stripeFeePercent / 100) * 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Doctor Fee (flat)</span>
                        <span className="font-medium text-foreground">
                          ${fees.doctorFlatFeeUsd.toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2.5 border-t border-border">
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-foreground">Total Fees</span>
                          <span className="text-[#4FA59C]">
                            ${(
                              ((fees.platformFeePercent / 100) * 100) +
                              ((fees.stripeFeePercent / 100) * 100) +
                              fees.doctorFlatFeeUsd
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Remaining for Brand</span>
                          <span className="font-medium text-foreground">
                            ${(
                              100 -
                              ((fees.platformFeePercent / 100) * 100) -
                              ((fees.stripeFeePercent / 100) * 100) -
                              fees.doctorFlatFeeUsd
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center space-x-2 px-6 py-3 bg-[#4FA59C] text-white font-medium rounded-xl hover:bg-[#3d8580] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

