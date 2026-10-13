"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Clock,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Eye,
  Activity,
  Phone,
  Filter,
  X,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  getPatients,
  registerPatient,
  getOPDQueue,
  getOPDStats,
  createOPDVisit,
  updateOPDStatus,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import Loader, { SkeletonRow } from "@/components/Loader";

export default function ReceptionDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState({ today: 0, waiting: 0, inProgress: 0, completed: 0, totalPatients: 0 });
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [bloodFilter, setBloodFilter] = useState("all");
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedPatientForVisit, setSelectedPatientForVisit] = useState(null);

  // Registration Form
  const [registerForm, setRegisterForm] = useState({
    name: "",
    age: "",
    gender: "Male",
    bloodGroup: "O+",
    phone: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRel: "",
    allergies: "",
    chronicConditions: "",
  });
  const [registering, setRegistering] = useState(false);

  // OPD Visit Form
  const [visitForm, setVisitForm] = useState({
    chiefComplaint: "General Consultation",
    priority: "normal",
  });
  const [creatingVisit, setCreatingVisit] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["overview", "queue", "patients", "register"].includes(tab)) {
      setActiveTab(tab);
      if (tab === "register") {
        setShowRegisterModal(true);
      }
    }
  }, [searchParams]);

  // Fetch Dashboard Stats & Queue
  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsData, queueData] = await Promise.all([
        getOPDStats(),
        getOPDQueue(),
      ]);
      setStats(statsData);
      setQueue(queueData);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch Patients List
  const fetchPatientsList = useCallback(async () => {
    try {
      setLoadingPatients(true);
      const data = await getPatients({
        search: searchQuery,
        bloodGroup: bloodFilter,
        limit: 100,
      });
      let list = data.patients || [];
      // Merge with custom patients in localStorage to prevent loss during serverless cold starts
      try {
        const stored = JSON.parse(localStorage.getItem("healthconnect_custom_patients") || "[]");
        const existingIds = new Set(list.map((p) => p.patientId || p._id));
        const missing = stored.filter((p) => !existingIds.has(p.patientId) && !existingIds.has(p._id));
        if (missing.length > 0) {
          list = [...missing, ...list];
        }
      } catch (e) {}

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        list = list.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.patientId?.toLowerCase().includes(q) ||
            (p.phone && p.phone.toLowerCase().includes(q))
        );
      }
      if (bloodFilter && bloodFilter !== "all") {
        list = list.filter((p) => p.bloodGroup === bloodFilter);
      }

      setPatients(list);
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setLoadingPatients(false);
    }
  }, [searchQuery, bloodFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchPatientsList();
  }, [fetchPatientsList]);

  // Handle Patient Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.age) {
      addToast("Please provide patient name and age.", "error");
      return;
    }

    setRegistering(true);
    try {
      const payload = {
        name: registerForm.name,
        age: Number(registerForm.age),
        gender: registerForm.gender,
        bloodGroup: registerForm.bloodGroup,
        phone: registerForm.phone,
        address: registerForm.address,
        emergencyContact: {
          name: registerForm.emergencyName,
          phone: registerForm.emergencyPhone,
          relationship: registerForm.emergencyRel,
        },
        allergies: registerForm.allergies,
        chronicConditions: registerForm.chronicConditions,
      };

      const newPatient = await registerPatient(payload);

      // Cache locally to ensure patient is never lost across serverless cold starts
      try {
        const stored = JSON.parse(localStorage.getItem("healthconnect_custom_patients") || "[]");
        const exists = stored.some((p) => p.patientId === newPatient.patientId || p._id === newPatient._id);
        if (!exists) {
          stored.unshift(newPatient);
          localStorage.setItem("healthconnect_custom_patients", JSON.stringify(stored));
        }
      } catch (e) {}

      addToast(`Patient registered successfully with ID: ${newPatient.patientId}`, "success");
      setShowRegisterModal(false);
      setRegisterForm({
        name: "",
        age: "",
        gender: "Male",
        bloodGroup: "O+",
        phone: "",
        address: "",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRel: "",
        allergies: "",
        chronicConditions: "",
      });

      fetchPatientsList();
      fetchDashboardData();

      // Automatically offer to enqueue
      setSelectedPatientForVisit(newPatient);
      setShowVisitModal(true);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to register patient";
      addToast(msg, "error");
    } finally {
      setRegistering(false);
    }
  };

  // Handle Create OPD Visit
  const handleCreateVisit = async (e) => {
    e.preventDefault();
    if (!selectedPatientForVisit) return;

    setCreatingVisit(true);
    try {
      const payload = {
        patientId: selectedPatientForVisit._id || selectedPatientForVisit.patientId,
        patientData: selectedPatientForVisit,
        chiefComplaint: visitForm.chiefComplaint,
        priority: visitForm.priority,
      };

      const visit = await createOPDVisit(payload);
      addToast(`OPD Token #${visit.queueNumber} created for ${selectedPatientForVisit.name}`, "success");
      setShowVisitModal(false);
      setSelectedPatientForVisit(null);
      setVisitForm({ chiefComplaint: "General Consultation", priority: "normal" });

      fetchDashboardData();
      fetchPatientsList();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to create OPD visit";
      addToast(msg, "error");
    } finally {
      setCreatingVisit(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Receptionist Command Center</h1>
          <p className="page-subtitle">
            Manage patient registration, OPD tokens, and front-desk clinic intake.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              fetchDashboardData();
              fetchPatientsList();
            }}
            className="btn btn-secondary btn-sm"
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn btn-primary btn-sm"
            style={{ gap: "6px" }}
          >
            <UserPlus size={16} />
            <span>Register New Patient</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#fee2e2", color: "#c62828" }}>
            <Users size={24} />
          </div>
          <div>
            <div className="stat-val">{stats.totalPatients}</div>
            <div className="stat-lbl">Registered Patients</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">{stats.waiting}</div>
            <div className="stat-lbl">Waiting in OPD Queue</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="stat-val">{stats.inProgress}</div>
            <div className="stat-lbl">In Doctor Consultation</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-val">{stats.completed}</div>
            <div className="stat-lbl">Visits Completed Today</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-nav">
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab-btn ${activeTab === "overview" || activeTab === "queue" ? "active" : ""}`}
        >
          <Clock size={16} />
          <span>Live OPD Queue ({queue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("patients")}
          className={`tab-btn ${activeTab === "patients" ? "active" : ""}`}
        >
          <Users size={16} />
          <span>Patients Directory ({patients.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE OPD QUEUE */}
      {(activeTab === "overview" || activeTab === "queue") && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Active OPD Queue for Today
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                Live token list of patients queued for doctor consultation.
              </p>
            </div>
            <span className="badge badge-inprogress">
              {queue.filter(q => q.status === "waiting" || q.status === "in-progress").length} Active in Clinic
            </span>
          </div>

          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token #</th>
                  <th>Patient Details</th>
                  <th>Chief Complaint</th>
                  <th>Priority</th>
                  <th>Arrival Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingQueue ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                ) : queue.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Clock size={28} />
                        </div>
                        <h4 style={{ color: "#0f172a" }}>OPD Queue is Clear</h4>
                        <p>No patients are currently in the waiting queue.</p>
                        <button
                          onClick={() => setActiveTab("patients")}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: "8px" }}
                        >
                          Select Patient to Enqueue
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => {
                    const p = item.patientId || {};
                    return (
                      <tr key={item._id}>
                        <td>
                          <span style={{ fontSize: "15px", fontWeight: "800", color: "#c62828" }}>
                            #{item.queueNumber || 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <Link
                              href={`/patient/${p._id}`}
                              style={{ fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}
                            >
                              <span>{p.name || "Patient"}</span>
                              <Eye size={13} color="#64748b" />
                            </Link>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {p.patientId || "HC-000000"} • {p.age} yrs • {p.gender} • Blood: {p.bloodGroup || "O+"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", fontWeight: "500" }}>
                            {item.chiefComplaint || "General Consultation"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.priority === "urgent" || item.priority === "emergency"
                                ? "badge-urgent"
                                : "badge-pill"
                            }`}
                          >
                            {item.priority || "Normal"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${item.status}`}>
                            {item.status === "in-progress" ? "In Consultation" : item.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              onClick={() => router.push(`/patient/${p._id}`)}
                              className="btn btn-secondary btn-sm"
                              title="View Patient Record"
                            >
                              <Eye size={14} />
                              <span>View</span>
                            </button>
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

      {/* TAB 2: PATIENTS DIRECTORY */}
      {activeTab === "patients" && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          {/* Search & Filter Bar */}
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
              <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <input
                type="text"
                placeholder="Search patient by Name, ID (HC-000001), or Phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ paddingLeft: "38px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={15} color="#64748b" />
              <select
                value={bloodFilter}
                onChange={(e) => setBloodFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto" }}
              >
                <option value="all">All Blood Groups</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <button
              onClick={() => setShowRegisterModal(true)}
              className="btn btn-primary"
              style={{ gap: "6px" }}
            >
              <Plus size={16} />
              <span>Register Patient</span>
            </button>
          </div>

          {/* Patients Table */}
          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Age / Gender</th>
                  <th>Blood Group</th>
                  <th>Phone</th>
                  <th>Last Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingPatients ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Users size={28} />
                        </div>
                        <h4 style={{ color: "#0f172a" }}>No Patients Found</h4>
                        <p>No registered patient records match your search query.</p>
                        <button
                          onClick={() => setShowRegisterModal(true)}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: "8px" }}
                        >
                          Register This Patient Now
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#c62828" }}>
                          {p.patientId || `HC-${p._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/patient/${p._id}`}
                          style={{ fontWeight: "700", color: "#0f172a" }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span style={{ color: "#334155" }}>
                          {p.age} yrs • {p.gender}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-pill">{p.bloodGroup || "Unknown"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "13px", color: "#64748b" }}>
                          {p.phone || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString() : "New"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => {
                              setSelectedPatientForVisit(p);
                              setShowVisitModal(true);
                            }}
                            className="btn btn-primary btn-sm"
                            title="Add Patient to Today's OPD Queue"
                          >
                            <Plus size={14} />
                            <span>Create OPD Visit</span>
                          </button>

                          <button
                            onClick={() => router.push(`/patient/${p._id}`)}
                            className="btn btn-secondary btn-sm"
                            title="View Full Patient Records & Timeline"
                          >
                            <Eye size={14} />
                            <span>Profile</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: REGISTER NEW PATIENT */}
      {/* ======================================================== */}
      {showRegisterModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={20} color="#c62828" />
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Register New Patient
                </h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Kunal Sharma"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Age (years) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 28"
                      value={registerForm.age}
                      onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select
                      value={registerForm.gender}
                      onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                      className="form-control"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select
                      value={registerForm.bloodGroup}
                      onChange={(e) => setRegisterForm({ ...registerForm, bloodGroup: e.target.value })}
                      className="form-control"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Address / Village</label>
                    <input
                      type="text"
                      placeholder="e.g. Ward 4, Rampur"
                      value={registerForm.address}
                      onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunita Sharma"
                      value={registerForm.emergencyName}
                      onChange={(e) => setRegisterForm({ ...registerForm, emergencyName: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9811223344"
                      value={registerForm.emergencyPhone}
                      onChange={(e) => setRegisterForm({ ...registerForm, emergencyPhone: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Known Drug / Food Allergies</label>
                    <input
                      type="text"
                      placeholder="e.g. Penicillin, Sulfa drugs (comma separated)"
                      value={registerForm.allergies}
                      onChange={(e) => setRegisterForm({ ...registerForm, allergies: e.target.value })}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Chronic Conditions</label>
                    <input
                      type="text"
                      placeholder="e.g. Hypertension, Diabetes Type 2"
                      value={registerForm.chronicConditions}
                      onChange={(e) => setRegisterForm({ ...registerForm, chronicConditions: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="btn btn-primary"
                >
                  {registering ? "Registering..." : "Save Patient & Assign ID"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE OPD VISIT / ENQUEUE */}
      {/* ======================================================== */}
      {showVisitModal && selectedPatientForVisit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={20} color="#c62828" />
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                  Create OPD Token / Visit
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowVisitModal(false);
                  setSelectedPatientForVisit(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleCreateVisit}>
              <div className="modal-body">
                {/* Patient Summary Card */}
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                  <div style={{ fontWeight: "700", color: "#0f172a" }}>
                    {selectedPatientForVisit.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    ID: {selectedPatientForVisit.patientId} • {selectedPatientForVisit.age} yrs • {selectedPatientForVisit.gender} • Blood: {selectedPatientForVisit.bloodGroup}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chief Complaint / Reason for Visit *</label>
                  <input
                    type="text"
                    placeholder="e.g. Acute severe headache & fever for 2 days"
                    value={visitForm.chiefComplaint}
                    onChange={(e) => setVisitForm({ ...visitForm, chiefComplaint: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Queue Priority</label>
                  <select
                    value={visitForm.priority}
                    onChange={(e) => setVisitForm({ ...visitForm, priority: e.target.value })}
                    className="form-control"
                  >
                    <option value="normal">Normal Routine OPD</option>
                    <option value="urgent">Urgent / High Priority</option>
                    <option value="emergency">Emergency Case</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowVisitModal(false);
                    setSelectedPatientForVisit(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVisit}
                  className="btn btn-primary"
                >
                  {creatingVisit ? "Enqueueing..." : "Generate Token & Add to Queue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}