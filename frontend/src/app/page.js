"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const handleLoginClick = () => {
    if (isAuthenticated && user) {
      router.push(user.role === "doctor" ? "/doctor" : "/reception");
    } else {
      router.push("/login");
    }
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      {/* HERO SECTION */}
      <main style={styles.heroWrapper}>
        <div style={styles.heroGrid}>
          {/* Left Content */}
          <div style={styles.leftContent}>
            <div style={styles.badge}>
              <Activity size={14} color="#d62828" />
              <span>Digital Healthcare Records</span>
            </div>

            <h1 style={styles.mainTitle}>HealthConnect</h1>

            <h2 style={styles.subHeading}>
              Smarter Patient Records.<br />
              <span style={{ color: "#d62828" }}>Better Care.</span>
            </h2>

            <p style={styles.description}>
              A secure digital platform for managing patient records, OPD queues,
              consultations, prescriptions, and clinical history.
            </p>

            <div style={styles.actionRow}>
              <button onClick={handleLoginClick} className="btn btn-primary btn-lg" style={styles.ctaButton}>
                <span>
                  {isAuthenticated && user
                    ? `Open ${user.role === "doctor" ? "Doctor" : "Reception"} Station`
                    : "Staff Login"}
                </span>
                <ArrowRight size={18} />
              </button>

              <div style={styles.securityNote}>
                <ShieldCheck size={14} color="#64748b" />
                <span>Secure access for authorized healthcare staff</span>
              </div>
            </div>
          </div>

          {/* Right Healthcare Visual */}
          <div style={styles.rightContent}>
            <div style={styles.imageCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/doctor2.png"
                alt="Doctor reviewing digital healthcare records"
                style={styles.heroImage}
                onError={(e) => {
                  // Fallback to doctor.png if doctor2.png fails
                  e.currentTarget.src = "/doctor.png";
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* MINIMAL FOOTER */}
      <footer style={styles.footer}>
        <div style={styles.footerContainer}>
          <span>© {new Date().getFullYear()} HealthConnect</span>
          <span style={{ margin: "0 8px", color: "#cbd5e1" }}>•</span>
          <span>Digital Healthcare Records & OPD Management</span>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  heroWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "36px 24px",
    maxWidth: "1280px",
    width: "100%",
    margin: "0 auto",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "56px",
    alignItems: "center",
    width: "100%",
  },
  leftContent: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    backgroundColor: "#fee2e2",
    borderRadius: "9999px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#d62828",
    width: "fit-content",
  },
  mainTitle: {
    fontSize: "44px",
    fontWeight: "900",
    color: "#172033",
    letterSpacing: "-0.03em",
    lineHeight: "1.1",
    margin: 0,
  },
  subHeading: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#334155",
    letterSpacing: "-0.02em",
    lineHeight: "1.25",
    margin: 0,
  },
  description: {
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#64748b",
    maxWidth: "500px",
    margin: "4px 0 10px 0",
  },
  actionRow: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "flex-start",
  },
  ctaButton: {
    backgroundColor: "#d62828",
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: "700",
    borderRadius: "10px",
    boxShadow: "0 4px 14px rgba(214, 40, 40, 0.3)",
    gap: "8px",
  },
  securityNote: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "500",
  },
  rightContent: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  imageCard: {
    width: "100%",
    maxWidth: "480px",
    maxHeight: "440px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    border: "1px solid #e2e8f0",
    padding: "12px",
    boxShadow: "0 20px 30px -10px rgba(0, 0, 0, 0.08), 0 10px 15px -3px rgba(0, 0, 0, 0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    maxHeight: "416px",
    objectFit: "contain",
    borderRadius: "14px",
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTop: "1px solid #e2e8f0",
    padding: "18px 24px",
    textAlign: "center",
  },
  footerContainer: {
    fontSize: "13px",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
};