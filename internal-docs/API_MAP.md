# API MAP

---

# Active APIs

| Endpoint | Method | Used By | Status |
|---|---|---|---|
| /api/players | GET | Dashboard | ✅ |
| /api/gps/upload | POST | GPS | ⚠ |
| /api/wellness/save | POST | Wellness | ❌ |

---

# Broken APIs

| Endpoint | Problem |
|---|---|
| /api/gps/upload | Wrong schema |
| /api/injuries/create | Missing table |

---

# Deprecated APIs

| Endpoint | Reason |
|---|---|
| /api/playerData | Legacy endpoint |
| /api/loadMetrics | Replaced |

---

# API Dependencies

## Dashboard
- /api/players
- /api/kpi
- /api/readiness

## GPS
- /api/gps/upload
- /api/gps/sessions

---

# Missing APIs

- notifications
- report export
- injury timeline

---

# Authentication Requirements

| Endpoint | Auth |
|---|---|
| /api/players | Required |
| /api/gps/upload | Required |
| /api/public/report | Public |

---

# Validation Problems

- Missing Zod validation
- Inconsistent response format
- No error handling standard