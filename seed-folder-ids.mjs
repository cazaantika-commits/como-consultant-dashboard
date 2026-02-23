import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const folderMapping = `# خريطة مجلدات Google Drive - معرفات المجلدات

## المجلد الرئيسي للعروض والعقود
02_Proposals Contracts & Agreements → 1Q4IwTgJkzJMOKDqOQKCtRvjQVApFPcHv

## مجلدات المشاريع (PCA = Proposals, Contracts & Agreements)

### JAD_3260885 (الجداف)
- JAD_3260885_PCA: 1P8AlxoabTktrFKmJ6h6qU5sa-w5huG7K
- JAD_3260885_PCA/Proposals: 1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC
- JAD_3260885_PCA/Contracts: 1ZvONS3acpJ0tbOXin6PXZ2lf36BG-qiN

### NAD_6185392 (ند الشبا - سكني)
- NAD_6185392_PCA: 1RcDTcqK9XLUpEKkBNMQnGbmCvzMqgJYL
- NAD_6185392_PCA/Proposals: 1EySnGu_28xXXzX7fCfC9qx8RaJzPaLIy
- NAD_6185392_PCA/Contracts: 1oXVmjjRmLipG67_zTARgKcaq49cl7oVq

### NAD_6182776 (ند الشبا - قطعة 2)
- NAD_6182776_PCA: 1Cq17UsAPAKnSFyOm28SSgFrh25Q_Te0K
- NAD_6182776_PCA/Proposals: 1vT59nz5UceUB7fxI3-YFc7o4S-Qb5sMg
- NAD_6182776_PCA/Contracts: 16T5ccbFHB-d9Z7iVPRa79x_9bdrbPfsh

### NAD_6180578 (ند الشبا - الفلل)
- NAD_6180578_PCA: 1q-NynLm0O8yPjr7QV93yhHvi7rytHhuS
- NAD_6180578_PCA/Proposals: 1XRuIUOqJgaKZj5s7Z0tyw6MhlthjJA_E
- NAD_6180578_PCA/Contracts: 19bWMB2cmc4LoE5Px-4Kni2DJyVfEslo4

### MAJ_6457956 (المجان - متعدد الاستخدامات)
- MAJ_6457956_PCA: 1ZR1tT3U1h2QiqMwoAM0nKXXamh4c2IrV
- MAJ_6457956_PCA/Proposals: 1s2ITQVVYfMwM1v3kTf3S5SHm2i3n4HFH
- MAJ_6457956_PCA/Contracts: 1e-ZeX7MgYCQlnJdWahgmKosz-804buyN

### MAJ_6457879 (المجان)
- MAJ_6457879_PCA: 18Bga-rwJqOic1wKaESFqxdmdDTaV5sAW
- MAJ_6457879_PCA/Proposals: 12gi-ndWRu_0uhmlnczbkTMMEB0biKYlz
- MAJ_6457879_PCA/Contracts: 1PttLusNH3_g9mKfiOfvsSPHgQAz0e_Tz

## مجلدات التصميم والرسومات (DD = Design & Drawings)
- JAD_3260885_DD: 1HlMjusjMAUF3dj-qSxzxFSWHMmWjvAvG

## تعليمات الاستخدام
عند البحث عن عروض مشروع معين، استخدم معرف مجلد Proposals مباشرة.
مثال: للبحث عن عروض الجداف، استخدم folderId: 1OPXsnMTtTce_niOwQwzQIDcp_JBq31GC`;

await conn.execute(
  `INSERT INTO knowledgeBase (userId, title, content, type, tags, createdAt, updatedAt)
   VALUES (1, ?, ?, ?, ?, NOW(), NOW())`,
  [
    'خريطة مجلدات Google Drive - معرفات المجلدات',
    folderMapping,
    'insight',
    'drive,folders,ids,mapping,مجلدات'
  ]
);

console.log('✅ Folder ID mapping added to knowledge base');
await conn.end();
