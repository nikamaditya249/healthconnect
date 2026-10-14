import express from "express";
import mongoose from "mongoose";
import Record from "../models/Record.js";
import Patient from "../models/Patient.js";
import OPDVisit from "../models/OPDVisit.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

import {
  isFallbackActive,
  memoryRecords,
  memoryPatients,
  memoryUsers,
  memoryOPDVisits,
  saveMemoryState,
  loadMemoryState,
} from "../services/inMemoryStore.js";

const router = express.Router();

// GET ALL RECORDS FOR A PATIENT
router.get(["/patient/:patientId", "/:patientId"], async (req, res) => {
  try {
    const { patientId } = req.params;
    const target = String(patientId).trim().toUpperCase();

    // Helper to extract matching records from in-memory cache
    const getMemoryRecordsForPatient = () => {
      loadMemoryState();
      return memoryRecords.filter((r) => {
        const rpId = String(r.patientId?._id || r.patientId?.patientId || r.patientId || "").toUpperCase();
        const rpCode = String(r.patientCode || "").toUpperCase();
        const rpObjId = String(r.patientObjectId || "").toUpperCase();
        return (
          rpId === target ||
          rpCode === target ||
          rpObjId === target ||
          (r.patientId && typeof r.patientId === "object" && String(r.patientId._id).toUpperCase() === target) ||
          (r.patientId && typeof r.patientId === "object" && String(r.patientId.patientId).toUpperCase() === target)
        );
      });
    };

    if (isFallbackActive()) {
      const recs = getMemoryRecordsForPatient();
      recs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(recs);
    }

    // In MongoDB mode: build flexible multi-clause search
    let orConditions = [];

    if (mongoose.Types.ObjectId.isValid(patientId)) {
      orConditions.push({ patientId: new mongoose.Types.ObjectId(patientId) });
      orConditions.push({ patientObjectId: String(patientId) });
    }
    orConditions.push({ patientCode: target });

    let patient = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: target });
    }
    if (patient) {
      orConditions.push({ patientId: patient._id });
      if (patient.patientId) orConditions.push({ patientCode: patient.patientId.toUpperCase() });
      orConditions.push({ patientObjectId: patient._id.toString() });
    }

    let records = await Record.find({ $or: orConditions })
      .populate("patientId")
      .populate("doctorId", "name employeeId department specialization")
      .sort({ createdAt: -1 });

    // Secondary fallback: Merge with any records from memory store if available
    const memRecs = getMemoryRecordsForPatient();
    if (memRecs.length > 0) {
      const existingIds = new Set(records.map((r) => String(r._id)));
      for (const mr of memRecs) {
        if (!existingIds.has(String(mr._id))) {
          records.push(mr);
          existingIds.add(String(mr._id));
        }
      }
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json(records);
  } catch (err) {
    console.error("Error fetching records:", err);
    res.status(500).json({ error: "Failed to fetch medical records", details: err.message });
  }
});

// CLIENT-SERVER RECORDS SYNC (Guarantees multi-container consistency on serverless)
router.post("/sync", optionalAuth, async (req, res) => {
  try {
    const { records } = req.body;
    if (Array.isArray(records) && records.length > 0) {
      loadMemoryState();
      const existingIds = new Set(memoryRecords.map((r) => String(r._id)));
      records.forEach((r) => {
        if (r && r._id && !existingIds.has(String(r._id))) {
          memoryRecords.unshift(r);
          existingIds.add(String(r._id));
        }
      });
      saveMemoryState();

      // If MongoDB is connected, also upsert records into MongoDB
      if (!isFallbackActive()) {
        for (const r of records) {
          if (!r || !r._id) continue;
          try {
            if (mongoose.Types.ObjectId.isValid(r._id)) {
              const exists = await Record.findById(r._id);
              if (!exists) {
                let pId = r.patientId?._id || r.patientId || r.patientObjectId;
                if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
                  const pDoc = await Patient.findOne({ patientId: String(r.patientCode || "").toUpperCase() });
                  if (pDoc) pId = pDoc._id;
                }
                if (pId && mongoose.Types.ObjectId.isValid(pId)) {
                  const doc = new Record({
                    _id: new mongoose.Types.ObjectId(r._id),
                    patientId: new mongoose.Types.ObjectId(pId),
                    patientCode: r.patientCode || r.patientId?.patientId || "",
                    patientObjectId: String(pId),
                    visitId: r.visitId && mongoose.Types.ObjectId.isValid(r.visitId) ? r.visitId : null,
                    doctorId: r.doctorId && mongoose.Types.ObjectId.isValid(r.doctorId) ? r.doctorId : null,
                    doctorName: r.doctorName || "Dr. Alok Sharma",
                    chiefComplaint: r.chiefComplaint || "",
                    symptoms: r.symptoms || "",
                    duration: r.duration || "",
                    diagnosis: r.diagnosis || "Consultation",
                    vitals: r.vitals || {},
                    medicines: r.medicines || [],
                    prescription: r.prescription || "",
                    doctorNotes: r.doctorNotes || "",
                    followUpDate: r.followUpDate || "",
                    createdAt: r.createdAt || new Date(),
                  });
                  await doc.save();
                }
              }
            }
          } catch (e) {
            console.warn("Sync record to Mongo warning:", e.message);
          }
        }
      }

      return res.json({ success: true, count: memoryRecords.length });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE RECORD BY ID
router.get("/detail/:id", async (req, res) => {
  try {
    if (isFallbackActive()) {
      loadMemoryState();
      const record = memoryRecords.find((r) => r._id === req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }
      return res.json(record);
    }

    let record = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      record = await Record.findById(req.params.id)
        .populate("patientId")
        .populate("doctorId", "name employeeId specialization department");
    }

    if (!record) {
      loadMemoryState();
      record = memoryRecords.find((r) => r._id === req.params.id);
    }

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
      patientCode,
      patientObjectId,
      patientData,
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

    // Normalizing medicines / prescription
    let formattedMedicines = [];
    if (Array.isArray(medicines) && medicines.length > 0) {
      formattedMedicines = medicines.filter((m) => m && m.medicine?.trim());
    }
    const resolvedPrescription =
      prescription ||
      (formattedMedicines.length > 0
        ? formattedMedicines.map((m) => `${m.medicine} - ${m.dosage} (${m.frequency})`).join(", ")
        : "");

    if (isFallbackActive()) {
      let p = memoryPatients.find(
        (pt) =>
          (pt._id && String(pt._id) === String(patientId)) ||
          (pt.patientId && String(pt.patientId).toUpperCase() === String(patientId).toUpperCase())
      );
      if (!p) {
        loadMemoryState();
        p = memoryPatients.find(
          (pt) =>
            (pt._id && String(pt._id) === String(patientId)) ||
            (pt.patientId && String(pt.patientId).toUpperCase() === String(patientId).toUpperCase())
        );
      }

      // Auto-restore patient if passed in payload (fixes serverless container drift)
      if (!p && (patientData || req.body.patient)) {
        const pd = patientData || req.body.patient;
        p = {
          _id: pd._id && mongoose.Types.ObjectId.isValid(pd._id) ? String(pd._id) : (mongoose.Types.ObjectId.isValid(patientId) ? String(patientId) : new mongoose.Types.ObjectId().toString()),
          patientId: pd.patientId || (String(patientId).startsWith("HC-") ? String(patientId) : `HC-000001`),
          name: pd.name || "Patient",
          age: Number(pd.age) || 0,
          gender: pd.gender || "Male",
          bloodGroup: pd.bloodGroup || "Unknown",
          phone: pd.phone || "",
          address: pd.address || "",
          allergies: Array.isArray(pd.allergies) ? pd.allergies : [],
          chronicConditions: Array.isArray(pd.chronicConditions) ? pd.chronicConditions : [],
          status: "done",
          createdAt: pd.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memoryPatients.unshift(p);
        saveMemoryState();
      }

      if (p) p.status = "done";

      // If an active OPD visit exists, mark as completed
      const targetPId = String(p?._id || patientId);
      const targetPCode = String(p?.patientId || "").toUpperCase();
      memoryOPDVisits.forEach((v) => {
        const vPid = String(v.patientId?._id || v.patientId?.patientId || v.patientId || "");
        if (vPid === targetPId || (targetPCode && vPid.toUpperCase() === targetPCode)) {
          v.status = "completed";
          v.completedAt = new Date().toISOString();
        }
      });

      const newRec = {
        _id: new mongoose.Types.ObjectId().toString(),
        patientId: p ? p : patientId,
        patientObjectId: p?._id || (mongoose.Types.ObjectId.isValid(patientId) ? String(patientId) : null),
        patientCode: p?.patientId || (String(patientId).startsWith("HC-") ? String(patientId) : null),
        visitId: visitId || null,
        doctorId: req.user?._id || memoryUsers[0]._id,
        doctorName: req.user?.name || doctorName || "Dr. Alok Sharma",
        chiefComplaint: chiefComplaint || "",
        symptoms: symptoms || "",
        duration: duration || "",
        diagnosis: diagnosis.trim(),
        vitals: vitals || {},
        medicines: formattedMedicines,
        prescription: resolvedPrescription,
        doctorNotes: doctorNotes || "",
        followUpDate: followUpDate || "",
        createdAt: new Date().toISOString(),
      };
      memoryRecords.unshift(newRec);
      saveMemoryState();
      return res.status(201).json(newRec);
    }

    // ==========================================
    // MONGODB MODE
    // ==========================================
    let patient = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: String(patientId).toUpperCase() });
    }

    // Check memoryPatients if patient not yet committed to MongoDB
    if (!patient) {
      loadMemoryState();
      const memP = memoryPatients.find(
        (pt) =>
          (pt._id && String(pt._id) === String(patientId)) ||
          (pt.patientId && String(pt.patientId).toUpperCase() === String(patientId).toUpperCase())
      );
      if (memP) {
        try {
          patient = new Patient({
            _id: memP._id && mongoose.Types.ObjectId.isValid(memP._id) ? new mongoose.Types.ObjectId(memP._id) : undefined,
            patientId: memP.patientId,
            name: memP.name,
            age: memP.age,
            gender: memP.gender,
            bloodGroup: memP.bloodGroup,
            phone: memP.phone,
            address: memP.address,
            allergies: memP.allergies,
            chronicConditions: memP.chronicConditions,
            status: "done",
            lastVisit: new Date(),
          });
          await patient.save();
        } catch (e) {
          console.warn("Could not upsert memP into MongoDB:", e.message);
        }
      }
    }

    // Auto-restore patient if passed in payload
    if (!patient && (patientData || req.body.patient)) {
      const pd = patientData || req.body.patient;
      const count = await Patient.countDocuments();
      patient = new Patient({
        _id: pd._id && mongoose.Types.ObjectId.isValid(pd._id) ? new mongoose.Types.ObjectId(pd._id) : undefined,
        patientId: pd.patientId || (String(patientId).startsWith("HC-") ? String(patientId) : `HC-${String(count + 1).padStart(6, "0")}`),
        name: pd.name || "Patient",
        age: Number(pd.age) || 0,
        gender: pd.gender || "Male",
        bloodGroup: pd.bloodGroup || "Unknown",
        phone: pd.phone || "",
        address: pd.address || "",
        allergies: pd.allergies || [],
        chronicConditions: pd.chronicConditions || [],
        status: "done",
        lastVisit: new Date(),
      });
      await patient.save();
    }

    if (!patient) {
      // Memory fallback: never let doctor lose consultation
      const fallbackRec = {
        _id: new mongoose.Types.ObjectId().toString(),
        patientId: patientId,
        patientObjectId: mongoose.Types.ObjectId.isValid(patientId) ? String(patientId) : null,
        patientCode: String(patientId).startsWith("HC-") ? String(patientId) : null,
        visitId: visitId || null,
        doctorId: req.user?._id || null,
        doctorName: req.user?.name || doctorName || "Dr. Alok Sharma",
        chiefComplaint: chiefComplaint || "",
        symptoms: symptoms || "",
        duration: duration || "",
        diagnosis: diagnosis.trim(),
        vitals: vitals || {},
        medicines: formattedMedicines,
        prescription: resolvedPrescription,
        doctorNotes: doctorNotes || "",
        followUpDate: followUpDate || "",
        createdAt: new Date().toISOString(),
      };
      memoryRecords.unshift(fallbackRec);
      saveMemoryState();
      return res.status(201).json(fallbackRec);
    }

    // Determine Doctor Name & ID
    const resolvedDoctorName = req.user?.name || doctorName || "Dr. Alok Sharma";
    const resolvedDoctorId = req.user?._id || doctorId || null;

    const newRecord = new Record({
      patientId: patient._id,
      patientCode: patient.patientId || patientCode || "",
      patientObjectId: patient._id.toString(),
      visitId: visitId && mongoose.Types.ObjectId.isValid(visitId) ? visitId : null,
      doctorId: resolvedDoctorId && mongoose.Types.ObjectId.isValid(resolvedDoctorId) ? resolvedDoctorId : null,
      doctorName: resolvedDoctorName,
      chiefComplaint: chiefComplaint || "",
      symptoms: symptoms || "",
      duration: duration || "",
      diagnosis: diagnosis.trim(),
      vitals: vitals || {},
      medicines: formattedMedicines,
      prescription: resolvedPrescription,
      doctorNotes: doctorNotes || "",
      followUpDate: followUpDate || "",
    });

    const savedRecord = await newRecord.save();

    // Cache copy in memoryRecords for instant availability
    memoryRecords.unshift({
      ...savedRecord.toObject(),
      patientId: patient.toObject ? patient.toObject() : patient,
      patientCode: patient.patientId,
      patientObjectId: patient._id.toString(),
    });
    saveMemoryState();

    // 1. Mark patient status to "done" and update lastVisit
    await Patient.findByIdAndUpdate(patient._id, {
      status: "done",
      lastVisit: new Date(),
    });

    // 2. If an open OPD visit exists for this patient, automatically mark it as completed
    if (visitId && mongoose.Types.ObjectId.isValid(visitId)) {
      await OPDVisit.findByIdAndUpdate(visitId, {
        status: "done",
        completedAt: new Date(),
      });
    } else {
      await OPDVisit.updateMany(
        { patientId: patient._id, status: { $in: ["waiting", "in-progress"] } },
        { status: "done", completedAt: new Date() }
      );
    }

    // Audit log
    try {
      await AuditLog.create({
        userId: resolvedDoctorId && mongoose.Types.ObjectId.isValid(resolvedDoctorId) ? resolvedDoctorId : undefined,
        userRole: req.user?.role || "doctor",
        action: "CONSULTATION_SAVED",
        entityType: "Record",
        entityId: savedRecord._id.toString(),
        details: { patientId: patient._id.toString(), diagnosis: savedRecord.diagnosis },
      });
    } catch (e) {}

    const populatedRecord = await Record.findById(savedRecord._id)
      .populate("patientId")
      .populate("doctorId", "name specialization");

    res.status(201).json(populatedRecord || savedRecord);
  } catch (err) {
    console.error("Error creating medical record:", err);
    res.status(500).json({ error: "Failed to save medical record", details: err.message });
  }
});

export default router;