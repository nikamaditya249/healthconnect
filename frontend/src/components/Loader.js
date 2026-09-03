"use client";

import React from "react";
import { Activity } from "lucide-react";

export default function Loader({ text = "Loading clinical records..." }) {
  return (
    <div style={styles.container}>
      <div style={styles.pulseBox}>
        <Activity size={28} color="#c62828" className="animate-pulse" />
      </div>
      <div style={styles.spinner}></div>
      <p style={styles.text}>{text}</p>
    </div>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div
            style={{
              height: "18px",
              backgroundColor: "#e2e8f0",
              borderRadius: "4px",
              width: i === 0 ? "80%" : "60%",
              animation: "pulse 1.5s infinite ease-in-out",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    gap: "14px",
  },
  pulseBox: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: "#fee2e2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #c62828",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  text: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#64748b",
  },
};
