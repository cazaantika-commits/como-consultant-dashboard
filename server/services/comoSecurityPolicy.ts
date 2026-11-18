// Exact avatar assets referenced by client/src/components/AgentChatBox.tsx.
// Direct CDN URLs stay unchanged. This is NOT a grant to any upload directory.
const publicAssets: ReadonlySet<string> = new Set([
  "salwa-enhanced_0251b1a8.png", "UphyyKbtnxhtJDDy.png", "pTwUciwtTCWHPghO.png", "fsUKhyALKYaTfnMj.png",
  "gFGfLWvLCJrhamTj.png", "qJSwoNSavgDflAVc.png", "GorWfdugNGIAdkOm.png", "mCOkEovAXTtxsABs.png",
]);
export function isComoPublicStorageAsset(key: string): boolean { return publicAssets.has(key); }
export const COMO_IMAP_TLS_OPTIONS = Object.freeze({ rejectUnauthorized: true as const });
