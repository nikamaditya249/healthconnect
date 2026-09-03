import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authenticateUser } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "healthconnect_fallback_jwt_secret_key_2026";

// Auto-seed demo staff if database is fresh
export const seedDefaultUsers = async () => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      console.log("🌱 Seeding default staff accounts...");
      await User.create([
        {
          name: "Dr. Alok Sharma",
          email: "doctor@healthconnect.local",
          password: "doctor123",
          role: "doctor",
          employeeId: "DOC-001",
          department: "General Medicine",
          specialization: "Chief Medical Officer",
        },
        {
          name: "Priya Deshmukh",
          email: "reception@healthconnect.local",
          password: "reception123",
          role: "receptionist",
          employeeId: "REC-001",
          department: "OPD Front Desk",
          specialization: "Reception Supervisor",
        },
      ]);
      console.log("✅ Seeded demo accounts: doctor@healthconnect.local & reception@healthconnect.local");
    }
  } catch (err) {
    console.error("⚠️ Error seeding default users:", err.message);
  }
};

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Please enter your Employee ID / Email and password." });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const query = {
      $or: [
        { email: cleanIdentifier },
        { employeeId: identifier.trim().toUpperCase() },
      ],
    };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials. Staff account not found." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, employeeId: user.employeeId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: user.role,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user._id.toString(),
      details: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        specialization: user.specialization,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    if (err.name === "MongooseError" || err.name === "MongoNetworkTimeoutError" || err.message?.includes("buffering timed out") || err.message?.includes("connect")) {
      return res.status(503).json({
        error: "Database connection timed out. Please check your MongoDB Atlas IP Whitelist (add 0.0.0.0/0 in Atlas Network Access).",
      });
    }
    res.status(500).json({ error: "Server error during authentication.", details: err.message });
  }
});

// REGISTER / SIGN UP NEW STAFF
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "doctor", employeeId, department, specialization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (!["doctor", "receptionist"].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'doctor' or 'receptionist'." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email address already exists. Please sign in." });
    }

    // Generate or format Employee ID
    let finalEmpId = employeeId ? employeeId.trim().toUpperCase() : null;
    if (!finalEmpId) {
      const count = await User.countDocuments({ role });
      const prefix = role === "doctor" ? "DOC" : "REC";
      finalEmpId = `${prefix}-${String(count + 1).padStart(3, "0")}`;
    }

    // Verify employee ID uniqueness
    const existingEmpId = await User.findOne({ employeeId: finalEmpId });
    if (existingEmpId) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      finalEmpId = `${finalEmpId}-${randomSuffix}`;
    }

    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: password, // pre-save hook will hash it
      role,
      employeeId: finalEmpId,
      department: department?.trim() || (role === "doctor" ? "General Medicine" : "OPD Front Desk"),
      specialization: specialization?.trim() || (role === "doctor" ? "General Physician" : "Receptionist"),
    });

    const saved = await newUser.save();

    const token = jwt.sign(
      { id: saved._id, role: saved.role, employeeId: saved.employeeId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Audit log
    await AuditLog.create({
      userId: saved._id,
      userRole: saved.role,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: saved._id.toString(),
      details: { email: saved.email, role: saved.role, employeeId: saved.employeeId },
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: saved._id,
        name: saved.name,
        email: saved.email,
        role: saved.role,
        employeeId: saved.employeeId,
        department: saved.department,
        specialization: saved.specialization,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to register staff account.", details: err.message });
  }
});

// GET CURRENT USER PROFILE
router.get("/me", authenticateUser, async (req, res) => {
  res.json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      employeeId: req.user.employeeId,
      department: req.user.department,
      specialization: req.user.specialization,
    },
  });
});

// EXPLICIT SEED ENDPOINT
router.post("/seed", async (req, res) => {
  await seedDefaultUsers();
  res.json({ message: "Default users seeded successfully" });
});

export default router;
