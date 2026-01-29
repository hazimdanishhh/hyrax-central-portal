# 🧮 Hyrax Hub Frontend

A frontend repository for Hyrax Oil's web application, a Unified Intelligence Portal.

---

## 📚 Table of Contents

- [🧮 Hyrax Hub Frontend](#-hyrax-hub-frontend)
  - [📚 Table of Contents](#-table-of-contents)
  - [📦 Tech Stack](#-tech-stack)
  - [🚀 Features](#-features)
  - [🧰 Installation \& Setup](#-installation--setup)
  - [🗂 Folder Structure](#-folder-structure)
  - [⚙️ Environment Variables](#️-environment-variables)
  - [📌 Future Improvements](#-future-improvements)
  - [👤 Authors](#-authors)
  - [📝 License](#-license)

---

## 📦 Tech Stack

- **React.js** + **Vite** Frontend

---

## 🚀 Features

- User authentication (JWT-based)
- Role-based access control
- Create/Edit/Delete project costings
- Dynamic service item selection with hourly rates
- Auto-calculated subtotals and total costing
- Full API structure for future frontend integration
- Modular folder structure using services, controllers, models

---

## 🧰 Installation & Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/hazimdanishhh/hyrax-central-portal
   cd hyrax-central-portal
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment variables**

   Create a `.env` file:
   - Ensure `VITE_API_BASE_URL` includes a trailing slash "/api".
   - Uncomment the URL that is currently being used as the frontend (either development or staging)

   ```env
   # DEVELOPMENT
   VITE_API_BASE_URL=http://localhost:5000/api

   # STAGING
   # VITE_API_BASE_URL=https://costing-system.onrender.com/api
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

---

## 🗂 Folder Structure

```bash
# To be added
```

---

## ⚙️ Environment Variables

| Variable            | Required | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `VITE_API_BASE_URL` | ✅       | Back End URL (Ensure it includes a trailing slash "/api") |

---

## 📌 Future Improvements

- PDF export of costings
- Email sending feature
- Admin dashboard with stats
- Role-based service item editing

---

## 👤 Authors

- [@danish](https://github.com/hazimdanishhh)
- [@hyraxoil](https://github.com/hyraxoilofficial)

---

## 📝 License

MIT License
