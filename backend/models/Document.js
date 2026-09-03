import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    uploadedByName: {
      type: String,
      default: "Healthcare Staff",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ["prescription", "lab_report", "discharge_summary", "imaging", "other"],
      default: "lab_report",
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: "application/octet-stream",
    },
    extractedText: {
      type: String,
      default: "",
    },
    aiSummary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
