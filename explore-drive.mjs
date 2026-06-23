import { listSharedDrives, listFilesInFolder } from './server/googleDrive.ts';

async function main() {
  console.log("=== المجلدات المشتركة ===\n");
  const sharedFolders = await listSharedDrives();
  for (const f of sharedFolders) {
    console.log(`📁 ${f.name} | ID: ${f.id}`);
  }

  const folderId = '1PLhYCKU08CMKJWfPK44IjNAw_V3oOawD';
  console.log("\n=== محتويات 01. COMO _Projects Management ===\n");
  
  const result1 = await listFilesInFolder(folderId);
  const level1 = result1?.files || result1 || [];
  const items1 = Array.isArray(level1) ? level1 : [];
  
  for (const item of items1) {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    const icon = isFolder ? '📁' : '📄';
    console.log(`${icon} ${item.name} | ID: ${item.id}`);
    
    if (isFolder) {
      try {
        const result2 = await listFilesInFolder(item.id);
        const level2 = result2?.files || result2 || [];
        const items2 = Array.isArray(level2) ? level2 : [];
        
        for (const sub of items2) {
          const isSubFolder = sub.mimeType === 'application/vnd.google-apps.folder';
          const icon2 = isSubFolder ? '📁' : '📄';
          console.log(`  ${icon2} ${sub.name}`);
          
          if (isSubFolder) {
            try {
              const result3 = await listFilesInFolder(sub.id);
              const level3 = result3?.files || result3 || [];
              const items3 = Array.isArray(level3) ? level3 : [];
              
              for (const deep of items3) {
                const isDeepFolder = deep.mimeType === 'application/vnd.google-apps.folder';
                const icon3 = isDeepFolder ? '📁' : '📄';
                console.log(`    ${icon3} ${deep.name}`);
                
                // Level 4 for deep folders
                if (isDeepFolder) {
                  try {
                    const result4 = await listFilesInFolder(deep.id);
                    const level4 = result4?.files || result4 || [];
                    const items4 = Array.isArray(level4) ? level4 : [];
                    for (const vdeep of items4) {
                      const icon4 = vdeep.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
                      console.log(`      ${icon4} ${vdeep.name}`);
                    }
                  } catch(e) {}
                }
              }
            } catch(e) {}
          }
        }
      } catch(e) {
        console.log(`  ⚠️ ${e.message}`);
      }
    }
  }
}

main().catch(e => console.error(e));
