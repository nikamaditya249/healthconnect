import express from "express";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import Patient from "../models/Patient.js";
import { upload } from "../middleware/upload.js";
import { optionalAuth } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

import { isFallbackActive, memoryDocuments } from "../services/inMemoryStore.js";

const router = express.Router();

// UPLOAD MEDICAL DOCUMENT
router.post("/upload", optionalAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please select a file to upload." });
    }

    const { patientId, title, documentType, extractedText } = req.body;

    if (!patientId || !title) {
      return res.status(400).json({ error: "Patient ID and Document Title are required." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    if (isFallbackActive()) {
      const newDoc = {
        _id: "60d0fe4f5311236168a109" + (memoryDocuments.length + 70),
        patientId,
        uploadedBy: req.user?._id || null,
        uploadedByName: req.user?.name || "Healthcare Staff",
        title: title.trim(),
        documentType: documentType || "lab_report",
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        extractedText: extractedText || "",
        createdAt: new Date().toISOString(),
      };
      memoryDocuments.unshift(newDoc);
      return res.status(201).json(newDoc);
    }

    let targetPatientId = patientId;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      const patient = await Patient.findOne({ patientId: String(patientId).toUpperCase() });
      if (patient) targetPatientId = patient._id;
    }

    const newDoc = new Document({
      patientId: targetPatientId,
      uploadedBy: req.user?._id || null,
      uploadedByName: req.user?.name || "Healthcare Staff",
      title: title.trim(),
      documentType: documentType || "lab_report",
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      extractedText: extractedText || "",
    });

    const saved = await newDoc.save();

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "staff",
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: saved._id.toString(),
      details: { patientId, title: saved.title, fileName: saved.fileName },
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("Error uploading document:", err);
    res.status(500).json({ error: "Document upload failed", details: err.message });
  }
});

// GET DOCUMENTS FOR A PATIENT
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (isFallbackActive()) {
      const docs = memoryDocuments.filter(
        (d) =>
          String(d.patientId) === String(patientId) ||
          (d.patientId?.patientId && String(d.patientId.patientId).toUpperCase() === String(patientId).toUpperCase())
      );
      return res.json(docs);
    }

    let targetPatientId = patientId;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      const patient = await Patient.findOne({ patientId: String(patientId).toUpperCase() });
      if (patient) targetPatientId = patient._id;
    }

    const docs = await Document.find({ patientId: targetPatientId }).sort({
      createdAt: -1,
    });
    res.json(docs);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ error: "Failed to fetch documents", details: err.message });
  }
});

// DELETE DOCUMENT
router.delete("/:id", optionalAuth, async (req, res) => {
  try {
    if (isFallbackActive()) {
      const idx = memoryDocuments.findIndex((d) => d._id === req.params.id);
      if (idx !== -1) memoryDocuments.splice(idx, 1);
      return res.json({ success: true, message: "Document removed successfully" });
    }

    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    await AuditLog.create({
      userId: req.user?._id,
      userRole: req.user?.role || "staff",
      action: "DOCUMENT_DELETED",
      entityType: "Document",
      entityId: req.params.id,
    });

    res.json({ success: true, message: "Document removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document", details: err.message });
  }
});

export default router;
