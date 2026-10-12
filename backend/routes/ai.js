import express from "express";
import { GoogleGenAI } from "@google/genai";
import Patient from "../models/Patient.js";
import Record from "../models/Record.js";
import { isFallbackActive, memoryPatients, memoryRecords } from "../services/inMemoryStore.js";

const router = express.Router();

// Initialize Google Gemini Client if API key is present
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() && apiKey !== "your_gemini_api_key_here") {
    return new GoogleGenAI({ apiKey });
  }
  return null;
};

// ==========================================
// FEATURE 1: AI PATIENT HISTORY SUMMARY
// ==========================================
router.post("/patient-summary", async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    let patient = null;
    let records = [];

    if (isFallbackActive()) {
      patient = memoryPatients.find((p) => p._id === patientId || p.patientId === patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      records = memoryRecords.filter(
        (r) => r.patientId === patientId || r.patientId?._id === patientId
      );
    } else {
      patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      records = await Record.find({ patientId }).sort({ createdAt: -1 });
    }

    if (records.length === 0) {
      return res.json({
        summary: `No prior consultations recorded for ${patient.name} (${patient.patientId}). This is their initial consultation.`,
        visitCount: 0,
        recurringComplaints: [],
        recentDiagnoses: [],
        disclaimer: "AI-generated clinical history summary — for review by authorized healthcare professional only. Not a medical diagnosis.",
      });
    }

    const historyData = {
      patient: {
        name: patient.name,
        id: patient.patientId,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        chronicConditions: patient.chronicConditions,
      },
      consultations: records.map((r) => ({
        date: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "Recent",
        chiefComplaint: r.chiefComplaint,
        diagnosis: r.diagnosis,
        duration: r.duration,
        symptoms: r.symptoms,
        vitals: r.vitals,
        prescription: r.prescription || (r.medicines?.map(m => `${m.medicine} ${m.dosage}`).join(", ") || "None"),
        doctorNotes: r.doctorNotes,
      })),
    };

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `
You are a certified Clinical Documentation Assistant for the HealthConnect healthcare platform.
Analyze the following patient's consultation history and produce a concise, structured executive summary for the attending doctor.

PATIENT RECORD:
${JSON.stringify(historyData, null, 2)}

SAFETY RULES:
1. Summarize strictly based on the provided records. Never hallucinate or extrapolate diagnoses not in the history.
2. Structure the summary with:
   - Overview: Total visit count, age, gender, known allergies/chronic conditions.
   - Recurring Patterns / Chronic Issues: Any repeated complaints or diagnoses.
   - Past Diagnoses & Outcomes: Chronological highlights.
   - Recent Medications / Prescriptions: Most recently prescribed medicines.
   - Key Clinical Alerts for Attending Doctor: e.g., high blood pressure trends, allergies.
3. Keep it clear, professional, bulleted, and ready for immediate clinical review.
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        return res.json({
          summary: response.text,
          visitCount: records.length,
          disclaimer: "AI-generated clinical history summary — for review by authorized healthcare professional only. Not a medical diagnosis.",
        });
      } catch (geminiErr) {
        console.warn("Gemini API call failed, falling back to intelligent rule engine:", geminiErr.message);
      }
    }

    // Intelligent Deterministic Fallback Summary
    const diagnoses = [...new Set(records.map((r) => r.diagnosis).filter(Boolean))];
    const complaints = [...new Set(records.map((r) => r.chiefComplaint).filter(Boolean))];
    const recentRecord = records[0];

    let fallbackSummary = `### Clinical History Summary: ${patient.name} (${patient.patientId})\n\n`;
    fallbackSummary += `• **Patient Demographics**: ${patient.age} yrs, ${patient.gender}, Blood Group: ${patient.bloodGroup || "Unknown"}\n`;
    fallbackSummary += `• **Consultation History**: ${records.length} recorded OPD visit(s).\n`;
    if (patient.allergies?.length) {
      fallbackSummary += `• **Documented Allergies**: ${patient.allergies.join(", ")}\n`;
    }
    if (patient.chronicConditions?.length) {
      fallbackSummary += `• **Chronic Conditions**: ${patient.chronicConditions.join(", ")}\n`;
    }
    fallbackSummary += `• **Recorded Diagnoses**: ${diagnoses.join(", ") || "None recorded"}\n`;
    fallbackSummary += `• **Frequent Complaints**: ${complaints.join(", ") || "General checkup"}\n`;
    fallbackSummary += `• **Most Recent Visit (${new Date(recentRecord.createdAt).toLocaleDateString()})**:\n`;
    fallbackSummary += `  - **Diagnosis**: ${recentRecord.diagnosis}\n`;
    if (recentRecord.prescription) {
      fallbackSummary += `  - **Prescription**: ${typeof recentRecord.prescription === "string" ? recentRecord.prescription : JSON.stringify(recentRecord.prescription)}\n`;
    }
    if (recentRecord.doctorNotes) {
      fallbackSummary += `  - **Doctor Notes**: ${recentRecord.doctorNotes}\n`;
    }

    res.json({
      summary: fallbackSummary,
      visitCount: records.length,
      disclaimer: "AI-generated clinical history summary — for review by authorized healthcare professional only. Not a medical diagnosis.",
    });
  } catch (err) {
    console.error("AI Summary error:", err);
    res.status(500).json({ error: "Failed to generate AI clinical summary", details: err.message });
  }
});

// ==========================================
// FEATURE 2: CLINICAL NOTE STRUCTURING
// ==========================================
router.post("/structure-notes", async (req, res) => {
  try {
    const { rawNotes } = req.body;

    if (!rawNotes || !rawNotes.trim()) {
      return res.status(400).json({ error: "rawNotes is required" });
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `
You are a Clinical Documentation Specialist. Convert the following unstructured doctor notes into a clean JSON structure for an Electronic Health Record form.

DOCTOR'S RAW NOTES:
"${rawNotes}"

Respond ONLY with a valid JSON object matching this schema (no markdown, no extra text):
{
  "chiefComplaint": "Brief statement of primary issue",
  "duration": "Duration (e.g., '3 days', '1 week')",
  "symptoms": ["Symptom 1", "Symptom 2"],
  "negativeFindings": ["Negative symptom 1", "Negative symptom 2"],
  "suggestedDiagnosis": "Provisional diagnosis based on notes",
  "doctorNotes": "Refined professional clinical note summary"
}
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const cleanedJsonText = response.text.replace(/```json|```/g, "").trim();
        const structured = JSON.parse(cleanedJsonText);
        return res.json({ success: true, data: structured });
      } catch (geminiErr) {
        console.warn("Gemini note structuring fallback:", geminiErr.message);
      }
    }

    // Heuristic structuring fallback
    const lines = rawNotes.split(/[.,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const chiefComplaint = lines[0] || "General Consultation";
    const durationMatch = rawNotes.match(/(\d+\s*(?:days?|weeks?|months?|hours?))/i);

    res.json({
      success: true,
      data: {
        chiefComplaint: chiefComplaint.slice(0, 80),
        duration: durationMatch ? durationMatch[0] : "Not specified",
        symptoms: lines.slice(0, 3),
        negativeFindings: rawNotes.toLowerCase().includes("no fever") ? ["No fever"] : [],
        suggestedDiagnosis: lines[0] ? `Evaluation of ${lines[0]}` : "General Assessment",
        doctorNotes: rawNotes,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to structure clinical notes", details: err.message });
  }
});

// ==========================================
// FEATURE 3: MEDICAL RECORD SEARCH / QA
// ==========================================
router.post("/record-search", async (req, res) => {
  try {
    const { patientId, query } = req.body;

    if (!patientId || !query) {
      return res.status(400).json({ error: "patientId and query are required" });
    }

    let patient = null;
    let records = [];

    if (isFallbackActive()) {
      patient = memoryPatients.find((p) => p._id === patientId || p.patientId === patientId);
      records = memoryRecords.filter(
        (r) => r.patientId === patientId || r.patientId?._id === patientId
      );
    } else {
      patient = await Patient.findById(patientId);
      records = await Record.find({ patientId }).sort({ createdAt: -1 });
    }

    if (records.length === 0) {
      return res.json({
        answer: "No past medical records found for this patient to answer this query.",
        matchedRecords: [],
      });
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `
You are a medical record retrieval assistant for HealthConnect.
Answer the following clinical query strictly based ONLY on the patient's existing recorded medical records below.
Do NOT fabricate any medical history. If the requested information is not documented in the records, state clearly that it is not documented.

QUERY: "${query}"

PATIENT RECORDS:
${JSON.stringify(records, null, 2)}

Provide a concise, direct answer citing specific visit dates and diagnoses where relevant.
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        return res.json({
          answer: response.text,
          disclaimer: "AI-assisted record search results — verify against official consultation entries.",
        });
      } catch (geminiErr) {
        console.warn("Gemini QA search fallback:", geminiErr.message);
      }
    }

    // Fallback simple search
    const lowerQuery = query.toLowerCase();
    const matches = records.filter((r) => {
      const fullText = `${r.diagnosis} ${r.chiefComplaint} ${r.doctorNotes} ${r.prescription}`.toLowerCase();
      return lowerQuery.split(" ").some((word) => word.length > 2 && fullText.includes(word));
    });

    let answer = "";
    if (matches.length > 0) {
      answer = `Found ${matches.length} relevant record(s):\n` +
        matches.map(m => `• ${new Date(m.createdAt).toLocaleDateString()}: ${m.diagnosis} (${m.chiefComplaint || "No complaint recorded"})`).join("\n");
    } else {
      answer = `No direct matches found in past records for "${query}". Total records reviewed: ${records.length}.`;
    }

    res.json({
      answer,
      disclaimer: "AI-assisted record search results — verify against official consultation entries.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to search patient records", details: err.message });
  }
});

// ==========================================
// FEATURE 4: MEDICAL DOCUMENT OCR / EXTRACTION
// ==========================================
router.post("/document-extract", async (req, res) => {
  try {
    const { documentText, documentTitle } = req.body;

    if (!documentText) {
      return res.status(400).json({ error: "documentText is required" });
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `
You are an expert Medical Document Parser. Extract key laboratory parameters, vital ranges, medications, and clinical impressions from the text below:

DOCUMENT TITLE: "${documentTitle || "Medical Document"}"
DOCUMENT TEXT:
"${documentText}"

Provide:
1. Executive Summary
2. Key Abnormal or Critical Values (if any)
3. Suggested Clinical Follow-up Actions for the doctor to review
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        return res.json({
          extraction: response.text,
          verified: false,
          disclaimer: "AI-extracted document insights — must be verified by healthcare personnel.",
        });
      } catch (geminiErr) {
        console.warn("Gemini Document extract fallback:", geminiErr.message);
      }
    }

    res.json({
      extraction: `Document Summary for "${documentTitle || "Report"}":\n• Text length: ${documentText.length} characters\n• Content preview: ${documentText.slice(0, 200)}...`,
      verified: false,
      disclaimer: "AI-extracted document insights — must be verified by healthcare personnel.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to extract document insights", details: err.message });
  }
});

export default router;
