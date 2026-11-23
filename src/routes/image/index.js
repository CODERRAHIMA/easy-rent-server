
import express from "express";
import multer from "multer";

const imageRoutes = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

imageRoutes.post(
  "/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image",
        });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed",
        });
      }

      const formData = new FormData();

      formData.append(
        "image",
        new Blob([req.file.buffer], {
          type: req.file.mimetype,
        }),
        req.file.originalname
      );

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        return res.status(500).json({
          success: false,
          message: "Image upload failed",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          url: result.data.url,
        },
        message: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Image upload error:", error);

      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);

export default imageRoutes;
