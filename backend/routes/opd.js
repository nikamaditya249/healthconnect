import express from "express";
import OPDVisit from "../models/OPDVisit.js";
import Patient from "../models/Patient.js";
import AuditLog from "../models/AuditLog.js";
import { optionalAuth } from "../middleware/auth.js";

import { isFallbackActive, memoryOPDVisits, memoryPatients } from "../services/inMemoryStore.js";

const router = express.Router();

// GET TODAY'S OPD QUEUE
router.get("/queue", async (req, res) => {
  try {
    const { status } = req.query;

    if (isFallbackActive()) {
      let q = [...memoryOPDVisits];
      if (status && status !== "all") {
        q = q.filter((v) => v.status === status);
      }
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
      .sort({ status: -1, createdAt: -1 });

    // Filter out any orphaned visits where patient was deleted
    const validQueue = queue.filter((v) => v.patientId !== null);

    res.json(validQueue);
  } catch (err) {
    console.error("Error fetching OPD queue:", err);
    res.status(500).json({ error: "Failed to fetch OPD queue", details: err.message });
  }
});

// GET QUEUE STATS
router.get("/stats", async (req, res) => {
  try {
    if (isFallbackActive()) {
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
router.post(["/visit", "/add"], optionalAuth, async (req, res) => {
  try {
    const { patientId, doctorId, chiefComplaint, priority } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    if (isFallbackActive()) {
      const p = memoryPatients.find(
        (pt) => pt._id === patientId || pt.patientId === patientId
      );
      if (!p) return res.status(404).json({ error: "Patient record not found" });
      const newV = {
        _id: "60d0fe4f5311236168a109" + (memoryOPDVisits.length + 30),
        patientId: p,
        queueNumber: memoryOPDVisits.length + 1,
        chiefComplaint: chiefComplaint || "General OPD Consultation",
        priority: priority || "normal",
        status: "waiting",
        visitDate: new Date(),
        createdAt: new Date().toISOString(),
      };
      p.status = "waiting";
      memoryOPDVisits.unshift(newV);
      return res.status(201).json(newV);
    }

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient record not found" });
    }

    // Check if patient already has an active waiting or in-progress visit today
    const existingActive = await OPDVisit.findOne({
      patientId,
      status: { $in: ["waiting", "in-progress"] },
    });

    if (existingActive) {
      return res.status(409).json({
        error: `Patient already has an active visit in queue (Queue #${existingActive.queueNumber})`,
        visit: existingActive,
      });
    }

    const newVisit = new OPDVisit({
      patientId,
      doctorId: doctorId || null,
      chiefComplaint: chiefComplaint || "General OPD Consultation",
      priority: priority || "normal",
      status: "waiting",
      visitDate: new Date(),
    });

    const savedVisit = await newVisit.save();

    // Update patient status and lastVisit
    await Patient.findByIdAndUpdate(patientId, {
      status: "waiting",
      lastVisit: new Date(),
    });

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "receptionist",
      action: "OPD_VISIT_CREATED",
      entityType: "OPDVisit",
      entityId: savedVisit._id.toString(),
      details: { patientId, queueNumber: savedVisit.queueNumber },
    });

    const populated = await OPDVisit.findById(savedVisit._id)
      .populate("patientId")
      .populate("doctorId", "name employeeId");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating OPD visit:", err);
    res.status(500).json({ error: "Failed to create OPD visit", details: err.message });
  }
});

// UPDATE VISIT STATUS (waiting -> in-progress -> done)
router.put(["/visit/:id/status", "/:id/complete", "/:id/status"], optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let nextStatus = req.body.status;

    // Handle legacy route /:id/complete without body
    if (req.url.includes("complete")) {
      nextStatus = "completed";
    }

    if (!nextStatus) {
      return res.status(400).json({ error: "Status is required" });
    }

    if (isFallbackActive()) {
      const v = memoryOPDVisits.find((item) => item._id === id);
      if (v) {
        v.status = nextStatus;
        if (v.patientId) v.patientId.status = nextStatus;
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

    const updated = await OPDVisit.findByIdAndUpdate(id, updateFields, { new: true })
      .populate("patientId")
      .populate("doctorId", "name");

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
      entityId: id,
    });

    res.json(updated);
  } catch (err) {
    console.error("Error updating visit status:", err);
    res.status(500).json({ error: "Failed to update visit status", details: err.message });
  }
});

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
