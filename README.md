# Oracle OS (The Oracle's Hearth)

A dynamic "Help Website" that generates custom, structured blog tutorials on demand using AI. The platform features a unique interface that blends technical utility with a narrative experience, currently styled with a "Modern Arcane" dark-mode aesthetic.

## 🤖 AI & Attribution

*   **Code Development:** This project's source code was developed with the assistance of **Google Gemini**.
*   **Content Generation:** All tutorials, blog posts, and technical guides within the app are generated in real-time using the **Google Gemini API** (Model: `gemini-flash-latest`).

## 🚀 Features

*   **AI-Powered Tutorials:** Users input a problem (e.g., "How to move from Photoshop to GIMP"), and the system generates a full Markdown-formatted blog post with steps and citations.
*   **Contextual Persona:** The AI is prompted to act as a "Grand Oracle," providing helpful, slightly narrative-driven technical advice.
*   **User System (Mock):** Includes a functional Register/Login system (currently running in "Mock Mode" for easy testing without database setup).
*   **Professional Logging:** Integrated detailed logging (Winston & Morgan) to track server traffic, errors, and AI generation latency.
*   **Modern UI:** A responsive, dark-mode interface built with CSS variables and Glassmorphism effects.

## 🛠️ Tech Stack

*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **AI Engine:** Google Generative AI SDK (`@google/generative-ai`)
*   **Templating:** EJS (Embedded JavaScript)
*   **Markdown Parsing:** `marked` + `dompurify` + `jsdom` (for sanitizing HTML)
*   **Logging:** `winston` (File/Console logs) + `morgan` (HTTP traffic)
*   **Security:** `bcrypt` (Password hashing)

## 📦 Installation & Setup

1.  **Prerequisites**
    *   Node.js (v18 or higher recommended)
    *   A Google Gemini API Key (Get it from [Google AI Studio](https://aistudio.google.com/))

2.  **Clone/Download**
    ```bash
    git clone https://codeberg.org/Mintdre/emptech-project.git
    cd emptech-project
    ```

3.  **Install Dependencies**
    ```bash
    npm install
    ```

4.  **Configuration**
    Create a `.env` file in the root directory and add the following:
    ```env
    PORT=6769
    SESSION_SECRET=your_random_secret_string_here
    GEMINI_API_KEY=your_actual_google_api_key_here
    
    # Optional (If switching from Mock to Real DB later)
    # MONGODB_URI=mongodb://127.0.0.1:27017/fantasyhelp
    # REDIS_URL=redis://127.0.0.1:6379
    ```

5.  **Run the Server**
    ```bash
    node server.js
    ```

6.  **Access the Application**
    Open your browser and navigate to: `http://localhost:6769`

## 📝 Usage Guide

1.  **Register:** Create a username and password (stored in memory).
2.  **Consult:** On the dashboard, type your technical question into the prompt box.
3.  **Read:** The system will generate a formatted guide.
4.  **Monitor:** Check `guild_logs.log` in the project folder to see backend activity.

## ⚠️ Note on Data Persistence (this is temporary as I will write a permanent DB in the future.)

Currently, the application is running in **Mock Mode**.
*   User data is stored in a JavaScript array.
*   **Restarting the server will wipe all registered users.**
*   To enable permanent storage, uncomment the MongoDB/Redis sections in `server.js` and ensure those services are running locally.