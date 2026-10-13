import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

let fallbackActive = false;

const TMP_DIR = "/tmp";
const PATIENTS_FILE = path.join(TMP_DIR, "healthconnect_patients.json");
const VISITS_FILE = path.join(TMP_DIR, "healthconnect_visits.json");
const RECORDS_FILE = path.join(TMP_DIR, "healthconnect_records.json");

export const isFallbackActive = () => fallbackActive;
export const setFallbackActive = (val) => {
  fallbackActive = val;
};

// Demo Users
export const memoryUsers = [
  {
    _id: "60d0fe4f5311236168a109ca",
    name: "Dr. Alok Sharma",
    email: "doctor@healthconnect.local",
    password: "doctor123", // plain check or bcrypt
    role: "doctor",
    employeeId: "DOC-001",
    department: "General Medicine",
    specialization: "Chief Medical Officer",
  },
  {
    _id: "60d0fe4f5311236168a109cb",
    name: "Priya Deshmukh",
    email: "reception@healthconnect.local",
    password: "reception123",
    role: "receptionist",
    employeeId: "REC-001",
    department: "OPD Front Desk",
    specialization: "Reception Supervisor",
  },
];

// Sample Patients
export const memoryPatients = [
  {
    _id: "60d0fe4f5311236168a10901",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10902",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10903",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10904",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10905",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10906",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10907",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10908",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Sample OPD Queue
export const memoryOPDVisits = [
  {
    _id: "60d0fe4f5311236168a10911",
    patientId: memoryPatients[0],
    queueNumber: 1,
    chiefComplaint: "Acute viral fever with severe chills and body ache",
    priority: "urgent",
    status: "waiting",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10912",
    patientId: memoryPatients[1],
    queueNumber: 2,
    chiefComplaint: "Shortness of breath and wheezing after exertion",
    priority: "normal",
    status: "waiting",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "60d0fe4f5311236168a10913",
    patientId: memoryPatients[2],
    queueNumber: 3,
    chiefComplaint: "Persistent dry cough and sore throat for 4 days",
    priority: "normal",
    status: "in-progress",
    createdAt: new Date().toISOString(),
  },
];

// Sample Medical Records
export const memoryRecords = [
  {
    _id: "60d0fe4f5311236168a10921",
    patientId: "60d0fe4f5311236168a10906",
    doctorId: memoryUsers[0],
    doctorName: "Dr. Alok Sharma",
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
    followUpDate: "2026-10-25",
    createdAt: new Date().toISOString(),
  },
];

export const memoryDocuments = [];
export const memoryAuditLogs = [];

// Persist in-memory records to /tmp for multi-container / serverless resilience
export const saveMemoryState = () => {
  try {
    fs.writeFileSync(PATIENTS_FILE, JSON.stringify(memoryPatients), "utf8");
    fs.writeFileSync(VISITS_FILE, JSON.stringify(memoryOPDVisits), "utf8");
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(memoryRecords), "utf8");
  } catch (err) {
    // Non-fatal if /tmp is read-only
  }
};

export const loadMemoryState = () => {
  try {
    if (fs.existsSync(PATIENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PATIENTS_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingIds = new Set();
        memoryPatients.forEach((p) => {
          if (p.patientId) existingIds.add(String(p.patientId).toUpperCase());
          if (p._id) existingIds.add(String(p._id));
        });
        const newOnes = [];
        data.forEach((p) => {
          const hasPId = p.patientId && existingIds.has(String(p.patientId).toUpperCase());
          const hasId = p._id && existingIds.has(String(p._id));
          if (!hasPId && !hasId) {
            if (p.patientId) existingIds.add(String(p.patientId).toUpperCase());
            if (p._id) existingIds.add(String(p._id));
            newOnes.push(p);
          }
        });
        memoryPatients.unshift(...newOnes);
      }
    }
    if (fs.existsSync(VISITS_FILE)) {
      const data = JSON.parse(fs.readFileSync(VISITS_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingVisitIds = new Set(memoryOPDVisits.map((v) => String(v._id)));
        const newOnes = [];
        data.forEach((v) => {
          if (v._id && !existingVisitIds.has(String(v._id))) {
            existingVisitIds.add(String(v._id));
            newOnes.push(v);
          }
        });
        memoryOPDVisits.unshift(...newOnes);
      }
    }
    if (fs.existsSync(RECORDS_FILE)) {
      const data = JSON.parse(fs.readFileSync(RECORDS_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        const existingRecordIds = new Set(memoryRecords.map((r) => String(r._id)));
        const newOnes = [];
        data.forEach((r) => {
          if (r._id && !existingRecordIds.has(String(r._id))) {
            existingRecordIds.add(String(r._id));
            newOnes.push(r);
          }
        });
        memoryRecords.unshift(...newOnes);
      }
    }
  } catch (err) {
    // Non-fatal if file parse fails
  }
};

// Initialize from /tmp on cold start
loadMemoryState();
