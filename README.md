# 🦠 Epicast — Disease Outbreak Intelligence & Forecasting System

A production-style full-stack healthcare intelligence platform for real-time
outbreak monitoring, geospatial zone classification, automated alerts, and
ML-powered disease spread forecasting.

---

## 📁 Project Structure

```
epicast/
├── backend/
│   ├── main.py                   ← FastAPI app entry point (startup, seeding, CORS)
│   ├── database.py               ← SQLAlchemy engine + session factory
│   ├── models.py                 ← ORM models: User, Report, Alert, ActivityLog
│   ├── auth.py                   ← JWT creation/validation + password hashing
│   ├── utils.py                  ← Haversine, compute_zone, ensure_alert, log_activity
│   ├── requirements.txt
│   └── routes/
│       ├── auth_routes.py        ← POST /login, POST /logout
│       ├── report_routes.py      ← POST /report_case, POST /report_death, GET /reports
│       ├── dashboard_routes.py   ← GET /dashboard/{stats,zones,forecast/:disease}
│       ├── alert_routes.py       ← GET /dashboard/alerts, POST /alerts/:id/acknowledge
│       └── log_routes.py         ← GET /logs (admin only)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx               ← BrowserRouter + protected routes
        ├── api.js                ← Axios instance + all API helpers
        ├── styles/index.css
        ├── components/
        │   ├── Layout.jsx        ← Sidebar + navbar shell
        │   ├── StatCard.jsx      ← KPI card component
        │   ├── OutbreakMap.jsx   ← Leaflet map with zone markers
        │   └── ForecastChart.jsx ← Chart.js historical + forecast line chart
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── ReportsPage.jsx
            ├── ForecastPage.jsx
            ├── AlertsPage.jsx
            └── LogsPage.jsx
```

---

## ⚙️ Prerequisites

| Tool    | Version |
|---------|---------|
| Python  | 3.10+   |
| Node.js | 18+     |
| npm     | 9+      |

---

## 🚀 Quick Start

### 1. Clone / extract the project

```bash
cd epicast
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Linux / macOS)
source venv/bin/activate

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at **http://localhost:8000**

- Swagger docs: http://localhost:8000/docs
- ReDoc:        http://localhost:8000/redoc

On first run the server will:
1. Create `epicast.db` (SQLite)
2. Create all tables via SQLAlchemy
3. Seed the default admin (`admin / admin123`)
4. Seed 15 Indian healthcare facilities with synthetic outbreak data

---

### 3. Frontend Setup

Open a **new terminal tab**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server
npm run dev
```

Frontend will be live at **http://localhost:5173**

---

## 🔑 Default Login

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | admin |

---

## 🌐 API Endpoints Summary

### Authentication
| Method | Endpoint  | Description          |
|--------|-----------|----------------------|
| POST   | /login    | Authenticate → JWT   |
| POST   | /logout   | Logout (audit log)   |

### Reports
| Method | Endpoint        | Description              |
|--------|-----------------|--------------------------|
| POST   | /report_case    | Submit case report       |
| POST   | /report_death   | Submit death report      |
| GET    | /reports        | List all reports         |

### Dashboard
| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| GET    | /dashboard/stats                 | KPI summary cards        |
| GET    | /dashboard/zones                 | Geo zone map data        |
| GET    | /dashboard/alerts                | All outbreak alerts      |
| GET    | /dashboard/forecast/{disease}    | 7-day ML forecast        |

### Alerts
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /alerts/{id}/acknowledge    | Acknowledge an alert     |

### Logs
| Method | Endpoint | Description              |
|--------|----------|--------------------------|
| GET    | /logs    | Admin-only audit trail   |

---

## 🧠 Technical Highlights

### Outbreak Detection (Haversine Clustering)
- All reports within **5 km** of a new report with the **same disease** are found
- `cluster_count ≥ 2` → **RED zone**
- `cluster_count ≥ 1` or `case_count > 1000` → **YELLOW zone**
- Otherwise → **GREEN zone**

### Forecasting (scikit-learn LinearRegression)
- Aggregates daily case counts over the last **14 days**
- Fits `LinearRegression` on day index → case count
- Predicts the **next 7 days**
- Returns `r2_score` as model quality indicator

### Security
- Passwords hashed with **bcrypt** via `passlib`
- **JWT** tokens signed with HS256 (configurable secret)
- Token expiry: **12 hours**
- Admin-only routes protected by `require_admin` dependency

---

## 🏗️ Production Deployment Tips

1. **Change the JWT secret** in `backend/auth.py` → `SECRET_KEY`
2. **Replace CORS `allow_origins=["*"]`** with your frontend domain
3. **Use PostgreSQL** instead of SQLite for production workloads
4. **Deploy backend** to Railway / Render / EC2 with `uvicorn main:app`
5. **Deploy frontend** to Vercel / Netlify with `npm run build`
6. **Set `VITE_API_URL`** environment variable to your backend URL

---

## 🎨 UI Features

- Dark glassmorphism design system (Tailwind CSS)
- Responsive mobile-first layout
- Leaflet map with red/yellow/green circle markers
- Chart.js dual-line chart (historical solid + forecast dashed)
- Auto-refreshing dashboard (every 60 seconds)
- Toast notifications for form submissions
- Admin sidebar with active route highlighting

---

*Epicast v1.0 — Built as a production-style healthcare intelligence platform*
