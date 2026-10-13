"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loginStaff, registerStaff, getStaffProfile } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("healthconnect_token");
    localStorage.removeItem("healthconnect_user");
    localStorage.removeItem("role");
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem("healthconnect_token");
        const storedUser = localStorage.getItem("healthconnect_user");

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Silently verify with server
          try {
            const profile = await getStaffProfile();
            if (profile?.user) {
              setUser(profile.user);
              localStorage.setItem("healthconnect_user", JSON.stringify(profile.user));
            }
          } catch (e) {
            // Token might be invalid
            if (e.response?.status === 401) {
              logout();
            }
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  const login = async (identifier, password) => {
    const data = await loginStaff({ identifier, password });
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("healthconnect_token", data.token);
      localStorage.setItem("healthconnect_user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      // Redirect to appropriate dashboard
      if (data.user.role === "doctor") {
        router.push("/doctor");
      } else {
        router.push("/reception");
      }
      return data;
    }
    throw new Error(data.error || "Invalid credentials. Staff account not found.");
  };

  const register = async (userData) => {
    const data = await registerStaff(userData);
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("healthconnect_token", data.token);
      localStorage.setItem("healthconnect_user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      if (data.user.role === "doctor") {
        router.push("/doctor");
      } else {
        router.push("/reception");
      }
      return data;
    }
    throw new Error(data.error || "Registration failed. Please check the entered details.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
