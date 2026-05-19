# COMPONENT MAP

---

# Shared Components

| Component | Used By | Status |
|---|---|---|
| DataTable | GPS, Wellness | ✅ |
| PlayerCard | Dashboard | ⚠ |
| ModalWrapper | Global | ✅ |

---

# Duplicate Components

| Component A | Component B | Recommendation |
|---|---|---|
| PlayerCard | AthleteCard | Merge |
| KPIWidget | StatsWidget | Merge |

---

# Dead Components

| Component | Reason |
|---|---|
| OldDashboardCard | Unused |
| LegacyChart | Deprecated |

---

# Shared Hooks

| Hook | Used By |
|---|---|
| usePlayers | Dashboard |
| useGPSData | GPS |
| useWellness | Wellness |

---

# Broken Hooks

| Hook | Problem |
|---|---|
| useSessionSync | Old API |
| useAuthRefresh | Infinite loop |

---

# Global Providers

| Provider | Status |
|---|---|
| AuthProvider | ⚠ |
| ThemeProvider | ✅ |
| NotificationProvider | ❌ |

---

# Design System

## Buttons
- PrimaryButton
- SecondaryButton
- IconButton

## Forms
- Input
- Select
- DatePicker

## Layout
- PageWrapper
- SectionCard
- DashboardGrid