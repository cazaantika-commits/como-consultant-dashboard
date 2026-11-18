import { Router } from "express";
import multer from "multer";
import { authenticateComoRest, comoRestActor, sendComoRestError } from "./services/comoSecurityGuards";
import { positiveUploadId, storePrivateCommandCenterAttachment } from "./services/comoPrivateUpload";

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
router.post("/command-center", authenticateComoRest, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "لم يتم إرسال أي ملف" });
      return;
    }

    const attachment = await storePrivateCommandCenterAttachment({
      actor: comoRestActor(res),
      projectId: positiveUploadId(req.body.projectId),
      memoryId: positiveUploadId(req.body.memoryId),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: req.file.buffer,
    });
    res.json({
      success: true,
      ...attachment,
    });
  } catch (err) {
    sendComoRestError(res, err);
  }
});

export default router;
