import express from "express";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import Patient from "../models/Patient.js";
import { upload } from "../middleware/upload.js";
import { optionalAuth } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

import {
  isFallbackActive,
  memoryDocuments,
  memoryPatients,
  saveMemoryState,
  loadMemoryState,
} from "../services/inMemoryStore.js";

const router = express.Router();

// UPLOAD MEDICAL DOCUMENT
router.post("/upload", optionalAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please select a file to upload." });
    }

    const { patientId, patientCode, patientObjectId, title, documentType, extractedText } = req.body;

    if (!patientId || !title) {
      return res.status(400).json({ error: "Patient ID and Document Title are required." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const resolvedPatientCode =
      patientCode || (String(patientId).startsWith("HC-") ? String(patientId) : "");
    const resolvedPatientObjectId =
      patientObjectId || (mongoose.Types.ObjectId.isValid(patientId) ? String(patientId) : "");

    if (isFallbackActive()) {
      loadMemoryState();
      const newDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        patientId,
        patientCode: resolvedPatientCode,
        patientObjectId: resolvedPatientObjectId,
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
      saveMemoryState();
      return res.status(201).json(newDoc);
    }

    let targetPatientId = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      targetPatientId = patientId;
    } else {
      const patient = await Patient.findOne({ patientId: String(patientId).toUpperCase() });
      if (patient) targetPatientId = patient._id;
    }

    // Secondary fallback: lookup in memoryPatients
    if (!targetPatientId) {
      loadMemoryState();
      const memP = memoryPatients.find(
        (p) =>
          (p._id && String(p._id) === String(patientId)) ||
          (p.patientId && String(p.patientId).toUpperCase() === String(patientId).toUpperCase())
      );
      if (memP && memP._id && mongoose.Types.ObjectId.isValid(memP._id)) {
        targetPatientId = memP._id;
      }
    }

    if (!targetPatientId || !mongoose.Types.ObjectId.isValid(targetPatientId)) {
      // Create in-memory document fallback
      loadMemoryState();
      const newDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        patientId,
        patientCode: resolvedPatientCode,
        patientObjectId: resolvedPatientObjectId,
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
      saveMemoryState();
      return res.status(201).json(newDoc);
    }

    const newDoc = new Document({
      patientId: targetPatientId,
      patientCode: resolvedPatientCode,
      patientObjectId: targetPatientId.toString(),
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

    // Cache in memory for instant multi-container access
    memoryDocuments.unshift(saved.toObject());
    saveMemoryState();

    try {
      await AuditLog.create({
        userId: req.user?._id,
        userRole: req.user?.role || "staff",
        action: "DOCUMENT_UPLOADED",
        entityType: "Document",
        entityId: saved._id.toString(),
        details: { patientId, title: saved.title, fileName: saved.fileName },
      });
    } catch (e) {}

    res.status(201).json(saved);
  } catch (err) {
    console.error("Error uploading document:", err);
    res.status(500).json({ error: "Document upload failed", details: err.message });
  }
});

// CLIENT-SERVER DOCUMENT SYNC (Guarantees multi-container consistency on serverless)
router.post("/sync", optionalAuth, async (req, res) => {
  try {
    const { documents } = req.body;
    if (Array.isArray(documents) && documents.length > 0) {
      loadMemoryState();
      const existingIds = new Set(memoryDocuments.map((d) => String(d._id)));
      documents.forEach((d) => {
        if (d && d._id && !existingIds.has(String(d._id))) {
          memoryDocuments.unshift(d);
          existingIds.add(String(d._id));
        }
      });
      saveMemoryState();
      return res.json({ success: true, count: memoryDocuments.length });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET DOCUMENTS FOR A PATIENT
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const target = String(patientId).trim().toUpperCase();

    const getMemoryDocsForPatient = () => {
      loadMemoryState();
      return memoryDocuments.filter((d) => {
        const dpId = String(d.patientId?._id || d.patientId?.patientId || d.patientId || "").toUpperCase();
        const dpCode = String(d.patientCode || "").toUpperCase();
        const dpObj = String(d.patientObjectId || "").toUpperCase();
        return dpId === target || dpCode === target || dpObj === target;
      });
    };

    if (isFallbackActive()) {
      const docs = getMemoryDocsForPatient();
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(docs);
    }

    let orConditions = [{ patientCode: target }];
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      orConditions.push({ patientId: new mongoose.Types.ObjectId(patientId) });
      orConditions.push({ patientObjectId: String(patientId) });
    }

    const patient = await Patient.findOne({ patientId: target });
    if (patient) {
      orConditions.push({ patientId: patient._id });
      orConditions.push({ patientObjectId: patient._id.toString() });
    }

    let docs = await Document.find({ $or: orConditions }).sort({
      createdAt: -1,
    });

    // Merge with memoryDocs
    const memDocs = getMemoryDocsForPatient();
    if (memDocs.length > 0) {
      const existingIds = new Set(docs.map((d) => String(d._id)));
      for (const md of memDocs) {
        if (!existingIds.has(String(md._id))) {
          docs.push(md);
          existingIds.add(String(md._id));
        }
      }
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json(docs);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ error: "Failed to fetch documents", details: err.message });
  }
});

// DELETE DOCUMENT
router.delete("/:id", optionalAuth, async (req, res) => {
  try {
    loadMemoryState();
    const idx = memoryDocuments.findIndex((d) => String(d._id) === String(req.params.id));
    if (idx !== -1) {
      memoryDocuments.splice(idx, 1);
      saveMemoryState();
    }

    if (!isFallbackActive() && mongoose.Types.ObjectId.isValid(req.params.id)) {
      await Document.findByIdAndDelete(req.params.id);
    }

    try {
      await AuditLog.create({
        userId: req.user?._id,
        userRole: req.user?.role || "staff",
        action: "DOCUMENT_DELETED",
        entityType: "Document",
        entityId: req.params.id,
      });
    } catch (e) {}

    res.json({ success: true, message: "Document removed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document", details: err.message });
  }
});

export default router;
