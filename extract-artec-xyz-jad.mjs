import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// Files already downloaded
const files = [
  { path: '/tmp/jad-proposals/JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf', consultant: 'ARTEC' },
  { path: '/tmp/jad-proposals/JAD_3260885_PRO-ENG_260218_XYZ_V00.pdf', consultant: 'XYZ' },
];

async function extractFeesForPlot(pdfPath, consultant) {
  const { execSync } = await import('child_process');
  const uploadResult = execSync(`manus-upload-file "${pdfPath}"`, { encoding: 'utf-8' }).trim();
  const urlMatch = uploadResult.match(/https:\/\/[^\s]+/);
  const pdfUrl = urlMatch ? urlMatch[0] : null;
  if (!pdfUrl) { console.error(`Upload failed`); return null; }
  console.log(`  Uploaded: ${pdfUrl}`);

  const body = JSON.stringify({
    messages: [
      {
        role: 'system',
        content: `You are an expert at reading engineering consultancy proposals in the UAE/Dubai market.

This proposal contains fees for MULTIPLE projects/plots. Your task is to extract the fee structure SPECIFICALLY for Plot 3260885 (Al Jadaf / الجداف).

The consultant may have listed several plots with different fees for each. Find the section that mentions Plot 3260885 or Al Jadaf and extract ONLY those fees.

For the fees, determine:
1. **Design fees**: percentage or lump sum? What value?
2. **Supervision fees**: percentage or lump sum? What value?

Also list ALL other projects/plots mentioned in the proposal with their fees so we can use them later.

Return ONLY a JSON object.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a multi-project proposal from ${consultant}. Extract the fees SPECIFICALLY for Plot 3260885 (Al Jadaf). Also list all other projects mentioned with their fees. Return ONLY JSON.`
          },
          {
            type: 'file_url',
            file_url: { url: pdfUrl, mime_type: 'application/pdf' }
          }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'multi_project_fees',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            jadafFees: {
              type: 'object',
              description: 'Fees specifically for Plot 3260885 (Al Jadaf)',
              properties: {
                found: { type: 'boolean', description: 'Was Plot 3260885 / Al Jadaf found in this proposal?' },
                designFeeType: { type: ['string', 'null'], description: 'pct or lump' },
                designFeeValue: { type: ['number', 'null'], description: 'Design fee value' },
                designFeeNotes: { type: ['string', 'null'], description: 'Notes about design fee' },
                supervisionFeeType: { type: ['string', 'null'], description: 'pct or lump' },
                supervisionFeeValue: { type: ['number', 'null'], description: 'Supervision fee value' },
                supervisionFeeNotes: { type: ['string', 'null'], description: 'Notes about supervision fee' },
                projectDescription: { type: ['string', 'null'], description: 'Building description for this plot' },
              },
              required: ['found', 'designFeeType', 'designFeeValue', 'designFeeNotes', 'supervisionFeeType', 'supervisionFeeValue', 'supervisionFeeNotes', 'projectDescription'],
              additionalProperties: false,
            },
            allProjects: {
              type: 'array',
              description: 'All projects/plots mentioned in this proposal',
              items: {
                type: 'object',
                properties: {
                  plotNumber: { type: 'string', description: 'Plot number' },
                  location: { type: 'string', description: 'Location name' },
                  buildingDescription: { type: 'string', description: 'Building type and floors' },
                  designFeeType: { type: 'string', description: 'pct or lump' },
                  designFeeValue: { type: 'number', description: 'Fee value' },
                  supervisionFeeType: { type: ['string', 'null'], description: 'pct or lump' },
                  supervisionFeeValue: { type: ['number', 'null'], description: 'Fee value' },
                },
                required: ['plotNumber', 'location', 'buildingDescription', 'designFeeType', 'designFeeValue', 'supervisionFeeType', 'supervisionFeeValue'],
                additionalProperties: false,
              }
            },
            currency: { type: 'string', description: 'Currency' },
            includesVAT: { type: 'boolean', description: 'Whether fees include VAT' },
            discountNote: { type: ['string', 'null'], description: 'Any discount for awarding multiple projects' },
          },
          required: ['jadafFees', 'allProjects', 'currency', 'includesVAT', 'discountNote'],
          additionalProperties: false,
        }
      }
    }
  });

  const response = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_KEY}`,
    },
    body,
  });

  const data = await response.json();
  if (data.choices?.[0]?.message?.content) {
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error(`Parse error:`, data.choices[0].message.content.slice(0, 300));
      return null;
    }
  }
  console.error(`LLM error:`, JSON.stringify(data).slice(0, 300));
  return null;
}

async function main() {
  for (const file of files) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${file.consultant} - Multi-Project Fee Extraction`);
    console.log('='.repeat(70));
    
    const result = await extractFeesForPlot(file.path, file.consultant);
    
    if (result) {
      console.log(`\n--- Al Jadaf (Plot 3260885) Fees ---`);
      if (result.jadafFees.found) {
        const jf = result.jadafFees;
        const dVal = jf.designFeeType === 'pct' ? `${jf.designFeeValue}%` : `${jf.designFeeValue?.toLocaleString()} AED`;
        const sVal = jf.supervisionFeeType === 'pct' ? `${jf.supervisionFeeValue}%` : 
                     jf.supervisionFeeType === 'lump' ? `${jf.supervisionFeeValue?.toLocaleString()} AED` : 'N/A';
        console.log(`  Design: ${dVal} (${jf.designFeeType}) - ${jf.designFeeNotes}`);
        console.log(`  Supervision: ${sVal} (${jf.supervisionFeeType}) - ${jf.supervisionFeeNotes}`);
        console.log(`  Building: ${jf.projectDescription}`);
      } else {
        console.log(`  ⚠️ Plot 3260885 NOT FOUND in this proposal!`);
      }
      
      console.log(`\n--- All Projects in this Proposal ---`);
      for (const p of result.allProjects) {
        const dVal = p.designFeeType === 'pct' ? `${p.designFeeValue}%` : `${p.designFeeValue?.toLocaleString()} AED`;
        const sVal = p.supervisionFeeType === 'pct' ? `${p.supervisionFeeValue}%` : 
                     p.supervisionFeeType === 'lump' ? `${p.supervisionFeeValue?.toLocaleString()} AED` : 'N/A';
        console.log(`  Plot ${p.plotNumber} (${p.location}): ${p.buildingDescription}`);
        console.log(`    Design: ${dVal} | Supervision: ${sVal}`);
      }
      
      console.log(`\n  Currency: ${result.currency} | VAT: ${result.includesVAT ? 'Included' : 'Excluded'}`);
      if (result.discountNote) console.log(`  Discount: ${result.discountNote}`);
      
      // Save individual result
      fs.writeFileSync(`/tmp/jad-${file.consultant.toLowerCase()}-multiproject.json`, JSON.stringify(result, null, 2));
    } else {
      console.log(`  ❌ Failed to extract`);
    }
  }
}

main().catch(console.error);
