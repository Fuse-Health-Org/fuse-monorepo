import { useState, useEffect } from 'react';
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Palette, Save, AlertCircle, RotateCcw } from 'lucide-react';

interface WebsiteBuilderConfig {
  id: string;
  defaultFooterDisclaimer: string;
  createdAt: string;
  updatedAt: string;
}

export default function WebsiteBuilder() {
  const { token } = useAuth();
  const [config, setConfig] = useState<WebsiteBuilderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (token) {
      fetchConfig();
    }
  }, [token]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/website-builder-configs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch website builder config');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Error fetching website builder config:', error);
      setMessage({ type: 'error', text: 'Failed to load website builder configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token || !config) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/website-builder-configs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          defaultFooterDisclaimer: config.defaultFooterDisclaimer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update website builder config');
      }

      const result = await response.json();
      console.log('✅ Updated website builder config:', result.data);
      
      setMessage({ type: 'success', text: 'Website builder configuration updated successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error updating website builder config:', error);
      setMessage({ type: 'error', text: 'Failed to update configuration. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (!token) return;

    if (!confirm('Are you sure you want to restore the default footer disclaimer? This will replace your current custom text.')) {
      return;
    }

    setRestoring(true);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/website-builder-configs/restore-default`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to restore default');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setConfig(result.data);
        setMessage({ type: 'success', text: 'Default footer disclaimer restored successfully!' });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error restoring default:', error);
      setMessage({ type: 'error', text: 'Failed to restore default. Please try again.' });
    } finally {
      setRestoring(false);
    }
  };

  const handleTextChange = (value: string) => {
    if (config) {
      setConfig({
        ...config,
        defaultFooterDisclaimer: value,
      });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-[#4FA59C] to-[#3d8580] rounded-xl flex items-center justify-center shadow-sm">
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Website Builder Configuration</h1>
                  <p className="text-sm text-muted-foreground">Manage global defaults for client custom websites</p>
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
                  {/* Info Banner */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                          Global Default Configuration
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                          This configuration sets the default footer disclaimer text that will be used across all client 
                          custom websites. Clients can override this text individually from their admin portal.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Disclaimer */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Default Footer Disclaimer Text
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      This text appears in the middle section of the footer on all custom landing pages. 
                      It typically contains legal disclaimers, FDA statements, and important product information.
                    </p>
                    <textarea
                      value={config?.defaultFooterDisclaimer || ''}
                      onChange={(e) => handleTextChange(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-3 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-transparent text-foreground text-sm font-mono resize-y bg-background"
                      placeholder="Enter default footer disclaimer text..."
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {config?.defaultFooterDisclaimer?.length || 0} characters
                    </p>
                  </div>

                  {/* Preview Section */}
                  <div className="bg-muted/50 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">
                      Preview (Footer Middle Section)
                    </h3>
                    <div className="bg-[#1F2937] dark:bg-gray-800 text-white p-6 rounded-lg">
                      <div className="text-xs leading-relaxed opacity-70 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {config?.defaultFooterDisclaimer || 'No disclaimer text set'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      onClick={handleRestoreDefault}
                      disabled={restoring || saving}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-background text-muted-foreground font-medium rounded-xl hover:bg-muted border border-input transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>{restoring ? 'Restoring...' : 'Restore Default'}</span>
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={saving || restoring}
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
