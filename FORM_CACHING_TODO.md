# Form Caching & Progress Saving Implementation

## Current State
❌ **No form progress caching** - Users lose all data if they close/refresh the page

## What Should Be Implemented

### Option 1: Client-Side Caching (Quick Win)

**Implementation:**
```typescript
// In useQuestionnaireModal.ts

// Save form state to localStorage whenever answers change
useEffect(() => {
  if (Object.keys(answers).length > 0) {
    const cacheKey = `form-draft-${formId}-${userId}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      answers,
      timestamp: Date.now(),
      currentStep: currentStepIndex,
      productId,
      sessionId: generateSessionId()
    }));
  }
}, [answers, formId, userId, currentStepIndex]);

// Restore form state on mount
useEffect(() => {
  const cacheKey = `form-draft-${formId}-${userId}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const { answers: savedAnswers, timestamp, currentStep } = JSON.parse(cached);
    
    // Check if cache is less than 7 days old
    const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp < CACHE_EXPIRY) {
      setAnswers(savedAnswers);
      setCurrentStepIndex(currentStep);
      // Show toast: "We restored your progress from [time ago]"
    } else {
      localStorage.removeItem(cacheKey);
    }
  }
}, [formId, userId]);

// Clear cache after successful submission
const handleSuccess = () => {
  const cacheKey = `form-draft-${formId}-${userId}`;
  localStorage.removeItem(cacheKey);
  // ... rest of success logic
};
```

**Pros:**
✅ Easy to implement (1-2 hours)
✅ Works offline
✅ No database changes needed
✅ Instant restoration

**Cons:**
❌ Only works on same browser/device
❌ Data lost if user clears browser cache
❌ Can't resume on different device

---

### Option 2: Server-Side Draft Saving (Robust)

**Database Schema:**
```sql
CREATE TABLE FormDrafts (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  form_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  answers JSONB NOT NULL,
  current_step INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id, form_id)
);

CREATE INDEX idx_form_drafts_user_form ON FormDrafts(user_id, form_id);
CREATE INDEX idx_form_drafts_expiry ON FormDrafts(expires_at);
```

**Backend API:**
```typescript
// POST /api/forms/drafts/save
router.post('/forms/drafts/save', async (req, res) => {
  const { userId, formId, productId, answers, currentStep, sessionId } = req.body;
  
  const draft = await FormDraft.upsert({
    userId,
    formId,
    productId,
    answers,
    currentStep,
    sessionId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  return res.json({ success: true, draftId: draft.id });
});

// GET /api/forms/drafts/restore
router.get('/forms/drafts/restore', async (req, res) => {
  const { userId, formId } = req.query;
  
  const draft = await FormDraft.findOne({
    where: {
      userId,
      formId,
      expiresAt: { [Op.gt]: new Date() }
    }
  });
  
  if (!draft) {
    return res.json({ success: true, hasDraft: false });
  }
  
  return res.json({
    success: true,
    hasDraft: true,
    draft: {
      answers: draft.answers,
      currentStep: draft.currentStep,
      savedAt: draft.updatedAt
    }
  });
});

// DELETE /api/forms/drafts/:userId/:formId (after submission)
router.delete('/forms/drafts/:userId/:formId', async (req, res) => {
  await FormDraft.destroy({
    where: {
      userId: req.params.userId,
      formId: req.params.formId
    }
  });
  
  return res.json({ success: true });
});
```

**Frontend Implementation:**
```typescript
// Auto-save every 10 seconds
useEffect(() => {
  const saveInterval = setInterval(async () => {
    if (Object.keys(answers).length > 0) {
      await fetch('/api/forms/drafts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          formId,
          productId,
          answers,
          currentStep: currentStepIndex,
          sessionId: generateSessionId()
        })
      });
      
      console.log('✅ Form progress auto-saved');
    }
  }, 10000); // Every 10 seconds
  
  return () => clearInterval(saveInterval);
}, [answers, currentStepIndex]);

// Restore on mount
useEffect(() => {
  const restoreDraft = async () => {
    const response = await fetch(
      `/api/forms/drafts/restore?userId=${userId}&formId=${formId}`
    );
    const { hasDraft, draft } = await response.json();
    
    if (hasDraft) {
      // Show modal: "Resume where you left off?"
      const confirmed = window.confirm(
        `We found your progress from ${formatTimeAgo(draft.savedAt)}. Resume?`
      );
      
      if (confirmed) {
        setAnswers(draft.answers);
        setCurrentStepIndex(draft.currentStep);
        toast.success('Progress restored!');
      }
    }
  };
  
  restoreDraft();
}, [formId, userId]);
```

**Pros:**
✅ Works across devices
✅ Survives browser cache clears
✅ Can track draft analytics
✅ Can send reminder emails to complete draft
✅ Database backup of user data

**Cons:**
❌ Requires database migration
❌ More complex implementation
❌ Server storage costs

---

## Recommended Approach

**Phase 1: Quick Win (This Week)**
- Implement **Client-Side Caching** (Option 1)
- Takes 1-2 hours
- Immediate user benefit

**Phase 2: Robust Solution (Next Sprint)**  
- Implement **Server-Side Drafts** (Option 2)
- Migrate existing localStorage drafts to server
- Add "Resume Draft" feature to dashboard
- Send abandoned cart emails with draft link

---

## UX Considerations

### When to Show Draft Restoration:

**Good UX:**
```
┌─────────────────────────────────────────┐
│  Resume Your Application?               │
│                                         │
│  We saved your progress from 2 hours   │
│  ago. You were on step 3 of 5.         │
│                                         │
│  [Start Fresh]  [Resume Progress] ←─    │
└─────────────────────────────────────────┘
```

**What to Save:**
✅ All answer fields
✅ Current step/page
✅ Selected products
✅ Partially filled contact info
✅ Session metadata

**What NOT to Save:**
❌ Credit card numbers (PCI compliance)
❌ Passwords
❌ Sensitive medical data (consider encryption)

---

## Analytics Benefits

Once drafts are tracked, you can:

1. **Measure Drop-off Intent**
   - How many users save progress vs abandon completely
   
2. **Send Targeted Emails**
   - "Complete your application - only 2 steps left!"
   
3. **A/B Test Reminder Timing**
   - 1 hour? 24 hours? Which works better?
   
4. **Track Completion from Draft**
   - Does draft saving improve conversion?

---

## Summary

**Current State:**
- ✅ Tracking: **Fully implemented and working**
- ❌ Caching: **Not implemented - users lose progress**

**Quick Fix (Recommended):**
- Add localStorage caching (1-2 hours of work)
- 80% of the benefit with 20% of the effort

**Long-term Solution:**
- Server-side draft saving
- Cross-device support
- Email reminders
