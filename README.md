# UP DigiShakti Student Details & College Search Portal 🎓📱

A modern, fast, responsive web application to view and verify student enrollment details, academic records, and Aadhaar e-KYC status using **Roll Number / Enrollment Number** and **College / University** directly integrated with the official Government of Uttar Pradesh DigiShakti EPramaan portal (`https://aadhaar.digishaktiup.in/EPramaan/SendServiceToEpramaan`).

---

## 🚀 Features

- **Direct Live DigiShakti Integration**:
  - Connected directly to `https://aadhaar.digishaktiup.in/EPramaan/SendServiceToEpramaan` with automatic ASP.NET session management and CSRF token handling.
  - Live Captcha retrieval (`/EPramaan/GetCaptchaimage`) with 1-click refresh.
  - Dynamic college list fetching (`/EPramaan/CollegeList?UdbId=...`) across 169+ UP State & Technical Universities.
- **Search by Roll Number & College**:
  - Searchable college dropdown with instant real-time fuzzy filtering across 800+ AKTU colleges and hundreds across other UP universities.
  - Quick-preset selectors for AKTU, Lucknow University, BTEUP (Polytechnic), CCSU Meerut, CSJMU Kanpur.
- **Comprehensive Student Details & e-KYC Card**:
  - Student Profile (English Name, Hindi Name, Father's Name, Gender, Roll Number / Enrollment Number with 1-click copy).
  - Academic Details (University, College Name, Code, Course, Branch/Stream, Academic Year & Session).
  - DigiShakti Scheme Status (Aadhaar e-KYC Status badge, Tablet / Smartphone Eligibility, Nodal Officer Approval Stage, Reference Number).
  - Direct MeriPehchaan (e-Pramaan) single sign-on link if e-KYC is pending.
- **Print & PDF Export**:
  - Clean, official printable Student Verification Slip format.
- **Share & Export**:
  - 1-click formatted summary copy for WhatsApp/Telegram.
  - Full JSON report export.
- **Multi-Tab Experience**:
  - **DigiShakti Portal**: Search by Roll No / Enrollment No + College/University.
  - **AKTU Result Portal**: Search semester exam results, SGPA, and subject grades by name.
  - **e-KYC & Guidelines**: Step-by-step tutorial on MeriPehchaan Aadhaar verification and troubleshooting.
- **Recent Searches**:
  - LocalStorage history with fast 1-click restore.

---

## 🛠️ How to Run

### 1. Zero-Dependency Local Node.js Server
Run the built-in server (uses Node.js standard libraries only, no external npm packages required):
```bash
npm start
# or
node server.js
```
Then visit **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🌐 API Endpoints

- `GET /api/universities`: Returns list of all 169 UP Universities / Boards.
- `GET /api/colleges?udbId=5`: Returns live list of colleges for the selected university.
- `GET /api/captcha`: Creates a new session with DigiShakti and returns base64 Captcha image + `sessionId`.
- `POST /api/search-student`: Submits search query to DigiShakti EPramaan with CSRF token and cookie jar, parses returned student profile.
- `POST /api/aktu-result`: Proxies name-based result search to AKTU exam portal.

---

## 🔒 Security & Privacy Notice

This application connects to the official UP Government DigiShakti Portal (`aadhaar.digishaktiup.in`) to display student verification records for the Tablet & Smartphone Distribution Scheme (Swami Vivekanand Yuva Sashaktikaran Yojana). All credentials and sessions are handled securely with transient in-memory sessions.
