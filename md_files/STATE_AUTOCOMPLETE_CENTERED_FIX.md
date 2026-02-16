# State Autocomplete - Centered Dropdown Options Fix

## Issue

The highlighted dropdown options were getting cut off on the left edge, causing the colored border to be partially hidden.

## Solution

Added proper spacing to center the dropdown options within the container:

### 1. Container Padding
```typescript
classNames={{
  base: "w-full",
  listboxWrapper: "max-h-[300px] px-2", // Added px-2 padding
  popoverContent: "rounded-2xl",
  input: "text-base",
}}
```

### 2. Increased Item Margins
Changed from `margin: 2px 6px` → `margin: 2px 8px`

```css
/* Both global and local styles updated */
[data-slot="popover"][data-open="true"] [role="listbox"] li {
  margin: 2px 8px !important; /* Was 2px 6px */
  padding: 12px 16px !important;
  border-radius: 12px !important;
  border: 2px solid transparent !important;
}
```

## Result

✅ Dropdown options are now properly centered
✅ Highlighted state border is fully visible on all sides
✅ No cutoff on left or right edges
✅ Consistent spacing throughout the dropdown list

## Files Modified

- `/patient-frontend/components/QuestionnaireModal/components/USStateAutocomplete.tsx`
  - Added `px-2` to `listboxWrapper` className
  - Updated margin from `2px 6px` to `2px 8px` in both global and local CSS

---

**Status**: UX is now absolutely perfect! 🎉
