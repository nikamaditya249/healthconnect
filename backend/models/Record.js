import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true },
    dosage: { type: String, default: "" },
    frequency: { type: String, default: "" },
    duration: { type: String, default: "" },
    instructions: { type: String, default: "" },
  },
  { _id: false }
);

const vitalsSchema = new mongoose.Schema(
  {
    temperature: { type: String, default: "" },
    bloodPressure: { type: String, default: "" },
    heartRate: { type: String, default: "" },
    spO2: { type: String, default: "" },
    weight: { type: String, default: "" },
  },
  { _id: false }
);

const recordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    patientCode: {
      type: String,
      index: true,
      default: "",
    },
    patientObjectId: {
      type: String,
      index: true,
      default: "",
    },
    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OPDVisit",
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    doctorName: {
      type: String,
      default: "Dr. Medical Officer",
    },
    chiefComplaint: {
      type: String,
      default: "",
    },
    symptoms: {
      type: mongoose.Schema.Types.Mixed,
      default: "",
    },
    duration: {
      type: String,
      default: "",
    },
    diagnosis: {
      type: String,
      required: true,
    },
    vitals: {
      type: vitalsSchema,
      default: () => ({}),
    },
    medicines: {
      type: [medicineSchema],
      default: [],
    },
    // Retain legacy string prescription support
    prescription: {
      type: mongoose.Schema.Types.Mixed,
      default: "",
    },
    doctorNotes: {
      type: String,
      default: "",
    },
    followUpDate: {
      type: String,
      default: "",
    },
    attachments: [
      {
        name: String,
        url: String,
        fileType: String,
      },
    ],
    aiInsights: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Record", recordSchema);