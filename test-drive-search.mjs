import { searchFiles, listFilesInFolder } from './server/googleDrive.js';

async function testSearch() {
  console.log('\n=== Testing Drive Search ===\n');
  
  // Test 1: Search for "XYZ"
  console.log('1. Searching for "XYZ"...');
  try {
    const results1 = await searchFiles('XYZ');
    console.log(`Found ${results1.length} files:`);
    results1.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test 2: Search for "012-26"
  console.log('\n2. Searching for "012-26"...');
  try {
    const results2 = await searchFiles('012-26');
    console.log(`Found ${results2.length} files:`);
    results2.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test 3: Search for "Multiple Development"
  console.log('\n3. Searching for "Multiple Development"...');
  try {
    const results3 = await searchFiles('Multiple Development');
    console.log(`Found ${results3.length} files:`);
    results3.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test 4: List all files in Ready folder (if we know the folder ID)
  console.log('\n4. Searching for Ready folder...');
  try {
    const readyFolders = await searchFiles('Ready');
    console.log(`Found ${readyFolders.length} folders/files named Ready:`);
    readyFolders.forEach(f => console.log(`  - ${f.name} (ID: ${f.id}, Type: ${f.mimeType})`));
    
    // If we found the folder, list its contents
    const readyFolder = readyFolders.find(f => f.mimeType === 'application/vnd.google-apps.folder');
    if (readyFolder) {
      console.log(`\n5. Listing files in Ready folder (${readyFolder.id})...`);
      const result = await listFilesInFolder(readyFolder.id);
      console.log(`Found ${result.files.length} files in Ready:`);
      result.files.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));
    }
    
    // Check where the XYZ file is located
    console.log('\n6. Checking XYZ file parent folder...');
    const xyzFiles = await searchFiles('XYZ');
    if (xyzFiles.length > 0) {
      const xyzFile = xyzFiles[0];
      console.log(`XYZ file: ${xyzFile.name}`);
      console.log(`Parents: ${JSON.stringify(xyzFile.parents)}`);
      console.log(`Ready folder ID: ${readyFolder?.id}`);
      console.log(`Is in Ready? ${xyzFile.parents?.includes(readyFolder?.id || '')}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testSearch().catch(console.error);
