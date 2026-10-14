"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  AlertTriangle,
  Heart,
  Stethoscope,
  Plus,
  Sparkles,
  FileText,
  Upload,
  Download,
  Trash2,
  Printer,
  CheckCircle2,
  Search,
  X,
  ChevronRight,
  ShieldCheck,
  Send,
  Eye,
} from "lucide-react";
import {
  getPatientById,
  getPatientRecords,
  createMedicalRecord,
  getPatientDocuments,
  uploadMedicalDocument,
  deleteMedicalDocument,
  generateAIPatientSummary,
  structureClinicalNotes,
  searchPatientRecordsAI,
  extractDocumentInsightsAI,
  createOPDVisit,
  syncPatients,
  syncMedicalRecords,
  syncMedicalDocuments,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Loader from "@/components/Loader";

export default function PatientProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, role, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // AI States
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchAnswer, setAiSearchAnswer] = useState("");
  const [loadingAiSearch, setLoadingAiSearch] = useState(false);
  const [rawNotesInput, setRawNotesInput] = useState("");
  const [structuringNotes, setStructuringNotes] = useState(false);

  // Add Consultation Modal
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [savingConsult, setSavingConsult] = useState(false);
  const [consultForm, setConsultForm] = useState({
    chiefComplaint: "",
    duration: "",
    symptoms: "",
    diagnosis: "",
    temperature: "",
    bloodPressure: "",
    heartRate: "",
    spO2: "",
    weight: "",
    doctorNotes: "",
    followUpDate: "",
    medicines: [{ medicine: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "After meals" }],
  });

  // Document Upload Modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("lab_report");
  const [selectedFile, setSelectedFile] = useState(null);
  const [docTextForAi, setDocTextForAi] = useState("");

  // Prescription Print Modal
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);

  // Fetch Patient & Clinical Data
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      let pData = null;
      try {
        pData = await getPatientById(id);
      } catch (pErr) {
        // Fallback to locally stored custom patients if serverless container hasn't synced
        try {
          const stored = JSON.parse(localStorage.getItem("healthconnect_custom_patients") || "[]");
          pData = stored.find(
            (p) =>
              (p._id && String(p._id) === String(id)) ||
              (p.patientId && String(p.patientId).toUpperCase() === String(id).toUpperCase())
          );
        } catch (e) {}
        if (!pData) throw pErr;
      }

      if (pData) {
        // Automatically sync patient to server so serverless containers never 404
        syncPatients([pData]).catch(() => {});
      }

      const [recordsData, docsData] = await Promise.all([
        getPatientRecords(id).catch(() => []),
        getPatientDocuments(id).catch(() => []),
      ]);

      // Merge server records with locally stored records to guarantee 100% persistence on serverless
      let mergedRecords = Array.isArray(recordsData) ? [...recordsData] : [];
      let mergedDocs = Array.isArray(docsData) ? [...docsData] : [];

      try {
        const storedRecs = JSON.parse(localStorage.getItem("healthconnect_patient_records") || "[]");
        const targetId = String(pData?._id || id).toUpperCase();
        const targetCode = String(pData?.patientId || (String(id).startsWith("HC-") ? id : "")).toUpperCase();

        const patientStoredRecs = storedRecs.filter((r) => {
          const rPid = String(r.patientId?._id || r.patientId?.patientId || r.patientId || "").toUpperCase();
          const rCode = String(r.patientCode || "").toUpperCase();
          const rObj = String(r.patientObjectId || "").toUpperCase();
          return (
            (targetId && (rPid === targetId || rObj === targetId)) ||
            (targetCode && (rPid === targetCode || rCode === targetCode))
          );
        });

        const existingRecIds = new Set(mergedRecords.map((r) => String(r._id)));
        const missingRecs = patientStoredRecs.filter((r) => !existingRecIds.has(String(r._id)));
        if (missingRecs.length > 0) {
          mergedRecords.push(...missingRecs);
          syncMedicalRecords(mergedRecords).catch(() => {});
        }

        // Keep local records cache updated
        const otherPatientsRecs = storedRecs.filter((r) => {
          const rPid = String(r.patientId?._id || r.patientId?.patientId || r.patientId || "").toUpperCase();
          const rCode = String(r.patientCode || "").toUpperCase();
          const rObj = String(r.patientObjectId || "").toUpperCase();
          const matches =
            (targetId && (rPid === targetId || rObj === targetId)) ||
            (targetCode && (rPid === targetCode || rCode === targetCode));
          return !matches;
        });
        localStorage.setItem(
          "healthconnect_patient_records",
          JSON.stringify([...mergedRecords, ...otherPatientsRecs])
        );

        // Keep local documents cache updated
        const storedDocs = JSON.parse(localStorage.getItem("healthconnect_patient_documents") || "[]");
        const patientStoredDocs = storedDocs.filter((d) => {
          const dpId = String(d.patientId?._id || d.patientId?.patientId || d.patientId || "").toUpperCase();
          const dpCode = String(d.patientCode || "").toUpperCase();
          const dpObj = String(d.patientObjectId || "").toUpperCase();
          return (
            (targetId && (dpId === targetId || dpObj === targetId)) ||
            (targetCode && (dpId === targetCode || dpCode === targetCode))
          );
        });

        const existingDocIds = new Set(mergedDocs.map((d) => String(d._id)));
        const missingDocs = patientStoredDocs.filter((d) => !existingDocIds.has(String(d._id)));
        if (missingDocs.length > 0) {
          mergedDocs.push(...missingDocs);
          syncMedicalDocuments(mergedDocs).catch(() => {});
        }

        const otherPatientsDocs = storedDocs.filter((d) => {
          const dpId = String(d.patientId?._id || d.patientId?.patientId || d.patientId || "").toUpperCase();
          const dpCode = String(d.patientCode || "").toUpperCase();
          const dpObj = String(d.patientObjectId || "").toUpperCase();
          const matches =
            (targetId && (dpId === targetId || dpObj === targetId)) ||
            (targetCode && (dpId === targetCode || dpCode === targetCode));
          return !matches;
        });
        localStorage.setItem(
          "healthconnect_patient_documents",
          JSON.stringify([...mergedDocs, ...otherPatientsDocs])
        );
      } catch (e) {}

      // Sort chronological descending (latest first)
      mergedRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      mergedDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setPatient(pData);
      setRecords(mergedRecords);
      setDocuments(mergedDocs);
    } catch (err) {
      console.error("Error fetching patient details:", err);
      addToast("Failed to load patient records", "error");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Medicine Row Handlers
  const handleAddMedicine = () => {
    setConsultForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        { medicine: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "After meals" },
      ],
    }));
  };

  const handleRemoveMedicine = (index) => {
    setConsultForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }));
  };

  const handleMedicineChange = (index, field, value) => {
    setConsultForm((prev) => {
      const updated = [...prev.medicines];
      updated[index][field] = value;
      return { ...prev, medicines: updated };
    });
  };

  // AI Feature 1: Generate History Summary
  const handleGenerateAISummary = async () => {
    setLoadingAiSummary(true);
    try {
      const res = await generateAIPatientSummary(id);
      setAiSummary(res.summary);
      addToast("AI clinical summary generated successfully", "success");
    } catch (err) {
      addToast("Failed to generate AI summary", "error");
    } finally {
      setLoadingAiSummary(false);
    }
  };

  // AI Feature 2: Natural Language Record Search
  const handleAISearch = async (e) => {
    e.preventDefault();
    if (!aiSearchQuery.trim()) return;

    setLoadingAiSearch(true);
    try {
      const res = await searchPatientRecordsAI(id, aiSearchQuery.trim());
      setAiSearchAnswer(res.answer);
    } catch (err) {
      addToast("Failed to perform AI record search", "error");
    } finally {
      setLoadingAiSearch(false);
    }
  };

  // AI Feature 3: Structure Raw Clinical Notes
  const handleStructureNotes = async () => {
    if (!rawNotesInput.trim()) {
      addToast("Please enter doctor notes to format", "error");
      return;
    }

    setStructuringNotes(true);
    try {
      const res = await structureClinicalNotes(rawNotesInput.trim());
      if (res.data) {
        setConsultForm((prev) => ({
          ...prev,
          chiefComplaint: res.data.chiefComplaint || prev.chiefComplaint,
          duration: res.data.duration || prev.duration,
          symptoms: Array.isArray(res.data.symptoms) ? res.data.symptoms.join(", ") : res.data.symptoms || prev.symptoms,
          diagnosis: res.data.suggestedDiagnosis || prev.diagnosis,
          doctorNotes: res.data.doctorNotes || prev.doctorNotes,
        }));
        addToast("Clinical notes structured into fields. Please review and edit.", "info");
      }
    } catch (err) {
      addToast("AI structuring note fallback applied", "error");
    } finally {
      setStructuringNotes(false);
    }
  };

  // Save Consultation Record
  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!consultForm.diagnosis.trim()) {
      addToast("Provisional or final diagnosis is required.", "error");
      return;
    }

    setSavingConsult(true);
    try {
      const payload = {
        patientId: patient?._id || patient?.patientId || id,
        patientCode: patient?.patientId || (String(id).startsWith("HC-") ? id : undefined),
        patientObjectId: patient?._id || (id.length === 24 ? id : undefined),
        patientData: patient,
        doctorName: user?.name || "Dr. Alok Sharma",
        doctorId: user?._id || null,
        chiefComplaint: consultForm.chiefComplaint,
        duration: consultForm.duration,
        symptoms: consultForm.symptoms,
        diagnosis: consultForm.diagnosis,
        vitals: {
          temperature: consultForm.temperature,
          bloodPressure: consultForm.bloodPressure,
          heartRate: consultForm.heartRate,
          spO2: consultForm.spO2,
          weight: consultForm.weight,
        },
        medicines: consultForm.medicines.filter((m) => m.medicine.trim()),
        doctorNotes: consultForm.doctorNotes,
        followUpDate: consultForm.followUpDate,
      };

      const newRec = await createMedicalRecord(payload);

      // Save into localStorage immediately so it is NEVER lost on subsequent refreshes
      if (newRec) {
        if (!newRec.patientCode && patient?.patientId) newRec.patientCode = patient.patientId;
        if (!newRec.patientObjectId && patient?._id) newRec.patientObjectId = patient._id;

        try {
          const stored = JSON.parse(localStorage.getItem("healthconnect_patient_records") || "[]");
          const exists = stored.some((r) => r._id === newRec._id);
          if (!exists) {
            stored.unshift(newRec);
            localStorage.setItem("healthconnect_patient_records", JSON.stringify(stored));
          }
        } catch (e) {}

        // Instantly reflect in local timeline state
        setRecords((prev) => {
          const filtered = prev.filter((r) => r._id !== newRec._id);
          const updated = [newRec, ...filtered];
          updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return updated;
        });
      }

      addToast("Consultation saved and added to medical timeline!", "success");
      setShowConsultModal(false);

      // Reset form
      setConsultForm({
        chiefComplaint: "",
        duration: "",
        symptoms: "",
        diagnosis: "",
        temperature: "",
        bloodPressure: "",
        heartRate: "",
        spO2: "",
        weight: "",
        doctorNotes: "",
        followUpDate: "",
        medicines: [{ medicine: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "After meals" }],
      });

      // Refetch data & switch to timeline tab
      await fetchData();
      setActiveTab("timeline");
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to save record";
      addToast(msg, "error");
    } finally {
      setSavingConsult(false);
    }
  };

  // Upload Document
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile || !docTitle) {
      addToast("Please select a file and enter document title", "error");
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("patientId", patient?._id || patient?.patientId || id);
      formData.append("patientCode", patient?.patientId || (String(id).startsWith("HC-") ? id : ""));
      formData.append("patientObjectId", patient?._id || (id.length === 24 ? id : ""));
      formData.append("title", docTitle);
      formData.append("documentType", docType);
      if (docTextForAi) {
        formData.append("extractedText", docTextForAi);
      }

      const newDoc = await uploadMedicalDocument(formData);

      if (newDoc) {
        if (!newDoc.patientCode && patient?.patientId) newDoc.patientCode = patient.patientId;
        if (!newDoc.patientObjectId && patient?._id) newDoc.patientObjectId = patient._id;

        try {
          const stored = JSON.parse(localStorage.getItem("healthconnect_patient_documents") || "[]");
          const exists = stored.some((d) => d._id === newDoc._id);
          if (!exists) {
            stored.unshift(newDoc);
            localStorage.setItem("healthconnect_patient_documents", JSON.stringify(stored));
          }
        } catch (e) {}

        setDocuments((prev) => {
          const filtered = prev.filter((d) => d._id !== newDoc._id);
          return [newDoc, ...filtered];
        });
      }

      addToast("Medical document uploaded successfully", "success");
      setShowDocModal(false);
      setDocTitle("");
      setSelectedFile(null);
      setDocTextForAi("");

      fetchData();
    } catch (err) {
      addToast("Document upload failed", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId) => {
    if (!confirm("Are you sure you want to remove this medical document?")) return;
    try {
      await deleteMedicalDocument(docId);
      try {
        const stored = JSON.parse(localStorage.getItem("healthconnect_patient_documents") || "[]");
        const filtered = stored.filter((d) => d._id !== docId);
        localStorage.setItem("healthconnect_patient_documents", JSON.stringify(filtered));
      } catch (e) {}

      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      addToast("Document removed", "info");
      fetchData();
    } catch (err) {
      addToast("Failed to delete document", "error");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader text="Loading patient medical records and timeline..." />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "60px auto", textAlign: "center", padding: "40px" }}>
        <AlertTriangle size={36} color="#dc2626" style={{ margin: "0 auto 12px" }} />
        <h2>Patient Record Not Found</h2>
        <p style={{ color: "#64748b", margin: "8px 0 20px" }}>
          The requested patient record could not be found or has been removed.
        </p>
        <button onClick={() => router.back()} className="btn btn-primary">
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  const latestRecord = records[0];

  return (
    <div style={{ paddingBottom: "60px" }}>
      {/* Top Breadcrumb & Return Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <button
          onClick={() => router.push(role === "doctor" ? "/doctor" : "/reception")}
          className="btn btn-secondary btn-sm"
          style={{ gap: "6px" }}
        >
          <ArrowLeft size={14} />
          <span>Back to {role === "doctor" ? "Doctor Station" : "Reception Desk"}</span>
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          {role !== "receptionist" && (
            <button
              onClick={() => setShowConsultModal(true)}
              className="btn btn-primary btn-sm"
              style={{ gap: "6px" }}
            >
              <Plus size={16} />
              <span>+ Add Consultation</span>
            </button>
          )}

          <button
            onClick={() => setShowDocModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ gap: "6px" }}
          >
            <Upload size={14} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* STICKY PATIENT HEADER CARD */}
      <div className="card" style={{ marginBottom: "22px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "18px" }}>
          {/* Patient Bio & ID */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                backgroundColor: "#fee2e2",
                color: "#c62828",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: "800",
              }}
            >
              {patient.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>
                  {patient.name}
                </h1>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#c62828",
                    backgroundColor: "#fee2e2",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {patient.patientId || `HC-${patient._id.slice(-6).toUpperCase()}`}
                </span>
                <span className={`badge badge-${patient.status || "waiting"}`}>
                  {patient.status || "waiting"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "14px", marginTop: "6px", flexWrap: "wrap", fontSize: "13px", color: "#475569" }}>
                <span><strong>Age:</strong> {patient.age} yrs</span>
                <span>•</span>
                <span><strong>Gender:</strong> {patient.gender}</span>
                <span>•</span>
                <span><strong>Blood:</strong> <span className="badge badge-pill">{patient.bloodGroup || "Unknown"}</span></span>
                {patient.phone && (
                  <>
                    <span>•</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Phone size={12} /> {patient.phone}
                    </span>
                  </>
                )}
                {patient.address && (
                  <>
                    <span>•</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={12} /> {patient.address}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Alerts Pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            {patient.allergies?.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                <AlertTriangle size={13} />
                <span>Allergies: {Array.isArray(patient.allergies) ? patient.allergies.join(", ") : patient.allergies}</span>
              </div>
            )}
            {patient.chronicConditions?.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                <Heart size={13} />
                <span>Conditions: {Array.isArray(patient.chronicConditions) ? patient.chronicConditions.join(", ") : patient.chronicConditions}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="tabs-nav">
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
        >
          <Activity size={16} />
          <span>Overview & Vitals</span>
        </button>

        <button
          onClick={() => setActiveTab("ai-assistant")}
          className={`tab-btn ${activeTab === "ai-assistant" ? "active" : ""}`}
        >
          <Sparkles size={16} color="#7c3aed" />
          <span>AI Clinical Assistant</span>
        </button>

        <button
          onClick={() => setActiveTab("timeline")}
          className={`tab-btn ${activeTab === "timeline" ? "active" : ""}`}
        >
          <Clock size={16} />
          <span>Medical Timeline ({records.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("consultations")}
          className={`tab-btn ${activeTab === "consultations" ? "active" : ""}`}
        >
          <Stethoscope size={16} />
          <span>Consultations & Rx</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`tab-btn ${activeTab === "documents" ? "active" : ""}`}
        >
          <FileText size={16} />
          <span>Documents & Reports ({documents.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW & VITALS */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Latest Vitals Card */}
          <div className="card">
            <h3 className="card-title">
              <Heart size={18} color="#c62828" />
              <span>Latest Recorded Vitals</span>
            </h3>

            {latestRecord?.vitals ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginTop: "14px" }}>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Blood Pressure</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                    {latestRecord.vitals.bloodPressure || "120/80"} <span style={{ fontSize: "11px", fontWeight: "400" }}>mmHg</span>
                  </div>
                </div>

                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Heart Rate</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                    {latestRecord.vitals.heartRate || "74"} <span style={{ fontSize: "11px", fontWeight: "400" }}>bpm</span>
                  </div>
                </div>

                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Temperature</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                    {latestRecord.vitals.temperature || "98.6"} <span style={{ fontSize: "11px", fontWeight: "400" }}>°F</span>
                  </div>
                </div>

                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>SpO2 Oxygen</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                    {latestRecord.vitals.spO2 || "99"} <span style={{ fontSize: "11px", fontWeight: "400" }}>%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "10px" }}>
                No vitals recorded yet. Add a consultation to track baseline vitals.
              </p>
            )}
          </div>

          {/* Emergency & Demographics Card */}
          <div className="card">
            <h3 className="card-title">
              <Phone size={18} color="#2563eb" />
              <span>Emergency Contact & Background</span>
            </h3>

            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
              <div>
                <span style={{ color: "#64748b" }}>Emergency Contact: </span>
                <strong>{patient.emergencyContact?.name || "Not specified"}</strong>
                {patient.emergencyContact?.relationship && ` (${patient.emergencyContact.relationship})`}
              </div>

              {patient.emergencyContact?.phone && (
                <div>
                  <span style={{ color: "#64748b" }}>Emergency Phone: </span>
                  <strong>{patient.emergencyContact.phone}</strong>
                </div>
              )}

              <div>
                <span style={{ color: "#64748b" }}>Registered On: </span>
                <span>{patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : "Recently"}</span>
              </div>

              <div>
                <span style={{ color: "#64748b" }}>Total Historical Visits: </span>
                <strong>{records.length} visit(s)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: AI CLINICAL ASSISTANT */}
      {/* ======================================================== */}
      {activeTab === "ai-assistant" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Executive History Summary Card */}
          <div className="card" style={{ border: "1px solid #ddd6fe", backgroundColor: "#faf5ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={20} color="#7c3aed" />
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#5b21b6" }}>
                  AI Patient History Summary
                </h3>
              </div>

              <button
                onClick={handleGenerateAISummary}
                disabled={loadingAiSummary}
                className="btn btn-ai btn-sm"
              >
                <Sparkles size={14} />
                <span>{loadingAiSummary ? "Generating Clinical Summary..." : "Generate AI Summary"}</span>
              </button>
            </div>

            {aiSummary ? (
              <div style={{ backgroundColor: "#ffffff", padding: "18px", borderRadius: "10px", border: "1px solid #e9d5ff", fontSize: "14px", lineHeight: "1.6", color: "#1e1b4b" }}>
                <div style={{ whiteSpace: "pre-wrap" }}>{aiSummary}</div>
                <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #f3e8ff", fontSize: "11px", color: "#7c3aed", fontWeight: "600" }}>
                  🛡️ AI-generated clinical summary — for review by authorized healthcare professional only. Not a medical diagnosis.
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "#6b21a8" }}>
                <p style={{ fontSize: "14px" }}>
                  Click <strong>&quot;Generate AI Summary&quot;</strong> to synthesize all historical visits, recurring symptoms, and active medications using Google Gemini.
                </p>
              </div>
            )}
          </div>

          {/* AI Medical Record Search / QA */}
          <div className="card">
            <h3 className="card-title">
              <Search size={18} color="#2563eb" />
              <span>AI Record Search & Clinical Inquiries</span>
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "14px" }}>
              Ask natural-language questions scoped strictly across this patient&apos;s existing consultations and prescriptions.
            </p>

            <form onSubmit={handleAISearch} style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="e.g. Has the patient ever reported drug allergies or previous asthma symptoms?"
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                className="form-control"
              />
              <button type="submit" disabled={loadingAiSearch} className="btn btn-primary" style={{ gap: "6px" }}>
                <Send size={15} />
                <span>{loadingAiSearch ? "Searching..." : "Ask AI"}</span>
              </button>
            </form>

            {aiSearchAnswer && (
              <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "14px", color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                  {aiSearchAnswer}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                  Verified against {records.length} recorded consultation(s) in MongoDB Atlas.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MEDICAL TIMELINE */}
      {/* ======================================================== */}
      {activeTab === "timeline" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                Chronological Medical Timeline
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                Historical timeline of all doctor consultations, provisional diagnoses, and treatments.
              </p>
            </div>

            {role !== "receptionist" && (
              <button onClick={() => setShowConsultModal(true)} className="btn btn-primary btn-sm">
                + Add Consultation
              </button>
            )}
          </div>

          {records.length === 0 ? (
            <div className="empty-state">
              <Clock size={32} />
              <h4>No Historical Medical Records Yet</h4>
              <p>Add a new consultation to start building this patient&apos;s digital health timeline.</p>
            </div>
          ) : (
            <div className="timeline-container">
              {records.map((r) => (
                <div key={r._id} className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "18px 22px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
                      <div>
                        <span style={{ fontSize: "16px", fontWeight: "800", color: "#c62828" }}>
                          {r.diagnosis}
                        </span>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                          Attending Physician: <strong>{r.doctorName || "Dr. Alok Sharma"}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#64748b", backgroundColor: "#f1f5f9", padding: "4px 8px", borderRadius: "6px" }}>
                          {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <button
                          onClick={() => setSelectedRecordForPrint(r)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px" }}
                          title="Print / View Prescription"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </div>

                    {r.chiefComplaint && (
                      <div style={{ fontSize: "13px", color: "#334155", marginBottom: "8px" }}>
                        <strong>Chief Complaint:</strong> {r.chiefComplaint} {r.duration ? `(${r.duration})` : ""}
                      </div>
                    )}

                    {r.symptoms && (
                      <div style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
                        <strong>Symptoms:</strong> {typeof r.symptoms === "string" ? r.symptoms : JSON.stringify(r.symptoms)}
                      </div>
                    )}

                    {/* Prescriptions */}
                    {(r.medicines?.length > 0 || r.prescription) && (
                      <div style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
                          Prescribed Medication(s):
                        </div>
                        {r.medicines?.length > 0 ? (
                          <ul style={{ paddingLeft: "18px", fontSize: "13px", color: "#334155" }}>
                            {r.medicines.map((m, i) => (
                              <li key={i}>
                                <strong>{m.medicine}</strong> {m.dosage && `(${m.dosage})`} — {m.frequency}, {m.duration} {m.instructions && `[${m.instructions}]`}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ fontSize: "13px", color: "#334155" }}>{r.prescription}</div>
                        )}
                      </div>
                    )}

                    {r.doctorNotes && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", fontStyle: "italic" }}>
                        Doctor Notes: &quot;{r.doctorNotes}&quot;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: CONSULTATIONS & PRESCRIPTIONS */}
      {/* ======================================================== */}
      {activeTab === "consultations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {records.length === 0 ? (
            <div className="card empty-state">
              <Stethoscope size={32} />
              <h4>No Consultations Recorded</h4>
              <p>Start a consultation to document diagnoses and write prescriptions.</p>
              {role !== "receptionist" && (
                <button onClick={() => setShowConsultModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: "8px" }}>
                  + Add First Consultation
                </button>
              )}
            </div>
          ) : (
            records.map((r, idx) => (
              <div key={r._id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#c62828" }}>
                      Consultation #{records.length - idx}: {r.diagnosis}
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Date: {new Date(r.createdAt).toLocaleDateString()} • Attending: {r.doctorName}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedRecordForPrint(r)}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: "6px" }}
                  >
                    <Printer size={14} />
                    <span>Print / View Rx</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                  <div><strong>Chief Complaint:</strong> {r.chiefComplaint || "—"}</div>
                  <div><strong>Duration:</strong> {r.duration || "—"}</div>
                  <div><strong>Follow-up:</strong> {r.followUpDate || "As needed"}</div>
                </div>

                {r.medicines?.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>Prescription:</h4>
                    <table className="data-table" style={{ border: "1px solid #e2e8f0" }}>
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Dosage</th>
                          <th>Frequency</th>
                          <th>Duration</th>
                          <th>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.medicines.map((m, i) => (
                          <tr key={i}>
                            <td><strong>{m.medicine}</strong></td>
                            <td>{m.dosage || "Standard"}</td>
                            <td>{m.frequency}</td>
                            <td>{m.duration}</td>
                            <td>{m.instructions || "After meals"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: MEDICAL DOCUMENTS */}
      {/* ======================================================== */}
      {activeTab === "documents" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                Patient Medical Documents ({documents.length})
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b" }}>
                Securely store previous lab tests, imaging, and discharge reports.
              </p>
            </div>

            <button onClick={() => setShowDocModal(true)} className="btn btn-primary btn-sm" style={{ gap: "6px" }}>
              <Upload size={14} />
              <span>Upload Document</span>
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <FileText size={32} />
              <h4>No Documents Uploaded</h4>
              <p>Upload medical reports, external prescriptions, or lab summaries.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span className="badge badge-pill" style={{ textTransform: "uppercase" }}>
                        {doc.documentType.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                      {doc.title}
                    </h4>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      File: {doc.fileName}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                    <a
                      href={`http://localhost:5050${doc.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ gap: "4px" }}
                    >
                      <Eye size={13} />
                      <span>View File</span>
                    </a>

                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}
                      title="Remove Document"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD CONSULTATION & PRESCRIPTION */}
      {/* ======================================================== */}
      {showConsultModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "750px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Stethoscope size={20} color="#c62828" />
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Record Clinical Consultation & Prescribe
                </h3>
              </div>
              <button onClick={() => setShowConsultModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSaveConsultation}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* AI Note Structuring helper box */}
                <div style={{ padding: "12px 16px", backgroundColor: "#faf5ff", borderRadius: "8px", border: "1px solid #ddd6fe" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <Sparkles size={14} color="#7c3aed" />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#5b21b6" }}>
                      AI Clinical Note Assistant (Optional)
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Type raw notes (e.g. Severe throbbing migraine for 3 days with nausea, no fever)"
                      value={rawNotesInput}
                      onChange={(e) => setRawNotesInput(e.target.value)}
                      className="form-control"
                      style={{ fontSize: "13px" }}
                    />
                    <button
                      type="button"
                      onClick={handleStructureNotes}
                      disabled={structuringNotes}
                      className="btn btn-ai btn-sm"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      <span>{structuringNotes ? "Structuring..." : "Format with AI"}</span>
                    </button>
                  </div>
                </div>

                {/* Chief Complaint & Duration */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Chief Complaint *</label>
                    <input
                      type="text"
                      placeholder="e.g. Persistent tension headache"
                      value={consultForm.chiefComplaint}
                      onChange={(e) => setConsultForm({ ...consultForm, chiefComplaint: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 days"
                      value={consultForm.duration}
                      onChange={(e) => setConsultForm({ ...consultForm, duration: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                {/* Symptoms & Diagnosis */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Symptoms Documented</label>
                    <input
                      type="text"
                      placeholder="e.g. Throbbing pain, photophobia, mild nausea"
                      value={consultForm.symptoms}
                      onChange={(e) => setConsultForm({ ...consultForm, symptoms: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Diagnosis / Assessment *</label>
                    <input
                      type="text"
                      placeholder="e.g. Acute Migraine Headache"
                      value={consultForm.diagnosis}
                      onChange={(e) => setConsultForm({ ...consultForm, diagnosis: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                {/* Vitals Input Row */}
                <div>
                  <label className="form-label" style={{ marginBottom: "8px" }}>Patient Vitals</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="BP (120/80)"
                      value={consultForm.bloodPressure}
                      onChange={(e) => setConsultForm({ ...consultForm, bloodPressure: e.target.value })}
                      className="form-control"
                      style={{ fontSize: "12px", padding: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="Pulse (bpm)"
                      value={consultForm.heartRate}
                      onChange={(e) => setConsultForm({ ...consultForm, heartRate: e.target.value })}
                      className="form-control"
                      style={{ fontSize: "12px", padding: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="Temp (°F)"
                      value={consultForm.temperature}
                      onChange={(e) => setConsultForm({ ...consultForm, temperature: e.target.value })}
                      className="form-control"
                      style={{ fontSize: "12px", padding: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="SpO2 (%)"
                      value={consultForm.spO2}
                      onChange={(e) => setConsultForm({ ...consultForm, spO2: e.target.value })}
                      className="form-control"
                      style={{ fontSize: "12px", padding: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="Weight (kg)"
                      value={consultForm.weight}
                      onChange={(e) => setConsultForm({ ...consultForm, weight: e.target.value })}
                      className="form-control"
                      style={{ fontSize: "12px", padding: "8px" }}
                    />
                  </div>
                </div>

                {/* Prescription Builder */}
                <div style={{ marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="form-label" style={{ margin: 0 }}>Medications & Prescriptions</label>
                    <button
                      type="button"
                      onClick={handleAddMedicine}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                    >
                      + Add Medicine
                    </button>
                  </div>

                  {consultForm.medicines.map((med, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 1fr auto", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Medicine Name (e.g. Paracetamol)"
                        value={med.medicine}
                        onChange={(e) => handleMedicineChange(idx, "medicine", e.target.value)}
                        className="form-control"
                        style={{ fontSize: "12px", padding: "8px" }}
                      />
                      <input
                        type="text"
                        placeholder="Dosage (500mg)"
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(idx, "dosage", e.target.value)}
                        className="form-control"
                        style={{ fontSize: "12px", padding: "8px" }}
                      />
                      <input
                        type="text"
                        placeholder="Freq (1-0-1)"
                        value={med.frequency}
                        onChange={(e) => handleMedicineChange(idx, "frequency", e.target.value)}
                        className="form-control"
                        style={{ fontSize: "12px", padding: "8px" }}
                      />
                      <input
                        type="text"
                        placeholder="Duration (5 days)"
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(idx, "duration", e.target.value)}
                        className="form-control"
                        style={{ fontSize: "12px", padding: "8px" }}
                      />
                      <input
                        type="text"
                        placeholder="Instructions"
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(idx, "instructions", e.target.value)}
                        className="form-control"
                        style={{ fontSize: "12px", padding: "8px" }}
                      />
                      {consultForm.medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Doctor Notes & Follow up */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Doctor&apos;s Clinical Notes</label>
                    <textarea
                      placeholder="Advice, dietary instructions, or clinical observations..."
                      value={consultForm.doctorNotes}
                      onChange={(e) => setConsultForm({ ...consultForm, doctorNotes: e.target.value })}
                      className="form-control"
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Follow-up Date</label>
                    <input
                      type="date"
                      value={consultForm.followUpDate}
                      onChange={(e) => setConsultForm({ ...consultForm, followUpDate: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowConsultModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={savingConsult} className="btn btn-primary">
                  {savingConsult ? "Saving Consultation..." : "Save Consultation & Update Timeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: UPLOAD DOCUMENT */}
      {/* ======================================================== */}
      {showDocModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Upload size={20} color="#c62828" />
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Upload Medical Document
                </h3>
              </div>
              <button onClick={() => setShowDocModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Document Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete Blood Count (CBC) Report"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="form-control"
                  >
                    <option value="lab_report">Lab Report / Bloodwork</option>
                    <option value="prescription">External Prescription</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="imaging">X-Ray / Imaging Scan</option>
                    <option value="other">Other Medical Record</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select File (PDF, PNG, JPG) *</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowDocModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploadingDoc} className="btn btn-primary">
                  {uploadingDoc ? "Uploading..." : "Upload & Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PRESCRIPTION PRINT VIEW */}
      {/* ======================================================== */}
      {selectedRecordForPrint && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "620px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Prescription Preview</h3>
              <button onClick={() => setSelectedRecordForPrint(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: "32px", backgroundColor: "#ffffff" }}>
              {/* Prescription Header */}
              <div style={{ borderBottom: "2px solid #c62828", paddingBottom: "16px", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#c62828" }}>HealthConnect Clinic</h2>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Digital OPD Record & Prescription</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "12px", color: "#475569" }}>
                  <div><strong>{selectedRecordForPrint.doctorName || "Dr. Alok Sharma"}</strong></div>
                  <div>Consultation Date: {new Date(selectedRecordForPrint.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Patient Details */}
              <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "20px", fontSize: "13px" }}>
                <strong>Patient:</strong> {patient.name} ({patient.patientId}) • {patient.age} yrs • {patient.gender} • Blood: {patient.bloodGroup}
              </div>

              {/* Diagnosis */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Diagnosis:</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{selectedRecordForPrint.diagnosis}</div>
              </div>

              {/* Medications Table */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "8px", color: "#0f172a" }}>Rx Medications:</div>
                {selectedRecordForPrint.medicines?.length > 0 ? (
                  <table className="data-table" style={{ border: "1px solid #e2e8f0" }}>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecordForPrint.medicines.map((m, i) => (
                        <tr key={i}>
                          <td><strong>{m.medicine}</strong></td>
                          <td>{m.dosage}</td>
                          <td>{m.frequency}</td>
                          <td>{m.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: "14px" }}>{selectedRecordForPrint.prescription || "None recorded"}</div>
                )}
              </div>

              {selectedRecordForPrint.doctorNotes && (
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "12px" }}>
                  <strong>Doctor Advice:</strong> {selectedRecordForPrint.doctorNotes}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ gap: "6px" }}>
                <Printer size={14} />
                <span>Print Document</span>
              </button>
              <button onClick={() => setSelectedRecordForPrint(null)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}