import express from "express";
import { addUser, getMappingRules} from "../../controllers/admin/adminController.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { adminOnly } from "../../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/users", protect, adminOnly, addUser);

export default router;
