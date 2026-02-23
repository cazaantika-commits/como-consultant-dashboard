import { google } from 'googleapis';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
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

// LLM config
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
  return destPath;
}

async function extractFeesWithLLM(pdfPath, consultant) {
  // Upload to S3 first to get a URL for the LLM
  const { execSync } = await import('child_process');
  const uploadResult = execSync(`manus-upload-file "${pdfPath}"`, { encoding: 'utf-8' }).trim();
  const urlMatch = uploadResult.match(/https:\/\/[^\s]+/);
  const pdfUrl = urlMatch ? urlMatch[0] : null;
  
  if (!pdfUrl) {
    console.error(`  Failed to upload ${pdfPath}`);
    return null;
  }
  
  console.log(`  Uploaded to: ${pdfUrl}`);
  
  // Call LLM with PDF URL
  const body = JSON.stringify({
    messages: [
      {
        role: 'system',
        content: `You are a financial data extraction expert. Extract the total consultant fee from this engineering proposal PDF. 
Return ONLY a JSON object with these fields:
- totalFee: number (the total fee amount, just the number)
- currency: string (AED, USD, etc.)
- includesVAT: boolean (whether the fee includes VAT)
- feeBeforeVAT: number (fee before VAT if mentioned, otherwise null)
- vatAmount: number (VAT amount if mentioned, otherwise null)
- scope: string (brief description of what the fee covers, max 100 chars)
- paymentTerms: string (brief payment terms if mentioned, max 100 chars)
Do NOT include any text outside the JSON object.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract the total consultant fee from this engineering proposal from ${consultant}. Return ONLY JSON.`
          },
          {
            type: 'file_url',
            file_url: {
              url: pdfUrl,
              mime_type: 'application/pdf'
            }
          }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'fee_extraction',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            totalFee: { type: 'number', description: 'Total fee amount' },
            currency: { type: 'string', description: 'Currency code' },
            includesVAT: { type: 'boolean', description: 'Whether fee includes VAT' },
            feeBeforeVAT: { type: ['number', 'null'], description: 'Fee before VAT' },
            vatAmount: { type: ['number', 'null'], description: 'VAT amount' },
            scope: { type: 'string', description: 'Brief scope description' },
            paymentTerms: { type: 'string', description: 'Payment terms' },
          },
          required: ['totalFee', 'currency', 'includesVAT', 'feeBeforeVAT', 'vatAmount', 'scope', 'paymentTerms'],
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
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error(`  Failed to parse LLM response for ${consultant}:`, data.choices[0].message.content);
      return null;
    }
  } else {
    console.error(`  LLM error for ${consultant}:`, JSON.stringify(data).slice(0, 200));
    return null;
  }
}

async function main() {
  const results = [];
  const downloadDir = '/tmp/jad-proposals';
  fs.mkdirSync(downloadDir, { recursive: true });

  for (const proposal of proposals) {
    console.log(`\nProcessing: ${proposal.name}`);
    
    // Download PDF
    const pdfPath = `${downloadDir}/${proposal.name}`;
    console.log(`  Downloading...`);
    await downloadFile(proposal.id, pdfPath);
    console.log(`  Downloaded: ${pdfPath} (${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB)`);
    
    // Extract fees
    console.log(`  Extracting fees with LLM...`);
    const fees = await extractFeesWithLLM(pdfPath, proposal.consultant);
    
    if (fees) {
      results.push({
        consultant: proposal.consultant,
        fileName: proposal.name,
        ...fees,
      });
      console.log(`  ✅ ${proposal.consultant}: ${fees.totalFee} ${fees.currency} (VAT: ${fees.includesVAT ? 'included' : 'excluded'})`);
    } else {
      results.push({
        consultant: proposal.consultant,
        fileName: proposal.name,
        error: 'Failed to extract',
      });
      console.log(`  ❌ Failed to extract fees`);
    }
  }

  // Summary
  console.log('\n\n========================================');
  console.log('SUMMARY: JAD_3260885 Engineering Proposals');
  console.log('========================================\n');
  
  console.log('| Consultant | Total Fee | Currency | VAT | Scope |');
  console.log('|------------|-----------|----------|-----|-------|');
  
  for (const r of results) {
    if (r.error) {
      console.log(`| ${r.consultant} | ERROR | - | - | ${r.error} |`);
    } else {
      const vatStr = r.includesVAT ? 'Incl.' : 'Excl.';
      console.log(`| ${r.consultant} | ${r.totalFee?.toLocaleString()} | ${r.currency} | ${vatStr} | ${r.scope} |`);
    }
  }

  // Save results to JSON
  fs.writeFileSync('/tmp/jad-fees-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /tmp/jad-fees-results.json');
}

main().catch(console.error);
