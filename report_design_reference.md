# Report Design Reference — User's Preferred Style

## Source: Capital Portfolio Export Report (تصدير محفظة رأس المال)

### Design Elements:
1. **Header**: Dark navy (#0f172a) with white text, Cairo font 800 weight, subtitle in #94a3b8
2. **Summary Section**: Light bg (#f8fafc) with 2px solid #0f172a border, grid of cards
3. **Summary Cards**: White bg, colored left-border (3px), small label (8px #64748b), value (12px bold #0f172a), sub-text (7px #94a3b8)
4. **Color coding for borders**:
   - Orange (#f97316) = Total cost
   - Green (#10b981) = Capital
   - Blue (#0ea5e9) = Paid
   - Red (#ef4444) = Remaining
   - Purple (#a855f7) = Construction phase
5. **Table**: 
   - Header: #0f172a bg, white text, 9px font, nowrap
   - Cells: 9px, centered, border #cbd5e1
   - Even rows: #f8fafc
   - Total row: #1e293b bg, white text, bold
6. **Phase color coding in cells**:
   - Design phase: bg #fff3e0, border-right 3px #fb923c (orange)
   - Registration/Offplan: bg #fce4ec, border-right 3px #db2777 (pink)
   - Construction: bg #ede7f6, border-right 3px #7c3aed (purple)
   - Empty: "—" in #cbd5e1
7. **Legend**: Flex row with colored dots + labels
8. **Footer**: Center, 9px, #94a3b8, "Como Developments · سري · للاستخدام الداخلي فقط"
9. **Action buttons**: Fixed top-left, dark bg, rounded, shadow
10. **Page size**: A3 landscape for tables, A4 portrait for summaries
11. **Font**: Cairo (Google Fonts), weights 400/600/700/800
12. **Print-ready**: @media print hides buttons

### Key Principles:
- Professional, clean, minimal
- Color-coded phases for quick scanning
- Dark header with COMO branding
- Summary stats at top before detailed table
- RTL direction throughout
- Tabular numbers (font-feature-settings:"tnum")
- No excessive decoration — data-first approach
