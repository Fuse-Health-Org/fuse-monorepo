# Papermark-Style Form Analytics

## Overview
Implemented comprehensive Papermark-inspired analytics for intake form tracking. This provides detailed visitor-level analytics showing how far users progress through forms, their completion rates, duration, and individual session data.

## Inspiration
Based on Papermark.com's document analytics UI, adapted for tracking intake form progression and visitor behavior in healthcare questionnaires.

## Features

### 📊 **Summary Metrics** (Top Cards)

1. **Number of Views**
   - Total count of form visits
   - Eye icon indicator
   - Shows overall form reach

2. **Average View Completion**
   - Percentage completion rate across all sessions
   - TrendingUp icon in green
   - Indicates how far users get on average

3. **Total Average Duration**
   - Mean time spent on forms
   - Formatted as "X:XX mins" or "XXs"
   - Clock icon indicator

4. **Conversion Rate**
   - Percentage of visitors who complete the form
   - Users icon in purple
   - Tracks successful completions

### 📈 **Views Over Time Chart**

- Beautiful purple gradient area chart
- Shows daily form views
- Smooth curves matching FUSE brand aesthetic
- Interactive hover tooltips
- Responsive design

### 👥 **All Visitors Table** (Papermark-style)

Displays comprehensive visitor data in an expandable table:

#### Main View (Collapsed)
- **Name**: Avatar with initials + Full name + Email
- **View Duration**: Time spent on form
- **View Completion**: Circular badge with percentage (color-coded)
- **Last Viewed**: Relative time ("2h ago", "3d ago")
- **Expand Icon**: Chevron to show more details

#### Expanded View
Additional information shown on click:
- **Phone Number**: If captured
- **Progress**: Steps completed / Total steps
- **Session ID**: Unique identifier (truncated)
- **Drop-off Stage**: If user didn't complete (product/payment/account)
- **Conversion Status**: Green badge if converted

### 🎨 **Completion Color Coding**

Visual indicators for completion rates:
- **90-100%**: Green (excellent completion)
- **70-89%**: Blue (good completion)
- **40-69%**: Orange (moderate completion)
- **0-39%**: Red (poor completion)

## Technical Implementation

### Frontend Component
**File**: `fuse-admin-frontend/components/form-analytics.tsx`

**Key Features**:
- React functional component with hooks
- Real-time data fetching from API
- Expandable rows for detailed view
- Responsive design
- FUSE brand purple theme integration

### Data Structure

```typescript
interface FormSession {
  sessionId: string          // Unique session identifier
  userId: string             // User ID
  firstName: string          // Captured on first slide
  lastName: string           // Captured on first slide
  email: string              // Captured on first slide
  phoneNumber?: string       // Optional phone
  viewDuration: number       // Seconds spent on form
  completion: number         // Percentage 0-100
  lastViewed: string         // ISO timestamp
  formStepsCompleted: number // Steps finished
  totalFormSteps: number     // Total steps in form
  dropOffStage?: string      // Where they dropped off
  converted: boolean         // Did they complete?
}
```

### API Endpoints Required

#### GET `/analytics/forms`
Returns list of available forms for clinic
```json
{
  "success": true,
  "data": [
    { "id": "form-123", "name": "Semaglutide Intake Form" }
  ]
}
```

#### GET `/analytics/forms/{formId}/sessions`
Returns detailed session data for a form
```json
{
  "success": true,
  "data": {
    "formId": "form-123",
    "formName": "Semaglutide Intake Form",
    "totalViews": 36,
    "averageCompletion": 85,
    "averageDuration": 224,
    "conversionRate": 72,
    "sessions": [...],
    "dailyViews": [...]
  }
}
```

## User Experience

### Navigation
1. Navigate to **Analytics** in sidebar
2. See form analytics overview
3. Select form from dropdown (if multiple forms)
4. View summary metrics at top
5. See chart showing trends
6. Scroll to visitor table
7. Click rows to expand for details

### Permissions
- Requires active subscription
- Requires `hasAccessToAnalytics` permission
- Shows upgrade message if no access

### Empty States
- "No analytics data yet" when no sessions
- "No sessions recorded yet" in empty table
- Helpful messaging guiding users

### Loading States
- Skeleton loaders for metrics while fetching
- "Loading analytics..." spinner
- Smooth transitions

## Data Capture Flow

### When Form is Viewed
1. User lands on intake form
2. System creates `sessionId`
3. Tracks `view` event
4. Starts duration timer

### When User Progresses
1. User fills first slide (name, email, phone)
2. Data immediately captured to database
3. User identified for analytics
4. Progress tracked per step

### When User Drops Off
1. Session duration calculated
2. Completion percentage computed
3. Drop-off stage recorded (product/payment/account)
4. `dropoff` event tracked

### When User Converts
1. Form fully completed
2. Conversion event tracked
3. `converted: true` flag set
4. Final duration and completion recorded

## Design Details

### Colors (FUSE Brand)
- **Purple**: `hsl(270, 80%, 65%)` - Primary brand color
- **Charts**: Purple gradient area chart
- **Completion Badges**: 
  - Green: `#10b981`
  - Blue: `#3b82f6`
  - Orange: `#f59e0b`
  - Red: `#ef4444`

### Typography
- **Headers**: SF Pro Display, semibold
- **Metrics**: Large numbers (3xl), tight tracking
- **Labels**: Small caps, muted foreground
- **Table**: Consistent sizing, readable

### Spacing
- Generous padding in cards (p-6)
- Consistent gaps between sections (gap-5, space-y-6)
- Apple-inspired whitespace
- Breathing room in tables

### Icons
- Lucide React icons throughout
- Eye: Views
- Clock: Duration
- TrendingUp: Completion
- Users: Visitors
- Phone/Mail/Calendar: Contact info
- BarChart3: Progress

## Mobile Responsiveness

### Breakpoints
- **Mobile**: Single column layout
- **Tablet**: 2-column metrics grid
- **Desktop**: 4-column metrics grid

### Table Handling
- Horizontal scroll on mobile
- Optimized column widths
- Touch-friendly expand/collapse
- Readable text sizes

## Performance Considerations

### Data Loading
- Lazy load form list first
- Fetch analytics on form selection
- Paginate visitor table if > 100 sessions
- Cache frequently accessed forms

### Rendering
- Virtual scrolling for large visitor lists
- Memoized components to prevent re-renders
- Debounced search/filter inputs
- Optimized chart rendering

## Future Enhancements

### Planned Features
1. **Date Range Selector**: Filter by custom date ranges
2. **Export to CSV**: Download analytics data
3. **Email Notifications**: Alert on low completion rates
4. **Comparison View**: Compare multiple forms
5. **Funnel Visualization**: Visual step-by-step drop-off
6. **Heat Maps**: Most/least viewed sections
7. **Session Replay**: Watch user journey (privacy-compliant)
8. **A/B Testing**: Compare form variants

### Advanced Metrics
- Time per question/section
- Device breakdown (mobile vs desktop)
- Browser analytics
- Geographic data
- Referral sources
- Return visitor tracking

## Privacy & Compliance

### HIPAA Considerations
- No PHI displayed in analytics
- Only basic contact info shown
- Session IDs anonymized
- Secure API endpoints
- Role-based access control
- Audit logging for access

### Data Retention
- Analytics data retained per compliance policy
- Configurable retention period
- Automatic data purging
- Export before deletion

## Testing

### Manual Testing Checklist
- [ ] Forms list loads correctly
- [ ] Metrics display accurate data
- [ ] Chart renders with data
- [ ] Visitor table shows sessions
- [ ] Expand/collapse rows works
- [ ] Completion colors correct
- [ ] Duration formatting accurate
- [ ] Empty states display
- [ ] Loading states smooth
- [ ] Permission checks work
- [ ] Mobile responsive
- [ ] Browser compatibility

### Test Scenarios
1. **No data**: Check empty states
2. **Single session**: Verify metrics calculate
3. **Multiple sessions**: Check table population
4. **High completion**: Green badges show
5. **Low completion**: Red badges show
6. **Long duration**: Format correctly
7. **Recent views**: "Just now" displays
8. **Old views**: Date formatting correct

## Troubleshooting

### No Data Showing
1. Check API endpoints responding
2. Verify form ID correct
3. Confirm user has analytics permission
4. Check date range if filtered
5. Verify session tracking active

### Incorrect Metrics
1. Check duration calculation logic
2. Verify completion percentage formula
3. Confirm conversion tracking
4. Review drop-off stage assignment

### Performance Issues
1. Implement pagination for large datasets
2. Add caching layer
3. Optimize database queries
4. Use indexes on session lookups

## Comparison to Papermark

### Similarities ✅
- Clean, minimal design
- Summary metrics at top
- Chart visualization
- Visitor table with expandable rows
- Completion percentage badges
- Duration tracking
- Relative time display
- Color-coded completion

### FUSE-Specific Additions ✨
- Healthcare intake form focus
- Drop-off stage tracking (product/payment/account)
- Conversion tracking
- FUSE brand purple theming
- Patient data capture (name, email, phone)
- Multi-step form progression
- Form selector for multiple forms
- Access permission gating

## Documentation for Users

### How to Use Form Analytics

1. **Access Analytics**
   - Click "Analytics" in the sidebar
   - Ensure you have analytics permissions

2. **Select a Form**
   - Use dropdown to choose form (if multiple)
   - View updates automatically

3. **Read Metrics**
   - Top cards show overall performance
   - Chart shows trends over time
   - Table shows individual visitors

4. **Explore Visitor Details**
   - Click any row to expand
   - See phone, progress, session info
   - Identify drop-off points

5. **Identify Issues**
   - Low completion rates: Form too long?
   - High drop-offs at payment: Price issue?
   - Short durations: Form confusing?

6. **Take Action**
   - Simplify forms with low completion
   - Follow up with incomplete visitors
   - A/B test form variations
   - Optimize conversion funnel

## Support

### Common Questions

**Q: Why don't I see Analytics?**
A: Analytics requires an active subscription with analytics access enabled.

**Q: How long until data appears?**
A: Data appears immediately after first form view.

**Q: Can I export this data?**
A: Export feature coming soon.

**Q: What counts as a "view"?**
A: Any time a form is loaded and displayed.

**Q: What is "completion"?**
A: Percentage of form steps completed (0-100%).

**Q: How is duration calculated?**
A: Time from form open to last interaction or close.

**Q: Can I see historical data?**
A: Yes, all session data is retained according to data retention policy.

**Q: Why are some rows missing phone numbers?**
A: Phone is optional on forms, may not be captured.
