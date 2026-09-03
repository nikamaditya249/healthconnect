import express from "express";
import Document from "../models/Document.js";
import { upload } from "../middleware/upload.js";
import { optionalAuth } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

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

    const newDoc = new Document({
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
    const docs = await Document.find({ patientId: req.params.patientId }).sort({
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
