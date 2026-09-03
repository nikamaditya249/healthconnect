import express from "express";
import Patient from "../models/Patient.js";

const router = express.Router();


// CREATE PATIENT
router.post(["/", "/add"], async (req, res) => {
  try {
    const patient = new Patient(req.body);
    const saved = await patient.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json(err);
  }
});


// GET ALL PATIENTS
router.get("/", async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET SINGLE PATIENT
router.get("/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json(err);
  }
});


// UPDATE STATUS
router.put("/:id/status", async (req, res) => {
  try {
    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json(err);
  }
});

export default router;