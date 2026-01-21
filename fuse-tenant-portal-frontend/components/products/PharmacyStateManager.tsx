import { useState, useEffect } from "react"
import { Loader2, Plus, Trash2, MapPin, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington DC' }
]

interface Pharmacy {
  id: string
  name: string
  slug: string
  supportedStates: string[]
}

interface PharmacyProduct {
  id: string | number
  sku: string | number
  name: string
  strength?: string
  nameWithStrength?: string
  dispense?: string
  label?: string
  sig?: string
  price?: number
  wholesalePrice?: number
  form?: string
  rxId?: string
}

interface PharmacyAssignment {
  id: string
  pharmacyId: string
  state: string
  pharmacyProductId?: string
  pharmacyProductName?: string
  pharmacyWholesaleCost?: number
  sig?: string
  form?: string
  rxId?: string
  pharmacy: Pharmacy
  pharmacyCoverageId?: string
  pharmacyCoverage?: {
    id: string
    customName: string
    customSig: string
  } | null
}

interface CoverageEntry {
  key: string
  pharmacy: Pharmacy
  productName?: string | null
  productSku?: string | null
  sig?: string | null
  form?: string | null
  rxId?: string | null
  wholesaleCost?: number | null
  states: Array<{ state: string; assignmentId: string }>
}

interface CoverageGroup {
  key: string
  coverageId?: string | null
  coverageName?: string | null
  coverageSig?: string | null
  entries: CoverageEntry[]
  defaultPharmacyId?: string
  rawCustomName?: string | null
  rawCustomSig?: string | null
}

type FormContext =
  | { mode: 'hidden' }
  | { mode: 'new' }
  | { mode: 'existing'; coverage: CoverageGroup }

interface PharmacyStateManagerProps {
  productId: string
}

export function PharmacyStateManager({ productId }: PharmacyStateManagerProps) {
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [assignments, setAssignments] = useState<PharmacyAssignment[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [pharmacyProducts, setPharmacyProducts] = useState<PharmacyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedPharmacyProduct, setSelectedPharmacyProduct] = useState<PharmacyProduct | null>(null)
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [customProductName, setCustomProductName] = useState("")
  const [customSig, setCustomSig] = useState("")
  const [formContext, setFormContext] = useState<FormContext>({ mode: 'hidden' })
  const [editingCoverageId, setEditingCoverageId] = useState<string | null>(null)
  const [headerNameInput, setHeaderNameInput] = useState("")
  const [headerSigInput, setHeaderSigInput] = useState("")
  const [headerSaving, setHeaderSaving] = useState(false)

  const resetFormState = () => {
    setSelectedStates([])
    setSelectedPharmacy("")
    setSelectedPharmacyProduct(null)
    setPharmacyProducts([])
    setProductSearchQuery("")
    setCustomProductName("")
    setCustomSig("")
    setError(null)
  }

  const openNewCoverageForm = () => {
    resetFormState()
    setFormContext({ mode: 'new' })
  }

  const openExistingCoverageForm = (coverage: CoverageGroup) => {
    cancelEditCoverageHeader()
    resetFormState()
    const fallbackEntry = coverage.entries[0]
    const fallbackName = coverage.rawCustomName || coverage.coverageName || fallbackEntry?.productName || ''
    const fallbackSig = coverage.rawCustomSig || coverage.coverageSig || fallbackEntry?.sig || 'Take as directed by your healthcare provider'

    setSelectedPharmacy(coverage.defaultPharmacyId || fallbackEntry?.pharmacy.id || '')
    setCustomProductName(fallbackName)
    setCustomSig(fallbackSig)
    setFormContext({ mode: 'existing', coverage })
  }

  const closeForm = () => {
    resetFormState()
    setFormContext({ mode: 'hidden' })
  }

  const startEditCoverageHeader = (coverage: CoverageGroup) => {
    if (!coverage.coverageId) return
    closeForm()
    const fallbackEntry = coverage.entries[0]
    setEditingCoverageId(coverage.coverageId)
    setHeaderNameInput(coverage.coverageName || coverage.rawCustomName || fallbackEntry?.productName || '')
    setHeaderSigInput(coverage.coverageSig || coverage.rawCustomSig || fallbackEntry?.sig || 'Take as directed by your healthcare provider')
  }

  const cancelEditCoverageHeader = () => {
    setEditingCoverageId(null)
    setHeaderNameInput("")
    setHeaderSigInput("")
  }

  const saveCoverageHeader = async (coverage: CoverageGroup) => {
    if (!coverage.coverageId) return
    if (!token) {
      setError("Not authenticated")
      return
    }
    const trimmedName = headerNameInput.trim()
    const trimmedSig = headerSigInput.trim()

    if (!trimmedName || !trimmedSig) {
      setError("Coverage name and note are required")
      return
    }

    try {
      setHeaderSaving(true)
      setError(null)

      const response = await fetch(`${baseUrl}/pharmacy-coverage/${coverage.coverageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customName: trimmedName, customSig: trimmedSig }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update coverage header')
      }

      cancelEditCoverageHeader()
      await fetchData()
    } catch (err: any) {
      console.error('Error updating coverage header:', err)
      setError(err.message)
    } finally {
      setHeaderSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [productId, token])

  const fetchData = async () => {
    if (!token) return

    try {
      setLoading(true)
      // Fetch pharmacies and assignments in parallel
      const [pharmaciesRes, assignmentsRes] = await Promise.all([
        fetch(`${baseUrl}/pharmacies`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${baseUrl}/products/${productId}/pharmacy-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (pharmaciesRes.ok) {
        const data = await pharmaciesRes.json()
        setPharmacies(data.data || [])
      }

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json()
        setAssignments(data.data || [])
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load pharmacy data")
    } finally {
      setLoading(false)
    }
  }

  // Fetch pharmacy products when pharmacy and states are selected
  useEffect(() => {
    if (!selectedPharmacy || selectedStates.length === 0 || !token) {
      setPharmacyProducts([])
      return
    }

    const fetchPharmacyProducts = async () => {
      const pharmacy = pharmacies.find(p => p.id === selectedPharmacy)
      if (!pharmacy) return

      setLoadingProducts(true)
      try {
        const statesQuery = selectedStates.join(',')
        const response = await fetch(
          `${baseUrl}/pharmacies/${pharmacy.slug}/products?states=${statesQuery}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )

        if (response.ok) {
          const data = await response.json()
          console.log('📦 Fetched pharmacy products:', data.data?.slice(0, 2)) // Log first 2 products
          setPharmacyProducts(data.data || [])
        } else {
          console.error('Failed to fetch pharmacy products')
          setPharmacyProducts([])
        }
      } catch (err) {
        console.error('Error fetching pharmacy products:', err)
        setPharmacyProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchPharmacyProducts()
  }, [selectedPharmacy, selectedStates, token, pharmacies, baseUrl])

  const assignedStatesByCoverage: Record<string, string[]> = {}
  assignments.forEach((assignment) => {
    const coverageId = assignment.pharmacyCoverageId || 'legacy'
    if (!assignedStatesByCoverage[coverageId]) {
      assignedStatesByCoverage[coverageId] = []
    }
    assignedStatesByCoverage[coverageId].push(assignment.state)
  })

  const getAvailableStatesForCoverage = (coverageKey?: string | null) => {
    const coverageId = coverageKey || 'legacy'
    const takenStates = assignedStatesByCoverage[coverageId] || []
    return US_STATES.filter((state) => !takenStates.includes(state.code))
  }

  const getAvailableStatesForPharmacy = (coverageKey?: string | null, pharmacyId?: string | null) => {
    if (!pharmacyId) return []
    const coverageStates = getAvailableStatesForCoverage(coverageKey)
    const pharmacy = pharmacies.find((p) => p.id === pharmacyId)
    if (!pharmacy) return []
    return coverageStates.filter((state) => pharmacy.supportedStates.includes(state.code))
  }

  const activeCoverageKey = formContext.mode === 'existing' ? formContext.coverage.coverageId || formContext.coverage.key : null
  const availableStatesForSelectedPharmacy = selectedPharmacy
    ? getAvailableStatesForPharmacy(activeCoverageKey, selectedPharmacy)
    : []

  // Filter pharmacy products by search query
  const filteredPharmacyProducts = pharmacyProducts.filter(product =>
    product.nameWithStrength?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.sku.toString().includes(productSearchQuery)
  )

  const handleAddAssignment = async () => {
    if (!token) return

    const isExistingCoverage = formContext.mode === 'existing'
    const isMetadataOnly = isExistingCoverage && selectedStates.length === 0

    if (!selectedPharmacy) {
      setError("Select a pharmacy before assigning coverage")
      return
    }

    const trimmedName = customProductName.trim()
    const trimmedSig = customSig.trim()

    if (!trimmedName) {
      setError("Custom product name is required")
      return
    }

    if (!trimmedSig) {
      setError("Custom SIG is required")
      return
    }

    if (!isExistingCoverage && selectedStates.length === 0) {
      setError("Select at least one state to assign")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload: any = {
        pharmacyId: selectedPharmacy,
        states: selectedStates,
        customName: trimmedName,
        customSig: trimmedSig,
        sig: trimmedSig,
      }

      if (formContext.mode === 'existing' && formContext.coverage.coverageId) {
        payload.coverageId = formContext.coverage.coverageId
      }

      if (selectedPharmacyProduct) {
        payload.pharmacyProductId = selectedPharmacyProduct.sku.toString()
        payload.pharmacyProductName = selectedPharmacyProduct.nameWithStrength || selectedPharmacyProduct.name
        payload.pharmacyWholesaleCost = selectedPharmacyProduct.wholesalePrice || selectedPharmacyProduct.price
        payload.form = selectedPharmacyProduct.form
        payload.rxId = selectedPharmacyProduct.rxId
        
        console.log('📦 Selected pharmacy product:', {
          sku: selectedPharmacyProduct.sku,
          name: selectedPharmacyProduct.name,
          sig: selectedPharmacyProduct.sig,
          form: selectedPharmacyProduct.form,
          rxId: selectedPharmacyProduct.rxId,
          wholesalePrice: selectedPharmacyProduct.wholesalePrice
        })
        console.log('📤 Sending payload to API:', payload)
      }

      const response = await fetch(`${baseUrl}/products/${productId}/pharmacy-assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to assign pharmacy")
      }

      closeForm()
      await fetchData()
    } catch (err: any) {
      console.error("Error adding assignment:", err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCustomPrice = async (assignmentId: string, customPrice: number) => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/pharmacy-assignments/${assignmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pharmacyWholesaleCost: customPrice }),
      })

      if (!response.ok) {
        throw new Error("Failed to update custom price")
      }

      await fetchData() // Refresh to show the updated price
    } catch (err) {
      console.error("Error updating custom price:", err)
      setError("Failed to update custom price")
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!token || !confirm("Remove this pharmacy assignment?")) return

    try {
      const response = await fetch(`${baseUrl}/pharmacy-assignments/${assignmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error("Failed to remove assignment")
      }

      await fetchData()
    } catch (err) {
      console.error("Error removing assignment:", err)
      setError("Failed to remove assignment")
    }
  }

  const handleRemoveCoverageGroup = async ({
    coverageId,
    pharmacyId,
    pharmacyName,
    coverageName,
  }: {
    coverageId?: string | null
    pharmacyId?: string
    pharmacyName?: string
    coverageName?: string
  }) => {
    if (!token) return

    const label = coverageName ? `"${coverageName}"` : "this coverage"
    if (!confirm(`Remove ${pharmacyName || 'the selected pharmacy'} coverage ${label}? This will delete all state assignments for this coverage.`)) return

    try {
      setSaving(true)
      setError(null)

      if (coverageId) {
        const response = await fetch(`${baseUrl}/pharmacy-coverage/${coverageId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error("Failed to remove pharmacy coverage")
        }
      } else if (pharmacyId) {
      const response = await fetch(`${baseUrl}/products/${productId}/pharmacies/${pharmacyId}/assignments`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error("Failed to remove pharmacy coverage")
        }
      } else {
        throw new Error("Unable to determine pharmacy for coverage removal")
      }

      await fetchData()
    } catch (err) {
      console.error("Error removing pharmacy coverage:", err)
      setError("Failed to remove pharmacy coverage")
    } finally {
      setSaving(false)
    }
  }

  type CoverageAccumulator = {
    key: string
    coverageId?: string | null
    coverageName?: string | null
    coverageSig?: string | null
    rawCustomName?: string | null
    rawCustomSig?: string | null
    defaultPharmacyId?: string
    entriesMap: Record<string, CoverageEntry>
  }

  const coverageMap = assignments.reduce<Record<string, CoverageAccumulator>>((acc, assignment) => {
    const coverageId = assignment.pharmacyCoverageId || null
    const coverage = assignment.pharmacyCoverage
    const key = coverageId ?? `legacy-${assignment.pharmacyId}-${assignment.pharmacyProductId || assignment.id}`

    if (!acc[key]) {
      acc[key] = {
        key,
        coverageId,
        coverageName: coverage?.customName || null,
        coverageSig: coverage?.customSig || null,
        rawCustomName: coverage?.customName ?? null,
        rawCustomSig: coverage?.customSig ?? null,
        defaultPharmacyId: assignment.pharmacy.id,
        entriesMap: {}
      }
    }

    const group = acc[key]
    const entryKey = `${assignment.pharmacyId}-${assignment.pharmacyProductId || 'none'}`

    if (!group.entriesMap[entryKey]) {
      group.entriesMap[entryKey] = {
        key: entryKey,
        pharmacy: assignment.pharmacy,
        productName: assignment.pharmacyProductName || coverage?.customName || null,
        productSku: assignment.pharmacyProductId || null,
        sig: assignment.sig || coverage?.customSig || null,
        form: assignment.form || null,
        rxId: assignment.rxId || null,
        wholesaleCost: assignment.pharmacyWholesaleCost ?? null,
        states: []
      }
    }

    group.entriesMap[entryKey].states.push({ state: assignment.state, assignmentId: assignment.id })
    return acc
  }, {} as Record<string, CoverageAccumulator>)

  const sortedCoverageGroups: CoverageGroup[] = Object.values(coverageMap)
    .map(group => ({
      key: group.key,
      coverageId: group.coverageId,
      coverageName: group.coverageName,
      coverageSig: group.coverageSig,
      rawCustomName: group.rawCustomName,
      rawCustomSig: group.rawCustomSig,
      defaultPharmacyId: group.defaultPharmacyId,
      entries: Object.values(group.entriesMap).map(entry => ({
        ...entry,
        states: [...entry.states].sort((a, b) => a.state.localeCompare(b.state))
      }))
    }))
    .sort((a, b) => (a.coverageName || '').localeCompare(b.coverageName || ''))

  const renderCoverageForm = (embedded: boolean) => {
    if (formContext.mode === 'hidden') {
      return null
    }

    const isExisting = formContext.mode === 'existing'
    const wrapperClasses = embedded
      ? "mt-4 p-6 border border-dashed border-[#4FA59C] rounded-2xl bg-muted/50 space-y-4"
      : "p-6 border border-border rounded-2xl space-y-4 bg-muted/50"

    return (
      <div className={wrapperClasses}>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Pharmacy</label>
              <select
                value={selectedPharmacy}
                onChange={(e) => {
                  setSelectedPharmacy(e.target.value)
              setSelectedStates([])
                }}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all disabled:bg-muted disabled:text-muted-foreground"
              >
                <option value="">Choose a pharmacy...</option>
                {pharmacies.map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name} ({pharmacy.supportedStates.length} states)
                  </option>
                ))}
              </select>
            </div>

            {selectedPharmacy && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select States (available for this pharmacy)
                </label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-xl p-3 bg-background">
                  {availableStatesForSelectedPharmacy.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">
                      All states supported by this pharmacy are already assigned.
                    </p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:bg-muted p-2 rounded-xl mb-2 border-b border-border">
                        <input
                          type="checkbox"
                          checked={selectedStates.length === availableStatesForSelectedPharmacy.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStates(availableStatesForSelectedPharmacy.map(s => s.code))
                            } else {
                              setSelectedStates([])
                            }
                          }}
                          className="w-4 h-4 rounded border-input text-[#4FA59C] focus:ring-[#4FA59C] focus:ring-2 focus:ring-opacity-50 bg-background"
                        />
                        <span className="text-foreground">Select All ({availableStatesForSelectedPharmacy.length} states)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {availableStatesForSelectedPharmacy.map((state) => (
                          <label key={state.code} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded-xl transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedStates.includes(state.code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStates([...selectedStates, state.code])
                                } else {
                                  setSelectedStates(selectedStates.filter(s => s !== state.code))
                                }
                              }}
                              className="w-4 h-4 rounded border-input text-[#4FA59C] focus:ring-[#4FA59C] focus:ring-2 focus:ring-opacity-50 bg-background"
                            />
                            <span className="text-foreground">{state.code}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedPharmacy && selectedStates.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Pharmacy Product (Optional)
                </label>
                {loadingProducts ? (
                  <div className="flex items-center justify-center p-4 border border-border rounded-xl bg-background">
                    <Loader2 className="h-5 w-5 animate-spin text-[#4FA59C] mr-2" />
                    <span className="text-sm text-muted-foreground">Loading products...</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search products by name or SKU..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground mb-2 focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                    />
                    <div className="max-h-64 overflow-y-auto border border-border rounded-xl bg-background">
                      {filteredPharmacyProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4 text-center">
                          {productSearchQuery ? "No products found matching your search." : "No products available."}
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredPharmacyProducts.map((product) => (
                            <label
                              key={product.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedPharmacyProduct?.id === product.id ? 'bg-muted' : ''
                              }`}
                            >
                              <input
                                type="radio"
                                name="pharmacyProduct"
                                checked={selectedPharmacyProduct?.id === product.id}
                            onChange={() => {
                              setSelectedPharmacyProduct(product)
                              const defaultName = product.nameWithStrength || product.name || ""
                              if (defaultName && customProductName.trim().length === 0) {
                                setCustomProductName(defaultName)
                              }
                              if (customSig.trim().length === 0) {
                                setCustomSig(product.sig || 'Take as directed by your healthcare provider')
                              }
                            }}
                                className="mt-1 w-4 h-4 border-input text-[#4FA59C] focus:ring-[#4FA59C] bg-background"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-foreground">
                                  {product.nameWithStrength || product.name}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  SKU: {product.sku}
                                  {product.dispense && ` • ${product.dispense}`}
                                  {product.wholesalePrice && ` • $${product.wholesalePrice}`}
                                </div>
                                {product.sig && (
                                  <div className="text-xs text-muted-foreground mt-1 italic">
                                    SIG: {product.sig}
                                  </div>
                                )}
                                {product.label && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {product.label}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedPharmacyProduct && (
                      <button
                        onClick={() => setSelectedPharmacyProduct(null)}
                        className="mt-2 px-4 py-2 rounded-full border border-border text-foreground hover:bg-muted transition-all text-sm font-medium"
                      >
                        Clear Selection
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Coverage Display Name
            </label>
            <input
              type="text"
              value={customProductName}
              onChange={(e) => setCustomProductName(e.target.value)}
              placeholder="e.g. IronSail Weight Loss Coverage"
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Displayed on the coverage card header. Keep it short and descriptive.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Coverage Note / SIG
            </label>
            <textarea
              value={customSig}
              onChange={(e) => setCustomSig(e.target.value)}
              placeholder="e.g. Take as directed by your healthcare provider"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This will appear below the coverage title and is saved with the coverage.
            </p>
          </div>
        </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddAssignment}
            disabled={
              !selectedPharmacy ||
              selectedStates.length === 0 ||
              !customProductName.trim() ||
              !customSig.trim() ||
              saving
            }
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Pharmacy"
                )}
              </button>
              <button 
            onClick={closeForm}
                className="px-4 py-2.5 rounded-full border border-border text-foreground hover:bg-muted transition-all text-sm font-medium"
              >
                Cancel
              </button>
            </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#4FA59C]" />
        </div>
      </div>
    )
  }

  const isNewFormOpen = formContext.mode === 'new'

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-muted rounded-xl p-2">
                <MapPin className="h-5 w-5 text-[#4FA59C]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Pharmacy & State Coverage</h2>
                <p className="text-sm text-muted-foreground">
                  Configure which pharmacies can fulfill this product in each state. This determines where patients can get their medication based on their location. Each coverage entry links a pharmacy, product details, and the states where it's available.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (formContext.mode === 'new') {
                  closeForm()
                } else {
                  openNewCoverageForm()
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {formContext.mode === 'new' ? 'Close Form' : 'Add Coverage'}
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm shadow-sm">
              {error}
          </div>
        )}

          {isNewFormOpen && renderCoverageForm(false)}
        </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Coverage</h3>
        {sortedCoverageGroups.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-border rounded-2xl bg-muted/50">
              <div className="bg-card rounded-full p-4 mx-auto w-fit mb-3">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No pharmacy coverage assigned yet. Add coverage to make this product available in specific states.
              </p>
            </div>
          ) : (
          sortedCoverageGroups.map((group) => {
            const isEditingThisCoverage =
              formContext.mode === 'existing' && formContext.coverage.key === group.key

            const firstEntry = group.entries[0]
            const coverageTitle = group.coverageName || firstEntry?.productName || firstEntry?.pharmacy.name || 'Coverage'
            const totalStates = group.entries.reduce((count, entry) => count + entry.states.length, 0)
            const uniquePharmacies = Array.from(new Set(group.entries.map(entry => entry.pharmacy.name)))
            const defaultPharmacyName = uniquePharmacies.join(', ')
            const isEditingHeader = editingCoverageId === group.coverageId

              return (
              <div key={group.key} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 pb-4 border-b border-border flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    {isEditingHeader ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-2 block">Coverage Display Name</label>
                          <input
                            type="text"
                            value={headerNameInput}
                            onChange={(e) => setHeaderNameInput(e.target.value)}
                            placeholder="e.g. IronSail Weight Loss Coverage"
                            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                            maxLength={120}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-2 block">Coverage Note / SIG</label>
                          <textarea
                            value={headerSigInput}
                            onChange={(e) => setHeaderSigInput(e.target.value)}
                            placeholder="e.g. Take as directed by your healthcare provider"
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all resize-none"
                            maxLength={500}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Applies to this coverage header. Product entries keep their own details below.
                        </p>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-lg font-semibold text-foreground">{coverageTitle}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pharmacies: <span className="font-medium text-foreground">{defaultPharmacyName || 'N/A'}</span> • {totalStates} states covered
                        </p>
                        {group.coverageSig && (
                          <p className="text-sm text-foreground mt-2 italic">
                            Coverage note: {group.coverageSig}
                          </p>
                        )}
                      </>
                              )}
                            </div>
                  <div className="flex items-center gap-2">
                    {isEditingHeader ? (
                      <>
                        <button
                          onClick={() => saveCoverageHeader(group)}
                          disabled={headerSaving}
                          className="px-4 py-2 rounded-full bg-[#4FA59C] text-white hover:bg-[#478F87] transition-all text-sm font-medium disabled:opacity-50"
                        >
                          {headerSaving ? 'Saving...' : 'Save header'}
                        </button>
                        <button
                          onClick={cancelEditCoverageHeader}
                          disabled={headerSaving}
                          className="px-4 py-2 rounded-full border border-border text-foreground hover:bg-muted transition-all text-sm font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openExistingCoverageForm(group)}
                          disabled={!group.coverageId}
                          className={`px-4 py-2 rounded-full border border-[#4FA59C] text-[#4FA59C] transition-all text-sm font-medium ${group.coverageId ? 'hover:bg-[#4FA59C]/10 dark:hover:bg-[#4FA59C]/20' : 'opacity-50 cursor-not-allowed'}`}
                        >
                          Add states/products
                        </button>
                        <button
                          onClick={() => startEditCoverageHeader(group)}
                          disabled={!group.coverageId}
                          className={`px-4 py-2 rounded-full border border-border text-foreground transition-all text-sm font-medium ${group.coverageId ? 'hover:bg-muted' : 'opacity-50 cursor-not-allowed'}`}
                        >
                          Edit name / note
                        </button>
                        <button
                          onClick={() =>
                            handleRemoveCoverageGroup({
                              coverageId: group.coverageId,
                              pharmacyId: group.defaultPharmacyId || firstEntry?.pharmacy.id,
                              pharmacyName: firstEntry?.pharmacy.name,
                              coverageName: group.coverageName || undefined,
                            })
                          }
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                              </div>
                </div>
                <div className="p-6 space-y-4">
                  {group.entries.map((entry) => {
                    const priceAssignmentId = entry.states[0]?.assignmentId
                    return (
                      <div key={entry.key} className="border border-border rounded-xl p-4 space-y-3">
                        <div>
                          <h5 className="text-base font-semibold text-foreground">{entry.productName || entry.pharmacy.name}</h5>
                          <p className="text-sm text-muted-foreground mt-1">
                            Managed by <span className="font-medium text-foreground">{entry.pharmacy.name}</span> • {entry.states.length} states covered
                          </p>
                          {entry.sig && (
                            <p className="text-sm text-foreground mt-2 italic">SIG: {entry.sig}</p>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-foreground">
                          {entry.productSku && (
                            <div>
                              <span className="text-muted-foreground">SKU: </span>
                              <span>{entry.productSku}</span>
                            </div>
                          )}
                          {entry.form && (
                            <div>
                                <span className="text-muted-foreground">Medication Form: </span>
                              <span>{entry.form}</span>
                              </div>
                            )}
                          {entry.rxId && (
                            <div>
                                <span className="text-muted-foreground">RX ID: </span>
                              <span className="font-mono">{entry.rxId}</span>
                              </div>
                            )}
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Wholesale Price:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-foreground">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-24 h-8 text-sm px-3 py-1 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                                defaultValue={entry.wholesaleCost ?? ''}
                                onBlur={(e) => {
                                  const customPrice = parseFloat(e.target.value)
                                  if (!isNaN(customPrice) && customPrice > 0 && priceAssignmentId) {
                                    handleUpdateCustomPrice(priceAssignmentId, customPrice)
                                  }
                                }}
                              />
                            </div>
                            {entry.wholesaleCost != null && (
                              <span className="inline-block px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full text-xs">From Spreadsheet</span>
                            )}
                          </div>
                      </div>

                  <div className="flex flex-wrap gap-2">
                          {entry.states.map(({ state, assignmentId }) => (
                        <div
                              key={assignmentId}
                          className="group relative inline-flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-full border border-border text-xs font-medium hover:bg-card hover:border-[#4FA59C] transition-all"
                        >
                          <span>{state}</span>
                          <button
                                onClick={() => handleRemoveAssignment(assignmentId)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                            </div>
                          ))}
                        </div>
                        </div>
                      )
                    })}

                  {isEditingThisCoverage && renderCoverageForm(true)}
                  </div>
                </div>
              )
            })
          )}
      </div>
    </div>
  )
}

