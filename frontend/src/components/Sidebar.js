"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Users,
  Clock,
  UserPlus,
  Stethoscope,
  FileText,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const { user, role, logout } = useAuth();

  const isReception = role === "receptionist" || pathname.startsWith("/reception");
  const isDoctor = role === "doctor" || pathname.startsWith("/doctor");

  const receptionNavItems = [
    { name: "Dashboard", href: "/reception?tab=overview", tab: "overview", icon: LayoutDashboard },
    { name: "OPD Live Queue", href: "/reception?tab=queue", tab: "queue", icon: Clock },
    { name: "Patients Directory", href: "/reception?tab=patients", tab: "patients", icon: Users },
    { name: "Register Patient", href: "/reception?tab=register", tab: "register", icon: UserPlus },
  ];

  const doctorNavItems = [
    { name: "Doctor Dashboard", href: "/doctor?tab=overview", tab: "overview", icon: LayoutDashboard },
    { name: "OPD Queue", href: "/doctor?tab=queue", tab: "queue", icon: Clock },
    { name: "Patients List", href: "/doctor?tab=patients", tab: "patients", icon: Users },
    { name: "Consultations", href: "/doctor?tab=consultations", tab: "consultations", icon: Stethoscope },
  ];

  const navItems = isDoctor ? doctorNavItems : receptionNavItems;

  const isActive = (item) => {
    if (pathname === "/reception" || pathname === "/doctor") {
      return currentTab === item.tab;
    }
    return false;
  };

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandBox}>
        <div style={styles.logoIcon}>
          <Activity size={20} color="#ffffff" />
        </div>
        <div>
          <div style={styles.brandTitle}>
            Health<span style={{ color: "#c62828" }}>Connect</span>
          </div>
          <div style={styles.roleTag}>
            {isDoctor ? "Doctor Portal" : "Reception Desk"}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={styles.navSection}>
        <div style={styles.sectionLabel}>MAIN NAVIGATION</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                ...styles.navLink,
                ...(active ? styles.navLinkActive : {}),
              }}
            >
              <Icon size={18} color={active ? "#c62828" : "#64748b"} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile & Logout */}
      <div style={styles.bottomSection}>
        <div style={styles.userCard}>
          <div style={styles.avatar}>
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || "Staff Member"}</div>
            <div style={styles.userRole}>
              {user?.employeeId ? `${user.employeeId} • ` : ""}
              <span style={{ textTransform: "capitalize" }}>{role || "Staff"}</span>
            </div>
          </div>
        </div>

        <button onClick={logout} style={styles.logoutBtn} aria-label="Sign out">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "260px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "100vh",
    flexShrink: 0,
  },
  brandBox: {
    padding: "24px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderBottom: "1px solid #f1f5f9",
  },
  logoIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    backgroundColor: "#c62828",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  roleTag: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  navSection: {
    padding: "20px 14px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "0.05em",
    marginBottom: "8px",
    paddingLeft: "10px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#475569",
    transition: "all 0.15s ease",
  },
  navLinkActive: {
    backgroundColor: "#fee2e2",
    color: "#c62828",
  },
  bottomSection: {
    padding: "16px",
    borderTop: "1px solid #f1f5f9",
    backgroundColor: "#f8fafc",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "#e2e8f0",
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "14px",
  },
  userInfo: {
    overflow: "hidden",
  },
  userName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#0f172a",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  userRole: {
    fontSize: "11px",
    color: "#64748b",
  },
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "8px 12px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};