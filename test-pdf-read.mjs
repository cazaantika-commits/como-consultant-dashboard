import { register } from "tsx/esm/api";
const unregister = register();

const { readFileContent } = await import("./server/googleDrive.ts");

// Test with the file ID from the user's conversation
const fileId = "1nTqxUsC5TEVRfi77WWeHbLokDm1BvweZ";
console.log("Testing PDF read for file:", fileId);

try {
  const result = await readFileContent(fileId);
  console.log("Result:", JSON.stringify({
    success: !result.error,
    fileName: result.fileName,
    mimeType: result.mimeType,
    contentType: result.contentType,
    totalChars: result.totalChars,
    truncated: result.truncated,
    error: result.error,
    contentPreview: result.content?.substring(0, 500),
  }, null, 2));
} catch (e) {
  console.error("Error:", e.message);
  console.error("Stack:", e.stack);
}

process.exit(0);
