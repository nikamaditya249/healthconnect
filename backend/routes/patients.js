import express from "express";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

import {
  isFallbackActive,
  memoryPatients,
  memoryOPDVisits,
  saveMemoryState,
  loadMemoryState,
} from "../services/inMemoryStore.js";

const router = express.Router();

// GET ALL / SEARCH PATIENTS
router.get("/", async (req, res) => {
  try {
    const { search = "", bloodGroup, gender, page = 1, limit = 50 } = req.query;

    if (isFallbackActive()) {
      loadMemoryState();
      let filtered = [...memoryPatients];
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.patientId.toLowerCase().includes(q) ||
            (p.phone && p.phone.toLowerCase().includes(q))
        );
      }
      if (bloodGroup && bloodGroup !== "all") {
        filtered = filtered.filter((p) => p.bloodGroup === bloodGroup);
      }
      if (gender && gender !== "all") {
        filtered = filtered.filter((p) => p.gender.toLowerCase() === gender.toLowerCase());
      }
      return res.json({
        patients: filtered,
        total: filtered.length,
        page: 1,
        totalPages: 1,
      });
    }

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
    let patients = await Patient.find(filter)
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

    // Secondary fallback: Merge any uncommitted memory patients that match the filter
    loadMemoryState();
    const existingIds = new Set();
    patients.forEach((p) => {
      if (p.patientId) existingIds.add(String(p.patientId).toUpperCase());
      if (p._id) existingIds.add(String(p._id));
    });
    for (const mp of memoryPatients) {
      const hasPId = mp.patientId && existingIds.has(String(mp.patientId).toUpperCase());
      const hasId = mp._id && existingIds.has(String(mp._id));
      if (!hasPId && !hasId) {
        let match = true;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          match =
            mp.name?.toLowerCase().includes(q) ||
            mp.patientId?.toLowerCase().includes(q) ||
            (mp.phone && mp.phone.toLowerCase().includes(q));
        }
        if (match && bloodGroup && bloodGroup !== "all") {
          match = mp.bloodGroup === bloodGroup;
        }
        if (match && gender && gender !== "all") {
          match = mp.gender?.toLowerCase() === gender.toLowerCase();
        }
        if (match) {
          patients.unshift(mp);
          if (mp.patientId) existingIds.add(String(mp.patientId).toUpperCase());
          if (mp._id) existingIds.add(String(mp._id));
        }
      }
    }

    res.json({
      patients,
      total: Math.max(total, patients.length),
      page: pageNum,
      totalPages: Math.ceil(Math.max(total, patients.length) / limitNum) || 1,
    });
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "Failed to fetch patients", details: err.message });
  }
});

// CLIENT-SERVER PATIENT SYNC (Guarantees multi-container consistency on serverless)
router.post("/sync", optionalAuth, async (req, res) => {
  try {
    const { patients } = req.body;
    if (Array.isArray(patients) && patients.length > 0) {
      loadMemoryState();
      const existingIds = new Set();
      memoryPatients.forEach((p) => {
        if (p.patientId) existingIds.add(String(p.patientId).toUpperCase());
        if (p._id) existingIds.add(String(p._id));
      });
      patients.forEach((p) => {
        if (p) {
          const hasPId = p.patientId && existingIds.has(String(p.patientId).toUpperCase());
          const hasId = p._id && existingIds.has(String(p._id));
          if (!hasPId && !hasId) {
            memoryPatients.unshift(p);
            if (p.patientId) existingIds.add(String(p.patientId).toUpperCase());
            if (p._id) existingIds.add(String(p._id));
          }
        }
      });
      saveMemoryState();

      // If MongoDB is connected, also upsert missing patients into MongoDB preserving _id
      if (!isFallbackActive()) {
        for (const p of patients) {
          if (!p) continue;
          try {
            const orList = [];
            if (p._id && mongoose.Types.ObjectId.isValid(p._id)) orList.push({ _id: p._id });
            if (p.patientId) orList.push({ patientId: String(p.patientId).toUpperCase() });
            if (orList.length > 0) {
              const existing = await Patient.findOne({ $or: orList });
              if (!existing) {
                const newDoc = new Patient({
                  _id: p._id && mongoose.Types.ObjectId.isValid(p._id) ? new mongoose.Types.ObjectId(p._id) : undefined,
                  patientId: p.patientId,
                  name: p.name || "Patient",
                  age: Number(p.age) || 0,
                  gender: p.gender || "Male",
                  bloodGroup: p.bloodGroup || "Unknown",
                  phone: p.phone || "",
                  address: p.address || "",
                  allergies: p.allergies || [],
                  chronicConditions: p.chronicConditions || [],
                  status: p.status || "waiting",
                  lastVisit: p.lastVisit || new Date(),
                });
                await newDoc.save();
              }
            }
          } catch (e) {
            console.warn("Sync patient to Mongo warning:", e.message);
          }
        }
      }

      return res.json({ success: true, count: memoryPatients.length });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE PATIENT BY ID (Supports both MongoDB ObjectId and HC-XXXXXX)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (isFallbackActive()) {
      let patient = memoryPatients.find(
        (p) =>
          (p._id && String(p._id) === String(id)) ||
          (p.patientId && String(p.patientId).toUpperCase() === String(id).toUpperCase())
      );
      if (!patient) {
        loadMemoryState();
        patient = memoryPatients.find(
          (p) =>
            (p._id && String(p._id) === String(id)) ||
            (p.patientId && String(p.patientId).toUpperCase() === String(id).toUpperCase())
        );
      }
      if (!patient) {
        const visit = memoryOPDVisits.find(
          (v) =>
            (v.patientId?._id && String(v.patientId._id) === String(id)) ||
            (v.patientId?.patientId && String(v.patientId.patientId).toUpperCase() === String(id).toUpperCase()) ||
            (v.patientId && String(v.patientId) === String(id))
        );
        if (visit && visit.patientId && typeof visit.patientId === "object") {
          patient = visit.patientId;
          memoryPatients.unshift(patient);
          saveMemoryState();
        }
      }
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      return res.json(patient);
    }

    let patient = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      patient = await Patient.findById(id);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: String(id).toUpperCase() });
    }

    // Secondary fallback: Check memory store if not yet committed to MongoDB
    if (!patient) {
      loadMemoryState();
      patient = memoryPatients.find(
        (p) =>
          (p._id && String(p._id) === String(id)) ||
          (p.patientId && String(p.patientId).toUpperCase() === String(id).toUpperCase())
      );
      if (!patient) {
        const visit = memoryOPDVisits.find(
          (v) =>
            (v.patientId?._id && String(v.patientId._id) === String(id)) ||
            (v.patientId?.patientId && String(v.patientId.patientId).toUpperCase() === String(id).toUpperCase()) ||
            (v.patientId && String(v.patientId) === String(id))
        );
        if (visit && visit.patientId && typeof visit.patientId === "object") {
          patient = visit.patientId;
        }
      }

      // If found in memory store, persist to MongoDB so future queries hit DB directly
      if (patient) {
        try {
          const doc = new Patient({
            _id: patient._id && mongoose.Types.ObjectId.isValid(patient._id) ? new mongoose.Types.ObjectId(patient._id) : undefined,
            patientId: patient.patientId,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup,
            phone: patient.phone,
            address: patient.address,
            allergies: patient.allergies,
            chronicConditions: patient.chronicConditions,
            status: patient.status || "waiting",
            lastVisit: patient.lastVisit || new Date(),
          });
          await doc.save();
          return res.json(doc);
        } catch (e) {
          return res.json(patient);
        }
      }
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

    if (isFallbackActive()) {
      loadMemoryState();

      // Duplicate check on phone if phone is provided
      if (phone && phone.trim()) {
        const existing = memoryPatients.find(
          (p) =>
            p.phone &&
            p.phone.trim() === phone.trim() &&
            p.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (existing) {
          return res.status(409).json({
            error: `Patient already registered with ID: ${existing.patientId || existing._id}`,
            patient: existing,
          });
        }
      }

      let maxNum = 0;
      memoryPatients.forEach((pt) => {
        const m = String(pt.patientId || "").match(/^HC-(\d+)$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const generatedId = `HC-${String(Math.max(maxNum + 1, memoryPatients.length + 1)).padStart(6, "0")}`;
      const newP = {
        _id: new mongoose.Types.ObjectId().toString(),
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryPatients.unshift(newP);
      saveMemoryState();
      return res.status(201).json(newP);
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
    let maxDbNum = 0;
    try {
      const allPatientsWithHc = await Patient.find({ patientId: /^HC-\d+$/i }).select("patientId").lean();
      allPatientsWithHc.forEach((p) => {
        const m = String(p.patientId || "").match(/^HC-(\d+)$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxDbNum) maxDbNum = num;
        }
      });
    } catch (e) {}

    const count = await Patient.countDocuments();
    const generatedId = `HC-${String(Math.max(maxDbNum + 1, count + 1)).padStart(6, "0")}`;

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
    if (isFallbackActive()) {
      const { id } = req.params;
      const idx = memoryPatients.findIndex(
        (p) => p._id === id || (p.patientId && p.patientId.toUpperCase() === id.toUpperCase())
      );
      if (idx === -1) return res.status(404).json({ error: "Patient not found" });
      memoryPatients[idx] = { ...memoryPatients[idx], ...req.body, updatedAt: new Date().toISOString() };
      saveMemoryState();
      return res.json(memoryPatients[idx]);
    }

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