import express from "express";
import { exportAllConvertedData } from "../../controllers/admin/adminConversion.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// 🔐 Admin-only export of unified converted data
router.get(
  "/export/conversions",
  protect,                // verifies JWT
  exportAllConvertedData  // checks admin role internally
);

export default router;
