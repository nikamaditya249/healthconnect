"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Stethoscope,
  Activity,
  Heart,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getPatientById,
  createMedicalRecord,
  updateOPDStatus,
  syncOPDQueue,
  syncMedicalRecords,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Loader from "@/components/Loader";

export default function AddRecordPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    chiefComplaint: "",
    duration: "",
    symptoms: "",
    diagnosis: "",
    bloodPressure: "120/80",
    heartRate: "72",
    temperature: "98.6",
    spO2: "98",
    weight: "65",
    medicines: [{ medicine: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "After food" }],
    doctorNotes: "",
    followUpDate: "",
  });

  useEffect(() => {
    async function fetchPatient() {
      try {
        setLoading(true);
        const p = await getPatientById(id);
        setPatient(p);
      } catch (err) {
        console.error("Error fetching patient for record:", err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchPatient();
  }, [id]);

  const addMedicineRow = () => {
    setForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        { medicine: "", dosage: "", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
      ],
    }));
  };

  const removeMedicineRow = (index) => {
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }));
  };

  const handleMedicineChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.medicines];
      updated[index][field] = value;
      return { ...prev, medicines: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.diagnosis.trim()) {
      addToast("Please enter a clinical diagnosis", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patientId: patient?._id || id,
        doctorName: user?.name || "Dr. Alok Sharma",
        doctorId: user?._id,
        chiefComplaint: form.chiefComplaint || "OPD Consultation",
        duration: form.duration,
        symptoms: form.symptoms,
        diagnosis: form.diagnosis,
        vitals: {
          bloodPressure: form.bloodPressure,
          heartRate: form.heartRate,
          temperature: form.temperature,
          spO2: form.spO2,
          weight: form.weight,
        },
        medicines: form.medicines.filter((m) => m.medicine.trim()),
        doctorNotes: form.doctorNotes,
        followUpDate: form.followUpDate,
      };

      const recordRes = await createMedicalRecord(payload);

      // Cache locally to ensure offline / multi-container resilience
      try {
        const stored = JSON.parse(localStorage.getItem("healthconnect_medical_records") || "[]");
        stored.unshift(recordRes);
        localStorage.setItem("healthconnect_medical_records", JSON.stringify(stored));
        syncMedicalRecords(stored).catch(() => {});
      } catch (e) {}

      // Complete any active OPD visit for this patient
      try {
        const storedVisits = JSON.parse(localStorage.getItem("healthconnect_opd_visits") || "[]");
        const pId = patient?._id || id;
        const pCode = patient?.patientId || "";
        let foundVisit = null;

        const updatedVisits = storedVisits.map((v) => {
          const vPid = String(v.patientId?._id || v.patientId?.patientId || v.patientId || "").toUpperCase();
          const vCode = String(v.patientId?.patientId || "").toUpperCase();
          const matches =
            (pId && vPid === String(pId).toUpperCase()) ||
            (pCode && (vPid === String(pCode).toUpperCase() || vCode === String(pCode).toUpperCase()));
          if (matches && v.status !== "completed" && v.status !== "done") {
            foundVisit = v;
            return { ...v, status: "completed", completedAt: new Date().toISOString() };
          }
          return v;
        });

        localStorage.setItem("healthconnect_opd_visits", JSON.stringify(updatedVisits));
        if (foundVisit) {
          updateOPDStatus(foundVisit._id, "completed", {
            queueNumber: foundVisit.queueNumber,
            patientId: pId,
            patientCode: pCode,
          }).catch(() => {});
        }
        syncOPDQueue(updatedVisits).catch(() => {});
      } catch (e) {}

      addToast("Clinical record saved and consultation marked complete!", "success");
      router.push(`/patient/${id}`);
    } catch (err) {
      console.error("Error creating record:", err);
      addToast(err.message || "Failed to save record", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="Loading patient information..." />;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/patient/${id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#64748b",
            fontSize: "14px",
            fontWeight: "600",
            textDecoration: "none",
            marginBottom: "12px",
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Patient File</span>
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>
              New Clinical Consultation Record
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px", marginTop: "2px" }}>
              Patient: <strong>{patient?.name || "Patient"}</strong> • {patient?.patientId || `HC-${String(id).slice(-6).toUpperCase()}`} • {patient?.age} yrs • {patient?.gender}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: "24px" }}>
        {/* Section: Clinical Complaint */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Stethoscope size={18} color="#c62828" />
            <span>Presenting Symptoms & Clinical Diagnosis</span>
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Chief Complaint *</label>
              <input
                type="text"
                placeholder="e.g. Acute chest discomfort and dizziness"
                value={form.chiefComplaint}
                onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                className="form-control"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Duration</label>
              <input
                type="text"
                placeholder="e.g. 3 days"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="form-control"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Symptoms & Clinical Examination Findings</label>
            <textarea
              rows={2}
              placeholder="e.g. Bilateral wheezing, throat erythema, no signs of cyanosis"
              value={form.symptoms}
              onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Definitive / Differential Diagnosis *</label>
            <input
              type="text"
              placeholder="e.g. Acute Bronchitis with mild bronchospasm"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              className="form-control"
              required
            />
          </div>
        </div>

        {/* Section: Vital Signs */}
        <div style={{ marginBottom: "24px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} color="#2563eb" />
            <span>Patient Vitals at Consultation</span>
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">BP (mmHg)</label>
              <input
                type="text"
                value={form.bloodPressure}
                onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Heart Rate (bpm)</label>
              <input
                type="text"
                value={form.heartRate}
                onChange={(e) => setForm({ ...form, heartRate: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Temp (°F)</label>
              <input
                type="text"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">SpO2 (%)</label>
              <input
                type="text"
                value={form.spO2}
                onChange={(e) => setForm({ ...form, spO2: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Weight (kg)</label>
              <input
                type="text"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="form-control"
              />
            </div>
          </div>
        </div>

        {/* Section: Prescription Rx */}
        <div style={{ marginBottom: "24px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileText size={18} color="#059669" />
              <span>Prescription & Medications (Rx)</span>
            </h3>
            <button
              type="button"
              onClick={addMedicineRow}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              + Add Medicine
            </button>
          </div>

          {form.medicines.map((med, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                gap: "10px",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <input
                type="text"
                placeholder="Medicine name (e.g. Amoxicillin)"
                value={med.medicine}
                onChange={(e) => handleMedicineChange(index, "medicine", e.target.value)}
                className="form-control"
              />
              <input
                type="text"
                placeholder="Dosage (500mg)"
                value={med.dosage}
                onChange={(e) => handleMedicineChange(index, "dosage", e.target.value)}
                className="form-control"
              />
              <input
                type="text"
                placeholder="Freq (1-0-1)"
                value={med.frequency}
                onChange={(e) => handleMedicineChange(index, "frequency", e.target.value)}
                className="form-control"
              />
              <input
                type="text"
                placeholder="Duration (5 days)"
                value={med.duration}
                onChange={(e) => handleMedicineChange(index, "duration", e.target.value)}
                className="form-control"
              />
              {form.medicines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMedicineRow(index)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: "#ef4444", padding: "6px 8px" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Section: Clinical Advice & Follow-Up */}
        <div style={{ marginBottom: "24px", paddingTop: "20px", borderTop: "1px solid #e2e8f0" }}>
          <div className="form-group">
            <label className="form-label">Doctor's Clinical Notes & Dietary Advice</label>
            <textarea
              rows={3}
              placeholder="e.g. Increase fluid intake, avoid cold drinks, steam inhalation twice daily."
              value={form.doctorNotes}
              onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
              className="form-control"
            />
          </div>

          <div className="form-group" style={{ maxWidth: "250px" }}>
            <label className="form-label">Follow-up Date</label>
            <input
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
              className="form-control"
            />
          </div>
        </div>

        {/* Action Row */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
          <Link href={`/patient/${id}`} className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ backgroundColor: "#059669", gap: "8px" }}
          >
            <Save size={16} />
            <span>{saving ? "Saving Consultation..." : "Save Record & Complete Visit"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}