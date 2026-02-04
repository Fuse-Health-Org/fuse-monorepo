# Multi-Tenant Analytics Structure

## Overview
Complete analytics system with **unique pages per form** and **strict brand isolation**. Each brand only sees analytics for their own forms.

## URL Structure

### Analytics Routes

**Main Analytics Page:**
```
/analytics
```
Shows list of all forms for the logged-in brand

**Individual Form Analytics:**
```
/analytics/forms/[formId]
```
Unique analytics page for each specific form

### Examples

**Brand: Limitless Health (clinicId: abc-123)**
```
/analytics
  → Shows their 3 forms

/analytics/forms/form-uuid-1
  → Semaglutide Intake Form analytics

/analytics/forms/form-uuid-2
  → Testosterone Intake Form analytics

/analytics/forms/form-uuid-3
  → Weight Loss Program analytics
```

**Brand: Vitality Meds (clinicId: xyz-789)**
```
/analytics
  → Shows their 2 forms (DIFFERENT from above)

/analytics/forms/form-uuid-4
  → Their Semaglutide form (different data)

/analytics/forms/form-uuid-5
  → Their Custom Protocol
```

## Multi-Tenant Isolation

### Backend Security

#### GET `/analytics/forms`
```typescript
// Filters by authenticated user's clinicId
const forms = await TenantProductForm.findAll({
  where: {
    clinicId: user.clinicId,  // ✅ ISOLATED
  }
});
```

**Result:**
- Brand A sees only Brand A's forms
- Brand B sees only Brand B's forms
- No cross-brand data leakage

#### GET `/analytics/forms/:formId/sessions`
```typescript
// Verifies form belongs to user's clinic
const form = await TenantProductForm.findOne({
  where: {
    id: formId,
    clinicId: user.clinicId,  // ✅ ISOLATED
  }
});

if (!form) {
  return 404; // Prevents access to other brands' forms
}
```

**Security:**
- Can't access other brands' form analytics
- Returns 404 if formId belongs to different clinic
- JWT authentication required
- ClincId verified on every request

### Database Isolation

#### TenantProductForm Table
```sql
WHERE clinicId = 'user-clinic-id'
  AND id = 'form-id'
```

#### TenantAnalyticsEvents Table
```sql
SELECT * FROM TenantAnalyticsEvents
WHERE formId IN (
  SELECT id FROM TenantProductForms 
  WHERE clinicId = 'user-clinic-id'
)
```

**Queries automatically filtered by:**
- Form ownership (TenantProductForm.clinicId)
- Product ownership (TenantProduct.clinicId)
- Analytics events linked to owned forms

## Page Structure

### /analytics (Form List)

**Purpose:** Show all forms for the brand with quick access

**Displays:**
- Form name
- Product name
- Published URL (if live)
- "View Analytics" button
- Hover effects
- Click → navigates to form detail

**Example Card:**
```
┌──────────────────────────────────────────────┐
│ Semaglutide Intake Form            [👁️]      │
│ Semaglutide                                  │
│ https://brand.fuse.health/my-products/...    │
│                      View Analytics →        │
└──────────────────────────────────────────────┘
```

### /analytics/forms/[formId] (Form Detail)

**Purpose:** Deep dive into single form analytics

**Displays:**
1. **Back Button** → Returns to form list
2. **Form Name** in header
3. **View Form** button → Opens published URL
4. **Form Progression Chart** (top priority)
5. **Summary Metrics** (Total Sessions, Completion, Duration)
6. **All Visitors Table** (up to 10 most recent)

**Example:**
```
← Back to All Forms                    [View Form →]

Semaglutide Intake Form Analytics
Track visitor behavior, completion rates, and form performance

┌─────────────────────────────────────────────┐
│ Form Progression Chart                      │
│ [Bars showing 36 → 32 → 28 → 26]           │
└─────────────────────────────────────────────┘

┌─────────────┬─────────────┬─────────────┐
│ 36 Sessions │ 72% Complete│ 3:44 Avg    │
└─────────────┴─────────────┴─────────────┘

┌─────────────────────────────────────────────┐
│ All Visitors                                │
│ Gary Smith    1:18  Checkout    75%  12h   │
│ [👥] Anonymous  23s   Product    25%  1h    │
│ ...                                         │
└─────────────────────────────────────────────┘
```

## Data Sharing Model

### What Brands See (Their Data Only)

**Limitless Health** sees:
- ✅ Their form analytics
- ✅ Their visitors (patients who filled their forms)
- ✅ Their conversion rates
- ✅ Their form structure
- ❌ NOT other brands' data

**Vitality Meds** sees:
- ✅ Their form analytics (completely different)
- ✅ Their visitors
- ✅ Their conversion rates
- ✅ Their form structure
- ❌ NOT Limitless Health's data

### Platform Owner Sees

**FUSE Tenant Portal** (if implemented):
- ✅ All brands' analytics
- ✅ Cross-brand comparisons
- ✅ Platform-wide metrics
- ✅ Performance benchmarks

## Implementation Files

### Frontend

**New Files:**
```
fuse-admin-frontend/
  ├── pages/
  │   ├── analytics.tsx (updated - form list)
  │   └── analytics/
  │       └── forms/
  │           └── [formId].tsx (new - form detail)
  └── components/
      ├── form-analytics.tsx (existing - used in main page)
      └── form-analytics-detail.tsx (new - used in detail page)
```

### Backend

**Existing Endpoints (already isolated):**
```
GET  /analytics/forms
     → Returns forms for user's clinicId only

GET  /analytics/forms/:formId/sessions
     → Verifies formId belongs to user's clinicId
     → Returns 404 if not authorized
```

## Navigation Flow

### User Journey

1. **Click "Analytics" in sidebar**
   ```
   /analytics
   ```
   → Shows list of their forms

2. **Click "Semaglutide Intake Form"**
   ```
   /analytics/forms/abc-123
   ```
   → Shows detailed analytics for that form

3. **Click "Back to All Forms"**
   ```
   → Returns to /analytics
   ```

4. **Click "View Form"**
   ```
   → Opens published form URL in new tab
   → Lets admin preview the actual form
   ```

## API Response Examples

### GET `/analytics/forms`
```json
{
  "success": true,
  "data": [
    {
      "id": "form-uuid-1",
      "name": "Semaglutide Intake Form",
      "productName": "Semaglutide",
      "publishedUrl": "https://brand.fuse.health/my-products/form-uuid-1/semaglutide",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "form-uuid-2",
      "name": "Testosterone Intake Form",
      "productName": "Testosterone",
      "publishedUrl": "https://brand.fuse.health/my-products/form-uuid-2/testosterone",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

### GET `/analytics/forms/form-uuid-1/sessions`
```json
{
  "success": true,
  "data": {
    "formId": "form-uuid-1",
    "formName": "Semaglutide Intake Form",
    "totalSessions": 36,
    "completionRate": 72,
    "averageDuration": 224,
    "stageMetrics": [...],
    "sessions": [...]
  }
}
```

## Security Verification

### Authentication
✅ All endpoints require JWT  
✅ User identity verified  
✅ ClinicId extracted from user  

### Authorization
✅ Forms filtered by clinicId  
✅ Form ownership verified before showing analytics  
✅ Cross-clinic access blocked  

### Data Isolation
✅ No shared sessions between brands  
✅ No shared analytics events  
✅ Independent tracking per brand  

## Benefits

### For Brands
1. **Clear Data Ownership**: See only their data
2. **Per-Form Insights**: Optimize each form independently
3. **Shareable Links**: Can share specific form analytics URL
4. **Privacy**: No exposure to competitor data

### For Platform
1. **Multi-tenant Safe**: No data leakage
2. **Scalable**: Works with 1 or 1000 brands
3. **Compliance**: HIPAA-compliant isolation
4. **Auditable**: Clear data boundaries

## Testing Checklist

### Multi-Tenant Tests

**Test 1: Brand A Access**
- [ ] Login as Brand A
- [ ] See only Brand A's forms
- [ ] Open Brand A's form analytics
- [ ] See only Brand A's visitors
- [ ] Try accessing Brand B's formId → 404

**Test 2: Brand B Access**
- [ ] Login as Brand B
- [ ] See only Brand B's forms
- [ ] Open Brand B's form analytics
- [ ] See only Brand B's visitors
- [ ] Verify completely different data from Brand A

**Test 3: URL Manipulation**
- [ ] Try accessing /analytics/forms/other-brand-form-id
- [ ] Should return 404 or redirect
- [ ] No data leakage

## Migration Path

### From Old Analytics

**Old structure:**
```
/analytics → Combined view, dropdown selector
```

**New structure:**
```
/analytics → Form list (overview)
/analytics/forms/[id] → Individual form detail
```

**Migration:**
- Old analytics.tsx → Replaced with form list
- Can add redirect from old URL if needed
- No database changes required
- Backward compatible API

## Future Enhancements

### Phase 2: Form Comparison
```
/analytics/compare?forms=id1,id2,id3
```
Compare multiple forms side-by-side

### Phase 3: Custom Dashboards
```
/analytics/dashboard
```
Customizable overview with widgets

### Phase 4: Export & Reports
```
/analytics/forms/[id]/export
```
Download CSV/PDF reports

### Phase 5: Public Analytics Sharing
```
/analytics/share/[shareToken]
```
Share analytics with stakeholders (no login required)

## Summary

✅ **Unique pages per form** - `/analytics/forms/[formId]`  
✅ **Brand isolation** - Only see their own data  
✅ **Secure routing** - ClincId verified  
✅ **Clean navigation** - List → Detail → Back  
✅ **Shareable URLs** - Can bookmark/share specific form analytics  
✅ **Anonymous tracking** - Up to 10 visitors with IP/location  

Each brand now has their own private analytics dashboard for each of their forms! 💜
