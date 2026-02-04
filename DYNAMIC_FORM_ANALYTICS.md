# Dynamic Form Analytics System

## Overview
Analytics system that **adapts to each form's unique structure**, tracking user progress through the actual steps/questions defined in that specific form, regardless of order.

## Key Innovation: Dynamic Adaptation

### Problem
❌ **Old Approach**: Assumed fixed flow (Product → Medical → Checkout → Account)
- Didn't work when forms had different structures
- Couldn't track custom question orders
- Hard-coded stage names

### Solution
✅ **New Approach**: Reads actual form structure and adapts
- Works with any form configuration
- Tracks progress through real questions
- Shows actual question text
- Adapts to any order

## How It Works

### 1. Fetch Form Structure
```typescript
// Backend fetches the actual form configuration
const form = await TenantProductForm.findOne({
  include: [
    {
      model: GlobalFormStructure,
      as: "globalFormStructure",
    },
  ],
});

// Extract actual steps from the form
const formSteps = formStructure?.steps || [];
```

### 2. Map Steps to Analytics
```typescript
const stages = formSteps.map((step, index) => ({
  stepNumber: index + 1,
  questionText: step.question || step.label,
  questionId: step.id,
  questionType: step.type
}));
```

### 3. Track Progress Per Step
```typescript
// When user views a step, track with metadata
POST /analytics/track {
  eventType: 'view',
  formId,
  sessionId,
  metadata: {
    stepNumber: 2,  // Current step
    questionId: 'q2'
  }
}
```

### 4. Calculate Drop-offs
For each stage:
- **Reached**: How many got to this step
- **Completed**: How many moved past this step
- **Dropoffs**: Reached - Completed
- **Drop-off Rate**: (Dropoffs / Reached) × 100

## Form Structure Examples

### Example 1: Medical-First Flow
```
Step 1: Medical History Questions
Step 2: Product Selection  
Step 3: Checkout
Step 4: Account Creation
```

Analytics shows:
- Medical History Questions: 36 started, 32 completed, 11% drop-off
- Product Selection: 32 started, 28 completed, 13% drop-off
- Checkout: 28 started, 26 completed, 7% drop-off
- Account Creation: 26 started, 26 completed, 0% drop-off

### Example 2: Product-First Flow
```
Step 1: Product Selection
Step 2: Medical Questions
Step 3: Checkout
Step 4: Account
```

Analytics adapts and shows this order!

### Example 3: Complex Custom Form
```
Step 1: Eligibility Check
Step 2: Insurance Information
Step 3: Medical History
Step 4: Lifestyle Questions
Step 5: Product Recommendation
Step 6: Checkout
Step 7: Account Setup
```

Analytics tracks all 7 steps dynamically!

## UI Components

### Drop-off by Stage Section
**Visual Funnel Display:**
- Shows each step in the form's actual order
- Step number in purple circle
- Question text as it appears in form
- Progress bar showing completion rate
- Drop-off percentage prominently displayed
- Connector lines between steps

```tsx
[1] Product Selection
    36 started • 32 completed • 4 dropped off
    [████████████████░░] 89%
    ↓
[2] Medical History Questions  
    32 started • 28 completed • 4 dropped off
    [██████████████░░░░] 88%
    ↓
[3] Checkout & Payment
    28 started • 26 completed • 2 dropped off
    [████████████████░░] 93%
    ↓
[4] Account Creation
    26 started • 26 completed • 0 dropped off
    [██████████████████] 100%
```

### All Visitors Table
Shows where each visitor currently is:

| Name | Duration | **Current Stage** | Progress | Last Viewed |
|------|----------|-------------------|----------|-------------|
| Gary Smith | 1:18 mins | **Checkout & Payment** | ⭕75 (3/4) | 12h ago |
| Jonathan Lane | 2:11 mins | **Completed** | ⭕100 (4/4) | 2d ago |
| Ben Wilson | 6s | **Medical History** | ⭕50 (2/4) | 2d ago |

## Data Tracking Requirements

### Frontend: Track Step Progress
When user advances to next step:
```typescript
// Track view of specific step
await fetch('/analytics/track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'view',
    formId: formId,
    sessionId: sessionId,
    userId: userId,
    productId: productId,
    metadata: {
      stepNumber: currentStep,  // 1-based step number
      questionId: question.id,
      questionText: question.text
    }
  })
});
```

### Frontend: Track Drop-offs
When user exits form:
```typescript
// Track drop-off at specific step
await fetch('/analytics/track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'dropoff',
    formId: formId,
    sessionId: sessionId,
    metadata: {
      stepNumber: currentStep,
      questionId: question.id
    }
  })
});
```

### Frontend: Track Completion
When user completes form:
```typescript
// Track conversion
await fetch('/analytics/track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'conversion',
    formId: formId,
    sessionId: sessionId,
    metadata: {
      stepNumber: totalSteps
    }
  })
});
```

## Backend Logic

### Step Calculation
```typescript
// Get last step reached from events
session.lastStepReached = Math.max(
  ...session.events
    .filter(e => e.metadata?.stepNumber)
    .map(e => e.metadata.stepNumber)
);

// Calculate completion rate
completionRate = (lastStepReached / totalSteps) * 100;

// Determine current stage
const currentStageIndex = lastStepReached - 1;
const currentStage = stages[currentStageIndex]?.questionText || 'Not Started';
```

### Stage Metrics Calculation
```typescript
for (const stage of stages) {
  // How many sessions reached this step?
  const reached = sessions.filter(s => 
    s.lastStepReached >= stage.stepNumber
  ).length;
  
  // How many moved past this step?
  const completed = sessions.filter(s => 
    s.lastStepReached > stage.stepNumber
  ).length;
  
  // Dropoffs = didn't move past
  const dropoffs = reached - completed;
  const dropoffRate = reached > 0 ? (dropoffs / reached) * 100 : 0;
}
```

## Integration Points

### 1. Form Builder Integration
- GlobalFormStructure stores step order
- Each step has: id, question, type, order
- Analytics reads this structure

### 2. Patient Frontend Integration
**File**: `patient-frontend/pages/[...form pages]`

Add analytics tracking:
```typescript
// On step view
useEffect(() => {
  trackStepView(currentStep);
}, [currentStep]);

// On form exit
useEffect(() => {
  return () => {
    if (!completed) {
      trackDropOff(currentStep);
    }
  };
}, []);

// On form completion
const handleSubmit = async () => {
  await submitForm();
  trackConversion();
};
```

### 3. Analytics Dashboard
**File**: `fuse-admin-frontend/pages/analytics.tsx`
- Displays FormAnalytics component
- Shows dynamic funnel
- Adapts to any form structure

## Benefits

### 1. Complete Flexibility
✅ Works with any form structure
✅ Any number of steps
✅ Any step order
✅ Custom question types

### 2. Actionable Insights
✅ See exactly which questions cause drop-offs
✅ Identify confusing steps
✅ Optimize specific problem areas
✅ A/B test question order

### 3. Real User Behavior
✅ Track actual user journey
✅ See where users spend time
✅ Identify friction points
✅ Measure engagement per step

## Example Use Cases

### Use Case 1: High Drop-off at Medical Questions
**Problem**: 40% drop at "Medical History Questions" step

**Action**:
- Simplify medical questions
- Break into smaller sub-steps
- Add progress indicator
- Offer "Save & Continue Later"

### Use Case 2: Fast Completions
**Insight**: Average duration only 45 seconds

**Action**:
- Form might be too simple
- Consider adding more qualifying questions
- Ensure enough medical info collected

### Use Case 3: Drop-off at Checkout
**Problem**: 25% drop at payment step

**Action**:
- Check pricing display
- Add payment options
- Simplify checkout form
- Add trust badges

## Default Fallback

If no GlobalFormStructure is defined:
```typescript
const defaultStages = [
  { stepNumber: 1, questionText: 'Product Selection' },
  { stepNumber: 2, questionText: 'Medical Questions' },
  { stepNumber: 3, questionText: 'Checkout' },
  { stepNumber: 4, questionText: 'Account Creation' },
];
```

## Data Flow Diagram

```
Form Structure → Analytics Backend → Stage Metrics → Frontend Display
     ↓                    ↓                ↓               ↓
[Q1: Product]     [Track Progress]   [Q1: 36→32]    [Visual Funnel]
[Q2: Medical]  →  [Per Question]  →  [Q2: 32→28]  → [Drop-off Rates]
[Q3: Checkout]    [Calculate Drop]   [Q3: 28→26]    [Progress Bars]
[Q4: Account]     [Group Sessions]   [Q4: 26→26]    [Visitor Table]
```

## API Response Structure

```json
{
  "success": true,
  "data": {
    "formId": "form-123",
    "formName": "Semaglutide Intake",
    "totalSessions": 36,
    "completionRate": 72,
    "averageDuration": 224,
    "formSteps": [
      {
        "stepNumber": 1,
        "questionText": "Product Selection",
        "questionId": "q1",
        "questionType": "selection"
      }
    ],
    "stageMetrics": [
      {
        "stepNumber": 1,
        "questionText": "Product Selection",
        "reached": 36,
        "completed": 32,
        "dropoffs": 4,
        "dropoffRate": 11
      }
    ],
    "sessions": [...],
    "dailyStats": [...]
  }
}
```

## Implementation Checklist

### Backend ✅
- [x] Read GlobalFormStructure
- [x] Extract steps in order
- [x] Calculate per-step metrics
- [x] Group events by session
- [x] Track last step reached
- [x] Calculate drop-off rates
- [x] Return dynamic structure

### Frontend ✅
- [x] Display dynamic funnel
- [x] Show actual question text
- [x] Visual progress bars
- [x] Visitor table with current stage
- [x] Adapt to any number of steps
- [x] Clean Papermark-style UI

### Patient Frontend ⏳ (Next Phase)
- [ ] Track step views with metadata
- [ ] Include stepNumber in events
- [ ] Track drop-offs on exit
- [ ] Track conversions on completion

## Testing Strategy

### Test Form Configurations

1. **4-Step Form**: Product → Medical → Checkout → Account
2. **6-Step Form**: Eligibility → Product → Medical → Lifestyle → Checkout → Account  
3. **3-Step Form**: Medical → Checkout → Account
4. **Custom Order**: Medical → Product → Account → Checkout

### Verify Each Configuration
- [ ] Steps display in correct order
- [ ] Drop-off metrics calculate correctly
- [ ] Progress bars show accurate percentages
- [ ] Visitor table shows correct current stage
- [ ] Funnel adapts to step count

## Performance Notes

- Form structure cached after first fetch
- Stage metrics calculated once per request
- Efficient session grouping
- Optimized database queries
- Frontend memoization

## Future: Real-time Updates

### WebSocket Integration (Optional)
```typescript
// Subscribe to form analytics
socket.on(`form:${formId}:analytics`, (update) => {
  // Update metrics in real-time
  updateStageMetrics(update);
});
```

### Benefits
- See visitors in real-time
- Live drop-off tracking
- Instant completion notifications
- Monitor active sessions

## Summary

This **dynamic analytics system** ensures that:
✅ Every form gets accurate, relevant analytics
✅ Drop-off tracking matches actual form flow
✅ Admins see the questions they created
✅ System adapts to form changes automatically
✅ No hard-coded assumptions about form structure

The UI now perfectly matches Papermark's clean design while providing healthcare-specific insights for form optimization! 💜
