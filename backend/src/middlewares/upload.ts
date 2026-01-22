import multer from "multer";
import path from "path";
import fs from "fs";

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "uploads");
const maxMb = Number(process.env.MAX_UPLOAD_MB || 15);
const maxBytes = maxMb * 1024 * 1024;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function makeShipmentUploader(companyId: string, shipmentId: string) {
  const dest = path.join(uploadRoot, "companies", companyId, "shipments", shipmentId);
  ensureDir(dest);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}_${safe}`);
    },
  });

  return multer({
    storage,
    limits: { 
      fileSize: 10 * 1024 * 1024,
     },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (!allowed.includes(file.mimetype)) return cb(new Error("Unsupported file type"));
      cb(null, true);
    },
  });
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

