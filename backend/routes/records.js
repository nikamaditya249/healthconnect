import express from "express";
import mongoose from "mongoose";
import Record from "../models/Record.js";
import Patient from "../models/Patient.js";
import OPDVisit from "../models/OPDVisit.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

import { isFallbackActive, memoryRecords, memoryPatients, memoryUsers } from "../services/inMemoryStore.js";

const router = express.Router();

// GET ALL RECORDS FOR A PATIENT
router.get(["/patient/:patientId", "/:patientId"], async (req, res) => {
  try {
    const { patientId } = req.params;

    if (isFallbackActive()) {
      const recs = memoryRecords.filter(
        (r) =>
          r.patientId === patientId ||
          r.patientId?._id === patientId ||
          r.patientId?.patientId === patientId
      );
      return res.json(recs);
    }

    let targetPatientId = patientId;
    // Support lookup by HC-XXXXXX code as well
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      const patient = await Patient.findOne({ patientId: patientId.toUpperCase() });
      if (patient) targetPatientId = patient._id;
    }

    const records = await Record.find({ patientId: targetPatientId })
      .populate("doctorId", "name employeeId department specialization")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    console.error("Error fetching records:", err);
    res.status(500).json({ error: "Failed to fetch medical records", details: err.message });
  }
});

// GET SINGLE RECORD BY ID
router.get("/detail/:id", async (req, res) => {
  try {
    if (isFallbackActive()) {
      const record = memoryRecords.find((r) => r._id === req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }
      return res.json(record);
    }

    const record = await Record.findById(req.params.id)
      .populate("patientId")
      .populate("doctorId", "name employeeId specialization department");

    if (!record) {
      return res.status(404).json({ error: "Medical record not found" });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch record", details: err.message });
  }
});

// CREATE MEDICAL CONSULTATION RECORD
router.post("/", optionalAuth, async (req, res) => {
  try {
    const {
      patientId,
      visitId,
      doctorId,
      doctorName,
      chiefComplaint,
      symptoms,
      duration,
      diagnosis,
      vitals,
      medicines,
      prescription,
      doctorNotes,
      followUpDate,
    } = req.body;

    if (!patientId || !diagnosis) {
      return res.status(400).json({ error: "Patient ID and Diagnosis are required." });
    }

    if (isFallbackActive()) {
      const p = memoryPatients.find(
        (pt) => pt._id === patientId || pt.patientId === patientId
      );
      if (p) p.status = "done";
      const newRec = {
        _id: "60d0fe4f5311236168a109" + (memoryRecords.length + 50),
        patientId,
        visitId,
        doctorId: req.user?._id || memoryUsers[0]._id,
        doctorName: req.user?.name || doctorName || "Dr. Alok Sharma",
        chiefComplaint: chiefComplaint || "",
        symptoms: symptoms || "",
        duration: duration || "",
        diagnosis: diagnosis.trim(),
        vitals: vitals || {},
        medicines: medicines || [],
        doctorNotes: doctorNotes || "",
        followUpDate: followUpDate || "",
        createdAt: new Date().toISOString(),
      };
      memoryRecords.unshift(newRec);
      return res.status(201).json(newRec);
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Determine Doctor Name
    const resolvedDoctorName =
      req.user?.name || doctorName || "Dr. Alok Sharma";
    const resolvedDoctorId = req.user?._id || doctorId || null;

    // Normalizing medicines / prescription
    let formattedMedicines = [];
    if (Array.isArray(medicines) && medicines.length > 0) {
      formattedMedicines = medicines.filter((m) => m && m.medicine?.trim());
    }

    const newRecord = new Record({
      patientId,
      visitId: visitId || null,
      doctorId: resolvedDoctorId,
      doctorName: resolvedDoctorName,
      chiefComplaint: chiefComplaint || "",
      symptoms: symptoms || "",
      duration: duration || "",
      diagnosis: diagnosis.trim(),
      vitals: vitals || {},
      medicines: formattedMedicines,
      prescription: prescription || (formattedMedicines.length > 0 ? formattedMedicines.map(m => `${m.medicine} - ${m.dosage} (${m.frequency})`).join(", ") : ""),
      doctorNotes: doctorNotes || "",
      followUpDate: followUpDate || "",
    });

    const savedRecord = await newRecord.save();

    // 1. Mark patient status to "done" and update lastVisit
    await Patient.findByIdAndUpdate(patientId, {
      status: "done",
      lastVisit: new Date(),
    });

    // 2. If an open OPD visit exists for this patient, automatically mark it as completed
    if (visitId) {
      await OPDVisit.findByIdAndUpdate(visitId, {
        status: "done",
        completedAt: new Date(),
      });
    } else {
      await OPDVisit.updateMany(
        { patientId, status: { $in: ["waiting", "in-progress"] } },
        { status: "done", completedAt: new Date() }
      );
    }

    // Audit log
    await AuditLog.create({
      userId: resolvedDoctorId,
      userRole: req.user?.role || "doctor",
      action: "CONSULTATION_SAVED",
      entityType: "Record",
      entityId: savedRecord._id.toString(),
      details: { patientId, diagnosis: savedRecord.diagnosis },
    });

    const populatedRecord = await Record.findById(savedRecord._id)
      .populate("patientId")
      .populate("doctorId", "name specialization");

    res.status(201).json(populatedRecord);
  } catch (err) {
    console.error("Error creating medical record:", err);
    res.status(500).json({ error: "Failed to save medical record", details: err.message });
  }
});

export default router;