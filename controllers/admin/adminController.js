import User from "../../models/User.js";
import { hashPassword } from "../../utils/password.js";

export const addUser = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashed = await hashPassword(password);

    // ✅ Auto-generate name from email
    const nameFromEmail = email
      .split("@")[0]
      .replace(/[^a-zA-Z]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const user = await User.create({
      name: nameFromEmail || "Staff User", // ✅ IMPORTANT
      email,
      password: hashed,
      role: (role || "user").toLowerCase(),
    });

    res.status(201).json({
      message: "User added successfully",
      id: user._id,
      name: user.name,   // ✅ return name
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
};


export const getMappingRules = async (req, res) => {
  const rules = await MappingRule.find().sort({ updatedAt: -1 });
  res.json({ success: true, rules });
};
