import User from "../../models/User.js";
import OrderUpload from "../../models/OrderUpload.js";
import MappingRule from "../../models/mappingRules.js";
import SystemAlert from "../../models/systemAlerts.js";
import ActivityLog from "../../models/activityLogs.js";

export const getAdminDashboard = async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    admins,
    totalUploads,
    failedUploads,
    mappingRules,
    alerts,
    recentActivity,
    recentUploads,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "admin" }),

    // 🔥 uploads instead of conversions
    OrderUpload.countDocuments(),
    OrderUpload.countDocuments({ status: "FAILED" }),

    MappingRule.countDocuments(),
    SystemAlert.find().sort({ createdAt: -1 }).limit(5),
    ActivityLog.find().sort({ createdAt: -1 }).limit(10),

    // 🔥 THIS IS WHAT YOU ARE MISSING
    OrderUpload.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("fileName userEmail status recordsProcessed recordsFailed createdAt")
      .lean(),
  ]);

  const successRate =
    totalUploads === 0
      ? 100
      : (((totalUploads - failedUploads) / totalUploads) * 100).toFixed(1);

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      admins,
      totalUploads,
      failedUploads,
      successRate,
    },
    mappingRules,
    alerts,
    recentActivity,
    recentUploads, // ✅ NEW
  });
};
