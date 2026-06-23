import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const router = Router();

// Memory storage — upload directly to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. المسموح به: PDF, Word, Excel, PowerPoint, صور"));
    }
  },
});

// POST /api/upload/command-center
router.post("/command-center", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "لم يتم إرسال أي ملف" });
      return;
    }

    const { bubbleType = "general" } = req.body;

    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._\u0600-\u06FF-]/g, "_");
    const fileKey = `command-center/${bubbleType}/${timestamp}-${safeName}`;

    const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

    res.json({
      success: true,
      url,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  } catch (err: any) {
    console.error("[FileUpload] Error:", err);
    res.status(500).json({ error: err.message || "خطأ في رفع الملف" });
  }
});

export default router;
