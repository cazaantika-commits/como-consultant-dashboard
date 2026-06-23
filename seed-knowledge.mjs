/**
 * Script to seed the knowledge base via the tRPC API
 * Run: node seed-knowledge.mjs
 */

const BASE_URL = 'http://localhost:3000';

async function seedKnowledge() {
  try {
    // We need to call the tRPC mutation - but we need auth
    // Instead, let's call the function directly via a simple HTTP endpoint
    // Actually, let's use the tRPC batch endpoint
    
    const response = await fetch(`${BASE_URL}/api/trpc/activityMonitor.seedKnowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.log('Status:', response.status);
      const text = await response.text();
      console.log('Response:', text.substring(0, 500));
      
      // If auth required, we need a different approach
      if (response.status === 401) {
        console.log('\nAuth required. Will seed directly via import...');
        return false;
      }
    } else {
      const data = await response.json();
      console.log('Seed result:', JSON.stringify(data, null, 2));
      return true;
    }
  } catch (err) {
    console.error('Error:', err.message);
    return false;
  }
}

seedKnowledge();
