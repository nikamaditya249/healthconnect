import axios from "axios";

export const getApiBase = () => {
  if (typeof window !== "undefined") {
    // In production (Vercel or custom domain), use relative /api rewritten by vercel.json
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "/api";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api";
};

export const getFileUrl = (url) => {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return url;
    }
  }
  return `http://localhost:5050${url}`;
};

const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to attach baseURL and JWT token dynamically
apiClient.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getApiBase();
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("healthconnect_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Helper for safe requests
const safeRequest = async (requestFn, defaultError = "Request failed") => {
  try {
    const res = await requestFn();
    return res.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message || defaultError;
    const errorObj = new Error(errorMsg);
    errorObj.response = err.response;
    errorObj.status = err.response?.status;
    throw errorObj;
  }
};

// ==================== AUTH APIS ====================
export const loginStaff = async (credentials) => {
  try {
    const res = await apiClient.post("/auth/login", credentials);
    return res.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || "Invalid login credentials. Please check your email/password.";
    return { success: false, error: errorMsg };
  }
};

export const registerStaff = async (userData) => {
  try {
    const res = await apiClient.post("/auth/register", userData);
    return res.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || "Registration failed. Please try again.";
    return { success: false, error: errorMsg };
  }
};

export const getStaffProfile = async () => {
  return safeRequest(() => apiClient.get("/auth/me"), "Failed to load staff profile");
};

// ==================== PATIENTS APIS ====================
export const getPatients = async (params = {}) => {
  return safeRequest(() => apiClient.get("/patients", { params }), "Failed to fetch patients");
};

export const getPatientById = async (id) => {
  return safeRequest(() => apiClient.get(`/patients/${id}`), "Patient not found");
};

export const registerPatient = async (patientData) => {
  return safeRequest(() => apiClient.post("/patients", patientData), "Failed to register patient");
};

export const updatePatient = async (id, updateData) => {
  return safeRequest(() => apiClient.put(`/patients/${id}`, updateData), "Failed to update patient");
};

// ==================== OPD QUEUE APIS ====================
export const getOPDQueue = async (params = {}) => {
  return safeRequest(() => apiClient.get("/opd/queue", { params }), "Failed to fetch OPD queue");
};

export const getOPDStats = async () => {
  return safeRequest(() => apiClient.get("/opd/stats"), "Failed to fetch OPD stats");
};

export const createOPDVisit = async (visitData) => {
  try {
    return await safeRequest(() => apiClient.post("/opd/visit", visitData), "Failed to enqueue patient");
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      try {
        return await safeRequest(() => apiClient.post("/visits", visitData), "Failed to enqueue patient");
      } catch {
        return await safeRequest(() => apiClient.post("/appointments", visitData), "Failed to enqueue patient");
      }
    }
    throw err;
  }
};

export const updateOPDStatus = async (visitId, status, extra = {}) => {
  const payload = {
    status,
    visitId,
    queueNumber: extra.queueNumber,
    patientId: extra.patientId,
    patientCode: extra.patientCode,
  };
  return safeRequest(() => apiClient.put(`/opd/visit/${visitId}/status`, payload), "Failed to update visit status");
};

export const syncOPDQueue = async (visits) => {
  try {
    return await apiClient.post("/opd/sync", { visits });
  } catch {
    // Non-fatal sync
  }
};

export const syncPatients = async (patients) => {
  try {
    return await apiClient.post("/patients/sync", { patients });
  } catch {
    // Non-fatal sync
  }
};

// ==================== MEDICAL RECORDS APIS ====================
export const getPatientRecords = async (patientId) => {
  return safeRequest(() => apiClient.get(`/records/patient/${patientId}`), "Failed to fetch medical records");
};

export const getRecordDetail = async (recordId) => {
  return safeRequest(() => apiClient.get(`/records/detail/${recordId}`), "Record detail not found");
};

export const createMedicalRecord = async (recordData) => {
  return safeRequest(() => apiClient.post("/records", recordData), "Failed to save medical record");
};

export const syncMedicalRecords = async (records) => {
  try {
    return await apiClient.post("/records/sync", { records });
  } catch {
    // Non-fatal sync
  }
};

// ==================== MEDICAL DOCUMENTS APIS ====================
export const uploadMedicalDocument = async (formData) => {
  return safeRequest(
    () =>
      apiClient.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    "Failed to upload document"
  );
};

export const getPatientDocuments = async (patientId) => {
  return safeRequest(() => apiClient.get(`/documents/patient/${patientId}`), "Failed to fetch documents");
};

export const deleteMedicalDocument = async (docId) => {
  return safeRequest(() => apiClient.delete(`/documents/${docId}`), "Failed to delete document");
};

export const syncMedicalDocuments = async (documents) => {
  try {
    return await apiClient.post("/documents/sync", { documents });
  } catch {
    // Non-fatal sync
  }
};

// ==================== AI HEALTHCARE APIS ====================
export const generateAIPatientSummary = async (patientId) => {
  return safeRequest(() => apiClient.post("/ai/patient-summary", { patientId }), "AI summary service unavailable");
};

export const structureClinicalNotes = async (rawNotes) => {
  return safeRequest(() => apiClient.post("/ai/structure-notes", { rawNotes }), "AI note structuring unavailable");
};

export const searchPatientRecordsAI = async (patientId, query) => {
  return safeRequest(() => apiClient.post("/ai/record-search", { patientId, query }), "AI search unavailable");
};

export const extractDocumentInsightsAI = async (documentText, documentTitle) => {
  return safeRequest(
    () => apiClient.post("/ai/document-extract", { documentText, documentTitle }),
    "AI document extraction unavailable"
  );
};

export default apiClient;