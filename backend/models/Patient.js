import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "male", "female", "other"],
      required: true,
    },
    bloodGroup: {
      type: String,
      default: "Unknown",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    allergies: {
      type: [String],
      default: [],
    },
    chronicConditions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["waiting", "in-progress", "done"],
      default: "waiting",
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Auto-assign patientId if not provided
patientSchema.pre("save", async function () {
  if (!this.patientId) {
    const count = await mongoose.model("Patient").countDocuments();
    this.patientId = `HC-${String(count + 1).padStart(6, "0")}`;
  }
});

export default mongoose.model("Patient", patientSchema);