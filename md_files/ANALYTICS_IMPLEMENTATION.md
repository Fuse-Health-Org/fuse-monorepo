# Analytics Implementation Guide

## Current State (Mock Data)

### What You're Seeing Now

**Form Tab - Flow Icons:**
```
🩺 Medical Questions → 👤 Create Account → 💳 Payment & Checkout
```
- These are **generic UI decorations** (hardcoded)
- They show a simplified high-level flow
- They don't represent actual tracking

**Analytics Tab - Progression Chart:**
```
Step 1: Medical Questions (94.8%)
Step 2: Standardized Category Questions (84.3%)
Step 3: Create Account (83.3%)
Step 4: Payment & Checkout (25.5%)
```
- These now use **actual form section names** from GlobalStructureModal.tsx
- Section names match the real form flow structure
- The metrics data is still mock/fake for demonstration
- In production, both section names AND metrics will come from API

## What Should Happen in Production

### 1. Form Structure Should Drive Analytics

Each Teleform has its own structure. For example:

**Glutathione Teleform might have:**
- Section 1: "Select Your Products"
- Section 2: "Medical History & Symptoms"
- Section 3: "Contact & Shipping Information"
- Section 4: "Payment Method"

**Weight Loss Teleform might have:**
- Section 1: "Choose Treatment Plan"
- Section 2: "Health Assessment"
- Section 3: "Medical Questionnaire"
- Section 4: "Lifestyle & Goals"
- Section 5: "Account & Payment"

### 2. Backend Implementation Needed

#### A. Form Structure API
```typescript
GET /api/forms/{formId}/structure

Response:
{
  formId: "form_123",
  formName: "Glutathione Intake",
  sections: [
    { id: 1, name: "Select Your Products", order: 1 },
    { id: 2, name: "Medical History & Symptoms", order: 2 },
    { id: 3, name: "Contact & Shipping Information", order: 3 },
    { id: 4, name: "Payment Method", order: 4 }
  ]
}
```

#### B. Analytics Tracking Events
When patients fill out forms, track:

```typescript
// When user views a section
{
  event: 'section_view',
  formId: 'form_123',
  sectionId: 1,
  sectionName: 'Select Your Products',
  sessionId: 'sess_abc',
  timestamp: '2026-02-13T20:30:00Z'
}

// When user completes a section (moves to next)
{
  event: 'section_complete',
  formId: 'form_123',
  sectionId: 1,
  sessionId: 'sess_abc',
  timestamp: '2026-02-13T20:32:00Z'
}

// When user abandons (closes without completing)
{
  event: 'form_abandon',
  formId: 'form_123',
  lastSectionId: 2,
  sessionId: 'sess_abc',
  timestamp: '2026-02-13T20:35:00Z'
}
```

#### C. Analytics API
```typescript
GET /api/analytics/forms/{formId}/progression

Response:
{
  formId: "form_123",
  formName: "Glutathione Intake",
  totalSessions: 248,
  completionRate: 16.9,
  averageDuration: 180,
  stageMetrics: [
    {
      sectionId: 1,
      sectionName: "Select Your Products",  // ← Real section name from form
      stepNumber: 1,
      reached: 248,      // Users who viewed this section
      completed: 235,    // Users who completed and moved to next
      dropoffs: 13,      // Users who abandoned here
      dropoffRate: 5.2
    },
    {
      sectionId: 2,
      sectionName: "Medical History & Symptoms",  // ← Real section name
      stepNumber: 2,
      reached: 235,
      completed: 198,
      dropoffs: 37,
      dropoffRate: 15.7
    },
    // ... etc for each section
  ]
}
```

### 3. Frontend Updates Needed

#### A. Form Tab - Show Real Sections
Instead of hardcoded icons, fetch and display actual sections:

```typescript
// Fetch form structure
const formStructure = await fetch(`/api/forms/${formId}/structure`)
const { sections } = await formStructure.json()

// Display actual sections
sections.map(section => (
  <div>{section.name}</div>
))
```

#### B. Analytics Tab - Use Real Data
The `FormAnalytics` component will automatically show real section names once the API returns them.

## Benefits of This Approach

✅ **Accurate Analytics** - Tracks exactly what users see in the form
✅ **Flexible** - Works with any form structure (3 sections, 4 sections, 10 sections, etc.)
✅ **Program-Specific** - Each Teleform can have different sections
✅ **Consistent** - Form Tab and Analytics Tab show the same section names
✅ **Actionable** - You can see exactly where users drop off by real section name

## Summary

**Current:** Hardcoded placeholder names that don't match reality
**Future:** Dynamic section names pulled from actual Teleform structure

**The key:** 
1. Store form structure (sections/pages) in database
2. Track analytics by section ID/name
3. Display analytics using real section names from form structure
