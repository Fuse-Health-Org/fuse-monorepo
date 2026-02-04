# FUSE Health Brand Colors Reference

## Admin Portal Colors (localhost:3002)

### Primary Purple (Softer Lavender)
- **HSL**: `hsl(270, 80%, 65%)`
- **Approximate Hex**: `#b47cf7` / `#a855f7`
- **Usage**: Primary brand color, buttons, links, active states, chart lines
- **Gradient**: `linear-gradient(135deg, hsl(270, 80%, 65%) 0%, hsl(280, 75%, 72%) 100%)`
- **Note**: This is a softer, more pastel purple chosen for the admin portal aesthetics

### FUSE Brand Purple (Official - for patient portal)
- **Hex**: `#b11fff`
- **HSL**: `hsl(290, 100%, 53%)`
- **Usage**: Patient-facing applications and official FUSE branding
- **Gradient**: `linear-gradient(135deg, #b11fff 0%, #d966ff 100%)`

### Secondary Orange
- **Hex**: `#ff751f`
- **HSL**: `hsl(24, 100%, 56%)`
- **Usage**: Accent color, warnings, special highlights, alternative CTAs
- **Gradient**: `linear-gradient(135deg, #ff751f 0%, #ff9554 100%)`

## Implementation in Code

### CSS Variables (globals.css)
```css
--primary: 290 100% 53%;           /* #b11fff */
--accent-orange: 24 100% 56%;      /* #ff751f */
```

### Direct Usage
```tsx
// Inline styles
style={{ background: 'linear-gradient(135deg, #b11fff 0%, #d966ff 100%)' }}

// Tailwind utility classes
className="bg-fuse-purple"         // Purple gradient
className="bg-fuse-orange"         // Orange gradient
className="text-fuse-purple"       // Purple text
className="text-fuse-orange"       // Orange text
```

### Chart Colors
```tsx
// Recharts/Chart libraries
stroke="#b11fff"
fill="url(#colorRevenue)"  // Where colorRevenue uses #b11fff gradient
```

## Color Usage Guidelines

### Purple (#b11fff)
✅ **Use for:**
- Primary buttons and CTAs
- Active navigation states
- Links
- Charts and data visualization
- Focus states
- Progress indicators
- Brand icons and logos

### Orange (#ff751f)
✅ **Use for:**
- Warning states (e.g., "Needs attention" badges)
- Alternative CTAs
- Complementary accents
- Special promotions or highlights
- Charts (as secondary color)

### Status Colors (System)
- **Success/Captured**: Green `#10b981` 
- **Warning/On Hold**: Amber `#f59e0b`
- **Error/Failed**: Red `#ef4444`
- **Info/Processing**: Blue `#3b82f6`
- **Neutral/Pending**: Gray `#6b7280`

## Typography Colors
- **Primary Text**: `hsl(0, 0%, 10%)` - Very dark gray
- **Secondary Text**: `hsl(0, 0%, 50%)` - Medium gray
- **Muted Text**: `hsl(0, 0%, 50%)` with opacity

## Background Colors
- **Page Background**: `hsl(0, 0%, 97%)` - Very light gray
- **Card Background**: `hsl(0, 0%, 100%)` - Pure white
- **Sidebar Background**: `hsl(0, 0%, 99%)` - Near white
- **Hover States**: `hsl(290, 70%, 98%)` - Very light purple

## Border Colors
- **Default Border**: `hsl(0, 0%, 92%)` - Light gray
- **Input Border**: `hsl(0, 0%, 92%)` with 60% opacity
- **Hover Border**: Slightly darker

## Examples in UI

### Metric Cards
- Background: White
- Text: Dark gray
- Status indicators: System colors (green, amber, red)

### Analytics Chart
- Line/Area: Brand purple (#b11fff)
- Gradient fill: Purple gradient
- Grid: Light gray

### Sidebar
- Background: Near white
- Logo/Icons: Purple gradient
- Active state: Light purple background
- Text: Dark gray, purple when active

### Recent Orders
- Card background: White
- Hover: Very light purple
- Payment badges: System colors
- Links: Brand purple

### Buttons
- Primary: Purple gradient
- Secondary: Orange gradient (optional)
- Outline: White with purple border
- Ghost: Transparent with purple hover

## Accessibility Notes
- All text meets WCAG AA contrast standards
- Purple (#b11fff) on white: 4.5:1 contrast ratio (AA)
- Orange (#ff751f) on white: 3.8:1 contrast ratio (Use for large text only)
- Always test color combinations for accessibility
