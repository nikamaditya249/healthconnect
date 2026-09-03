"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Stethoscope,
  Users,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  BadgePlus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const { addToast } = useToast();

  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"

  // Sign In State
  const [identifier, setIdentifier] = useState("doctor@healthconnect.local");
  const [password, setPassword] = useState("doctor123");
  const [role, setRole] = useState("doctor");

  // Sign Up State
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("doctor");
  const [signupEmpId, setSignupEmpId] = useState("");
  const [signupDepartment, setSignupDepartment] = useState("General Medicine");
  const [signupSpecialization, setSignupSpecialization] = useState("General Physician");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your Employee ID / Email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      addToast(`Welcome back, ${res.user.name}!`, "success");
    } catch (err) {
      const msg = err.message || "Invalid login credentials. Please try again.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError("Please fill in all required fields (Name, Email, Password).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        role: signupRole,
        employeeId: signupEmpId.trim() || undefined,
        department: signupDepartment.trim(),
        specialization: signupSpecialization.trim(),
      };

      const res = await register(payload);
      addToast(`Staff account created successfully! Welcome, ${res.user.name}`, "success");
    } catch (err) {
      const msg = err.message || "Failed to create staff account.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (selectedRole) => {
    setRole(selectedRole);
    setError("");
    if (selectedRole === "doctor") {
      setIdentifier("doctor@healthconnect.local");
      setPassword("doctor123");
    } else {
      setIdentifier("reception@healthconnect.local");
      setPassword("reception123");
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Banner */}
      <div style={styles.topNav}>
        <Link href="/" style={styles.brand}>
          <div style={styles.logoIcon}>
            <Activity size={20} color="#ffffff" />
          </div>
          <span style={styles.brandTitle}>
            Health<span style={{ color: "#c62828" }}>Connect</span>
          </span>
        </Link>
        <Link href="/" style={styles.homeLink}>
          ← Back to Public Website
        </Link>
      </div>

      {/* Main Box */}
      <div style={styles.cardWrapper}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.headerIconBox}>
              <ShieldCheck size={26} color="#c62828" />
            </div>
            <h2 style={styles.title}>
              {authMode === "signin" ? "Staff Portal Login" : "Register Healthcare Staff"}
            </h2>
            <p style={styles.subtitle}>
              {authMode === "signin"
                ? "Secure role-based access for healthcare providers & reception."
                : "Create a new verified staff account saved directly in MongoDB."}
            </p>
          </div>

          {/* Mode Switcher: Sign In vs Sign Up */}
          <div style={styles.modeSwitcher}>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setError("");
              }}
              style={{
                ...styles.modeBtn,
                ...(authMode === "signin" ? styles.modeBtnActive : {}),
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setError("");
              }}
              style={{
                ...styles.modeBtn,
                ...(authMode === "signup" ? styles.modeBtnActive : {}),
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={styles.errorBanner}>
              <AlertCircle size={16} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {/* ==================== SIGN IN VIEW ==================== */}
          {authMode === "signin" && (
            <>
              {/* Quick Demo Fill Buttons */}
              <div style={styles.demoSection}>
                <span style={styles.demoLabel}>1-Click Demo Credentials:</span>
                <div style={styles.demoButtonGroup}>
                  <button
                    type="button"
                    onClick={() => handleDemoFill("doctor")}
                    style={role === "doctor" ? styles.demoChipActive : styles.demoChip}
                  >
                    <Stethoscope size={14} color={role === "doctor" ? "#c62828" : "#64748b"} />
                    <span>👨‍⚕️ Doctor Demo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoFill("receptionist")}
                    style={role === "receptionist" ? styles.demoChipActive : styles.demoChip}
                  >
                    <Users size={14} color={role === "receptionist" ? "#c62828" : "#64748b"} />
                    <span>👩‍💼 Reception Demo</span>
                  </button>
                </div>
              </div>

              {/* Role Selector Tabs */}
              <div style={styles.roleTabs}>
                <button
                  type="button"
                  onClick={() => {
                    setRole("doctor");
                    if (identifier === "reception@healthconnect.local") handleDemoFill("doctor");
                  }}
                  style={{
                    ...styles.roleTab,
                    ...(role === "doctor" ? styles.roleTabActive : {}),
                  }}
                >
                  <Stethoscope size={16} />
                  <span>Doctor Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("receptionist");
                    if (identifier === "doctor@healthconnect.local") handleDemoFill("receptionist");
                  }}
                  style={{
                    ...styles.roleTab,
                    ...(role === "receptionist" ? styles.roleTabActive : {}),
                  }}
                >
                  <Users size={16} />
                  <span>Reception Desk</span>
                </button>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSignIn} style={styles.form}>
                <div className="form-group">
                  <label className="form-label">Employee ID or Email</label>
                  <div style={styles.inputWithIcon}>
                    <Mail size={16} color="#94a3b8" style={styles.fieldIcon} />
                    <input
                      type="text"
                      placeholder={role === "doctor" ? "e.g. DOC-001 or doctor@healthconnect.local" : "e.g. REC-001 or reception@..."}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="form-control"
                      style={{ paddingLeft: "38px" }}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={styles.inputWithIcon}>
                    <Lock size={16} color="#94a3b8" style={styles.fieldIcon} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter staff password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-control"
                      style={{ paddingLeft: "38px", paddingRight: "38px" }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", marginTop: "8px" }}
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In as {role === "doctor" ? "Doctor" : "Receptionist"}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ==================== SIGN UP VIEW ==================== */}
          {authMode === "signup" && (
            <form onSubmit={handleSignUp} style={styles.form}>
              {/* Role Selection */}
              <div className="form-group">
                <label className="form-label">Staff Role *</label>
                <div style={styles.roleTabs}>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupRole("doctor");
                      setSignupDepartment("General Medicine");
                      setSignupSpecialization("General Physician");
                    }}
                    style={{
                      ...styles.roleTab,
                      ...(signupRole === "doctor" ? styles.roleTabActive : {}),
                    }}
                  >
                    <Stethoscope size={16} />
                    <span>Doctor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSignupRole("receptionist");
                      setSignupDepartment("OPD Front Desk");
                      setSignupSpecialization("Receptionist");
                    }}
                    style={{
                      ...styles.roleTab,
                      ...(signupRole === "receptionist" ? styles.roleTabActive : {}),
                    }}
                  >
                    <Users size={16} />
                    <span>Receptionist</span>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <div style={styles.inputWithIcon}>
                  <User size={16} color="#94a3b8" style={styles.fieldIcon} />
                  <input
                    type="text"
                    placeholder={signupRole === "doctor" ? "e.g. Dr. Ramesh Gupta" : "e.g. Anjali Sharma"}
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "38px" }}
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <div style={styles.inputWithIcon}>
                  <Mail size={16} color="#94a3b8" style={styles.fieldIcon} />
                  <input
                    type="email"
                    placeholder="e.g. ramesh.gupta@clinic.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "38px" }}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">Password *</label>
                <div style={styles.inputWithIcon}>
                  <Lock size={16} color="#94a3b8" style={styles.fieldIcon} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: "38px", paddingRight: "38px" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                  </button>
                </div>
              </div>

              {/* Department & Employee ID Row */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee ID (Optional)</label>
                  <input
                    type="text"
                    placeholder={signupRole === "doctor" ? "e.g. DOC-102" : "e.g. REC-102"}
                    value={signupEmpId}
                    onChange={(e) => setSignupEmpId(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. General Medicine"
                    value={signupDepartment}
                    onChange={(e) => setSignupDepartment(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg"
                style={{ width: "100%", marginTop: "8px" }}
              >
                {loading ? (
                  <span>Creating Staff Account...</span>
                ) : (
                  <>
                    <span>Register Account & Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Security Notice */}
          <div style={styles.footerNote}>
            <ShieldCheck size={14} color="#16a34a" />
            <span>Encrypted with JWT Authentication & RBAC Policy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column",
  },
  topNav: {
    height: "64px",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    backgroundColor: "#c62828",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: "17px",
    fontWeight: "800",
    color: "#0f172a",
  },
  homeLink: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
  },
  cardWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "36px 16px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "32px 36px",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
  },
  cardHeader: {
    textAlign: "center",
    marginBottom: "16px",
  },
  headerIconBox: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    backgroundColor: "#fee2e2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
  },
  modeSwitcher: {
    display: "flex",
    backgroundColor: "#f1f5f9",
    padding: "4px",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  modeBtn: {
    flex: 1,
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#64748b",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  modeBtnActive: {
    flex: 1,
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#c62828",
    backgroundColor: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    transition: "all 0.15s ease",
  },
  demoSection: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 14px",
    marginBottom: "18px",
  },
  demoLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "6px",
  },
  demoButtonGroup: {
    display: "flex",
    gap: "8px",
  },
  demoChip: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 10px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#334155",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  demoChipActive: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 10px",
    backgroundColor: "#fee2e2",
    border: "1px solid #c62828",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#c62828",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  roleTabs: {
    display: "flex",
    gap: "6px",
    backgroundColor: "#f1f5f9",
    padding: "4px",
    borderRadius: "8px",
    marginBottom: "18px",
  },
  roleTab: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "9px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "transparent",
    fontSize: "13px",
    fontWeight: "600",
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  roleTabActive: {
    backgroundColor: "#ffffff",
    color: "#c62828",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#b91c1c",
    marginBottom: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  inputWithIcon: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  fieldIcon: {
    position: "absolute",
    left: "12px",
    pointerEvents: "none",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 0,
  },
  footerNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#64748b",
    marginTop: "20px",
    paddingTop: "14px",
    borderTop: "1px solid #f1f5f9",
  },
};