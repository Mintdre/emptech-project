# Oracle OS (Enterprise Technical Writer)

A sophisticated SaaS platform that uses AI to generate structured, professional technical blog posts and documentation. This project demonstrates a full-stack implementation including authentication, subscription management (SaaS), payment simulation, and accessibility compliance.

> **Repository:** [https://codeberg.org/Mintdre/emptech-project](https://codeberg.org/Mintdre/emptech-project)

## 🤖 AI & Attribution

*   **Code Assistance:** This project's source code was developed with the assistance of **Google Gemini**.
*   **Content Engine:** The application leverages the **Google Gemini API** (`gemini-1.5-flash` for Standard users, `gemini-1.5-pro` for Plus users).

## 🚀 Key Features

### 1. Core Functionality
*   **AI Blog Generation:** Converts simple prompts (e.g., "How to use Docker") into full Markdown tutorials with titles and steps.
*   **History System:** Automatically saves all generated content to a PostgreSQL database. Users can browse past guides via the sidebar.

### 2. Monetization (SaaS Model)
*   **3-Tier Subscription System:**
    *   **Free:** Limited to 10 generations per month.
    *   **Premium:** Unlimited generations + Priority.
    *   **Plus:** Unlimited + Early Access to "Pro" AI models.
*   **Mock Payment Gateway:** A simulated checkout experience supporting Credit Card, GCash/Maya, and PayPal. (Accepts any input for testing).
*   **Usage Tracking:** Visual progress bar for Free tier users tracking their monthly quota.

### 3. Security & Privacy
*   **Data Protection:** User passwords are hashed using **Bcrypt** (Salt rounds: 10).
*   **Input Sanitization:** All AI output is scrubbed via **DOMPurify** to prevent XSS attacks.
*   **Legal Compliance:** Includes a dedicated `/legal` page and mandatory consent checkboxes during registration.

### 4. Accessibility (WCAG)
*   **"True Sight" Mode:** A high-contrast toggle for visually impaired users.
*   **Keyboard Navigation:** Includes hidden "Skip to Content" links and visible focus indicators.
*   **Screen Reader Support:** Full usage of ARIA labels and `.sr-only` classes.

## 🛠️ Tech Stack

*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** PostgreSQL (User data, History, Subscription state)
*   **Session Store:** Redis
*   **AI:** Google Generative AI SDK
*   **Frontend:** EJS (Templating) + Custom CSS (Glassmorphism/Dark Mode)
*   **Infrastructure:** Podman / Docker

## 📦 Installation & Setup

### 1. Prerequisites
*   Node.js (v18+)
*   Podman or Docker (for Database & Redis)
*   Google Gemini API Key

### 2. Infrastructure Setup
Start the required databases using Podman (or Docker):

```bash
# Create data directories
mkdir -p database/postgres database/redis

# Start Redis
podman run -d --name fantasy-redis -p 6379:6379 -v $(pwd)/database/redis:/data redis:latest

# Start PostgreSQL
podman run -d --name fantasy-postgres -p 5432:5432 \
  -e POSTGRES_USER=fantasy -e POSTGRES_PASSWORD=password123 -e POSTGRES_DB=fantasyhelp \
  -v $(pwd)/database/postgres:/var/lib/postgresql/data \
  postgres:15-alpine