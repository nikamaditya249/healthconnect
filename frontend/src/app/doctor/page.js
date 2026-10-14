"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Eye,
  Activity,
  ArrowRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  getOPDQueue,
  getOPDStats,
  updateOPDStatus,
  syncOPDQueue,
  getPatients,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import Loader, { SkeletonRow } from "@/components/Loader";

// Priority tier: Emergency = 0 (highest), Urgent = 1, Normal = 2
const priorityTier = (p) => {
  const s = String(p || "").toLowerCase();
  if (s === "emergency") return 0;
  if (s === "urgent" || s === "priority") return 1;
  return 2;
};

// Clinically sort OPD Queue: In-progress at top, then emergency, then urgent, then normal (FIFO by token within each tier)
export const sortQueueClinically = (visits) => {
  return [...visits].sort((a, b) => {
    // 1. In-progress visits always at the very top (currently being attended)
    if (a.status === "in-progress" && b.status !== "in-progress") return -1;
    if (b.status === "in-progress" && a.status !== "in-progress") return 1;

    // 2. Completed visits at the bottom if present
    const aDone = a.status === "completed" || a.status === "done";
    const bDone = b.status === "completed" || b.status === "done";
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;

    // 3. Emergency & Urgent triage for waiting patients
    const tierA = priorityTier(a.priority);
    const tierB = priorityTier(b.priority);
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // 4. Within same priority tier: Token / Queue number ascending (FIFO)
    return (Number(a.queueNumber) || 0) - (Number(b.queueNumber) || 0);
  });
};

export default function DoctorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "queue";
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState({ today: 0, waiting: 0, inProgress: 0, completed: 0, totalPatients: 0 });
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["overview", "queue", "patients", "consultations"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsData, queueData, patientsData] = await Promise.all([
        getOPDStats().catch(() => ({})),
        getOPDQueue().catch(() => []),
        getPatients({ search: searchQuery, limit: 50 }).catch(() => ({ patients: [] })),
      ]);
      setStats(statsData);

      let mergedQueue = Array.isArray(queueData) ? [...queueData] : [];
      try {
        const storedVisits = JSON.parse(localStorage.getItem("healthconnect_opd_visits") || "[]");

        // Build status map of locally stored visits
        const storedStatusMap = new Map();
        storedVisits.forEach((v) => {
          if (v._id) storedStatusMap.set(String(v._id), v);
          if (v.queueNumber) storedStatusMap.set(`token_${v.queueNumber}`, v);
          const pId = v.patientId?._id || v.patientId?.patientId || (typeof v.patientId === "string" ? v.patientId : null);
          if (pId) storedStatusMap.set(`patient_${String(pId).toUpperCase()}`, v);
        });

        // Reconcile status: if locally marked completed, it MUST stay completed!
        mergedQueue = mergedQueue.map((v) => {
          const pId = v.patientId?._id || v.patientId?.patientId || (typeof v.patientId === "string" ? v.patientId : null);
          const local =
            (v._id && storedStatusMap.get(String(v._id))) ||
            (v.queueNumber && storedStatusMap.get(`token_${v.queueNumber}`)) ||
            (pId && storedStatusMap.get(`patient_${String(pId).toUpperCase()}`));

          if (local) {
            if (local.status === "completed" || local.status === "done") {
              return { ...v, ...local, status: "completed" };
            }
            if (local.status === "in-progress" && v.status === "waiting") {
              return { ...v, ...local, status: "in-progress" };
            }
          }
          return v;
        });

        // Add any visits that exist only in localStorage
        const existingKeys = new Set();
        mergedQueue.forEach((v) => {
          if (v._id) existingKeys.add(String(v._id));
          if (v.queueNumber) existingKeys.add(`token_${v.queueNumber}`);
        });

        storedVisits.forEach((v) => {
          if (!existingKeys.has(String(v._id)) && !existingKeys.has(`token_${v.queueNumber}`)) {
            mergedQueue.push(v);
          }
        });

        // Persist reconciled queue locally and sync to server
        localStorage.setItem("healthconnect_opd_visits", JSON.stringify(mergedQueue));
        syncOPDQueue(mergedQueue).catch(() => {});
      } catch (e) {}

      const sorted = sortQueueClinically(mergedQueue);
      setQueue(sorted);

      let pList = patientsData.patients || [];
      try {
        const storedPatients = JSON.parse(localStorage.getItem("healthconnect_custom_patients") || "[]");
        const existingIds = new Set(pList.map((p) => p.patientId || p._id));
        const missingPatients = storedPatients.filter(
          (p) => !existingIds.has(p.patientId) && !existingIds.has(p._id)
        );
        if (missingPatients.length > 0) {
          pList = [...missingPatients, ...pList];
        }
      } catch (e) {}
      setPatients(pList);
    } catch (err) {
      console.error("Error fetching doctor data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Start Consultation Handler
  const handleStartConsultation = async (visit) => {
    const patientId =
      visit.patientId?._id ||
      visit.patientId?.patientId ||
      (typeof visit.patientId === "string" ? visit.patientId : null);
    if (!patientId) return;

    const pCode = visit.patientId?.patientId;

    setStartingId(visit._id);
    try {
      if (visit.status === "waiting") {
        await updateOPDStatus(visit._id, "in-progress", {
          queueNumber: visit.queueNumber,
          patientId,
          patientCode: pCode,
        }).catch(() => {});

        try {
          const stored = JSON.parse(localStorage.getItem("healthconnect_opd_visits") || "[]");
          const updated = stored.map((v) =>
            v._id === visit._id || (visit.queueNumber && v.queueNumber === visit.queueNumber)
              ? { ...v, status: "in-progress", startedAt: new Date().toISOString() }
              : v
          );
          localStorage.setItem("healthconnect_opd_visits", JSON.stringify(updated));
          syncOPDQueue(updated).catch(() => {});
        } catch (e) {}
        addToast(`Consultation started for ${visit.patientId?.name || "Patient"}`, "info");
      }
      router.push(`/patient/${patientId}`);
    } catch (err) {
      console.error("Error starting consultation:", err);
      router.push(`/patient/${patientId}`);
    } finally {
      setStartingId(null);
    }
  };

  // Complete Consultation Handler
  const handleCompleteConsultation = async (visit) => {
    const visitId = visit._id;
    const queueNum = visit.queueNumber;
    const pId = visit.patientId?._id || visit.patientId?.patientId || (typeof visit.patientId === "string" ? visit.patientId : null);
    const pCode = visit.patientId?.patientId;

    // 1. Immediately update UI state
    setQueue((prev) =>
      sortQueueClinically(
        prev.map((v) => {
          const matches =
            v._id === visitId ||
            (queueNum && v.queueNumber === queueNum) ||
            (pId && (v.patientId?._id === pId || v.patientId === pId || v.patientId?.patientId === pId));
          return matches
            ? { ...v, status: "completed", completedAt: new Date().toISOString() }
            : v;
        })
      )
    );

    try {
      // 2. Call backend status update with full metadata
      await updateOPDStatus(visitId, "completed", {
        queueNumber: queueNum,
        patientId: pId,
        patientCode: pCode,
      }).catch(() => {});

      // 3. Update localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("healthconnect_opd_visits") || "[]");
        const updated = stored.map((v) => {
          const matches =
            v._id === visitId ||
            (queueNum && v.queueNumber === queueNum) ||
            (pId && (v.patientId?._id === pId || v.patientId === pId || v.patientId?.patientId === pId));
          return matches
            ? { ...v, status: "completed", completedAt: new Date().toISOString() }
            : v;
        });
        localStorage.setItem("healthconnect_opd_visits", JSON.stringify(updated));
        syncOPDQueue(updated).catch(() => {});
      } catch (e) {}

      // 4. Update patient status in localStorage
      try {
        const storedP = JSON.parse(localStorage.getItem("healthconnect_custom_patients") || "[]");
        const updatedP = storedP.map((p) =>
          p._id === pId || p.patientId === pId || (pCode && p.patientId === pCode)
            ? { ...p, status: "done" }
            : p
        );
        localStorage.setItem("healthconnect_custom_patients", JSON.stringify(updatedP));
      } catch (e) {}

      addToast(`Visit for ${visit.patientId?.name || "Patient"} marked completed and moved to Completed Visits!`, "success");
      fetchData();
    } catch (err) {
      console.error("Error completing consultation:", err);
      fetchData();
    }
  };

  const activeConsultation = queue.find((q) => q.status === "in-progress");
  const waitingPatients = queue.filter((q) => q.status === "waiting");
  const completedToday = queue.filter((q) => q.status === "done" || q.status === "completed");

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Consultation Station</h1>
          <p className="page-subtitle">
            Review waiting patients, examine past clinical records, and conduct OPD consultations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={fetchData}
            className="btn btn-secondary btn-sm"
            title="Refresh clinical queue"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">{waitingPatients.length}</div>
            <div className="stat-lbl">Waiting Patients</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="stat-val">{activeConsultation ? 1 : 0}</div>
            <div className="stat-lbl">In Active Consultation</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-val">{Math.max(stats.completed || 0, completedToday.length)}</div>
            <div className="stat-lbl">Completed Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#fee2e2", color: "#c62828" }}>
            <Users size={24} />
          </div>
          <div>
            <div className="stat-val">{Math.max(stats.totalPatients || 0, patients.length)}</div>
            <div className="stat-lbl">Total Clinic Records</div>
          </div>
        </div>
      </div>

      {/* Active Consultation Alert Banner */}
      {activeConsultation && activeConsultation.patientId && (
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Stethoscope size={20} />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e3a8a" }}>
                Active Consultation In-Progress: {activeConsultation.patientId.name} ({activeConsultation.patientId.patientId})
              </div>
              <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "2px" }}>
                Chief Complaint: {activeConsultation.chiefComplaint || "General Checkup"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => router.push(`/patient/${activeConsultation.patientId._id}`)}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: "#2563eb", gap: "6px" }}
            >
              <span>Resume Consultation</span>
              <ArrowRight size={15} />
            </button>
            <button
              onClick={() => handleCompleteConsultation(activeConsultation)}
              className="btn btn-sm"
              style={{ backgroundColor: "#059669", color: "#ffffff", gap: "6px", fontWeight: "600" }}
              title="Finish consultation and move patient to Completed Visits"
            >
              <CheckCircle2 size={15} />
              <span>Complete & Submit</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="tabs-nav">
        <button
          onClick={() => setActiveTab("queue")}
          className={`tab-btn ${activeTab === "queue" || activeTab === "overview" ? "active" : ""}`}
        >
          <Clock size={16} />
          <span>Today&apos;s OPD Queue ({waitingPatients.length + (activeConsultation ? 1 : 0)})</span>
        </button>

        <button
          onClick={() => setActiveTab("patients")}
          className={`tab-btn ${activeTab === "patients" ? "active" : ""}`}
        >
          <Users size={16} />
          <span>Patient Registry ({patients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("consultations")}
          className={`tab-btn ${activeTab === "consultations" ? "active" : ""}`}
        >
          <CheckCircle2 size={16} />
          <span>Completed Visits ({completedToday.length})</span>
        </button>
      </div>

      {/* TAB 1: OPD QUEUE */}
      {(activeTab === "queue" || activeTab === "overview") && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Waiting Patients in OPD
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                Click &quot;Start Consultation&quot; to review medical history and prescribe treatment.
              </p>
            </div>
          </div>

          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token #</th>
                  <th>Patient Name & ID</th>
                  <th>Age / Sex</th>
                  <th>Blood Group</th>
                  <th>Chief Complaint</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                ) : queue.filter(q => q.status !== "done" && q.status !== "completed").length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <CheckCircle2 size={28} />
                        </div>
                        <h4 style={{ color: "#0f172a" }}>All OPD Patients Attended</h4>
                        <p>No waiting patients in the queue right now.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queue
                    .filter(q => q.status !== "done" && q.status !== "completed")
                    .map((item) => {
                      const p = item.patientId || {};
                      const isEmergency = item.priority === "emergency";
                      const isUrgent = item.priority === "urgent";
                      const isInProgress = item.status === "in-progress";

                      return (
                        <tr
                          key={item._id}
                          style={{
                            backgroundColor: isInProgress
                              ? "#f0f7ff"
                              : isEmergency
                              ? "#fff5f5"
                              : isUrgent
                              ? "#fffdf5"
                              : "transparent",
                            borderLeft: isEmergency
                              ? "4px solid #dc2626"
                              : isUrgent
                              ? "4px solid #f59e0b"
                              : isInProgress
                              ? "4px solid #2563eb"
                              : "4px solid transparent",
                          }}
                        >
                          <td>
                            <span style={{ fontSize: "16px", fontWeight: "800", color: isEmergency ? "#dc2626" : "#c62828" }}>
                              #{item.queueNumber || 1}
                            </span>
                          </td>
                          <td>
                            <div>
                              <Link
                                href={`/patient/${p._id || p.patientId}`}
                                style={{ fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}
                              >
                                <span>{p.name}</span>
                              </Link>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>
                                {p.patientId || "HC-000000"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: "#334155" }}>
                              {p.age} yrs • {p.gender}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-pill">{p.bloodGroup || "O+"}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: "13px", fontWeight: isEmergency ? "700" : "500", color: isEmergency ? "#991b1b" : "#1e293b" }}>
                              {item.chiefComplaint || "General Consultation"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                isEmergency
                                  ? "badge-emergency"
                                  : isUrgent
                                  ? "badge-urgent"
                                  : "badge-pill"
                              }`}
                            >
                              {isEmergency ? "🚨 EMERGENCY" : isUrgent ? "URGENT" : "Normal"}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${item.status}`}>
                              {isInProgress ? "In Consultation" : item.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                              <button
                                onClick={() => handleStartConsultation(item)}
                                disabled={startingId === item._id}
                                className={`btn ${isInProgress ? "btn-primary" : "btn-primary"} btn-sm`}
                                style={{
                                  backgroundColor: isInProgress ? "#2563eb" : "#c62828",
                                  gap: "5px",
                                }}
                              >
                                <Stethoscope size={14} />
                                <span>{isInProgress ? "Resume" : "Start Consultation"}</span>
                              </button>

                              {isInProgress && (
                                <button
                                  onClick={() => handleCompleteConsultation(item)}
                                  className="btn btn-sm"
                                  style={{
                                    backgroundColor: "#059669",
                                    color: "#ffffff",
                                    gap: "5px",
                                    fontWeight: "600",
                                  }}
                                  title="Mark consultation as completed and move to Completed Visits"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Complete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PATIENT REGISTRY */}
      {activeTab === "patients" && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ position: "relative", maxWidth: "450px" }}>
              <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <input
                type="text"
                placeholder="Search patient by Name, Patient ID, or Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ paddingLeft: "38px" }}
              />
            </div>
          </div>

          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Demographics</th>
                  <th>Blood Group</th>
                  <th>Last Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <Users size={28} />
                        <h4>No patient records match query</h4>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <span style={{ fontWeight: "700", color: "#c62828", fontFamily: "monospace" }}>
                          {p.patientId || `HC-${p._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td>
                        <Link href={`/patient/${p._id}`} style={{ fontWeight: "700", color: "#0f172a" }}>
                          {p.name}
                        </Link>
                      </td>
                      <td>{p.age} yrs • {p.gender}</td>
                      <td>
                        <span className="badge badge-pill">{p.bloodGroup || "Unknown"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString() : "New Patient"}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => router.push(`/patient/${p._id}`)}
                          className="btn btn-secondary btn-sm"
                          style={{ gap: "5px" }}
                        >
                          <Eye size={14} />
                          <span>Open Medical File</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETED CONSULTATIONS */}
      {activeTab === "consultations" && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
              Completed Consultations ({completedToday.length})
            </h3>
          </div>

          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Chief Complaint</th>
                  <th>Completed At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedToday.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <CheckCircle2 size={28} />
                        <h4>No consultations finished yet today</h4>
                      </div>
                    </td>
                  </tr>
                ) : (
                  completedToday.map((c) => {
                    const p = c.patientId && typeof c.patientId === "object" ? c.patientId : {};
                    const pTargetId = p._id || p.patientId || (typeof c.patientId === "string" ? c.patientId : null);
                    const pName = p.name || "Patient";
                    const pCode = p.patientId || (typeof c.patientId === "string" ? c.patientId : "HC-000000");

                    return (
                      <tr key={c._id}>
                        <td>
                          <span style={{ fontWeight: "700", color: "#047857" }}>
                            #{c.queueNumber}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: "700" }}>{pName}</span>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {pCode}
                          </div>
                        </td>
                        <td>{c.chiefComplaint || "General Consultation"}</td>
                        <td>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {c.completedAt ? new Date(c.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Completed"}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => pTargetId && router.push(`/patient/${pTargetId}`)}
                            className="btn btn-secondary btn-sm"
                            style={{ gap: "5px" }}
                          >
                            <FileText size={14} />
                            <span>View EHR</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}