# Make "Create Your Account" a Required System Step

## Current Architecture

The "Create Your Account" step is currently **program-specific** - it only appears if an admin manually adds it when building a questionnaire.

### How It Works Now

1. **Database Storage**: The step is stored in the `QuestionnaireSteps` table as a step with `title: 'Create Your Account'`
2. **Frontend Detection**: The modal checks if `currentStep?.title === 'Create Your Account'` to render the AccountCreationStep component
3. **Optional**: Admins can choose to include or exclude this step when creating programs

**Example from seeder:**
```javascript
// Step 8: Account creation
const step8Id = require('uuid').v4();
steps.push({
  id: step8Id,
  title: 'Create Your Account',
  description: "We'll use this information to set up your personalized care plan",
  stepOrder: 8,
  questionnaireId: questionnaireId,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### The Problem

❌ Account creation is **not guaranteed** to be in every program
❌ Admins might forget to add it
❌ Programs without this step would have no way to collect patient information
❌ Medically required information might be missing

---

## Solution: Make It a System-Required Step

We need to ensure "Create Your Account" appears in **every program flow** automatically, regardless of how the questionnaire is configured.

### Option 1: Frontend Auto-Injection (Recommended)

Automatically inject the account creation step into the questionnaire flow on the frontend if it doesn't exist.

#### Implementation

**File: `/patient-frontend/components/QuestionnaireModal/hooks/useQuestionnaireData.ts`**

Add logic to check if account creation step exists, and inject it if missing:

```typescript
// After loading questionnaire data
React.useEffect(() => {
  if (questionnaire?.steps) {
    // Check if "Create Your Account" step exists
    const hasAccountStep = questionnaire.steps.some(
      step => step.title === 'Create Your Account'
    );

    if (!hasAccountStep) {
      // Inject account creation step before checkout
      const checkoutIndex = questionnaire.steps.findIndex(
        step => step.title === 'Checkout' || step.stepOrder === questionnaire.steps.length
      );

      const accountStep = {
        id: 'system-account-creation',
        title: 'Create Your Account',
        description: 'A licensed healthcare provider will use this information to verify, prescribe and deliver treatments at their discretion.',
        stepOrder: checkoutIndex > 0 ? checkoutIndex - 1 : questionnaire.steps.length,
        questions: [],
        isRequired: true,
        isSystemStep: true // Flag to identify system-injected steps
      };

      // Insert the step
      const updatedSteps = [...questionnaire.steps];
      updatedSteps.splice(checkoutIndex > 0 ? checkoutIndex : questionnaire.steps.length, 0, accountStep);

      // Update questionnaire
      setQuestionnaire({
        ...questionnaire,
        steps: updatedSteps
      });
    }
  }
}, [questionnaire]);
```

**Pros:**
✅ Works immediately without database changes
✅ Doesn't break existing questionnaires
✅ Can be deployed independently
✅ Guarantees account creation in every flow

**Cons:**
❌ Adds complexity to frontend logic
❌ Step won't show in admin preview (unless admin also adds injection logic)

---

### Option 2: Backend Enforcement

Modify the API to automatically include the account creation step when returning questionnaire data.

#### Implementation

**File: `/patient-api/src/endpoints/questionnaires/services/questionnaire.service.ts`**

```typescript
async getQuestionnaireById(id: string) {
  const questionnaire = await Questionnaire.findByPk(id, {
    include: [{ model: QuestionnaireStep, include: [Question] }]
  });

  if (!questionnaire) throw new Error('Questionnaire not found');

  // Check if account creation step exists
  const hasAccountStep = questionnaire.steps.some(
    step => step.title === 'Create Your Account'
  );

  if (!hasAccountStep) {
    // Insert system account step before checkout
    const checkoutIndex = questionnaire.steps.findIndex(
      step => step.title === 'Checkout'
    );

    const accountStep = {
      id: 'system-account-creation',
      title: 'Create Your Account',
      description: 'A licensed healthcare provider will use this information to verify, prescribe and deliver treatments at their discretion.',
      stepOrder: checkoutIndex > 0 ? checkoutIndex - 1 : questionnaire.steps.length,
      questions: [],
      isRequired: true,
      isSystemStep: true
    };

    questionnaire.steps.splice(
      checkoutIndex > 0 ? checkoutIndex : questionnaire.steps.length,
      0,
      accountStep
    );
  }

  return questionnaire;
}
```

**Pros:**
✅ Single source of truth
✅ Works for all clients (web, mobile, etc.)
✅ Easier to maintain
✅ Shows in admin previews

**Cons:**
❌ Requires backend deployment
❌ May need database migration for `isSystemStep` flag
❌ Could break existing integrations

---

### Option 3: Database Migration + Validation

Add a database-level constraint that requires every questionnaire to have an account creation step.

#### Implementation Steps

1. **Migration**: Add `isSystemStep` flag to `QuestionnaireSteps` table
2. **Seeder Update**: Mark account creation steps as `isSystemStep: true`
3. **Validation**: Add database constraint or application-level validation
4. **Admin UI**: Prevent deletion of system steps in questionnaire builder

**Pros:**
✅ Enforced at data level
✅ Prevents human error
✅ Clear separation of system vs custom steps
✅ Best long-term solution

**Cons:**
❌ Requires database migration
❌ Need to update all existing questionnaires
❌ Most complex implementation
❌ Longest development time

---

## Recommended Approach

### Phase 1: Quick Fix (Option 1)
Implement frontend auto-injection immediately to guarantee account creation appears in all programs.

### Phase 2: Proper Solution (Option 3)
Migrate to database-enforced system steps for long-term maintainability.

---

## Step Placement

The account creation step should appear:

**Position**: After all medical questions, before checkout/payment

**Example Flow:**
1. Welcome
2. Medical Questions (weight, health history, etc.)
3. Treatment Recommendations
4. **Create Your Account** ← Insert here
5. Checkout / Payment
6. Success

**Why this order:**
- Patient has already engaged with the form (committed)
- Medical context is established
- Just before payment (logical time to create account)
- After they see treatment recommendations (motivated to proceed)

---

## Frontend Code Location

**Current Implementation:**
```
patient-frontend/components/QuestionnaireModal/
├── index.tsx                    # Line 185: Checks for "Create Your Account"
├── AccountCreationStep.tsx      # The account creation component
└── hooks/
    └── useQuestionnaireData.ts  # Where auto-injection should happen
```

**Key Logic:**
```typescript
// In index.tsx, line 184-208
if (currentStep?.title === 'Create Your Account') {
  return <AccountCreationStep {...props} />;
}
```

This logic would still work with auto-injected steps.

---

## Testing Checklist

After implementation:

- [ ] Account creation appears in programs that have it configured
- [ ] Account creation appears in programs WITHOUT it configured (auto-injection)
- [ ] Step order is correct (before checkout)
- [ ] Navigation works properly
- [ ] Form data persists through the step
- [ ] Admin panel still works for creating questionnaires
- [ ] Existing programs continue to work
- [ ] Mobile view displays correctly
- [ ] Analytics track the step properly

---

## Files to Modify

### Quick Fix (Option 1):
1. `/patient-frontend/components/QuestionnaireModal/hooks/useQuestionnaireData.ts` - Add auto-injection logic
2. `/patient-frontend/components/QuestionnaireModal/hooks/useQuestionnaireModal.ts` - Handle system step flag

### Long-term (Option 3):
1. `/patient-api/migrations/XXXXXX-add-system-step-flag.js` - Add `isSystemStep` column
2. `/patient-api/src/models/QuestionnaireStep.ts` - Update model
3. `/patient-api/src/endpoints/questionnaires/services/questionnaire.service.ts` - Add validation
4. `/fuse-admin-frontend/components/questionnaire-builder/` - Prevent system step deletion
5. All seeders - Mark account steps as system steps

---

## Immediate Action

**What to do now:**

1. Implement Option 1 (Frontend Auto-Injection) for immediate deployment
2. Test with multiple programs
3. Plan database migration for proper long-term solution

**Code to add (Quick Fix):**

```typescript
// In useQuestionnaireData.ts
const ensureAccountCreationStep = (questionnaire: Questionnaire) => {
  if (!questionnaire?.steps) return questionnaire;

  const hasAccountStep = questionnaire.steps.some(
    step => step.title === 'Create Your Account'
  );

  if (hasAccountStep) return questionnaire;

  // Find insertion point (before checkout or at end)
  const checkoutIndex = questionnaire.steps.findIndex(
    step => step.title?.toLowerCase().includes('checkout') || 
           step.title?.toLowerCase().includes('payment')
  );

  const insertAt = checkoutIndex > 0 ? checkoutIndex : questionnaire.steps.length;

  // Create system account step
  const accountStep = {
    id: 'system-account-creation',
    title: 'Create Your Account',
    description: 'A licensed healthcare provider will use this information to verify, prescribe and deliver treatments at their discretion.',
    stepOrder: insertAt,
    questions: [],
    isRequired: true,
    isSystemStep: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Insert step
  const updatedSteps = [...questionnaire.steps];
  updatedSteps.splice(insertAt, 0, accountStep);

  // Reorder steps
  updatedSteps.forEach((step, index) => {
    step.stepOrder = index + 1;
  });

  return {
    ...questionnaire,
    steps: updatedSteps
  };
};
```

---

**Status**: ⚠️ Account creation currently NOT guaranteed in all programs
**Priority**: 🔴 HIGH - This is medically required information
**Effort**: Frontend injection = 2 hours, Database migration = 1-2 days
