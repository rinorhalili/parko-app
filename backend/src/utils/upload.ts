import multer from "multer";

export const imageOrVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"));
  },
});
