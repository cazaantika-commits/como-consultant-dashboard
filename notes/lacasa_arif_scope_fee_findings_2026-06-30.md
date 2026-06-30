# Proposal Findings for Shopping Center True-Cost Setup

## LACASA — MAJ_6457956_PRO-ENG_260206_LACASA_V00.pdf

### Confirmed project identity
- Project: Construction of Proposed Shopping Center on Plot No. 6457956 at Wadi Al Safa 3 (Majan), Dubai, U.A.E.
- Proposal type: Design Services Only.
- Source: PDF pages 1, 4, 15.

### Confirmed design fee
- The proposal states: "The total fees for the Design Services shall be AED 9,384,500.00."
- Source: Section 5 – Fees and Remuneration, PDF page 15 (text extraction around page 15 of 43).

### Scope items clearly included by LACASA
- Architectural Design
- Civil / Structural Engineering
- MEP Engineering
- Passive security / CCTV access control
- Passive telecom / IT / data networks
- AV and ELV Design
- Interior design for main entrance lobby, corridors and public spaces only
- SIRA / security consultant for CCTV design and authority approval
- Quantity Survey / Cost Management
- Fire Protection & Life Safety
- Façade Engineering
- Façade Lighting
- Façade Maintenance System
- Signage & Wayfinding
- Waste Management
- Vertical Transportation
- Parking Strategy
- Landscape / Irrigation / Horticulture
- Water features and swimming pools
- Infrastructure & Utilities within plot boundary
- Traffic Impact Study
- Source: PDF pages 6–10.

### Scope items clearly excluded by LACASA
- Acoustics Consultancy
- Independent structural auditing / 3rd Party Structural Audit
- Wind Tunnel Study
- Energy / sustainability / environmental design specialists for LEED certification
- Source: PDF pages 6–7.

## Arif & Bintoak — Mall_Arif&Bintoak.pdf

### Confirmed overall fee structure
- Design subtotal: AED 11,775,000
- Construction supervision subtotal: AED 12,102,000
- Total fee: AED 23,877,000 excluding VAT
- Source: fee summary table, visual page 4 of 16.

### Specialist-consultant prices clearly broken out in the design fee schedule
- Landscape and Water features: AED 750,000
- Fire, Life Safety: AED 200,000
- CFD Modelling (for Atriums & Car Parking): AED 200,000
- Telecom, ICT, AV, IT: AED 300,000
- Specialist Lighting: AED 250,000
- Third-party structural peer review: AED 150,000
- Vertical Transport: AED 250,000
- Acoustics: AED 150,000
- Facade, BMU Access & Maintenance Specialist: AED 750,000
- Traffic Impact Study: AED 675,000
- Safety and Security: AED 200,000
- Waste Management: AED 150,000
- Signage & Wayfinding: AED 250,000
- Parking & Vehicular Circulation Review: AED 75,000
- Source: detailed fee matrix, visual page 5 of 16.

### Items marked as exclusions in Arif & Bintoak schedule
- Cost Management & Quantity Surveying Services
- Physical Model
- Lease Outline Drawings (LODs) and Tenant Manuals
- Sales & Marketing Material
- Environmental Impact Assessment
- Topographic Survey
- Geotechnical Survey and Report
- Third-Party Area Measurement & Surveyor
- PI Insurance (Project Specific, if required)
- Marine Engineering Services
- Aeronautical Survey Services
- Wind Tunnel Services
- Stack Effect & Pressurisation Studies
- Source: detailed fee matrix, visual page 5 of 16.

## Immediate implication for system logic
- The system can seed Shopping Center scope reference costs from clearly priced specialist items in Arif & Bintoak’s proposal where those prices are explicit.
- LACASA’s adjusted design fee should later be computed as:
  - quoted design fee (AED 9,384,500)
  - plus reference prices for excluded or missing cost-bearing scope items, especially Acoustics, 3rd Party Structural Audit, Wind Tunnel, LEED / sustainability where applicable.
- Shopping Center category currently has no entries yet in `cpa_scope_reference_costs`, so those prices must be inserted before adjusted-fee calculations can work.

## Source files
- /home/ubuntu/upload/MAJ_6457956_PRO-ENG_260206_LACASA_V00.pdf
- /home/ubuntu/upload/Mall_Arif&Bintoak.pdf
