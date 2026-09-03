import express from "express";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// GET ALL / SEARCH PATIENTS
router.get("/", async (req, res) => {
  try {
    const { search = "", bloodGroup, gender, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { patientId: regex },
        { phone: regex },
      ];
    }

    if (bloodGroup && bloodGroup !== "all") {
      filter.bloodGroup = bloodGroup;
    }

    if (gender && gender !== "all") {
      filter.gender = new RegExp(`^${gender}$`, "i");
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const total = await Patient.countDocuments(filter);
    const patients = await Patient.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Ensure all existing legacy patients have a valid patientId
    for (const p of patients) {
      if (!p.patientId) {
        const hash = p._id.toString().slice(-6).toUpperCase();
        p.patientId = `HC-${hash}`;
        await Patient.updateOne({ _id: p._id }, { $set: { patientId: p.patientId } });
      }
    }

    res.json({
      patients,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "Failed to fetch patients", details: err.message });
  }
});

// GET SINGLE PATIENT BY ID (Supports both MongoDB ObjectId and HC-XXXXXX)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let patient = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      patient = await Patient.findById(id);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: id.toUpperCase() });
    }

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Auto-backfill patientId if missing on legacy record
    if (!patient.patientId) {
      patient.patientId = `HC-${patient._id.toString().slice(-6).toUpperCase()}`;
      await patient.save();
    }

    res.json(patient);
  } catch (err) {
    console.error("Error fetching patient:", err);
    res.status(500).json({ error: "Failed to fetch patient details", details: err.message });
  }
});

// REGISTER NEW PATIENT
router.post(["/", "/add"], optionalAuth, async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      bloodGroup,
      phone,
      address,
      emergencyContact,
      allergies,
      chronicConditions,
    } = req.body;

    if (!name || age === undefined || !gender) {
      return res.status(400).json({ error: "Name, age, and gender are required fields." });
    }

    // Duplicate check on phone if phone is provided
    if (phone && phone.trim()) {
      const existing = await Patient.findOne({
        phone: phone.trim(),
        name: new RegExp(`^${name.trim()}$`, "i"),
      });
      if (existing) {
        return res.status(409).json({
          error: `Patient already registered with ID: ${existing.patientId || existing._id}`,
          patient: existing,
        });
      }
    }

    // Generate clean sequential ID
    const count = await Patient.countDocuments();
    const generatedId = `HC-${String(count + 1).padStart(6, "0")}`;

    const newPatient = new Patient({
      patientId: generatedId,
      name: name.trim(),
      age: Number(age),
      gender: gender.trim(),
      bloodGroup: bloodGroup || "Unknown",
      phone: phone ? phone.trim() : "",
      address: address ? address.trim() : "",
      emergencyContact: emergencyContact || { name: "", relationship: "", phone: "" },
      allergies: Array.isArray(allergies)
        ? allergies
        : typeof allergies === "string" && allergies.trim()
        ? allergies.split(",").map((s) => s.trim())
        : [],
      chronicConditions: Array.isArray(chronicConditions)
        ? chronicConditions
        : typeof chronicConditions === "string" && chronicConditions.trim()
        ? chronicConditions.split(",").map((s) => s.trim())
        : [],
      status: "waiting",
      lastVisit: new Date(),
    });

    const saved = await newPatient.save();

    // Audit log
    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "receptionist",
      action: "PATIENT_REGISTERED",
      entityType: "Patient",
      entityId: saved._id.toString(),
      details: { patientId: saved.patientId, name: saved.name },
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("Error registering patient:", err);
    res.status(500).json({ error: "Failed to register patient", details: err.message });
  }
});

// UPDATE PATIENT
router.put("/:id", optionalAuth, async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Patient not found" });
    }

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "system",
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: updated._id.toString(),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update patient", details: err.message });
  }
});

// UPDATE STATUS (Legacy & Quick status toggles)
router.put("/:id/status", optionalAuth, async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update patient status", details: err.message });
  }
});

export default router;