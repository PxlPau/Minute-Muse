# 🕰️ Minute Muse

> **"The clock showed the time, and the world held its breath."**

**Minute Muse** is a cozy, atmospheric web application that turns every minute of the day into a story. It combines real-time literature quotes, dynamic seasonal photography, and immersive soundscapes to create a calming digital environment.

🔗 **[Live Demo](https://pxlpau.github.io/Minute-Muse/)** 

---

## ✨ Features

*   **📖 Literature Clock:** Displays a unique quote from a book that mentions the *exact* current time (e.g., "It was 4:32 PM...").
*   **🌍 Smart Atmosphere:** Automatically detects your location's climate (Tropical vs. Temperate) and season (Winter/Summer) to show relevant imagery.
*   **📸 Hourly Curation:** Powered by a custom GitHub Action that curates fresh, high-quality images from Unsplash every hour.
*   **🎧 Immersive Audio:** Features dynamic soundscapes (Rain, Fireplace, Nature) using Public Domain (CC0) audio.
*   **🧘 Zen Mode:** A distraction-free interface for deep focus.
*   **✏️ Muse Journal:** A privacy-focused, local-storage scratchpad for your thoughts.
*   **🔧 Admin Dashboard:** A hidden developer mode to test different seasons and locations.

---

## 🛠️ How It Works

Minute Muse uses a unique **"Serverless Curator"** architecture to maintain high performance without hitting API rate limits on the client side.

1.  **The Brain (GitHub Actions):** Every hour, a workflow runs `generate-images.js`. It generates varied search queries based on global seasons (e.g., *"Kyoto Winter Temple"* or *"Bali Rice Terrace"*) and fetches fresh photos from Unsplash.
2.  **The Cache:** These images are saved to a static `images.json` file.
3.  **The Client:** The website simply reads this JSON file. This ensures the site loads instantly and respects user privacy by not making unnecessary API calls.

---

## © Credits & Attribution

This project is a labor of love that relies on the creative work of many others. We strictly adhere to attribution requirements and Fair Use principles.

### 📚 Literature Quotes
The database of time-synced quotes is sourced from the open-source **Literature Clock** project.
*   **Source:** [Literature Clock on GitHub](https://github.com/JohannesNE/literature-clock)
*   **Rights:** All literary rights, copyrights, and ownership of the quotes remain with their respective authors and publishers. They are used here for educational and transformative purposes.

### 📸 Photography
Background images are provided by the **Unsplash Community**.
*   **Source:** [Unsplash](https://unsplash.com)
*   **Attribution:** Each image in the app is accompanied by a direct link to the photographer's profile and the Unsplash website, complying with the [Unsplash API Terms](https://unsplash.com/api-terms).

### 🎵 Audio
All ambient soundscapes used in this project are **Public Domain (CC0)**.
*   **Source:** [Freesound.org](https://freesound.org/)
*   **License:** Creative Commons 0 (Universal Public Domain Dedication).
*   **Note:** These files are free to use, modify, and distribute for any purpose without attribution (though we credit the source platform as a courtesy).

---

## ⚖️ License & Disclaimer

### The Code
The source code for Minute Muse (HTML, CSS, JS, Workflows) is licensed under the **MIT License**.

> You are free to use, modify, and distribute the code for personal or commercial projects, provided you include the original copyright notice.

### The Assets (Disclaimer)
**Important:** The MIT License applies **only to the code**. It does **not** grant you rights to the creative assets (book quotes or specific photographs) used within the application.
*   If you fork this project, you must ensure you have the right to use any third-party media you include.
*   This software is provided "as is", without warranty of any kind.

---

## 🚀 Local Setup

If you want to run your own version of Minute Muse:

1.  **Clone the repo**
    ```bash
    git clone https://github.com/yourusername/Minute-Muse.git
    cd Minute-Muse
    ```

2.  **Add your Unsplash Key**
    *   Get a free Access Key from the [Unsplash Developers](https://unsplash.com/developers).
    *   Create a `.env` file or set a system environment variable: `UNSPLASH_ACCESS_KEY=your_key_here`.

3.  **Run the Curator**
    ```bash
    npm install
    node generate-images.js
    ```
    *This will generate the `images.json` file needed for the app to run.*

4.  **Open `index.html`** in your browser.

---

## 🤝 Contributing

Found a bug? Have a better playlist idea?
1.  Fork the repository.
2.  Create a feature branch.
3.  Submit a Pull Request!

---

*Made with ☕ and 🌧️ by Jerriel*
