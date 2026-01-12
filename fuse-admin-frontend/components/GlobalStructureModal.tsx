import { useEffect, useState } from 'react'
import { Plus, X, Info, GripVertical, Edit, Trash2 } from 'lucide-react'

interface FormSection {
  id: string
  type: 'product_questions' | 'category_questions' | 'brand_questions' | 'account_creation' | 'checkout'
  label: string
  description: string
  order: number
  enabled: boolean
  icon: string
}

interface GlobalStructure {
  id: string
  name: string
  description?: string
  sections: FormSection[]
  createdAt?: string
  isDefault?: boolean
}

const DEFAULT_SECTIONS: FormSection[] = [
  {
    id: 'product',
    type: 'product_questions',
    label: 'Product Questions',
    description: 'Questions specific to each individual product',
    order: 1,
    enabled: true,
    icon: '📦'
  },
  {
    id: 'category',
    type: 'category_questions',
    label: 'Standardized Category Questions',
    description: 'Questions shared across all products in a category (e.g., weight loss, hair growth)',
    order: 2,
    enabled: true,
    icon: '📋'
  },
  {
    id: 'brand',
    type: 'brand_questions',
    label: 'Brand Questions',
    description: 'Custom questions specific to your brand',
    order: 3,
    enabled: false,
    icon: '🏢'
  },
  {
    id: 'account',
    type: 'account_creation',
    label: 'Create Account',
    description: 'Patient information collection (name, email, phone)',
    order: 4,
    enabled: true,
    icon: '👤'
  },
  {
    id: 'checkout',
    type: 'checkout',
    label: 'Payment & Checkout',
    description: 'Billing information, shipping address, and payment processing',
    order: 5,
    enabled: true,
    icon: '💳'
  }
]

interface GlobalStructureModalProps {
  isOpen: boolean
  onClose: () => void
  baseUrl: string
  token: string | null
  structureToEdit?: GlobalStructure | null
  onStructuresSaved?: () => void
}

export function GlobalStructureModal({ isOpen, onClose, baseUrl, token, structureToEdit, onStructuresSaved }: GlobalStructureModalProps) {
  const [structures, setStructures] = useState<GlobalStructure[]>([])
  const [sections, setSections] = useState<FormSection[]>(DEFAULT_SECTIONS)
  const [structureName, setStructureName] = useState('')
  const [structureDescription, setStructureDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Load structure to edit when modal opens, or reset for new structure
  useEffect(() => {
    if (isOpen) {
      if (structureToEdit) {
        setSections(structureToEdit.sections)
        setStructureName(structureToEdit.name)
        setStructureDescription(structureToEdit.description || '')
      } else {
        // Creating new structure - reset to defaults
        setSections(DEFAULT_SECTIONS)
        setStructureName('')
        setStructureDescription('')
      }
    }
  }, [isOpen, structureToEdit])

  // Load all structures when modal opens
  useEffect(() => {
    if (isOpen) {
      loadStructures()
    }
  }, [isOpen, token])

  const loadStructures = async () => {
    if (!token) return
    setLoading(true)

    try {
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setStructures(data.data)
        }
      }
    } catch (error) {
      console.error('Failed to load structures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveStructure = async () => {
    if (!token) return

    setSaving(true)
    try {
      const newStructure: GlobalStructure = {
        id: structureToEdit?.id || Date.now().toString(),
        name: structureName || 'Untitled Structure',
        description: structureDescription,
        sections: sections.map((s, idx) => ({ ...s, order: idx + 1 })),
        createdAt: structureToEdit?.createdAt || new Date().toISOString()
      }

      let updatedStructures
      if (structureToEdit) {
        updatedStructures = structures.map(s => s.id === structureToEdit.id ? newStructure : s)
      } else {
        updatedStructures = [...structures, newStructure]
      }

      // Save to backend
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ structures: updatedStructures })
      })

      if (response.ok) {
        setStructures(updatedStructures)
        onClose()
        onStructuresSaved?.()
      } else {
        alert('Failed to save structure')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save structure')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this structure?')) return
    if (!token) return

    try {
      const updatedStructures = structures.filter(s => s.id !== id)

      // Save to backend
      const response = await fetch(`${baseUrl}/global-form-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ structures: updatedStructures })
      })

      if (response.ok) {
        setStructures(updatedStructures)
        onStructuresSaved?.()
      } else {
        alert('Failed to delete structure')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete structure')
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newSections = [...sections]
    const draggedSection = newSections[draggedIndex]
    newSections.splice(draggedIndex, 1)
    newSections.splice(index, 0, draggedSection)
    setSections(newSections)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const toggleSection = (id: string) => {
    setSections(sections.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Edit Structure Modal */}
      {(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-[#E5E7EB] p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#1F2937]">
                    {structureToEdit ? 'Edit' : 'Create'} Form Structure
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-1">Define the order and flow of your form sections</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-[#F3F4F6] transition-colors"
                >
                  <X className="h-5 w-5 text-[#6B7280]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Structure Name and Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#4B5563] mb-2">Structure Name *</label>
                  <input
                    type="text"
                    value={structureName}
                    onChange={(e) => setStructureName(e.target.value)}
                    placeholder="e.g., Weight Loss Flow, Standard Flow"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4B5563] mb-2">Description</label>
                  <textarea
                    value={structureDescription}
                    onChange={(e) => setStructureDescription(e.target.value)}
                    placeholder="Describe when to use this structure..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:border-[#4FA59C] transition-all resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Drag sections to reorder them. Toggle switches to enable/disable. Product Questions, Account, and Checkout sections cannot be disabled.
                  </p>
                </div>
              </div>

              {/* Form Sections */}
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937] mb-3">Form Sections</h3>

                <div className="p-6 space-y-3">
                  {sections.map((section, index) => (
                    <div
                      key={section.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border-2 rounded-xl p-5 transition-all cursor-move ${draggedIndex === index ? 'border-[#4FA59C] shadow-lg scale-105' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                        } ${!section.enabled ? '' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Drag Handle */}
                        <div className="flex-shrink-0 mt-1">
                          <GripVertical className="h-5 w-5 text-[#9CA3AF]" />
                        </div>

                        {/* Icon */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-[#F3F4F6] rounded-xl flex items-center justify-center text-2xl">
                            {section.icon}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-[#1F2937]">{section.label}</h3>
                            <span className="px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded-full text-xs font-medium">
                              Step {index + 1}
                            </span>
                          </div>
                          <p className="text-sm text-[#6B7280]">{section.description}</p>

                          {/* Section-specific info */}
                          {section.type === 'category_questions' && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg">
                              <span className="text-xs text-purple-700">✨ Supports Variants (Variant 1, Variant 2)</span>
                            </div>
                          )}
                          {section.type === 'product_questions' && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
                              <span className="text-xs text-green-700">🔒 Required section</span>
                            </div>
                          )}
                          {(section.type === 'account_creation' || section.type === 'checkout') && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
                              <span className="text-xs text-green-700">🔒 Auto-injected by system</span>
                            </div>
                          )}
                        </div>

                        {/* Toggle */}
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => toggleSection(section.id)}
                            disabled={section.type === 'product_questions' || section.type === 'account_creation' || section.type === 'checkout'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${section.enabled ? 'bg-[#4FA59C]' : 'bg-gray-300'
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6] font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStructure}
                  disabled={!structureName.trim() || saving}
                  className="px-6 py-2.5 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : (structureToEdit ? 'Update' : 'Create')} Structure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
