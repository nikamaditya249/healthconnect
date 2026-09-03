"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, LogIn, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        {/* Brand Logo */}
        <Link href="/" style={styles.brand}>
          <div style={styles.logoIcon}>
            <Activity size={20} color="#ffffff" />
          </div>
          <span style={styles.brandTitle}>
            Health<span style={{ color: "#d62828" }}>Connect</span>
          </span>
        </Link>

        {/* Right CTA */}
        <div>
          {isAuthenticated && user ? (
            <button
              onClick={() => router.push(user.role === "doctor" ? "/doctor" : "/reception")}
              className="btn btn-primary btn-sm"
              style={{ gap: "6px" }}
            >
              <span>Go to {user.role === "doctor" ? "Doctor" : "Reception"} Portal</span>
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="btn btn-primary btn-sm"
              style={{ gap: "6px" }}
            >
              <LogIn size={15} />
              <span>Staff Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "0 24px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
  },
  logoIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    backgroundColor: "#d62828",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(214, 40, 40, 0.25)",
  },
  brandTitle: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#172033",
    letterSpacing: "-0.02em",
  },
};