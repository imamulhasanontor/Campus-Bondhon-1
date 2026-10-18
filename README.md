# Campus Bondhon 🤝🎓

**Team Name:** Bondhon  
**Project Name:** Campus Bondhon  
**Concept:** A responsive, mobile-first connection hub for university students to share study materials, donate clothing anonymously with full dignity, and browse verified landlord housing profiles near campus.

---

## 📁 Project File Structure

```text
campus-bondhon/
├── index.html          # Home page (Hero, How It Works, 3 Feature Cards)
├── study.html          # Study Resources page (Post & filter books, notes, past papers)
├── clothing.html       # Clothing Resources page (100% Free & Anonymous clothing donations)
├── landlords.html      # Landlords Profile page (Firebase Auth login, owner dashboard, room units)
├── css/
│   └── style.css       # Mobile-first stylesheet with CSS variables at the top
├── js/
│   ├── firebase-config.js  # Firebase SDK setup & placeholder configuration
│   ├── main.js             # Shared navbar toggle, phone/image validation, WhatsApp helpers
│   ├── study.js            # Study Resources Firestore + Storage logic
│   ├── clothing.js         # Clothing Resources anonymous donation logic
│   └── landlords.js        # Landlord Auth, profile editor, and multi-unit manager
├── assets/             # Default images & placeholder note for custom logos/photos
├── firestore.rules     # Firestore Database security rules
├── storage.rules       # Firebase Storage security rules (2 MB image limit)
└── README.md           # Complete setup, deployment, and customization guide
```

---

## 🔥 1. How to Set Up Firebase & Where to Paste the Config

> **Good news for testing:** Out of the box, Campus Bondhon automatically runs in **Local Demo Mode** (using browser storage) until you paste your Firebase keys. You can test every form, filter, and dashboard immediately!

When you are ready to connect live Firebase for GitHub Pages:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Create a project** (or **Add project**), name it `campus-bondhon`, and finish creating it.
3. **Register Your Web App:**
   - On the Project Overview page, click the **Web icon (`</>`)**.
   - Enter `Campus Bondhon` as the app nickname and click **Register app**.
   - Copy the `firebaseConfig` object shown on screen.
4. **Paste Your Config:**
   - Open `js/firebase-config.js`.
   - Replace the placeholder values inside `export const firebaseConfig = { ... }` (lines 43–50) with your copied keys.
5. **Enable Authentication (for Landlords):**
   - In Firebase Console, go to **Build → Authentication → Get started**.
   - Click **Email/Password**, toggle **Enable** on, and click **Save**.
6. **Enable Firestore Database:**
   - Go to **Build → Firestore Database → Create database**.
   - Start in **Production mode**, choose your nearest location, and click **Create**.
   - Open the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**.
7. **Enable Firebase Storage (for Photos):**
   - Go to **Build → Storage → Get started**.
   - Open the **Rules** tab, paste the contents of `storage.rules`, and click **Publish**.

---

## 💻 2. How to Run the Site Locally

Because the JavaScript files use standard ES Modules (`<script type="module">`), open the folder using a local development server rather than double-clicking `index.html` directly:

### Option A: Using VS Code Live Server (Recommended for Beginners)
1. Open the `campus-bondhon` folder in **Visual Studio Code**.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click `index.html` and select **Open with Live Server**.
4. Your browser will open `http://127.0.0.1:5500/index.html`.

### Option B: Using Python (Built into macOS/Linux/Windows)
1. Open a terminal inside the `campus-bondhon` folder.
2. Run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

---

## 🚀 3. Exact Steps to Upload to GitHub & Enable GitHub Pages

1. Create a free account at [github.com](https://github.com/) and click the **`+`** icon in the top-right corner → **New repository**.
2. Name the repository `campus-bondhon`, set it to **Public**, and click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Drag and drop all files and folders inside `campus-bondhon/` (`index.html`, `study.html`, `clothing.html`, `landlords.html`, `css/`, `js/`, `assets/`, `firestore.rules`, `storage.rules`, `README.md`) into the browser window.
5. Type `"Initial commit of Campus Bondhon"` at the bottom and click **Commit changes**.
6. Go to your repository's **Settings** tab (top menu bar).
7. In the left sidebar, click **Pages**.
8. Under **Build and deployment → Branch**, select **`main`** (and `/ (root)` folder), then click **Save**.
9. Wait 1–2 minutes and refresh the page. GitHub will display your live site URL:
   `https://<your-github-username>.github.io/campus-bondhon/`
10. **Important Firebase Step:** Copy your `https://<your-github-username>.github.io` domain and add it to **Firebase Console → Authentication → Settings → Authorized domains** so landlord login works on the live domain.

---

## 🎨 4. Simple Guide on What to Edit (Text, Colors, Logo & Contact Info)

- **Change Colors, Fonts & Rounded Corners:**
  - Open `css/style.css` and edit the `:root` variables at the very top (lines 11–50). For example, change `--primary-color: #0f766e;` to your university's official color!
- **Change University Departments:**
  - Open `study.html` and look for the `<!-- EDIT HERE: Add or modify university departments -->` comment to add your university's exact faculties/departments.
- **Change Logo & Hero Banner:**
  - Replace `assets/hero-campus.jpg`, `assets/study-default.jpg`, `assets/clothing-default.jpg`, or `assets/housing-default.jpg` with your own campus photos using the same filenames.
- **Change Team Contact Details & Footer:**
  - At the bottom of `index.html`, `study.html`, `clothing.html`, and `landlords.html`, look for `<!-- EDIT HERE: Replace with your team's real email, phone, and university name -->` and update the email, WhatsApp support number, and campus location.
