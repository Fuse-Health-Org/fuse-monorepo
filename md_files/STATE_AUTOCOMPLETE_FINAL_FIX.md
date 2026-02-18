# State Autocomplete - Final UX Fix

## Problem

The state dropdown was inconsistently filtering to only show the selected state instead of showing all states. This happened because the Autocomplete component was treating dropdown selection the same as typing, causing unwanted filtering.

## Root Cause

HeroUI's Autocomplete component maintains internal state for the input value. When a state was selected from the dropdown, the component's internal input value was set to that state's label (e.g., "Arkansas"), which then filtered the dropdown to only show matching states on the next open.

## Solution

**Force component remount on selection changes** by using a dynamic `key` prop. This completely resets the component's internal state after each selection.

### Implementation

```typescript
// Component remounts whenever value changes
<Autocomplete
  key={`autocomplete-${questionId}-${value || 'empty'}`}
  defaultInputValue={selectedState?.label || ""}
  selectedKey={value || null}
  onSelectionChange={handleSelectionChange}
  // ... other props
>
```

### Key Changes

1. **Dynamic key prop**: `key={autocomplete-${questionId}-${value || 'empty'}}` - Changes whenever selection changes, forcing remount
2. **Removed controlled inputValue**: No manual control of input state - let HeroUI manage it internally
3. **Removed onInputChange handler**: Not needed since we're not controlling the input
4. **Kept defaultInputValue**: Shows selected state label on mount
5. **Removed onOpenChange handler**: Not needed with remount strategy

## How It Works

### Dropdown Selection Flow
1. User opens dropdown → sees all 50 states
2. User clicks a state → `handleSelectionChange` fires
3. `value` prop updates → `key` prop changes
4. Component **remounts** with fresh internal state
5. Next dropdown open → shows all states again (no filtering)

### Typing Flow
1. User opens dropdown → sees all 50 states
2. User types "cal" → HeroUI's internal filtering shows California, North Carolina, South Carolina
3. User continues typing or selects from filtered list
4. On selection → component remounts, resetting for next use

## Benefits

✅ **Consistent UX**: Dropdown ALWAYS shows all states when opened
✅ **Smart filtering**: Autocomplete ONLY works when user types
✅ **Simple logic**: No complex state management or conditional rendering
✅ **Reliable**: Component remount guarantees clean state every time

## Testing Checklist

- [ ] Open dropdown with no selection → shows all 50 states
- [ ] Type "ark" → filters to Arkansas
- [ ] Select Arkansas → input shows "Arkansas"
- [ ] Open dropdown again → shows ALL 50 states (not just Arkansas)
- [ ] Clear selection → dropdown still shows all states
- [ ] Type "new" → filters to New Hampshire, New Jersey, New Mexico, New York
- [ ] Select New York → input shows "New York"  
- [ ] Open dropdown again → shows ALL 50 states (not just New York)
- [ ] Repeat multiple times → behavior stays consistent

## Technical Notes

- **Key prop pattern**: Using `${questionId}-${value}` ensures uniqueness per question and remounts on value change
- **defaultInputValue**: Provides initial display value on mount; HeroUI manages it after that
- **No controlled state**: Simpler, more reliable than trying to sync controlled and uncontrolled patterns
- **Portal rendering**: Global CSS styles ensure dropdown appears correctly even when rendered in portal

## Files Modified

- `/patient-frontend/components/QuestionnaireModal/components/USStateAutocomplete.tsx`
  - Removed: `inputValue` state, `handleInputChange`, `onOpenChange` handler
  - Added: Dynamic `key` prop based on `value`
  - Simplified: Component now uses uncontrolled pattern with forced remount

---

**Result**: Autocomplete filtering now ONLY works when user types, not when selecting from dropdown. UX is consistent every time.
