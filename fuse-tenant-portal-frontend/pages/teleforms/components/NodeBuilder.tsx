import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getThemePalette } from "@/lib/utils"
import type { FormSectionTemplate } from "@/hooks/useTemplates"

interface NodeBuilderProps {
  layoutTemplate: string
  themeId?: string | null
  sections: Array<{
    key: string
    label: string
    description: string
    template: FormSectionTemplate | null
    selectedTemplateId: string | null
    required: boolean
    availableTemplates: FormSectionTemplate[]
    onSelectTemplate?: (sectionType: string, templateId: string) => void
    locked?: boolean
  }>
  locked?: boolean
}

export function NodeBuilder({ layoutTemplate, themeId, sections, locked = false }: NodeBuilderProps) {
  const palette = useMemo(() => getThemePalette(themeId), [themeId])

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="info" className="uppercase tracking-wide">Layout: {layoutTemplate}</Badge>
        <div className="mt-2 flex gap-2 items-center text-xs text-muted-foreground">
          <span className="inline-flex h-4 w-4 rounded-full" style={{ backgroundColor: palette.primary }} />
          <span>{palette.primary}</span>
          <span className="inline-flex h-4 w-4 rounded-full border" style={{ backgroundColor: palette.secondary }} />
          <span>{palette.secondary}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => {
          const sectionLocked = locked || section.locked

          return (
            <Card key={section.key} className={`relative border ${sectionLocked ? "border-dashed" : ""}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {section.label}
                  <Badge
                    variant={section.required ? "secondary" : "outline"}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {section.required ? "Required" : "Optional"}
                  </Badge>
                  {sectionLocked && (
                    <Badge variant="warning" className="text-[10px] uppercase tracking-wide">Locked</Badge>
                  )}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.template ? (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{section.template.name}</p>
                        {section.template.category && (
                          <p className="text-xs text-muted-foreground">Category: {section.template.category}</p>
                        )}
                      </div>
                      <Badge variant="muted">v{section.template.version}</Badge>
                    </div>
                    {section.template.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{section.template.description}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                    No template selected
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {section.availableTemplates.length} template{section.availableTemplates.length === 1 ? "" : "s"} available
                </div>

                <div className="space-y-2">
                  {section.availableTemplates.map((template) => {
                    const isSelected = template.id === section.selectedTemplateId

                    return (
                      <button
                        key={template.id}
                        onClick={() => {
                          if (sectionLocked) return
                          section.onSelectTemplate?.(section.key, template.id)
                        }}
                        disabled={sectionLocked}
                        className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                          } ${sectionLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{template.name}</span>
                          <Badge variant="outline">v{template.version}</Badge>
                        </div>
                        {template.description && (
                          <p className="mt-1 line-clamp-2 text-muted-foreground">{template.description}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default NodeBuilder

