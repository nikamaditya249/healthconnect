import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "completed"],
      default: "waiting",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);