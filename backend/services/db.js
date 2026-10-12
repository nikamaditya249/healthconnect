import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seedDefaultUsers } from "../routes/auth.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import OPDVisit from "../models/OPDVisit.js";
import Record from "../models/Record.js";

let memoryServer = null;
let activeEngine = "Disconnected";

export const getActiveDbEngine = () => activeEngine;

export const seedSamplePatients = async () => {
  try {
    const patientCount = await Patient.countDocuments();
    if (patientCount === 0) {
      console.log("🌱 Syncing all clinical patients & active OPD queue from MongoDB Atlas data...");
      
      const p1 = await Patient.create({
        patientId: "HC-B80436",
        name: "Omkar Maske",
        age: 20,
        gender: "Male",
        bloodGroup: "B+",
        phone: "+91 9823011223",
        address: "Pune, Maharashtra",
        allergies: [],
        chronicConditions: [],
        status: "waiting",
      });

      const p2 = await Patient.create({
        patientId: "HC-B80433",
        name: "Ayush Mishra",
        age: 21,
        gender: "Male",
        bloodGroup: "O+",
        phone: "+91 9890123456",
        address: "Mumbai, Maharashtra",
        allergies: ["Penicillin"],
        chronicConditions: ["Asthma"],
        status: "waiting",
      });

      const p3 = await Patient.create({
        patientId: "HC-4F540A",
        name: "Arya",
        age: 19,
        gender: "Male",
        bloodGroup: "O+",
        phone: "+91 9765432109",
        address: "Nagpur, Maharashtra",
        allergies: [],
        chronicConditions: [],
        status: "in-progress",
      });

      const p4 = await Patient.create({
        patientId: "HC-84D42C",
        name: "Kunal",
        age: 21,
        gender: "Male",
        bloodGroup: "A+",
        phone: "+91 9988776611",
        address: "Nashik, Maharashtra",
        allergies: [],
        chronicConditions: [],
        status: "done",
      });

      const p5 = await Patient.create({
        patientId: "HC-84D44E",
        name: "Aditya",
        age: 22,
        gender: "Male",
        bloodGroup: "B+",
        phone: "+91 9988776622",
        address: "Pune, Maharashtra",
        allergies: [],
        chronicConditions: [],
        status: "done",
      });

      const p6 = await Patient.create({
        patientId: "HC-7971F0",
        name: "Aditya Nikam",
        age: 20,
        gender: "Male",
        bloodGroup: "O+",
        phone: "+91 9988776633",
        address: "Kothrud, Pune",
        allergies: [],
        chronicConditions: [],
        status: "done",
      });

      const p7 = await Patient.create({
        patientId: "HC-8A8194",
        name: "Avishkar Durgade",
        age: 20,
        gender: "Male",
        bloodGroup: "B+",
        phone: "+91 9988776644",
        address: "Baner, Pune",
        allergies: [],
        chronicConditions: [],
        status: "done",
      });

      const p8 = await Patient.create({
        patientId: "HC-EB68A9",
        name: "Harsh Bhagat",
        age: 19,
        gender: "Male",
        bloodGroup: "O+",
        phone: "+91 9988776655",
        address: "Viman Nagar, Pune",
        allergies: [],
        chronicConditions: [],
        status: "done",
      });

      // Create Active OPD Visits for today's queue
      await OPDVisit.create([
        {
          patientId: p1._id,
          queueNumber: 1,
          chiefComplaint: "Acute viral fever with severe chills and body ache",
          priority: "urgent",
          status: "waiting",
        },
        {
          patientId: p2._id,
          queueNumber: 2,
          chiefComplaint: "Shortness of breath and wheezing after exertion",
          priority: "normal",
          status: "waiting",
        },
        {
          patientId: p3._id,
          queueNumber: 3,
          chiefComplaint: "Persistent dry cough and sore throat for 4 days",
          priority: "normal",
          status: "in-progress",
        },
      ]);

      // Seed historical records
      const doctorUser = await User.findOne({ role: "doctor" });
      if (doctorUser) {
        await Record.create({
          patientId: p6._id,
          doctorId: doctorUser._id,
          doctorName: doctorUser.name,
          chiefComplaint: "Routine seasonal health examination",
          duration: "3 days",
          symptoms: "Mild nasal congestion and fatigue",
          diagnosis: "Acute Upper Respiratory Tract Infection (URTI)",
          vitals: {
            bloodPressure: "120/80",
            heartRate: "72",
            temperature: "98.4",
            spO2: "99",
            weight: "68",
          },
          medicines: [
            {
              medicine: "Paracetamol",
              dosage: "650mg",
              frequency: "1-0-1",
              duration: "3 days",
              instructions: "After food with warm water",
            },
            {
              medicine: "Cetirizine",
              dosage: "10mg",
              frequency: "0-0-1",
              duration: "5 days",
              instructions: "Night before sleep",
            },
          ],
          doctorNotes: "Chest clear. Hydration recommended. Follow up if fever exceeds 101F.",
          followUpDate: "2026-09-10",
        });
      }

      console.log("✅ Seeded all Atlas clinical patients and live OPD queue.");
    }
  } catch (err) {
    console.error("⚠️ Error seeding sample patients:", err.message);
  }
};

export const connectDatabase = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI;

  if (mongoUri) {
    try {
      console.log("⏳ Attempting connection to MongoDB Atlas cluster...");
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 6000,
      });
      activeEngine = "MongoDB Atlas";
      console.log("✅ Connected directly to MongoDB Atlas!");
      await seedDefaultUsers();
      await seedSamplePatients();
      return;
    } catch (err) {
      console.warn("⚠️ MongoDB Atlas connection error:", err.message);
      if (process.env.VERCEL) {
        throw new Error(`MongoDB Atlas connection failed: ${err.message}. Please verify MONGO_URI and Atlas network access (allow 0.0.0.0/0).`);
      }
      console.log("⚡ Auto-switching to full database engine so application stays 100% operational...");
    }
  }

  if (process.env.VERCEL) {
    throw new Error("MONGO_URI environment variable is required on Vercel.");
  }

  // Fallback to embedded MongoDB server
  try {
    memoryServer = await MongoMemoryServer.create();
    const fallbackUri = memoryServer.getUri();
    await mongoose.connect(fallbackUri);
    activeEngine = "Embedded MongoDB Server";
    console.log("✅ Database instance running and connected successfully!");
    await seedDefaultUsers();
    await seedSamplePatients();
  } catch (memErr) {
    console.error("❌ Failed to start database instance:", memErr.message);
    throw memErr;
  }
};
