"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut, Clock, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Topbar({ title = "HealthConnect Portal" }) {
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={styles.topbar}>
      <div style={styles.left}>
        <div style={styles.portalTitle}>{title}</div>
        <div style={styles.securityBadge}>
          <ShieldCheck size={14} color="#16a34a" />
          <span>Encrypted Session</span>
        </div>
      </div>

      <div style={styles.right}>
        {timeStr && (
          <div style={styles.timeBox}>
            <Clock size={14} color="#64748b" />
            <span>{timeStr}</span>
          </div>
        )}

        <div style={styles.userBadge}>
          <div style={styles.rolePill}>
            {role === "doctor" ? "Doctor In-Charge" : "Front Desk Reception"}
          </div>
          <span style={styles.staffName}>{user?.name || "Staff"}</span>
        </div>

        <button onClick={logout} style={styles.logoutBtn} title="Sign out">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    height: "64px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 90,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  portalTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
  },
  securityBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "12px",
    color: "#16a34a",
    backgroundColor: "#f0fdf4",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: "500",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  timeBox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#64748b",
    fontWeight: "500",
  },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 10px",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  rolePill: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#c62828",
    backgroundColor: "#fee2e2",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  staffName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent",
    border: "1px solid #fee2e2",
    borderRadius: "6px",
    color: "#dc2626",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};