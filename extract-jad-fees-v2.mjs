import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let serviceAccountKey;
try {
  serviceAccountKey = JSON.parse(raw);
} catch {
  serviceAccountKey = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
}
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const proposals = [
  { id: '1WzZixBGCq_WJEgwGcUh5SJmBz-ToFvjy', name: 'JAD_3260885_PRO-ENG_250902_SAFEER_V00.pdf', consultant: 'SAFEER' },
  { id: '1syUa-0_lfzzaTMA4CjFzEOiEW6B-ZdjY', name: 'JAD_3260885_PRO-ENG_260209_REALISTIC_V00.pdf', consultant: 'REALISTIC' },
  { id: '1AORBEofkHmQco9x60mTXwGOXqJqq8-OG', name: 'JAD_3260885_PRO-ENG_260209_OSUS_V00.pdf', consultant: 'OSUS' },
  { id: '1Ca6KsRrdl2qzyZAHaodlfjqpFECfbqMJ', name: 'JAD_3260885_PRO-ENG_260212_DATUM_V00.pdf', consultant: 'DATUM' },
  { id: '14AbR1h6XVGopEcyxGiGXpVFlnsECMohT', name: 'JAD_3260885_PRO-ENG_260213_ARTEC_V00.pdf', consultant: 'ARTEC' },
  { id: '1d-JvFasCjZJAhEc9Rq9zhD2m3fZtf8de', name: 'JAD_3260885_PRO-ENG_260218_XYZ_V00.pdf', consultant: 'XYZ' },
];

async function downloadFile(fileId, destPath) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  fs.writeFileSync(destPath, Buffer.from(res.data));
}

async function extractFeesWithLLM(pdfPath, consultant) {
  const { execSync } = await import('child_process');
  
  // Check if already uploaded
  const uploadResult = execSync(`manus-upload-file "${pdfPath}"`, { encoding: 'utf-8' }).trim();
  const urlMatch = uploadResult.match(/https:\/\/[^\s]+/);
  const pdfUrl = urlMatch ? urlMatch[0] : null;
  if (!pdfUrl) { console.error(`  Upload failed for ${pdfPath}`); return null; }
  console.log(`  Uploaded: ${pdfUrl}`);

  const body = JSON.stringify({
    messages: [
      {
        role: 'system',
        content: `You are an expert at reading engineering consultancy proposals in the UAE/Dubai market.

Your task is to extract the fee structure from the proposal. Consultants specify their fees in TWO categories:
1. **Design fees** (أتعاب التصميم) - for architectural, structural, MEP design work
2. **Supervision fees** (أتعاب الإشراف) - for construction supervision

For EACH category, the consultant may specify fees as:
- **Percentage (pct)**: A percentage of the construction cost or project value (e.g., "3% of construction cost", "5% of project value")
- **Lump sum (lump)**: A fixed amount in AED/DHS (e.g., "500,000 AED")

IMPORTANT RULES:
- If the consultant gives a percentage, report it as percentage type with the percentage number (e.g., 3 for 3%)
- If the consultant gives a lump sum, report it as lump type with the amount in AED
- Some consultants give a TOTAL fee that includes both design and supervision - in that case, try to find the breakdown. If no breakdown exists, put the total under design and mark supervision as null.
- Some consultants give fees as percentage of construction cost, others as percentage of project value - note which one in the notes field.
- If a consultant provides BOTH a percentage AND a calculated lump sum amount, the PRIMARY type is percentage (the lump sum is just the calculated result).
- Read the ENTIRE document carefully. Fee tables are often at the end or in appendices.

Return ONLY a JSON object.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract the fee structure from this engineering proposal from ${consultant}. Identify separately: design fees and supervision fees. For each, determine if it's a percentage or lump sum. Return ONLY JSON.`
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
        name: 'fee_structure',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            designFeeType: { type: 'string', enum: ['pct', 'lump'], description: 'Is design fee a percentage or lump sum?' },
            designFeeValue: { type: 'number', description: 'Design fee value: percentage number (e.g. 3 for 3%) or lump sum amount in AED' },
            designFeeNotes: { type: 'string', description: 'Notes about design fee (e.g. percentage of what? any conditions?)' },
            supervisionFeeType: { type: ['string', 'null'], enum: ['pct', 'lump', null], description: 'Is supervision fee a percentage or lump sum? null if not specified separately' },
            supervisionFeeValue: { type: ['number', 'null'], description: 'Supervision fee value, null if not specified separately' },
            supervisionFeeNotes: { type: ['string', 'null'], description: 'Notes about supervision fee' },
            totalFeeIfStated: { type: ['number', 'null'], description: 'Total fee if explicitly stated as a single number in the proposal' },
            currency: { type: 'string', description: 'Currency (AED or DHS)' },
            includesVAT: { type: 'boolean', description: 'Whether stated fees include VAT' },
            scope: { type: 'string', description: 'Brief scope of work (max 150 chars)' },
            projectDescription: { type: 'string', description: 'Project description mentioned in the proposal (building type, floors, plot number)' },
          },
          required: ['designFeeType', 'designFeeValue', 'designFeeNotes', 'supervisionFeeType', 'supervisionFeeValue', 'supervisionFeeNotes', 'totalFeeIfStated', 'currency', 'includesVAT', 'scope', 'projectDescription'],
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
      console.error(`  Parse error for ${consultant}:`, data.choices[0].message.content.slice(0, 200));
      return null;
    }
  }
  console.error(`  LLM error:`, JSON.stringify(data).slice(0, 200));
  return null;
}

async function main() {
  const results = [];
  const downloadDir = '/tmp/jad-proposals';
  fs.mkdirSync(downloadDir, { recursive: true });

  for (const proposal of proposals) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${proposal.consultant} - ${proposal.name}`);
    console.log('='.repeat(60));
    
    const pdfPath = `${downloadDir}/${proposal.name}`;
    if (!fs.existsSync(pdfPath)) {
      console.log(`  Downloading...`);
      await downloadFile(proposal.id, pdfPath);
    }
    console.log(`  File: ${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB`);
    
    console.log(`  Extracting with LLM...`);
    const fees = await extractFeesWithLLM(pdfPath, proposal.consultant);
    
    if (fees) {
      results.push({ consultant: proposal.consultant, fileName: proposal.name, ...fees });
      
      const dType = fees.designFeeType === 'pct' ? `${fees.designFeeValue}%` : `${fees.designFeeValue?.toLocaleString()} AED`;
      const sType = fees.supervisionFeeType === 'pct' ? `${fees.supervisionFeeValue}%` : 
                    fees.supervisionFeeType === 'lump' ? `${fees.supervisionFeeValue?.toLocaleString()} AED` : 'N/A';
      
      console.log(`  ✅ Design: ${dType} (${fees.designFeeType}) - ${fees.designFeeNotes}`);
      console.log(`  ✅ Supervision: ${sType} (${fees.supervisionFeeType || 'N/A'}) - ${fees.supervisionFeeNotes || 'N/A'}`);
      console.log(`  📋 Project: ${fees.projectDescription}`);
      console.log(`  📋 Scope: ${fees.scope}`);
      if (fees.totalFeeIfStated) console.log(`  💰 Total stated: ${fees.totalFeeIfStated.toLocaleString()} ${fees.currency}`);
      console.log(`  VAT: ${fees.includesVAT ? 'Included' : 'Excluded'}`);
    } else {
      results.push({ consultant: proposal.consultant, fileName: proposal.name, error: 'Failed' });
      console.log(`  ❌ Failed`);
    }
  }

  // Summary table
  console.log('\n\n' + '='.repeat(80));
  console.log('CORRECTED SUMMARY: JAD_3260885 Engineering Proposals');
  console.log('='.repeat(80) + '\n');
  
  console.log('| Consultant | Design Type | Design Value | Supervision Type | Supervision Value | VAT | Project |');
  console.log('|------------|-------------|--------------|------------------|-------------------|-----|---------|');
  
  for (const r of results) {
    if (r.error) {
      console.log(`| ${r.consultant} | ERROR | - | - | - | - | - |`);
    } else {
      const dVal = r.designFeeType === 'pct' ? `${r.designFeeValue}%` : `${r.designFeeValue?.toLocaleString()} AED`;
      const sVal = r.supervisionFeeType === 'pct' ? `${r.supervisionFeeValue}%` : 
                   r.supervisionFeeType === 'lump' ? `${r.supervisionFeeValue?.toLocaleString()} AED` : 'N/A';
      console.log(`| ${r.consultant} | ${r.designFeeType} | ${dVal} | ${r.supervisionFeeType || 'N/A'} | ${sVal} | ${r.includesVAT ? 'Incl.' : 'Excl.'} | ${r.projectDescription?.slice(0, 40)} |`);
    }
  }

  fs.writeFileSync('/tmp/jad-fees-v2.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /tmp/jad-fees-v2.json');
}

main().catch(console.error);
