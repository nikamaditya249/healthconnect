import mongoose from "mongoose";

const opdVisitSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    queueNumber: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["waiting", "in-progress", "done", "cancelled", "completed"],
      default: "waiting",
      index: true,
    },
    chiefComplaint: {
      type: String,
      default: "General Consultation",
    },
    priority: {
      type: String,
      enum: ["normal", "urgent", "emergency"],
      default: "normal",
    },
    visitDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Auto-assign queue number for today
opdVisitSchema.pre("save", async function () {
  if (this.isNew && !this.queueNumber) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await mongoose.model("OPDVisit").countDocuments({
      visitDate: { $gte: startOfDay, $lte: endOfDay },
    });
    this.queueNumber = count + 1;
  }
});

export default mongoose.model("OPDVisit", opdVisitSchema);
