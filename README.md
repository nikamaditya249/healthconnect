# HealthConnect — Digital Healthcare Records & OPD Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-blue?style=flat&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=flat&logo=node.js)](https://nodejs.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas%20Mongoose-brightgreen?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%202.5-purple?style=flat&logo=google)](https://ai.google.dev/)
[![JWT Auth](https://img.shields.io/badge/Security-JWT%20%2B%20Bcrypt%20RBAC-red?style=flat&logo=jsonwebtokens)](https://jwt.io/)

> **HealthConnect** is a full-stack, SaaS-grade Electronic Health Record (EHR) and Outpatient Department (OPD) management system designed to replace physical paper-based patient records with centralized digital health records, real-time OPD queue orchestration, chronological medical timelines, and AI-assisted clinical documentation.

---

## 🏥 Problem Statement & Solution

### The Challenge
In rural clinics, primary healthcare centers, and small outpatient facilities, patients frequently carry physical paper files. Physical files are vulnerable to loss, water/physical damage, and fragmentation across multiple visits. When paper files are misplaced, attending doctors lose vital clinical context—including documented drug allergies, chronic conditions, prior prescriptions, and diagnostic lab reports.

### The HealthConnect Solution
HealthConnect eliminates paper file vulnerabilities by providing a unified digital clinical station:
- **Unique Digital Patient ID**: Sequential format (`HC-000001`) preventing duplicate records.
- **Real-Time OPD Queue**: Front-desk reception enqueues patients with priority tags (`Normal`, `Urgent`, `Emergency`); doctors track waiting counts and start consultations in one click.
- **Chronological Medical Timeline**: Complete visual history of all past visits, diagnoses, vital signs, and physician notes.
- **AI Clinical Copilot**: Powered by the **Google Gemini API** to synthesize multi-visit history into executive summaries, structure raw doctor notes, and search patient history strictly within official records.
- **Encrypted Medical Document Vault**: Secure multi-category storage for lab reports, imaging, and external prescriptions.

---

## 🌟 Key Features & Role-Based Workflows

```
                           HEALTHCONNECT ARCHITECTURE
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
                 RECEPTIONIST                         DOCTOR
                      │                                 │
                 Dashboard                         Dashboard
                 Patients Registry                 OPD Live Queue
                 Patient Registration              Patients List
                 OPD Token Generation              Consultations
                      │                                 │
                      └───────────────┬─────────────────┘
                                      │
                              PATIENT PROFILE
                                      │
                   ┌──────────────────┼──────────────────┐
                   │                  │                  │
                Overview       Medical History        Timeline
                   │                  │                  │
                   └──────────────────┼──────────────────┘
                                      │
                             ADD CONSULTATION
                                      │
                              Doctor Verification
                                      │
                                COMPLETED
                                      │
                       ┌──────────────┴──────────────┐
                       │                             │
                 Medical Records            Google Gemini AI
                                                     │
                                             Clinical Summary /
                                             Note Structuring /
                                             Record QA Search
```

### 1. Receptionist Desk (`/reception`)
- **Live Clinic Metrics**: Total registered patients, active queue count, in-consultation count, completed visits today.
- **Instant Patient Search**: Real-time filtering by Patient Name, ID (`HC-XXXXXX`), phone number, and blood group.
- **Patient Registration**: Streamlined intake capturing demographics, emergency contacts, drug allergies, and chronic conditions.
- **OPD Token Generation**: Instant queue placement with chief complaint and priority categorization.

### 2. Doctor Consultation Station (`/doctor`)
- **Queue Overview**: Waiting list with arrival times, chief complaints, priority badges, and active consultation alerts.
- **"Start Consultation" Action**: Auto-transitions visit status to `in-progress` and directly opens the patient's comprehensive profile.
- **Completed Tracker**: Real-time audit of patients treated today with diagnostic summaries.

### 3. Unified Patient Profile (`/patient/[id]`)
- **Demographics & Alerts**: Patient ID badge, blood group pill, drug allergies banner, and emergency contact details.
- **Overview & Vitals**: Latest recorded blood pressure, heart rate, temperature, SpO2, and weight.
- **AI Clinical Assistant**:
  - **Generate History Summary**: Synthesizes past visits, recurring complaints, and active medications.
  - **Natural Language Record QA**: Answers doctor queries bounded strictly to the patient's existing history.
- **Chronological Medical Timeline**: Visual cards detailing every historical consultation, diagnosis, and prescription.
- **Inline Consultation Creator & Multi-Medicine Prescription Builder**:
  - Chief complaint, symptoms, duration, diagnosis, follow-up date.
  - Vital signs recording (BP, Pulse, Temp, SpO2, Weight).
  - Multi-row medication prescription table (Medicine, Dosage, Frequency, Duration, Instructions).
  - **AI Clinical Note Formatter**: Formats unstructured doctor notes into structured clinical fields.
  - **Auto-Completion**: Saving a consultation automatically transitions linked OPD visits to `Completed`.
- **Medical Documents Vault**: Multi-format document upload (PDF, PNG, JPG) categorized by report type.
- **Printable Prescription View**: Clean, printable clinical prescription sheet.

---

## 🔐 Security & Clinical Safety

- **JWT Authentication**: Secure stateless token authentication with 7-day expiration.
- **Role-Based Access Control (RBAC)**: Backend authorization middleware strictly separating receptionist and physician capabilities.
- **Password Hashing**: Bcrypt encryption with salt rounds; passwords never stored in plaintext.
- **Audit Logging**: Sensitive patient registration, record modification, and login events tracked with timestamp and user ID.
- **AI Clinical Safety Protocol**: All AI outputs are bounded to verified database records and labeled with standard safety disclaimers:
  > *"AI-generated clinical summary — for review by authorized healthcare professional only. Not a medical diagnosis."*

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16 (Turbopack)](https://nextjs.org/), [React 19](https://react.dev/), [Lucide Icons](https://lucide.dev/) |
| **Styling** | Custom Responsive Healthcare SaaS Design System (`globals.css`) |
| **Backend** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/) (ES Modules) |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/) via [Mongoose ODM](https://mongoosejs.com/) |
| **AI Integration** | [Google Gemini API (`@google/genai`)](https://ai.google.dev/) with Deterministic Fallbacks |
| **File Storage** | [Multer](https://github.com/expressjs/multer) Medical Document Storage |
| **Security** | [jsonwebtoken](https://jwt.io/), [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB Atlas** database connection string

---

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` (or copy from `.env.example`):

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/healthconnect?retryWrites=true&w=majority
PORT=5050

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Client URL
CLIENT_URL=http://localhost:3000

# Google Gemini API Key (Optional: smart fallback is used if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend server:

```bash
npm start
# or
node server.js
```

Backend API will be running on **`http://localhost:5050`**. Default demo staff accounts will be auto-seeded on first boot.

---

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file inside `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5050/api
```

Start the Next.js development server:

```bash
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🔑 Demo Login Credentials

For quick evaluation, click the **1-Click Demo Chips** on the login page (`/login`):

| Role | Email / Employee ID | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor@healthconnect.local` (`DOC-001`) | `doctor123` | OPD Queue, Consultations, EHRs, Prescriptions, AI Tools |
| **Receptionist** | `reception@healthconnect.local` (`REC-001`) | `reception123` | Patient Registration, Patient Search, OPD Tokens |

---

## 📡 API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new healthcare staff account (Doctor or Receptionist) stored directly in MongoDB Atlas.
- `POST /api/auth/login` — Authenticate staff via Email/Employee ID + Password + Role.
- `GET /api/auth/me` — Retrieve current authenticated session profile (JWT required).
- `POST /api/auth/seed` — Seed default demo staff accounts.

### Patients (`/api/patients`)
- `GET /api/patients` — List/search patients with pagination and blood group filters.
- `GET /api/patients/:id` — Retrieve patient details by MongoDB ID or Patient ID (`HC-XXXXXX`).
- `POST /api/patients` — Register new patient with auto-generated sequential ID.
- `PUT /api/patients/:id` — Update patient clinical information.

### OPD Queue (`/api/opd`)
- `GET /api/opd/queue` — Get active waiting and in-consultation visits for today.
- `GET /api/opd/stats` — Get clinic metrics (Total Today, Waiting, In-Consultation, Completed).
- `POST /api/opd/visit` — Create new OPD queue token for a patient.
- `PUT /api/opd/visit/:id/status` — Transition visit status (`waiting` → `in-progress` → `done`).

### Medical Records (`/api/records`)
- `GET /api/records/patient/:patientId` — Fetch all historical consultations for a patient.
- `POST /api/records` — Save consultation record with vitals & prescriptions (auto-completes OPD visit).
- `GET /api/records/detail/:id` — Get single consultation detail.

### Medical Documents (`/api/documents`)
- `POST /api/documents/upload` — Upload medical document (Multer multipart file + metadata).
- `GET /api/documents/patient/:patientId` — Retrieve all documents uploaded for a patient.
- `DELETE /api/documents/:id` — Delete a document.

### AI Clinical Layer (`/api/ai`)
- `POST /api/ai/patient-summary` — Generates clinical history executive summary via Gemini API.
- `POST /api/ai/structure-notes` — Converts raw doctor notes into structured clinical JSON.
- `POST /api/ai/record-search` — Natural language query interface over patient history.
- `POST /api/ai/document-extract` — Extracts key clinical values from uploaded medical report text.

---

## 🌐 Production Deployment

### Frontend (Vercel)
1. Push repository to GitHub.
2. Import project into [Vercel](https://vercel.com).
3. Set the Root Directory to `frontend`.
4. Configure environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-api.onrender.com/api`
5. Deploy.

### Backend (Render / Railway)
1. Set the Root Directory to `backend`.
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Configure environment variables:
   - `MONGO_URI` = `mongodb+srv://...`
   - `JWT_SECRET` = `your_strong_jwt_secret`
   - `CLIENT_URL` = `https://your-frontend.vercel.app`
   - `GEMINI_API_KEY` = `your_gemini_api_key`
5. Deploy.

---

## 📄 License
This project is developed for portfolio demonstration. All rights reserved.# healthconnect
