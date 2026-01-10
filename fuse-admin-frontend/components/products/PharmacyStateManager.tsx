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

interface CoverageGroup {
  key: string
  coverageId?: string | null
  pharmacy: Pharmacy
  coverageName: string
  coverageSig?: string
  assignments: PharmacyAssignment[]
}

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pharmacyProducts, setPharmacyProducts] = useState<PharmacyProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedPharmacyProduct, setSelectedPharmacyProduct] = useState<PharmacyProduct | null>(null)
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [customProductName, setCustomProductName] = useState("")
  const [customSig, setCustomSig] = useState("")

  const resetCoverageForm = () => {
    setSelectedStates([])
    setSelectedPharmacy("")
    setSelectedPharmacyProduct(null)
    setPharmacyProducts([])
    setProductSearchQuery("")
    setCustomProductName("")
    setCustomSig("")
    setError(null)
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

  const assignedStates = assignments.map(a => a.state)
  const availableStates = US_STATES.filter(s => !assignedStates.includes(s.code))
  const availableStatesForSelectedPharmacy = selectedPharmacy
    ? availableStates.filter(s => {
      const pharmacy = pharmacies.find(p => p.id === selectedPharmacy)
      return pharmacy?.supportedStates.includes(s.code)
    })
    : []

  // Filter pharmacy products by search query
  const filteredPharmacyProducts = pharmacyProducts.filter(product =>
    product.nameWithStrength?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.sku.toString().includes(productSearchQuery)
  )

  const handleAddAssignment = async () => {
    if (!token || !selectedPharmacy || selectedStates.length === 0) return

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

    try {
      setSaving(true)
      setError(null)

      const payload: any = {
        pharmacyId: selectedPharmacy,
        states: selectedStates,
        customName: trimmedName,
        customSig: trimmedSig,
      }

      payload.sig = trimmedSig

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

      resetCoverageForm()
      setShowAddForm(false)
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
    pharmacyId: string
    pharmacyName: string
    coverageName?: string
  }) => {
    if (!token) return

    const label = coverageName ? `"${coverageName}"` : "this coverage"
    if (!confirm(`Remove ${pharmacyName} coverage ${label}? This will delete all state assignments for this coverage.`)) return

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
      } else {
        const response = await fetch(`${baseUrl}/products/${productId}/pharmacies/${pharmacyId}/assignments`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error("Failed to remove pharmacy coverage")
        }
      }

      await fetchData()
    } catch (err) {
      console.error("Error removing pharmacy coverage:", err)
      setError("Failed to remove pharmacy coverage")
    } finally {
      setSaving(false)
    }
  }

  const coverageGroups = assignments.reduce<Record<string, CoverageGroup>>((acc, assignment) => {
    const coverageId = assignment.pharmacyCoverageId || null
    const coverage = assignment.pharmacyCoverage

    const key = coverageId ?? `legacy-${assignment.pharmacyId}-${assignment.pharmacyProductId || 'no-product'}-${assignment.sig || ''}`

    if (!acc[key]) {
      acc[key] = {
        key,
        coverageId,
        pharmacy: assignment.pharmacy,
        coverageName: coverage?.customName || assignment.pharmacyProductName || `${assignment.pharmacy.name} Coverage`,
        coverageSig: coverage?.customSig || assignment.sig || '',
        assignments: []
      }
    }

    acc[key].assignments.push(assignment)
    return acc
  }, {})

  const sortedCoverageGroups = Object.values(coverageGroups).map(group => ({
    ...group,
    assignments: [...group.assignments].sort((a, b) => a.state.localeCompare(b.state))
  })).sort((a, b) => a.coverageName.localeCompare(b.coverageName))

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#4FA59C]" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
      <div className="p-6 pb-4 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#F3F4F6] rounded-xl p-2">
              <MapPin className="h-5 w-5 text-[#4FA59C]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1F2937]">Pharmacy & State Coverage</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Configure which pharmacies can fulfill orders for this product and in which states. This determines where customers can receive this product.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!showAddForm) {
                resetCoverageForm()
                setShowAddForm(true)
              } else {
                setShowAddForm(false)
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white shadow-sm transition-all text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Coverage
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
            {error}
          </div>
        )}

        {/* Add Assignment Form */}
        {showAddForm && (
          <div className="p-6 border border-[#E5E7EB] rounded-2xl space-y-4 bg-[#F9FAFB]">
            <div>
              <label className="text-sm font-medium text-[#4B5563] mb-2 block">
                Select Pharmacy
              </label>
              <p className="text-xs text-[#9CA3AF] mb-2">
                Choose the pharmacy partner that will fulfill orders for this product. Each pharmacy operates in specific states.
              </p>
              <select
                value={selectedPharmacy}
                onChange={(e) => {
                  setSelectedPharmacy(e.target.value)
                  setSelectedStates([]) // Reset states when pharmacy changes
                }}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
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
                <label className="text-sm font-medium text-[#4B5563] mb-2 block">
                  Select States (available for this pharmacy)
                </label>
                <p className="text-xs text-[#9CA3AF] mb-2">
                  Choose which US states this pharmacy can fulfill orders for. Only states where the pharmacy operates and that aren't already assigned will be shown.
                </p>
                <div className="max-h-48 overflow-y-auto border border-[#E5E7EB] rounded-xl p-3 bg-white">
                  {availableStatesForSelectedPharmacy.length === 0 ? (
                    <p className="text-sm text-[#6B7280] p-2">
                      All states supported by this pharmacy are already assigned.
                    </p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:bg-[#F3F4F6] p-2 rounded-xl mb-2 border-b border-[#E5E7EB]">
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
                          className="w-4 h-4 rounded border-[#E5E7EB] text-[#4FA59C] focus:ring-[#4FA59C] focus:ring-2 focus:ring-opacity-50"
                        />
                        <span className="text-[#1F2937]">Select All ({availableStatesForSelectedPharmacy.length} states)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {availableStatesForSelectedPharmacy.map((state) => (
                          <label key={state.code} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[#F3F4F6] p-2 rounded-xl transition-colors">
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
                              className="w-4 h-4 rounded border-[#E5E7EB] text-[#4FA59C] focus:ring-[#4FA59C] focus:ring-2 focus:ring-opacity-50"
                            />
                            <span className="text-[#1F2937]">{state.code}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Pharmacy Product Selector */}
            {selectedPharmacy && selectedStates.length > 0 && (
              <div>
                <label className="text-sm font-medium text-[#4B5563] mb-2 block">
                  Select Pharmacy Product (Optional)
                </label>
                <p className="text-xs text-[#9CA3AF] mb-2">
                  Link this coverage to a specific product in the pharmacy's inventory. This helps match the correct product, pricing, and dispensing instructions. You can skip this and enter custom information below if the product isn't in their system.
                </p>
                {loadingProducts ? (
                  <div className="flex items-center justify-center p-4 border border-[#E5E7EB] rounded-xl bg-white">
                    <Loader2 className="h-5 w-5 animate-spin text-[#4FA59C] mr-2" />
                    <span className="text-sm text-[#6B7280]">Loading products...</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search products by name or SKU..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#1F2937] mb-2 focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                    />
                    <div className="max-h-64 overflow-y-auto border border-[#E5E7EB] rounded-xl bg-white">
                      {filteredPharmacyProducts.length === 0 ? (
                        <p className="text-sm text-[#6B7280] p-4 text-center">
                          {productSearchQuery ? "No products found matching your search." : "No products available."}
                        </p>
                      ) : (
                        <div className="divide-y divide-[#E5E7EB]">
                          {filteredPharmacyProducts.map((product) => (
                            <label
                              key={product.id}
                              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-[#F9FAFB] transition-colors ${selectedPharmacyProduct?.id === product.id ? 'bg-[#F3F4F6]' : ''
                                }`}
                            >
                              <input
                                type="radio"
                                name="pharmacyProduct"
                                checked={selectedPharmacyProduct?.id === product.id}
                                onChange={() => {
                                  setSelectedPharmacyProduct(product)
                                  const defaultName = product.nameWithStrength || product.name || ""
                                  if (!customProductName && defaultName) {
                                    setCustomProductName(defaultName)
                                  }
                                  if (!customSig && product.sig) {
                                    setCustomSig(product.sig)
                                  }
                                }}
                                className="mt-1 w-4 h-4 border-[#E5E7EB] text-[#4FA59C] focus:ring-[#4FA59C]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-[#1F2937]">
                                  {product.nameWithStrength || product.name}
                                </div>
                                <div className="text-xs text-[#9CA3AF] mt-1">
                                  SKU: {product.sku}
                                  {product.dispense && ` • ${product.dispense}`}
                                  {product.wholesalePrice && ` • $${product.wholesalePrice}`}
                                </div>
                                {product.sig && (
                                  <div className="text-xs text-[#6B7280] mt-1 italic">
                                    SIG: {product.sig}
                                  </div>
                                )}
                                {product.label && (
                                  <div className="text-xs text-[#9CA3AF] mt-1">
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
                        className="mt-2 px-4 py-2 rounded-full border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6] transition-all text-sm font-medium"
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
                <label className="text-sm font-medium text-[#4B5563] mb-2 block">
                  Custom Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  placeholder="e.g. NAD+ Wellness Kit"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                  maxLength={120}
                />
                <p className="text-xs text-[#9CA3AF] mt-1">
                  The name customers will see for this product coverage. This appears on coverage cards and order confirmations. Keep it short and descriptive (max 120 characters).
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-[#4B5563] mb-2 block">
                  Custom SIG (Dispensing Instructions) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={customSig}
                  onChange={(e) => setCustomSig(e.target.value)}
                  placeholder="e.g. Take 1 capsule daily with food."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-[#9CA3AF] mt-1">
                  SIG stands for "Signatura" (Latin for "let it be labeled"). This is the prescription instructions that appear on the product label and in pharmacy systems (e.g., "Take 1 capsule daily with food"). This will appear on coverage cards and order confirmations (max 500 characters).
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
                onClick={() => {
                  resetCoverageForm()
                  setShowAddForm(false)
                }}
                className="px-4 py-2.5 rounded-full border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6] transition-all text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Current Assignments */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider">Current Coverage</h3>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Review all pharmacy assignments for this product. Each coverage group shows the pharmacy, states, product details, and wholesale pricing.
            </p>
          </div>
          {sortedCoverageGroups.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-[#F9FAFB]">
              <div className="bg-white rounded-full p-4 mx-auto w-fit mb-3">
                <Building2 className="h-8 w-8 text-[#9CA3AF]" />
              </div>
              <p className="text-sm text-[#6B7280]">
                No pharmacy coverage assigned yet. Add coverage to make this product available in specific states.
              </p>
            </div>
          ) : (
            <>
              {sortedCoverageGroups.map((group) => {
                const firstAssignment = group.assignments[0]
                const states = group.assignments.map(a => a.state)

                return (
                  <div key={group.key} className="p-5 border border-[#E5E7EB] rounded-2xl bg-white hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-[#1F2937] text-base">{group.coverageName}</h4>
                        <p className="text-sm text-[#6B7280] mt-0.5">
                          Managed by <span className="font-medium text-[#1F2937]">{group.pharmacy.name}</span> • {states.length} states covered
                        </p>
                        <div className="mt-3 space-y-2">
                          {group.coverageSig && (
                            <div className="text-sm">
                              <span className="text-[#9CA3AF]">SIG: </span>
                              <span className="text-[#1F2937] italic">{group.coverageSig}</span>
                            </div>
                          )}

                          {firstAssignment?.pharmacyProductName && (
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="text-[#9CA3AF]">Pharmacy Product: </span>
                                <span className="font-medium text-[#1F2937]">{firstAssignment.pharmacyProductName}</span>
                                {firstAssignment.pharmacyProductId && (
                                  <span className="text-[#9CA3AF] ml-2">(SKU: {firstAssignment.pharmacyProductId})</span>
                                )}
                              </div>
                              {group.pharmacy.slug === 'ironsail' && firstAssignment.form && (
                                <div className="text-sm">
                                  <span className="text-[#9CA3AF]">Medication Form: </span>
                                  <span className="text-[#1F2937]">{firstAssignment.form}</span>
                                </div>
                              )}
                              {group.pharmacy.slug === 'ironsail' && firstAssignment.rxId && (
                                <div className="text-sm">
                                  <span className="text-[#9CA3AF]">RX ID: </span>
                                  <span className="text-[#1F2937] font-mono">{firstAssignment.rxId}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {firstAssignment && (
                            <div className="flex items-center gap-2">
                              <span className="text-[#9CA3AF] text-sm">Wholesale Price:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-[#4B5563]">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="w-24 h-8 text-sm px-3 py-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-opacity-50 focus:border-[#4FA59C] transition-all"
                                  defaultValue={firstAssignment.pharmacyWholesaleCost || ""}
                                  onBlur={(e) => {
                                    const customPrice = parseFloat(e.target.value)
                                    if (!isNaN(customPrice) && customPrice > 0) {
                                      handleUpdateCustomPrice(firstAssignment.id, customPrice)
                                    }
                                  }}
                                  title="The cost you pay to the pharmacy for each unit. This is used to calculate your profit margin."
                                />
                              </div>
                              {firstAssignment.pharmacyWholesaleCost && (
                                <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs" title="This price was automatically imported from the pharmacy's inventory spreadsheet">From Spreadsheet</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleRemoveCoverageGroup({
                            coverageId: group.coverageId,
                            pharmacyId: group.pharmacy.id,
                            pharmacyName: group.pharmacy.name,
                            coverageName: group.coverageName,
                          })
                        }
                        className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-xl transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="group relative inline-flex items-center gap-1 px-3 py-1.5 bg-[#F3F4F6] text-[#4B5563] rounded-full border border-[#E5E7EB] text-xs font-medium hover:bg-white hover:border-[#4FA59C] transition-all"
                        >
                          <span>{assignment.state}</span>
                          <button
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          >
                            <Trash2 className="h-3 w-3 text-[#EF4444]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCoverageForm()
                    setShowAddForm(true)
                  }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-[#4FA59C] text-[#4FA59C] hover:bg-[#ECFDF5] hover:border-[#22C55E] hover:text-[#166534] text-sm font-medium transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add 1 more product
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

