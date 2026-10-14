import express from "express";
import mongoose from "mongoose";
import OPDVisit from "../models/OPDVisit.js";
import Patient from "../models/Patient.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

import {
  isFallbackActive,
  memoryOPDVisits,
  memoryPatients,
  saveMemoryState,
  loadMemoryState,
} from "../services/inMemoryStore.js";

const router = express.Router();

// GET TODAY'S OPD QUEUE
router.get("/queue", async (req, res) => {
  try {
    const { status } = req.query;

    if (isFallbackActive()) {
      loadMemoryState();
      let q = [...memoryOPDVisits];
      if (status && status !== "all") {
        q = q.filter((v) => v.status === status);
      }
      // Strictly sort by queueNumber ascending (Token #1, #2, #3, ...)
      q.sort((a, b) => (Number(a.queueNumber) || 0) - (Number(b.queueNumber) || 0));
      return res.json(q);
    }

    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    } else {
      // By default return active queue (waiting and in-progress, plus recent completed)
      filter.status = { $in: ["waiting", "in-progress", "done", "completed"] };
    }

    const queue = await OPDVisit.find(filter)
      .populate("patientId")
      .populate("doctorId", "name employeeId specialization department")
      .sort({ queueNumber: 1, createdAt: 1 });

    // Filter out any orphaned visits where patient was deleted
    const validQueue = queue.filter((v) => v.patientId !== null);

    res.json(validQueue);
  } catch (err) {
    console.error("Error fetching OPD queue:", err);
    res.status(500).json({ error: "Failed to fetch OPD queue", details: err.message });
  }
});

// CLIENT-SERVER QUEUE SYNC (Guarantees multi-container consistency on serverless)
router.post("/sync", optionalAuth, async (req, res) => {
  try {
    const { visits } = req.body;
    if (isFallbackActive() && Array.isArray(visits) && visits.length > 0) {
      loadMemoryState();
      const existingVisitIds = new Set(memoryOPDVisits.map((v) => String(v._id)));
      visits.forEach((v) => {
        if (v && v._id && !existingVisitIds.has(String(v._id))) {
          memoryOPDVisits.push(v);
          existingVisitIds.add(String(v._id));
        }
      });
      memoryOPDVisits.sort((a, b) => (Number(a.queueNumber) || 0) - (Number(b.queueNumber) || 0));
      saveMemoryState();
      return res.json({ success: true, count: memoryOPDVisits.length });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET QUEUE STATS
router.get("/stats", async (req, res) => {
  try {
    if (isFallbackActive()) {
      loadMemoryState();
      const waitingCount = memoryOPDVisits.filter((v) => v.status === "waiting").length;
      const inProgressCount = memoryOPDVisits.filter((v) => v.status === "in-progress").length;
      const completedCount = memoryPatients.filter((p) => p.status === "done").length;
      return res.json({
        today: memoryOPDVisits.length + completedCount,
        waiting: waitingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        totalPatients: memoryPatients.length,
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalToday, waitingCount, inProgressCount, completedCount, totalPatients] =
      await Promise.all([
        OPDVisit.countDocuments({ createdAt: { $gte: startOfDay } }),
        OPDVisit.countDocuments({ status: "waiting" }),
        OPDVisit.countDocuments({ status: "in-progress" }),
        OPDVisit.countDocuments({ status: { $in: ["done", "completed"] } }),
        Patient.countDocuments(),
      ]);

    res.json({
      today: totalToday,
      waiting: waitingCount,
      inProgress: inProgressCount,
      completed: completedCount,
      totalPatients,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats", details: err.message });
  }
});

// CREATE OPD VISIT / ENQUEUE PATIENT
router.post(["/visit", "/visits", "/add", "/", "/queue"], optionalAuth, async (req, res) => {
  try {
    const { patientId, doctorId, chiefComplaint, priority, patientData } = req.body;

    const targetLookupId = patientId || patientData?._id || patientData?.patientId || "";

    if (isFallbackActive()) {
      let p = memoryPatients.find(
        (pt) =>
          (pt._id && String(pt._id) === String(targetLookupId)) ||
          (pt.patientId && String(pt.patientId).toUpperCase() === String(targetLookupId).toUpperCase())
      );

      // If not in warm memory, check /tmp persistent state
      if (!p) {
        loadMemoryState();
        p = memoryPatients.find(
          (pt) =>
            (pt._id && String(pt._id) === String(targetLookupId)) ||
            (pt.patientId && String(pt.patientId).toUpperCase() === String(targetLookupId).toUpperCase())
        );
      }

      // Auto-sync / restore patient if payload passed patientData (fixes serverless container drift)
      if (!p && (patientData || req.body.patient)) {
        const pd = patientData || req.body.patient;
        let maxNum = 0;
        memoryPatients.forEach((pt) => {
          const m = String(pt.patientId || "").match(/^HC-(\d+)$/i);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        const genId = pd.patientId || `HC-${String(Math.max(maxNum + 1, memoryPatients.length + 1)).padStart(6, "0")}`;
        p = {
          _id: pd._id && mongoose.Types.ObjectId.isValid(pd._id) ? String(pd._id) : new mongoose.Types.ObjectId().toString(),
          patientId: genId,
          name: pd.name || "Unknown Patient",
          age: Number(pd.age) || 0,
          gender: pd.gender || "Male",
          bloodGroup: pd.bloodGroup || "Unknown",
          phone: pd.phone ? String(pd.phone).trim() : "",
          address: pd.address ? String(pd.address).trim() : "",
          emergencyContact: pd.emergencyContact || { name: "", relationship: "", phone: "" },
          allergies: Array.isArray(pd.allergies) ? pd.allergies : [],
          chronicConditions: Array.isArray(pd.chronicConditions) ? pd.chronicConditions : [],
          status: "waiting",
          createdAt: pd.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memoryPatients.unshift(p);
        saveMemoryState();
      }

      // Guarantee fallback patient creation if still not found so patient intake is NEVER blocked
      if (!p) {
        const cleanName = (req.body.name || req.body.patientName || "Walk-in Patient").trim();
        const pIdStr = String(targetLookupId || "");
        let maxNum = 0;
        memoryPatients.forEach((pt) => {
          const m = String(pt.patientId || "").match(/^HC-(\d+)$/i);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        const genId = pIdStr.startsWith("HC-") ? pIdStr : `HC-${String(Math.max(maxNum + 1, memoryPatients.length + 1)).padStart(6, "0")}`;
        p = {
          _id: new mongoose.Types.ObjectId().toString(),
          patientId: genId,
          name: cleanName,
          age: Number(req.body.age) || 20,
          gender: req.body.gender || "Male",
          bloodGroup: req.body.bloodGroup || "O+",
          phone: req.body.phone || "",
          address: req.body.address || "",
          emergencyContact: { name: "", relationship: "", phone: "" },
          allergies: [],
          chronicConditions: [],
          status: "waiting",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memoryPatients.unshift(p);
        saveMemoryState();
      }

      // Robust duplicate queue check in fallback mode
      const isSamePatient = (visit) => {
        const vp = visit.patientId;
        if (!vp) return false;

        // Priority 1: Match by clinical patient ID (e.g., HC-000010) if present on both
        if (vp.patientId && p.patientId) {
          return String(vp.patientId).trim().toUpperCase() === String(p.patientId).trim().toUpperCase();
        }

        // Priority 2: Match by exact _id if both are valid
        const vId = String(vp._id || vp);
        const targetId = String(p._id || "");
        if (vId && targetId && vId === targetId) {
          return true;
        }

        // Priority 3: Match by phone if present on both
        if (vp.phone && p.phone && String(vp.phone).trim() === String(p.phone).trim()) {
          return true;
        }

        return false;
      };

      const existingActive = memoryOPDVisits.find(
        (v) => isSamePatient(v) && (v.status === "waiting" || v.status === "in-progress")
      );

      if (existingActive) {
        return res.status(200).json({
          ...existingActive,
          alreadyQueued: true,
          message: `Patient already has an active visit in queue (Queue #${existingActive.queueNumber})`,
        });
      }

      let maxQueue = 0;
      memoryOPDVisits.forEach((v) => {
        if (typeof v.queueNumber === "number" && v.queueNumber > maxQueue) {
          maxQueue = v.queueNumber;
        }
      });

      const newV = {
        _id: new mongoose.Types.ObjectId().toString(),
        patientId: p,
        queueNumber: maxQueue + 1,
        chiefComplaint: chiefComplaint || "General OPD Consultation",
        priority: priority || "normal",
        status: "waiting",
        visitDate: new Date(),
        createdAt: new Date().toISOString(),
      };
      p.status = "waiting";
      memoryOPDVisits.unshift(newV);
      saveMemoryState();
      return res.status(201).json(newV);
    }

    // Check if patient exists in MongoDB (support both ObjectId and HC-XXXXXX patientId)
    let patient = null;
    if (mongoose.Types.ObjectId.isValid(targetLookupId)) {
      patient = await Patient.findById(targetLookupId);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: String(targetLookupId).toUpperCase() });
    }

    // Auto-sync into MongoDB if patientData was provided
    if (!patient && (patientData || req.body.patient)) {
      const pd = patientData || req.body.patient;
      const count = await Patient.countDocuments();
      patient = new Patient({
        patientId: pd.patientId || `HC-${String(count + 1).padStart(6, "0")}`,
        name: pd.name || "Unknown Patient",
        age: Number(pd.age) || 0,
        gender: pd.gender || "Male",
        bloodGroup: pd.bloodGroup || "Unknown",
        phone: pd.phone ? String(pd.phone).trim() : "",
        address: pd.address ? String(pd.address).trim() : "",
        emergencyContact: pd.emergencyContact || { name: "", relationship: "", phone: "" },
        allergies: Array.isArray(pd.allergies) ? pd.allergies : [],
        chronicConditions: Array.isArray(pd.chronicConditions) ? pd.chronicConditions : [],
        status: "waiting",
        lastVisit: new Date(),
      });
      await patient.save();
    }

    // Guarantee fallback patient creation in MongoDB so intake is NEVER blocked
    if (!patient) {
      const cleanName = (req.body.name || req.body.patientName || "Walk-in Patient").trim();
      const pIdStr = String(targetLookupId || "");
      const count = await Patient.countDocuments();
      patient = new Patient({
        patientId: pIdStr.startsWith("HC-") ? pIdStr : `HC-${String(count + 1).padStart(6, "0")}`,
        name: cleanName,
        age: Number(req.body.age) || 20,
        gender: req.body.gender || "Male",
        bloodGroup: req.body.bloodGroup || "O+",
        phone: req.body.phone || "",
        status: "waiting",
        lastVisit: new Date(),
      });
      await patient.save();
    }

    // Check if patient already has an active waiting or in-progress visit today
    const existingActive = await OPDVisit.findOne({
      patientId: patient._id,
      status: { $in: ["waiting", "in-progress"] },
    })
      .populate("patientId")
      .populate("doctorId", "name employeeId");

    if (existingActive) {
      const visitObj = existingActive.toObject ? existingActive.toObject() : existingActive;
      return res.status(200).json({
        ...visitObj,
        alreadyQueued: true,
        message: `Patient already has an active visit in queue (Queue #${existingActive.queueNumber})`,
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const countToday = await OPDVisit.countDocuments({
      visitDate: { $gte: startOfDay, $lte: endOfDay },
    });

    const newVisit = new OPDVisit({
      patientId: patient._id,
      doctorId: doctorId || null,
      queueNumber: countToday + 1,
      chiefComplaint: chiefComplaint || "General OPD Consultation",
      priority: priority || "normal",
      status: "waiting",
      visitDate: new Date(),
    });

    const savedVisit = await newVisit.save();

    // Update patient status and lastVisit
    await Patient.findByIdAndUpdate(patient._id, {
      status: "waiting",
      lastVisit: new Date(),
    });

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "receptionist",
      action: "OPD_VISIT_CREATED",
      entityType: "OPDVisit",
      entityId: savedVisit._id.toString(),
      details: { patientId: patient.patientId, queueNumber: savedVisit.queueNumber },
    });

    const populated = await OPDVisit.findById(savedVisit._id)
      .populate("patientId")
      .populate("doctorId", "name employeeId");

    res.status(201).json(populated || savedVisit);
  } catch (err) {
    console.error("Error creating OPD visit:", err);
    res.status(500).json({ error: "Failed to create OPD visit", details: err.message });
  }
});

// UPDATE VISIT STATUS (waiting -> in-progress -> done/completed)
const handleUpdateVisitStatus = async (req, res) => {
  try {
    const id = req.params.id || req.body.visitId || req.body.patientId;
    let nextStatus = req.body.status;

    // Handle legacy route /:id/complete without body
    if (req.url.includes("complete") || !nextStatus) {
      nextStatus = "completed";
    }

    if (!id) {
      return res.status(400).json({ error: "Visit ID or Patient ID is required" });
    }

    if (isFallbackActive()) {
      const matchVisit = (item) =>
        String(item._id) === String(id) ||
        String(item.patientId?._id || item.patientId) === String(id) ||
        String(item.patientId?.patientId || "").toUpperCase() === String(id).toUpperCase();

      let v = memoryOPDVisits.find(matchVisit);
      if (!v) {
        loadMemoryState();
        v = memoryOPDVisits.find(matchVisit);
      }
      if (v) {
        v.status = nextStatus;
        if (nextStatus === "done" || nextStatus === "completed") {
          v.completedAt = new Date().toISOString();
        } else if (nextStatus === "in-progress") {
          v.startedAt = new Date().toISOString();
        }
        if (v.patientId && typeof v.patientId === "object") {
          v.patientId.status = (nextStatus === "completed" || nextStatus === "done") ? "done" : nextStatus;
        }
        saveMemoryState();
        return res.json(v);
      }
      return res.json({ _id: id, status: nextStatus });
    }

    const updateFields = { status: nextStatus };
    if (nextStatus === "in-progress") {
      updateFields.startedAt = new Date();
    } else if (nextStatus === "done" || nextStatus === "completed") {
      updateFields.completedAt = new Date();
    }

    let updated = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updated = await OPDVisit.findByIdAndUpdate(id, updateFields, { new: true })
        .populate("patientId")
        .populate("doctorId", "name");
    }

    // If not found by direct visit ObjectId, attempt lookup by patient
    if (!updated) {
      let patientObjId = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        patientObjId = id;
      } else {
        const p = await Patient.findOne({ patientId: new RegExp(`^${id}$`, "i") });
        if (p) patientObjId = p._id;
      }

      if (patientObjId) {
        updated = await OPDVisit.findOneAndUpdate(
          { patientId: patientObjId, status: { $in: ["waiting", "in-progress"] } },
          updateFields,
          { new: true, sort: { createdAt: -1 } }
        )
          .populate("patientId")
          .populate("doctorId", "name");
      }
    }

    if (!updated) {
      return res.status(404).json({ error: "OPD Visit not found" });
    }

    // Sync status to patient record
    if (updated.patientId) {
      const patientStatus =
        nextStatus === "completed" ? "done" : nextStatus === "in-progress" ? "in-progress" : "waiting";
      await Patient.findByIdAndUpdate(updated.patientId._id, { status: patientStatus });
    }

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "system",
      action: `OPD_STATUS_${nextStatus.toUpperCase()}`,
      entityType: "OPDVisit",
      entityId: String(updated._id || id),
    });

    res.json(updated);
  } catch (err) {
    console.error("Error updating visit status:", err);
    res.status(500).json({ error: "Failed to update visit status", details: err.message });
  }
};

router.put(["/visit/:id/status", "/:id/complete", "/:id/status", "/complete/:id", "/:id"], optionalAuth, handleUpdateVisitStatus);
router.patch(["/visit/:id/status", "/:id/complete", "/:id/status", "/complete/:id", "/:id"], optionalAuth, handleUpdateVisitStatus);
router.post(["/complete", "/visit/complete"], optionalAuth, handleUpdateVisitStatus);

// Backward compatibility for root appointments GET
router.get("/", async (req, res) => {
  try {
    const queue = await OPDVisit.find({ status: { $in: ["waiting", "in-progress"] } })
      .populate("patientId")
      .sort({ createdAt: 1 });
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
