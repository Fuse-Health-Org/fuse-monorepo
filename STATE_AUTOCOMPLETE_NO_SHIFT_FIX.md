# State Autocomplete - No Loading Shift Fix

## Issue

Every time the dropdown opened, there was a small visual shift/jump - almost like a loading movement. This made the UX feel janky.

## Root Cause

HeroUI's Autocomplete was applying:
1. Default fade/slide animations on popover open
2. Dynamic position calculations (flipping)
3. Transition effects on the dropdown container

These caused a visible shift as the dropdown rendered and positioned itself.

## Solution

### 1. Disabled Popover Transitions
```css
/* Prevent layout shift on dropdown open */
[data-slot="popover"] {
  transition: none !important;
  animation: none !important;
}
```

### 2. Instant Motion (No Animation)
```typescript
popoverProps={{
  offset: 8,
  placement: "bottom",
  shouldFlip: false,
  motionProps: {
    variants: {
      enter: { opacity: 1, y: 0, transition: { duration: 0 } },
      exit: { opacity: 0, y: 0, transition: { duration: 0 } }
    }
  }
}}
```

**Key settings:**
- `duration: 0` - Instant appearance, no fade-in animation
- `shouldFlip: false` - No dynamic repositioning
- `placement: "bottom"` - Fixed placement direction
- `offset: 8` - Consistent spacing from input

## Result

✅ Dropdown appears instantly with no shift
✅ No loading movement or jump
✅ Smooth, stable UX every time
✅ Perfect positioning on every open

## Files Modified

- `/patient-frontend/components/QuestionnaireModal/components/USStateAutocomplete.tsx`
  - Added CSS to disable popover transitions/animations
  - Added `popoverProps` with instant motion configuration
  - Set fixed placement and offset

---

**Status**: Dropdown is now perfectly stable with no visual shift! 🎉
