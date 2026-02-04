import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, ArrowLeft, Settings, Save, RotateCcw, ChevronDown, ChevronUp, Eye, ExternalLink } from "lucide-react"
import { useTemplates } from "@/hooks/useTemplates"
import NodeBuilder from "../components/NodeBuilder"
import { listAvailablePalettes } from "@/lib/utils"
import { CheckCircle2, CircleSlash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { LAYOUT_OPTIONS } from "@fuse/enums"



export default function FormBuilder() {
  const router = useRouter()
  const { id: assignmentId } = router.query
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", [])
  const { loading, error, sections, assignments, refresh, saveAssignment } = useTemplates(baseUrl)
  const { token } = useAuth()

  const [selectedPersonalization, setSelectedPersonalization] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [selectedLayout, setSelectedLayout] = useState<string>(LAYOUT_OPTIONS[0].id)
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [productTemplate, setProductTemplate] = useState<any | null>(null)

  // Expanded sections for template review
  const [expandedPersonalization, setExpandedPersonalization] = useState(false)
  const [expandedAccount, setExpandedAccount] = useState(false)
  const [expandedDoctor, setExpandedDoctor] = useState(false)

  const selectedAssignment = useMemo(() => {
    if (!assignmentId || typeof assignmentId !== "string") return null
    return assignments.find((assignment) => assignment.id === assignmentId) ?? null
  }, [assignments, assignmentId])

  useEffect(() => {
    if (assignmentId) {
      refresh()
    }
  }, [assignmentId])

  const paletteOptions = listAvailablePalettes()

  // Filter personalization templates by the product's category
  const productCategory = selectedAssignment?.treatment?.category
  const personalizationTemplates = useMemo(() =>
    (sections.personalization ?? []).filter((t: any) => t.category === productCategory),
    [sections.personalization, productCategory]
  )
  const accountTemplates = useMemo(() =>
    (sections.account ?? []).filter((t: any) => !t.category),
    [sections.account]
  )
  const doctorTemplates = useMemo(() => sections.doctor ?? [], [sections.doctor])

  useEffect(() => {
    setSaveMessage(null)

    if (!selectedAssignment) {
      setSelectedPersonalization(null)
      setSelectedAccount(null)
      setSelectedDoctor(null)
      setSelectedLayout(LAYOUT_OPTIONS[0].id)
      setSelectedTheme(null)
      return
    }

    setSelectedPersonalization(selectedAssignment.personalizationTemplate?.id ?? null)
    setSelectedAccount(selectedAssignment.accountTemplate?.id ?? null)
    setSelectedDoctor(selectedAssignment.doctorTemplate?.id ?? null)
    setSelectedLayout(selectedAssignment.layoutTemplate ?? LAYOUT_OPTIONS[0].id)
    setSelectedTheme(selectedAssignment.themeId ?? null)
  }, [selectedAssignment?.id])

  // Fetch questionnaire template linked to the product to read setup booleans
  useEffect(() => {
    const productId = selectedAssignment?.treatmentId
    if (!productId || !token) {
      setProductTemplate(null)
      return
    }

    let cancelled = false
      ; (async () => {
        try {
          setTemplateLoading(true)
          const res = await fetch(`${baseUrl}/questionnaires/product/${productId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) {
            setProductTemplate(null)
            return
          }
          const data = await res.json()
          if (!cancelled) {
            const list = Array.isArray(data?.data) ? data.data : []
            // pick most recently updated if available
            const picked = list.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0] || null
            setProductTemplate(picked)
          }
        } catch {
          if (!cancelled) setProductTemplate(null)
        } finally {
          if (!cancelled) setTemplateLoading(false)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [selectedAssignment?.treatmentId, token, baseUrl])

  // Auto-select templates when there's only one available for the category
  useEffect(() => {
    if (!selectedAssignment || !productCategory) return

    // Auto-select personalization template if there's only one for this category
    if (!selectedPersonalization && personalizationTemplates.length === 1) {
      setSelectedPersonalization(personalizationTemplates[0].id)
    }

    // Auto-select account template if there's only one universal template
    if (!selectedAccount && accountTemplates.length === 1) {
      setSelectedAccount(accountTemplates[0].id)
    }

    // Auto-select doctor template if there's only one
    if (!selectedDoctor && doctorTemplates.length === 1) {
      setSelectedDoctor(doctorTemplates[0].id)
    }
  }, [selectedAssignment, productCategory, personalizationTemplates, accountTemplates, doctorTemplates, selectedPersonalization, selectedAccount, selectedDoctor])

  const handleSelectTemplate = (sectionType: string, templateId: string) => {
    if (sectionType === "personalization") setSelectedPersonalization(templateId)
    if (sectionType === "account") setSelectedAccount(templateId)
    if (sectionType === "doctor") setSelectedDoctor(templateId)
  }



  const handleSave = async () => {
    if (!selectedAssignment || saving) return

    setSaving(true)
    setSaveMessage(null)

    try {
      await saveAssignment({
        assignmentId: selectedAssignment.id,
        treatmentId: selectedAssignment.treatmentId,
        personalizationTemplateId: selectedPersonalization ?? selectedAssignment.personalizationTemplate?.id,
        accountTemplateId: selectedAccount ?? selectedAssignment.accountTemplate?.id,
        doctorTemplateId: selectedDoctor ?? selectedAssignment.doctorTemplate?.id,
        layoutTemplate: selectedLayout,
        themeId: selectedTheme ?? undefined,
      })

      setSaveMessage("Configuration saved successfully.")
      await refresh()
    } catch (error: any) {
      setSaveMessage(error?.message || "Failed to save configuration.")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!selectedAssignment) return

    setSelectedPersonalization(selectedAssignment.personalizationTemplate?.id ?? null)
    setSelectedAccount(selectedAssignment.accountTemplate?.id ?? null)
    setSelectedDoctor(selectedAssignment.doctorTemplate?.id ?? null)
    setSelectedLayout(selectedAssignment.layoutTemplate ?? LAYOUT_OPTIONS[0].id)
    setSelectedTheme(selectedAssignment.themeId ?? null)
    setSaveMessage("Reset to live configuration.")
  }

  const activeSections = selectedAssignment
    ? [
      {
        key: "personalization",
        label: "Personalization",
        description:
          "Category-specific slides, emoji selectors, and warm-up questions to tailor the experience.",
        template:
          personalizationTemplates.find((tpl) => tpl.id === selectedPersonalization) ??
          selectedAssignment.personalizationTemplate ??
          null,
        selectedTemplateId: selectedPersonalization ?? selectedAssignment.personalizationTemplate?.id ?? null,
        required: true,
        availableTemplates: personalizationTemplates,
        onSelectTemplate: handleSelectTemplate,
        locked: Boolean(selectedAssignment.lockedUntil && new Date(selectedAssignment.lockedUntil) > new Date()),
      },
      {
        key: "account",
        label: "Create Account",
        description:
          "Standard account details, compliance notices, and payment prerequisites. Locked for compliance.",
        template:
          accountTemplates.find((tpl) => tpl.id === selectedAccount) ??
          selectedAssignment.accountTemplate ??
          null,
        selectedTemplateId: selectedAccount ?? selectedAssignment.accountTemplate?.id ?? null,
        required: true,
        availableTemplates: accountTemplates,
        onSelectTemplate: handleSelectTemplate,
        locked: true,
      },
      {
        key: "doctor",
        label: "Doctor Questions",
        description: "Product-specific medical intake, lab history, and provider disclosures.",
        template:
          doctorTemplates.find((tpl) => tpl.id === selectedDoctor) ??
          selectedAssignment.doctorTemplate ??
          null,
        selectedTemplateId: selectedDoctor ?? selectedAssignment.doctorTemplate?.id ?? null,
        required: true,
        availableTemplates: doctorTemplates,
        onSelectTemplate: handleSelectTemplate,
        locked: Boolean(selectedAssignment.lockedUntil && new Date(selectedAssignment.lockedUntil) > new Date()),
      },
    ]
    : []

  const saveDisabled =
    saving ||
    !selectedAssignment ||
    !selectedPersonalization ||
    !selectedAccount ||
    !selectedDoctor

  const lockedWarning = Boolean(
    selectedAssignment?.lockedUntil && new Date(selectedAssignment.lockedUntil) > new Date()
  )

  const currentPersonalizationTemplate = personalizationTemplates.find(t => t.id === selectedPersonalization)
  const currentAccountTemplate = accountTemplates.find(t => t.id === selectedAccount)
  const currentDoctorTemplate = doctorTemplates.find(t => t.id === selectedDoctor)

  if (loading && !selectedAssignment) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading form builder...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!loading && !selectedAssignment) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Form not found</p>
              <Button onClick={() => router.push("/forms")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forms
              </Button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.push("/forms")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div>
                <h1 className="text-3xl font-semibold text-foreground mb-2">
                  {selectedAssignment?.treatment?.name || "Form Builder"}
                </h1>
                <div className="flex items-center gap-2">
                  {selectedAssignment?.treatment?.category && (
                    <Badge variant="secondary">
                      {selectedAssignment.treatment.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )}
                  {selectedAssignment?.publishedUrl && selectedAssignment?.lastPublishedAt && (
                    <Badge variant="info">Live</Badge>
                  )}
                  {lockedWarning && selectedAssignment?.lockedUntil && (
                    <Badge variant="warning">
                      Locked until {new Date(selectedAssignment.lockedUntil).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
                {selectedAssignment?.publishedUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-2"
                    onClick={() => window.open(selectedAssignment.publishedUrl!, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    View Live Form
                  </Button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {saveMessage && (
            <Card className="border-green-500/40 bg-green-500/10">
              <CardContent className="p-4 text-sm text-green-700 dark:text-green-400">{saveMessage}</CardContent>
            </Card>
          )}

          {/* Main Content */}
          <div className="space-y-6">
            {/* Section Setup Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sections Setup</CardTitle>
                <CardDescription>Review which parts of this questionnaire are configured</CardDescription>
              </CardHeader>
              <CardContent>
                {templateLoading ? (
                  <div className="text-sm text-muted-foreground">Loading template status...</div>
                ) : productTemplate ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center gap-2 rounded-md border p-3">
                      {productTemplate.personalizationQuestionsSetup ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleSlash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-sm">
                        <div className="font-medium">Personalization</div>
                        <div className="text-xs text-muted-foreground">
                          {productTemplate.personalizationQuestionsSetup ? "Configured" : "Not configured"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border p-3">
                      {productTemplate.createAccountQuestionsSetup ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleSlash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-sm">
                        <div className="font-medium">Create Account</div>
                        <div className="text-xs text-muted-foreground">
                          {productTemplate.createAccountQuestionsSetup ? "Configured" : "Not configured"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border p-3">
                      {productTemplate.doctorQuestionsSetup ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CircleSlash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-sm">
                        <div className="font-medium">Doctor Questions</div>
                        <div className="text-xs text-muted-foreground">
                          {productTemplate.doctorQuestionsSetup ? "Configured" : "Not configured"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No template found for this product yet.</div>
                )}
              </CardContent>
            </Card>
            {/* Template Management Section */}
            <Card>
              <CardHeader>
                <CardTitle>Form Templates</CardTitle>
                <CardDescription>Review and configure each section of the patient intake form</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Personalization Template */}
                <div className="border rounded-lg">
                  <button
                    onClick={() => setExpandedPersonalization(!expandedPersonalization)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="info">Personalization</Badge>
                      <div className="text-left">
                        <p className="text-sm font-medium">{currentPersonalizationTemplate?.name || "Not configured"}</p>
                        <p className="text-xs text-muted-foreground">
                          Category-specific warm-up and marketing content
                        </p>
                      </div>
                    </div>
                    {expandedPersonalization ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {expandedPersonalization && (
                    <div className="border-t p-4 space-y-4 bg-muted/20">
                      {currentPersonalizationTemplate && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Current Template:</span>
                            <Badge variant="outline">v{currentPersonalizationTemplate.version}</Badge>
                          </div>
                          {currentPersonalizationTemplate.description && (
                            <p className="text-sm text-muted-foreground">{currentPersonalizationTemplate.description}</p>
                          )}
                          {currentPersonalizationTemplate.category && (
                            <p className="text-xs text-muted-foreground">Category: {currentPersonalizationTemplate.category}</p>
                          )}
                        </div>
                      )}

                      <Separator />

                      <div>
                        <label className="text-sm font-medium mb-2 block">Available Templates:</label>
                        <div className="space-y-2">
                          {personalizationTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleSelectTemplate("personalization", template.id)}
                              disabled={lockedWarning}
                              className={`w-full text-left rounded-md border p-3 text-sm transition ${template.id === selectedPersonalization
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                                } ${lockedWarning ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{template.name}</span>
                                <Badge variant="outline">v{template.version}</Badge>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Template */}
                <div className="border rounded-lg">
                  <button
                    onClick={() => setExpandedAccount(!expandedAccount)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="muted">Create Account</Badge>
                      <div className="text-left">
                        <p className="text-sm font-medium">{currentAccountTemplate?.name || "Not configured"}</p>
                        <p className="text-xs text-muted-foreground">
                          Standard account setup (locked for compliance)
                        </p>
                      </div>
                    </div>
                    {expandedAccount ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {expandedAccount && (
                    <div className="border-t p-4 space-y-4 bg-muted/20">
                      {currentAccountTemplate && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Current Template:</span>
                            <Badge variant="outline">v{currentAccountTemplate.version}</Badge>
                          </div>
                          {currentAccountTemplate.description && (
                            <p className="text-sm text-muted-foreground">{currentAccountTemplate.description}</p>
                          )}
                          <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-700 dark:text-amber-400">
                            🔒 This section is locked for HIPAA and payment compliance
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <label className="text-sm font-medium mb-2 block">Available Templates:</label>
                        <div className="space-y-2">
                          {accountTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleSelectTemplate("account", template.id)}
                              disabled={true}
                              className="w-full text-left rounded-md border p-3 text-sm transition opacity-50 cursor-not-allowed border-border"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{template.name}</span>
                                <Badge variant="outline">v{template.version}</Badge>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Doctor Questions Template */}
                <div className="border rounded-lg">
                  <button
                    onClick={() => setExpandedDoctor(!expandedDoctor)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="warning">Doctor Questions</Badge>
                      <div className="text-left">
                        <p className="text-sm font-medium">{currentDoctorTemplate?.name || "Not configured"}</p>
                        <p className="text-xs text-muted-foreground">
                          Product-specific medical requirements
                        </p>
                      </div>
                    </div>
                    {expandedDoctor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {expandedDoctor && (
                    <div className="border-t p-4 space-y-4 bg-muted/20">
                      {currentDoctorTemplate && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Current Template:</span>
                            <Badge variant="outline">v{currentDoctorTemplate.version}</Badge>
                          </div>
                          {currentDoctorTemplate.description && (
                            <p className="text-sm text-muted-foreground">{currentDoctorTemplate.description}</p>
                          )}
                        </div>
                      )}

                      <Separator />

                      <div>
                        <label className="text-sm font-medium mb-2 block">Available Templates:</label>
                        <div className="space-y-2">
                          {doctorTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleSelectTemplate("doctor", template.id)}
                              disabled={lockedWarning}
                              className={`w-full text-left rounded-md border p-3 text-sm transition ${template.id === selectedDoctor
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                                } ${lockedWarning ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{template.name}</span>
                                <Badge variant="outline">v{template.version}</Badge>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Theme & Layout Configuration */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Theme</CardTitle>
                  <CardDescription>Choose a preset palette for the patient UI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {paletteOptions.map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => setSelectedTheme(palette.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${selectedTheme === palette.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      <div>
                        <div className="font-medium capitalize">{palette.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {palette.primary} / {palette.secondary}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-flex h-4 w-4 rounded-full"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <span
                          className="inline-flex h-4 w-4 rounded-full border"
                          style={{ backgroundColor: palette.secondary }}
                        />
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Layout</CardTitle>
                  <CardDescription>Switch between curated flow archetypes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {LAYOUT_OPTIONS.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => setSelectedLayout(layout.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${selectedLayout === layout.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      <div className="font-medium">{layout.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{layout.description}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Visual Flow Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Visual Flow Preview</CardTitle>
                <CardDescription>See how your configuration looks to patients</CardDescription>
              </CardHeader>
              <CardContent>
                <NodeBuilder
                  layoutTemplate={selectedLayout}
                  themeId={selectedTheme}
                  sections={activeSections}
                  locked={Boolean(lockedWarning)}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                disabled={!selectedAssignment || saving}
                onClick={handleReset}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reset to Live
              </Button>

              <Button
                disabled={saveDisabled}
                onClick={handleSave}
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
