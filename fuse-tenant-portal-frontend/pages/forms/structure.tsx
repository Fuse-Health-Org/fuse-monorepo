import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useAuth } from "@/contexts/AuthContext"
import { GripVertical, Plus, Trash2, Info, Layers, Save } from "lucide-react"
import { toast } from "sonner"

interface FormSection {
  id: string
  type: 'product_questions' | 'category_questions' | 'account_creation' | 'product_selection' | 'checkout' | 'custom'
  label: string
  description: string
  order: number
  enabled: boolean
  icon: string
}

const DEFAULT_SECTIONS: FormSection[] = [
  {
    id: 'product',
    type: 'product_questions',
    label: 'Medical Questions',
    description: 'Medical questionnaire created by doctors for patient assessment',
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
    id: 'account',
    type: 'account_creation',
    label: 'Create Account',
    description: 'Patient information collection (name, email, phone)',
    order: 3,
    enabled: true,
    icon: '👤'
  },
  {
    id: 'productSelection',
    type: 'product_selection',
    label: 'Product Selection',
    description: 'Patient selects product options before checkout',
    order: 4,
    enabled: true,
    icon: '🛒'
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

export default function GlobalFormStructure() {
  const router = useRouter()
  const { token } = useAuth()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const [sections, setSections] = useState<FormSection[]>(DEFAULT_SECTIONS)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Load saved structure from backend
  useEffect(() => {
    loadStructure()
  }, [])

  const loadStructure = async () => {
    if (!token) return

    try {
      const response = await fetch(`${baseUrl}/global-form-structure`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSections(data.data.sections || DEFAULT_SECTIONS)
        }
      }
    } catch (error) {
      console.error('Failed to load form structure:', error)
    }
  }

  const handleSave = async () => {
    if (!token) return

    setSaving(true)
    try {
      const response = await fetch(`${baseUrl}/global-form-structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sections: sections.map((s, idx) => ({ ...s, order: idx + 1 }))
        })
      })

      if (response.ok) {
        toast.success('Global form structure saved successfully!')
      } else {
        toast.error('Failed to save form structure')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save form structure')
    } finally {
      setSaving(false)
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main className="lg:pl-64 pt-16">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[#4FA59C] rounded-xl p-2.5">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-[#1F2937]">Global Form Structure</h1>
                <p className="text-[#6B7280] mt-1">
                  Define the high-level structure and order of form sections that apply to all products
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">How Form Structure Works</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Medical Questions</strong>: Doctor-created medical questionnaire for patient assessment</li>
                  <li>• <strong>Category Questions</strong>: Shared across all products in a category (can have multiple variants)</li>
                  <li>• <strong>Create Account</strong>: Global patient information collection (auto-injected)</li>
                  <li>• <strong>Product Selection</strong>: Product options step before checkout (auto-injected by system)</li>
                  <li>• <strong>Checkout</strong>: Payment and shipping (auto-injected by system)</li>
                </ul>
                <p className="mt-3 text-sm text-blue-700">
                  Drag sections to reorder them. This structure applies globally to all products.
                </p>
              </div>
            </div>
          </div>

          {/* Form Sections */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-6 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#1F2937]">Form Sections</h2>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#4FA59C] hover:bg-[#478F87] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Structure
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white border-2 rounded-xl p-5 transition-all cursor-move ${
                    draggedIndex === index ? 'border-[#4FA59C] shadow-lg scale-105' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                  } ${!section.enabled ? 'opacity-60' : ''}`}
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
                      {(section.type === 'account_creation' || section.type === 'product_selection' || section.type === 'checkout') && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
                          <span className="text-xs text-green-700">🔒 Auto-injected by system</span>
                        </div>
                      )}
                    </div>

                    {/* Toggle */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => toggleSection(section.id)}
                        disabled={section.type === 'account_creation' || section.type === 'product_selection' || section.type === 'checkout'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FA59C] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          section.enabled ? 'bg-[#4FA59C]' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            section.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Flow */}
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-6 border-b border-[#E5E7EB]">
              <h2 className="text-xl font-semibold text-[#1F2937]">Form Flow Preview</h2>
              <p className="text-sm text-[#6B7280] mt-1">How patients will experience your forms</p>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                {sections
                  .filter(s => s.enabled)
                  .map((section, index) => (
                    <div key={section.id} className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-[#F3F4F6] rounded-xl flex items-center justify-center text-3xl border-2 border-[#E5E7EB]">
                          {section.icon}
                        </div>
                        <p className="text-xs font-medium text-[#4B5563] mt-2 text-center max-w-[80px]">
                          {section.label}
                        </p>
                      </div>
                      {index < sections.filter(s => s.enabled).length - 1 && (
                        <div className="flex-shrink-0">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#9CA3AF]">
                            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-gradient-to-br from-[#E0F2F1] to-[#F0F9FF] rounded-2xl p-6 border border-[#B2DFDB]">
            <h3 className="font-semibold text-[#1F2937] mb-3">💡 Understanding Form Sections</h3>
            <div className="space-y-3 text-sm text-[#4B5563]">
              <div>
                <span className="font-semibold text-[#1F2937]">🩺 Medical Questions:</span> These are medical questionnaires created by doctors for patient assessment. 
                Contains clinical questions to evaluate patient eligibility and medical history.
              </div>
              <div>
                <span className="font-semibold text-[#1F2937]">📋 Standardized Category Questions:</span> These apply to ALL products in a category. 
                For example, all "weight_loss" products can share questions like "What is your current weight?". 
                <strong> Can have multiple variants (Variant 1, Variant 2) for different question flows.</strong>
              </div>
              <div>
                <span className="font-semibold text-[#1F2937]">👤 Create Account:</span> Global section that collects patient information. 
                Same for all products. Cannot be disabled.
              </div>
              <div>
                <span className="font-semibold text-[#1F2937]">💳 Payment & Checkout:</span> System-generated checkout flow. 
                Cannot be disabled or modified.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

