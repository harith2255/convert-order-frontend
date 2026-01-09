import express from "express";
import multer from "multer";
import { protect } from "../middlewares/authMiddleware.js";
import {
  extractOrderFields,
  convertOrders,
  getOrderHistory,
  downloadConvertedFile,
  getOrderResult,
  getOrderTemplate,
  getOrderById,
} from "../controllers/orderController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ----------- EXTRACT ----------- */
router.post(
  "/extract",
  protect,
  upload.single("file"), 
  extractOrderFields
);

/* ----------- CONVERT ----------- */
router.post("/convert", protect, convertOrders);

/* ----------- HISTORY ----------- */
router.get("/history", protect, getOrderHistory);

router.get("/download/:id", protect, downloadConvertedFile);
router.get("/result/:id", protect, getOrderResult);
router.get("/template", protect, getOrderTemplate);
router.get(
  "/:id",
  protect,
  getOrderById
);


export default router;
