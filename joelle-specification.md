# JOELLE – FULL MARKET INTELLIGENCE ENGINE
## Complete Specification Document

### System Overview
Joelle is an AI Market Intelligence Agent responsible for:
- Collecting market data from multiple sources
- Analyzing real estate market conditions in Dubai
- Producing development recommendations
- Generating 7 professional reports
- Self-learning from project outcomes

### 12 Core Engines

#### Engine 1: Data Acquisition Layer
Collects data from 8 source categories with defined weights:

| Source | Weight | Data Extracted |
|--------|--------|---------------|
| DXB Interact (Transaction Data) | 35% | transaction price, price/sqft, unit size, transaction date, building name, developer |
| Property Monitor | 20% | price trends, transaction stats, pipeline supply, district performance |
| DataFinder | 20% | sales data, rental data, project-level performance |
| DLD Open Data | 10% | official transaction records |
| Property Finder | 10% | asking price, unit size, project name, building status |
| Bayut/Dubizzle | 5% | listing prices, unit sizes, project names |
| Market Reports (CBRE/JLL/Knight Frank/Savills) | 5% | macro trends, investor behaviour, market sentiment |
| Google Maps/Places + Demographics | Variable | schools, hospitals, malls, metro, parks, population, income |

#### Engine 2: Data Cleaning Layer
- Remove duplicate records
- Standardize unit sizes and price/sqft
- Remove outliers (beyond 2 standard deviations)

#### Engine 3: Market Structure Analysis
- Transaction volume (total transactions/year in district)
- Price distribution (price/sqft range)
- Unit demand distribution (Studio %, 1BR %, 2BR %, 3BR %)

#### Engine 4: Competitive Landscape Engine
Identify projects within 1km, 2km, 3km radius. For each:
- Developer, Units, Unit mix, Unit sizes, Prices, Payment plans, Sales speed

#### Engine 5: Demand Forecast Engine
- Annual market demand (e.g., 1200 units/year)
- Market share scenarios: Conservative 5%, Base 8%, Optimistic 12%
- Monthly sales velocity
- Project sell-out duration

#### Engine 6: Product Strategy Engine
- Unit mix percentages
- Average unit sizes
- Project positioning (Affordable/Mid-market/Upper-mid/Luxury)

#### Engine 7: Pricing Intelligence Engine
Price bands per unit type with 3 scenarios:
- Conservative, Base, Optimistic
Using weighted average from multiple sources

#### Engine 8: Absorption Engine
- Units sold per year = Market share × Area demand
- Monthly sales velocity

#### Engine 9: Risk Intelligence Engine
5 risk categories:
1. Supply Pipeline Risk (detect oversupply)
2. Pricing Sensitivity Risk (avoid unrealistic pricing)
3. Demand Volatility Risk (market stability)
4. Competitive Saturation Risk (oversupplied segments)
5. Developer Positioning Risk (competing with stronger developers)

Risk levels: Low, Moderate, Elevated, High → Project Market Risk Index

#### Engine 10: Data Reconciliation Engine
Weighted average calculation across sources:
- DXB Interact → 30%
- Property Monitor → 20%
- DataFinder → 20%
- Property Finder → 10%
- Bayut → 10%
- Market Reports → 10%

#### Engine 11: Output Generation
Auto-populate platform fields:
- unit mix percentages
- average unit sizes
- retail mix
- project positioning
- price per sqft scenarios
- payment plan strategy
- absorption rate
- sales timeline

#### Engine 12: Report Generation
7 reports:
1. Market Intelligence Report
2. Competitive Analysis Report
3. Product Strategy Report
4. Pricing Strategy Report
5. Demand Forecast Report
6. Risk Analysis Report
7. Executive Board Summary

### Self-Learning Intelligence System
1. Historical Project Database (store all analyzed outcomes)
2. Forecast vs Reality Comparison (predicted vs actual)
3. Model Adjustment Logic (update assumptions from deviations)
4. Market Cycle Tracking (expansion/stabilization/contraction/recovery)
5. Developer Performance Database
6. Product Performance Learning
7. Pricing Accuracy Calibration
8. Continuous Market Intelligence Updates (transactions monthly, listings weekly, reports quarterly)
9. Intelligence Feedback Loop

### Data Access Protocol
| Source | Access Method | Update Frequency |
|--------|-------------|-----------------|
| DXB Interact | Subscription + structured export | Monthly |
| Property Monitor | API subscription | Monthly |
| DataFinder | API subscription or data export | Monthly |
| Property Finder | Web scraping agent | Weekly |
| Bayut | Web scraping agent | Weekly |
| Dubizzle | Web scraping agent | Weekly |
| CBRE/JLL/Knight Frank/Savills | Manual upload to Knowledge Base | Quarterly |
| Google Maps/Places | Google Places API | On-demand |
| Dubai Pulse/Statistics | Dataset ingestion | Annual |
| RERA | Project database access | Quarterly |

### Source Weighting for Price Reconciliation
When multiple sources provide different prices, calculate weighted average:
```
Weighted Price = (DXB_price × 0.30) + (PM_price × 0.20) + (DF_price × 0.20) + (PF_price × 0.10) + (Bayut_price × 0.10) + (Reports_price × 0.10)
```
