import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Link2, Unlink, ExternalLink, Check, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface MDIOfferingManagerProps {
  productId: string
  productName: string
}

interface Offering {
  id: string
  offering_id?: string
  name?: string
  title?: string
  description?: string
}

export function MDIOfferingManager({ productId, productName }: MDIOfferingManagerProps) {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(true)
  const [hasOffering, setHasOffering] = useState(false)
  const [linkedOffering, setLinkedOffering] = useState<{ id: string; name: string } | null>(null)
  const [availableOfferings, setAvailableOfferings] = useState<Offering[]>([])
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("")
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch current offering status and available offerings
  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch current product's offering status
      const statusRes = await fetch(`${baseUrl}/md/admin/products/${productId}/offering`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const statusData = await statusRes.json()

      if (statusData.success) {
        setHasOffering(statusData.data.hasOffering)
        if (statusData.data.hasOffering) {
          setLinkedOffering({
            id: statusData.data.offeringId,
            name: statusData.data.offeringName
          })
        } else {
          setLinkedOffering(null)
        }
      }

      // Fetch all available offerings
      const offeringsRes = await fetch(`${baseUrl}/md/admin/offerings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const offeringsData = await offeringsRes.json()

      if (offeringsData.success && offeringsData.data) {
        setAvailableOfferings(offeringsData.data)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load MDI offering data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId && token) {
      fetchData()
    }
  }, [productId, token])

  const handleLinkOffering = async () => {
    if (!selectedOfferingId) return

    setLinking(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${baseUrl}/md/admin/products/${productId}/offering/link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ offeringId: selectedOfferingId })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess("Product linked to MDI offering")
        setHasOffering(true)
        setLinkedOffering({
          id: data.data.offeringId,
          name: data.data.offeringName
        })
        setSelectedOfferingId("")
      } else {
        setError(data.message || "Failed to link offering")
      }
    } catch (err: any) {
      setError(err.message || "Failed to link offering")
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkOffering = async () => {
    setLinking(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${baseUrl}/md/admin/products/${productId}/offering`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await res.json()

      if (data.success) {
        setSuccess("Product unlinked from MDI offering")
        setHasOffering(false)
        setLinkedOffering(null)
      } else {
        setError(data.message || "Failed to unlink offering")
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlink offering")
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            MD Integrations Offering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          MD Integrations Offering
        </CardTitle>
        <CardDescription>
          Link this product to an MDI offering for telehealth case creation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Current Status */}
        {hasOffering && linkedOffering ? (
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium text-green-900 dark:text-green-300">Linked to MDI Offering</div>
                <div className="text-sm text-green-700 dark:text-green-400">{linkedOffering.name}</div>
                <div className="text-xs text-green-600 dark:text-green-500 font-mono mt-1">{linkedOffering.id}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlinkOffering}
              disabled={linking}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
              Unlink
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="font-medium text-amber-900 dark:text-amber-300">No MDI Offering Linked</div>
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  Link an existing offering or create a new one
                </div>
              </div>
            </div>

            {/* Link Existing Offering */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Link to Existing Offering</label>
              <div className="flex gap-2">
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select an offering...</option>
                  {availableOfferings.map((offering) => (
                    <option 
                      key={offering.offering_id || offering.id} 
                      value={offering.offering_id || offering.id}
                    >
                      {offering.name || offering.title}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleLinkOffering}
                  disabled={!selectedOfferingId || linking}
                >
                  {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Link
                </Button>
              </div>
              {availableOfferings.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No offerings found. Create one in the MDI portal first.
                </p>
              )}
            </div>

            {/* Info about creating offerings */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <div className="font-medium text-sm text-blue-900 dark:text-blue-300">Need a new offering?</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Offerings must be created in the{" "}
                    <a 
                      href="https://app.mdintegrations.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      MD Integrations portal
                    </a>
                    . Once created, it will appear in the dropdown above.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          MDI offerings are used when creating telehealth cases. When a patient orders this product,
          the linked offering will be sent to MD Integrations for clinician review.
        </div>
      </CardContent>
    </Card>
  )
}
