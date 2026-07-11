# Research Summary: Unit Types & Pricing for Como Projects

## Key Decision: NO STUDIOS (user preference)

## Project Structure (from DB):
- Project 1: مركز مجان التجاري (G+4) — Commercial only (retail)
- Project 2: مجان متعدد الاستخدامات (G+4P+25) — Mixed use (residential + retail + office)
- Project 3: مبنى الجداف السكني (G+7) — Residential
- Project 4: ند الشبا — قطعة 1 (6185392) — Residential
- Project 5: ند الشبا — قطعة 2 المدمجة (6182776) — Mixed
- Project 6: ند الشبا — قطعة 3 الفلل (6180578) — Villas

## DB Schema Key Columns:
- projects table: gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft, saleableResidentialPct (95%), saleableRetailPct (97%), saleableOfficesPct (95%)
- marketOverview table: residentialStudioPct/AvgArea/Count, residential1brPct/AvgArea/Count, residential2brPct/AvgArea/Count, residential3brPct/AvgArea/Count, retailSmall/Medium/Large Pct/AvgArea/Count, officeSmall/Medium/Large Pct/AvgArea/Count
- competition_pricing table: baseStudioPrice, base1brPrice, base2brPrice, base3brPrice, baseRetailSmallPrice, baseRetailMediumPrice, baseRetailLargePrice, baseOfficeSmallPrice, baseOfficeMediumPrice, baseOfficeLargePrice

## Current Project 2 (Majan G+4P+25) Market Overview:
- Studio: 8.12%, 380 sqft, 19 units
- 1BR: 24.85%, 650 sqft, 34 units
- 2BR: 29.90%, 950 sqft, 28 units (absorbs surplus)
- 3BR: 13.15%, 1300 sqft, 9 units
- Retail Small: 21.69%, 1000 sqft, 13 units
- Retail Medium: 40.05%, 3000 sqft, 8 units
- Retail Large: 37.55%, 7500 sqft, 3 units
- Office Small: 39.38%, 1000 sqft, 105 units
- Office Medium: 39.38%, 2500 sqft, 42 units
- Office Large: 18.75%, 5000 sqft, 10 units

## Current Pricing (competition_pricing):
- P2 Majan: Studio 1800, 1BR 1700, 2BR 1600, 3BR 1550, Retail/Office not set (shows as 0 or missing)
- P3 Jaddaf: Studio 1520, 1BR 1470, 2BR 1420, 3BR 1370
- P4 Nad Sheba 1: Studio 1250, 1BR 1250, 2BR 1250, 3BR 1200
- P5 Nad Sheba 2: Studio 1682, 1BR 1682, 2BR 1682, 3BR 1765, Retail 1650
- P6 Nad Sheba 3: all 1250

## Market Research Findings:

### Majan/Arjan Area (Projects 1 & 2):
- Source: Bayut, DXB Analytics, Samana, Betterhomes
- Avg PSF Majan: 1,469 (DXB Analytics 2024-2025)
- Arjan by type (Bayut): Studio 1,718; 1BR 1,520; 2BR 1,452; 3BR 1,465
- Majan avg sale prices: Studio AED 700K; 1BR AED 950K; 2BR AED 1.45M; 3BR AED 1.72M
- Majan avg rent: Studio 42K; 1BR 60K; 2BR 85K; 3BR 96K
- ROI: 6% avg
- Demand: 1BR and 2BR most popular; families prefer 2BR-3BR; area is apartment-led
- Retail: Majan retail avg 2,588 (CRC report); growing demand as residential catchment grows
- Office: Dubai avg 1,725 (Engel & Volkers)

### Al Jaddaf (Project 3):
- Source: Bayut, Terra Firma, Property Finder
- Bayut Price Index June 2026: Studio 2,120; 1BR 1,828; 2BR 1,749; 3BR 2,016
- Area avg: 1,874/sqft (June 2026)
- Demand: 1BR most popular (Rank #1 in Binghatti Avenue), 2BR growing fast (+108% demand change)
- Profile: Young professionals, couples, small families
- Metro connected (Green Line) — adds value
- Off-plan range: 1,480-2,065/sqft depending on building

### Nad Al Sheba (Projects 4, 5, 6):
- Source: Bayut, Chainex, DLD transactions
- Avg PSF: 2,190-2,244/sqft (DLD 2025-2026) — mostly villas/townhouses
- Nad Al Sheba Gardens: luxury villas by Meraas, 3BR townhouse from AED 4.49M, 4BR villa from AED 10.89M
- Villa prices: 2,230 PSF (Chainex 2026)
- Property types: Primarily villas & townhouses (3-6 BR), some apartments in newer phases
- Apartment demand: Limited data — area is villa-dominated
- For apartments in Nad Al Sheba: estimated 1,600-1,800/sqft based on comparable areas

## RECOMMENDED UNIT MIX (No Studios):

### Project 2: مجان G+4P+25 (Mixed Use)
Residential:
- 1BR: 35% (was 24.85%), avg 700 sqft
- 2BR: 45% (was 29.90%), avg 1,000 sqft
- 3BR: 20% (was 13.15%), avg 1,400 sqft
Retail: Keep current distribution (small/medium/large)
Office: Keep current distribution

### Project 3: الجداف G+7 (Residential)
- 1BR: 40%, avg 700 sqft
- 2BR: 40%, avg 1,050 sqft
- 3BR: 20%, avg 1,400 sqft

### Project 4: ند الشبا قطعة 1 (Residential)
- 1BR: 30%, avg 750 sqft
- 2BR: 45%, avg 1,100 sqft
- 3BR: 25%, avg 1,500 sqft

### Project 5: ند الشبا قطعة 2 (Mixed)
- 1BR: 30%, avg 750 sqft
- 2BR: 45%, avg 1,100 sqft
- 3BR: 25%, avg 1,500 sqft
Retail: Keep current

### Project 6: ند الشبا قطعة 3 (Villas)
- 3BR Townhouse: 30%, avg 2,750 sqft
- 4BR Villa: 40%, avg 3,800 sqft
- 5BR Villa: 30%, avg 5,400 sqft
(Use 3BR field for townhouse, 2BR field for 4BR villa, 1BR field for 5BR villa — or discuss with user)

## RECOMMENDED PRICING (AED/sqft):

### Project 1: مجان التجاري
- Retail Small: 2,300
- Retail Medium: 2,100
- Retail Large: 1,900

### Project 2: مجان G+4P+25
- 1BR: 1,550
- 2BR: 1,450
- 3BR: 1,400
- Retail Small: 2,300
- Retail Medium: 2,100
- Retail Large: 1,900
- Office Small: 1,800
- Office Medium: 1,700
- Office Large: 1,500

### Project 3: الجداف
- 1BR: 1,828
- 2BR: 1,750
- 3BR: 1,650

### Project 4: ند الشبا قطعة 1
- 1BR: 1,700
- 2BR: 1,600
- 3BR: 1,500

### Project 5: ند الشبا قطعة 2
- 1BR: 1,750
- 2BR: 1,650
- 3BR: 1,550
- Retail Small: 2,200
- Retail Medium: 2,000
- Retail Large: 1,800

### Project 6: ند الشبا قطعة 3 (Villas)
- 3BR TH: 2,200
- 4BR Villa: 2,200
- 5BR Villa: 2,200
