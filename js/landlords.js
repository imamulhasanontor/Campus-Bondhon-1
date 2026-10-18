/**
 * ============================================================================
 * CAMPUS BONDHON - LANDLORDS PROFILE & HOUSING LOGIC (js/landlords.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Features:
 * - Landlord Sign Up / Login / Logout / Forgot Password via Firebase Auth
 *   (every signup/login/logout is also written to Firestore: users + login_logs,
 *   so the admin can watch them live on admin.html)
 * - Owner-only Landlord Dashboard to create/update Building Profile:
 *   Name, Building Name, Address, Google Maps URL, Contact Numbers, Facilities,
 *   Rules & Regulations, and Building Photos.
 * - Manage Multiple Vacant Units inside the profile:
 *   Flat/Room No, Monthly Rent (BDT), Unit Type (Single Room / Shared / Flat),
 *   Gender Preference, Status (Available / Booked), and Notes.
 * - Public student view with Availability & Max Rent filters, Detailed Modal,
 *   Direct Call (tel:) and WhatsApp (wa.me) buttons.
 */

import {
  IS_FIREBASE_CONFIGURED,
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  collection,
  doc,
  setDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  increment
} from "./firebase-config.js";

import {
  showToast,
  validatePhone,
  buildWhatsAppUrl,
  processImageFiles,
  getLocalData,
  setLocalData,
  escapeHtml
} from "./main.js";

const STORAGE_KEY = "bondhon_landlords_v1";
const SESSION_KEY = "bondhon_demo_landlord_user";

const INITIAL_LANDLORDS = [
  {
    uid: "demo-landlord-1",
    email: "rahman.villa@example.com",
    landlordName: "Md. Habibur Rahman",
    buildingName: "Rahman Student Villa",
    address: "House 14, Road 3, Main Gate Academic Area (5 mins walk from campus)",
    mapLink: "https://maps.google.com/?q=Dhaka+University",
    phonePrimary: "8801715001122",
    phoneSecondary: "01819001122 (Caretaker)",
    facilities: ["High-Speed Wi-Fi", "24/7 CCTV & Guard", "Filtered Water", "Line Gas", "IPS / Generator Backup"],
    rules: "Main gate closes at 11:00 PM (late entry allowed with student ID). Quiet study hours after 10:00 PM. No smoking inside shared rooms.",
    images: ["assets/housing-default.jpg"],
    units: [
      {
        unitId: "u-101",
        roomNumber: "Room 3B (3rd Floor)",
        rent: 4500,
        type: "Single Room",
        gender: "Male",
        status: "Available",
        notes: "Attached balcony, south-facing sunny window, study table & chair included."
      },
      {
        unitId: "u-102",
        roomNumber: "Room 2A (2nd Floor)",
        rent: 2800,
        type: "Shared Seat",
        gender: "Male",
        status: "Available",
        notes: "2-seat spacious room, 1 seat vacant from next month."
      }
    ],
    updatedAt: Date.now() - 3600000 * 5
  },
  {
    uid: "demo-landlord-2",
    email: "greenview.lodge@example.com",
    landlordName: "Mrs. Farhana Yasmin",
    buildingName: "GreenView Female Student Residence",
    address: "Plot 22, Lake Road, West Campus Gate",
    mapLink: "https://maps.google.com/?q=Dhaka",
    phonePrimary: "8801912334455",
    phoneSecondary: "01712334455 (Female Warden)",
    facilities: ["High-Speed Wi-Fi", "24/7 Female Security", "Lift / Elevator", "Filtered Water", "Optional Meal System"],
    rules: "Strictly for university female students (valid ID card copy required). Visitors allowed in ground floor lounge until 8:00 PM.",
    images: ["assets/housing-default.jpg"],
    units: [
      {
        unitId: "u-201",
        roomNumber: "Flat 4C - Seat 1",
        rent: 3500,
        type: "Shared Seat",
        gender: "Female",
        status: "Available",
        notes: "Attached washroom, fridge and microwave shared on floor."
      },
      {
        unitId: "u-202",
        roomNumber: "Flat 5A (Full 2-Bed Student Flat)",
        rent: 11500,
        type: "Full Flat",
        gender: "Female",
        status: "Booked",
        notes: "Suitable for 3-4 friends sharing together."
      }
    ],
    updatedAt: Date.now() - 3600000 * 18
  }
];

let landlordsList = [];
let currentUser = null;
let editingUnits = [];

document.addEventListener("DOMContentLoaded", () => {
  initLandlordsPage();
});

async function initLandlordsPage() {
  await loadLandlords();
  setupAuthListeners();
  setupDashboardListeners();
  setupFilterListeners();
}

async function loadLandlords() {
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const snap = await getDocs(collection(db, "landlords"));
      landlordsList = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch (err) {
      landlordsList = getLocalData(STORAGE_KEY, INITIAL_LANDLORDS);
    }
  } else {
    landlordsList = getLocalData(STORAGE_KEY, INITIAL_LANDLORDS);
  }
  renderLandlordsGrid();
}

// ---------------------------------------------------------------------------
// LIVE USER TRACKING HELPERS (Firestore: users + login_logs)
// ---------------------------------------------------------------------------
let heartbeatTimer = null;
let formAuthInProgress = false;

function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "This email is already registered. Switch to 'Login' instead.",
    "auth/invalid-email": "That email address doesn't look valid.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/invalid-credential": "Wrong email or password. Please try again.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Wrong email or password. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Network problem. Check your internet connection.",
    "auth/operation-not-allowed": "Email/Password login is not enabled in Firebase Console yet.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains)."
  };
  return map[err && err.code] || (err && err.message) || "Authentication failed.";
}

async function logActivity(type, user, name) {
  if (!(IS_FIREBASE_CONFIGURED && db) || !user) return;
  try {
    await addDoc(collection(db, "login_logs"), {
      uid: user.uid,
      email: user.email || "",
      name: name || user.displayName || "",
      type, // "signup" | "login" | "logout"
      userAgent: (navigator.userAgent || "").slice(0, 160),
      at: serverTimestamp()
    });
  } catch (err) {
    console.warn("Could not write login log:", err);
  }
}

async function touchPresence(uid, online) {
  if (!(IS_FIREBASE_CONFIGURED && db) || !uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      { isOnline: online, lastSeen: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("Presence update failed:", err);
  }
}

function startHeartbeat(uid) {
  stopHeartbeat();
  // While the page is open, refresh "lastSeen" every 60 seconds so the admin
  // dashboard can tell who is really online right now.
  heartbeatTimer = setInterval(() => touchPresence(uid, true), 60000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function setupAuthListeners() {
  const loginForm = document.getElementById("landlord-auth-form");
  const demoLoginBtn = document.getElementById("demo-landlord-login-btn");
  const logoutBtn = document.getElementById("landlord-logout-btn");
  const modeSelect = document.getElementById("auth-mode-select");
  const forgotBtn = document.getElementById("forgot-password-btn");
  const submitBtn = document.getElementById("auth-submit-btn");
  const liveMode = IS_FIREBASE_CONFIGURED && auth && db;

  // The fake demo login only makes sense without a real Firebase connection
  if (liveMode && demoLoginBtn) demoLoginBtn.style.display = "none";

  // Show Name + Phone fields only in Sign Up mode
  const syncModeFields = () => {
    const isSignup = modeSelect && modeSelect.value === "signup";
    document.querySelectorAll(".signup-only").forEach((el) => {
      el.style.display = isSignup ? "" : "none";
    });
    if (forgotBtn) forgotBtn.style.display = isSignup ? "none" : "";
    if (submitBtn) submitBtn.textContent = isSignup ? "Create Account" : "Access Landlord Dashboard";
  };
  if (modeSelect) {
    modeSelect.addEventListener("change", syncModeFields);
    syncModeFields();
  }

  if (liveMode) {
    onAuthStateChanged(auth, (user) => {
      currentUser = user ? { uid: user.uid, email: user.email, name: user.displayName || "" } : null;
      if (user) {
        // Page reload with an existing session: just refresh presence.
        // (Explicit login/signup is recorded by the form handler below.)
        if (!formAuthInProgress) touchPresence(user.uid, true);
        startHeartbeat(user.uid);
      } else {
        stopHeartbeat();
      }
      updateDashboardVisibility();
    });
  } else {
    currentUser = getLocalData(SESSION_KEY, null);
    updateDashboardVisibility();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value;
      const mode = modeSelect ? modeSelect.value : "login"; // "login" or "signup"

      if (!email || password.length < 6) {
        showToast("Please enter a valid email and a password of at least 6 characters.", "error");
        return;
      }

      if (!liveMode) {
        // Local Demo Mode Login/Signup
        let existing = landlordsList.find((l) => l.email.toLowerCase() === email.toLowerCase());
        const uid = existing ? existing.uid : "landlord-" + Date.now();
        currentUser = { uid, email };
        setLocalData(SESSION_KEY, currentUser);
        updateDashboardVisibility();
        showToast(`Signed in as ${email} (Demo Mode).`);
        return;
      }

      // ---- Live Firebase mode ----
      let name = "";
      let phone = "";
      if (mode === "signup") {
        name = document.getElementById("auth-name").value.trim();
        const phoneCheck = validatePhone(document.getElementById("auth-phone").value);
        if (name.length < 2) {
          showToast("Please enter your full name.", "error");
          return;
        }
        if (!phoneCheck.valid) {
          showToast(phoneCheck.error, "error");
          return;
        }
        phone = phoneCheck.cleaned;
      }

      if (submitBtn) submitBtn.disabled = true;
      formAuthInProgress = true;
      try {
        if (mode === "signup") {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name });
          await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            email,
            name,
            phone,
            role: "landlord",
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            isOnline: true,
            loginCount: 1
          });
          await logActivity("signup", cred.user, name);

          currentUser = { uid: cred.user.uid, email, name };
          const nameInput = document.getElementById("ll-name");
          const phoneInput = document.getElementById("ll-phone1");
          if (nameInput && !nameInput.value) nameInput.value = name;
          if (phoneInput && !phoneInput.value) phoneInput.value = phone;
          showToast("Account created! Fill out your building profile below.");
        } else {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          const profileUpdate = {
            uid: cred.user.uid,
            email: cred.user.email,
            lastLoginAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            isOnline: true,
            loginCount: increment(1)
          };
          if (cred.user.displayName) profileUpdate.name = cred.user.displayName;
          await setDoc(doc(db, "users", cred.user.uid), profileUpdate, { merge: true });
          await logActivity("login", cred.user, cred.user.displayName);
          showToast("Logged in to Landlord Dashboard.");
        }
        loginForm.reset();
        syncModeFields();
      } catch (err) {
        showToast(friendlyAuthError(err), "error");
      } finally {
        formAuthInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
      const email = document.getElementById("auth-email").value.trim();
      if (!email) {
        showToast("Type your email in the Email box first, then click 'Forgot password?'.", "error");
        return;
      }
      if (!liveMode) {
        showToast("Password reset needs live Firebase connection.", "error");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset link sent! Check your inbox (and spam folder).");
      } catch (err) {
        showToast(friendlyAuthError(err), "error");
      }
    });
  }

  if (demoLoginBtn) {
    demoLoginBtn.addEventListener("click", () => {
      currentUser = { uid: "demo-landlord-1", email: "rahman.villa@example.com" };
      setLocalData(SESSION_KEY, currentUser);
      updateDashboardVisibility();
      showToast("Logged into sample Landlord account (Md. Habibur Rahman)!");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (liveMode) {
        const user = auth.currentUser;
        if (user) {
          // Must be written BEFORE signOut, while we're still authenticated
          await logActivity("logout", user, user.displayName);
          await touchPresence(user.uid, false);
        }
        stopHeartbeat();
        await signOut(auth);
      }
      currentUser = null;
      setLocalData(SESSION_KEY, null);
      updateDashboardVisibility();
      showToast("Logged out of Landlord Dashboard.");
    });
  }
}

function updateDashboardVisibility() {
  const authBox = document.getElementById("landlord-auth-box");
  const dashBox = document.getElementById("landlord-dashboard-box");
  const userEmailBadge = document.getElementById("landlord-logged-email");

  if (!authBox || !dashBox) return;

  if (currentUser) {
    authBox.style.display = "none";
    dashBox.style.display = "block";
    if (userEmailBadge) userEmailBadge.textContent = currentUser.email;
    populateDashboardForm();
  } else {
    authBox.style.display = "block";
    dashBox.style.display = "none";
  }
  renderLandlordsGrid();
}

function populateDashboardForm() {
  if (!currentUser) return;
  const profile = landlordsList.find((l) => l.uid === currentUser.uid);

  document.getElementById("ll-name").value = profile?.landlordName || currentUser.name || "";
  document.getElementById("ll-building").value = profile?.buildingName || "";
  document.getElementById("ll-address").value = profile?.address || "";
  document.getElementById("ll-map").value = profile?.mapLink || "";
  document.getElementById("ll-phone1").value = profile?.phonePrimary || "";
  document.getElementById("ll-phone2").value = profile?.phoneSecondary || "";
  document.getElementById("ll-rules").value = profile?.rules || "";

  const savedFacilities = profile?.facilities || [];
  document.querySelectorAll("input[name='ll-facility']").forEach((cb) => {
    cb.checked = savedFacilities.includes(cb.value);
  });

  editingUnits = profile?.units ? JSON.parse(JSON.stringify(profile.units)) : [];
  renderEditingUnitsList();
}

function setupDashboardListeners() {
  const addUnitBtn = document.getElementById("add-unit-btn");
  const profileForm = document.getElementById("landlord-profile-form");

  if (addUnitBtn) {
    addUnitBtn.addEventListener("click", () => {
      const roomNumber = document.getElementById("unit-room").value.trim();
      const rent = Number(document.getElementById("unit-rent").value || 0);
      const type = document.getElementById("unit-type").value;
      const gender = document.getElementById("unit-gender").value;
      const status = document.getElementById("unit-status").value;
      const notes = document.getElementById("unit-notes").value.trim();

      if (!roomNumber || rent <= 0) {
        showToast("Please enter a valid Flat/Room number and monthly rent amount.", "error");
        return;
      }

      editingUnits.push({
        unitId: "u-" + Date.now(),
        roomNumber,
        rent,
        type,
        gender,
        status,
        notes
      });

      document.getElementById("unit-room").value = "";
      document.getElementById("unit-rent").value = "";
      document.getElementById("unit-notes").value = "";
      renderEditingUnitsList();
      showToast("Unit added to your list! Click 'Save Complete Profile' below to publish.");
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveLandlordProfile();
    });
  }
}

function renderEditingUnitsList() {
  const container = document.getElementById("dashboard-units-list");
  if (!container) return;

  if (editingUnits.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: var(--font-size-sm);">No rooms/units added yet. Use the mini-form above to add a room or flat.</p>`;
    return;
  }

  container.innerHTML = editingUnits
    .map(
      (u, idx) => `
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.7rem; background: var(--bg-muted); border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 0.5rem;">
        <div>
          <strong>${escapeHtml(u.roomNumber)}</strong> — ৳${escapeHtml(u.rent)}/mo
          <span class="badge badge-primary">${escapeHtml(u.type)}</span>
          <span class="badge badge-neutral">${escapeHtml(u.gender)}</span>
          <span class="badge ${u.status === "Available" ? "badge-available" : "badge-booked"}">${escapeHtml(u.status)}</span>
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary);">${escapeHtml(u.notes)}</div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-outline btn-sm" data-unit-toggle="${idx}">
            Mark ${u.status === "Available" ? "Booked" : "Available"}
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-unit-remove="${idx}">
            Remove
          </button>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll("[data-unit-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.unitToggle);
      editingUnits[i].status = editingUnits[i].status === "Available" ? "Booked" : "Available";
      renderEditingUnitsList();
    });
  });

  container.querySelectorAll("[data-unit-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.unitRemove);
      editingUnits.splice(i, 1);
      renderEditingUnitsList();
    });
  });
}

async function saveLandlordProfile() {
  if (!currentUser) return;
  const landlordName = document.getElementById("ll-name").value.trim();
  const buildingName = document.getElementById("ll-building").value.trim();
  const address = document.getElementById("ll-address").value.trim();
  const mapLink = document.getElementById("ll-map").value.trim();
  const phonePrimaryRaw = document.getElementById("ll-phone1").value.trim();
  const phoneSecondary = document.getElementById("ll-phone2").value.trim();
  const rules = document.getElementById("ll-rules").value.trim();
  const photoFiles = document.getElementById("ll-photos").files;

  if (!landlordName || !buildingName || !address) {
    showToast("Please fill in your Name, Building Name, and Address.", "error");
    return;
  }

  const phoneCheck = validatePhone(phonePrimaryRaw);
  if (!phoneCheck.valid) {
    showToast(phoneCheck.error, "error");
    return;
  }

  const facilities = Array.from(document.querySelectorAll("input[name='ll-facility']:checked")).map((cb) => cb.value);
  const existingProfile = landlordsList.find((l) => l.uid === currentUser.uid);
  const defaultImg = existingProfile?.images?.[0] || "assets/housing-default.jpg";

  let images;
  try {
    images = await processImageFiles(photoFiles, "landlords", defaultImg);
  } catch (err) {
    if (err && typeof err.code === "string" && err.code.startsWith("storage/")) {
      // Firebase Storage isn't ready (not enabled / rules / billing) - don't block the profile
      console.warn("Photo upload failed:", err);
      showToast("Photo upload failed (Firebase Storage not ready). Saving profile with the default photo.", "error");
      images = existingProfile?.images || [defaultImg];
    } else {
      showToast(err.message || "Could not process the selected photos.", "error");
      return;
    }
  }

  const profileData = {
    uid: currentUser.uid,
    email: currentUser.email,
    landlordName,
    buildingName,
    address,
    mapLink,
    phonePrimary: phoneCheck.cleaned,
    phoneSecondary,
    facilities,
    rules,
    images,
    units: editingUnits,
    updatedAt: Date.now()
  };

  try {
    if (IS_FIREBASE_CONFIGURED && db) {
      await setDoc(doc(db, "landlords", currentUser.uid), profileData);
    } else {
      const idx = landlordsList.findIndex((l) => l.uid === currentUser.uid);
      if (idx >= 0) {
        landlordsList[idx] = profileData;
      } else {
        landlordsList.unshift(profileData);
      }
      setLocalData(STORAGE_KEY, landlordsList);
    }
  } catch (err) {
    console.error("Saving landlord profile failed:", err);
    showToast("Could not save profile: " + (err.message || "unknown error"), "error");
    return;
  }

  await loadLandlords();
  showToast("Landlord profile and units saved and published!");
}

function setupFilterListeners() {
  ["landlord-search", "filter-ll-availability", "filter-ll-rent", "filter-ll-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", renderLandlordsGrid);
      el.addEventListener("change", renderLandlordsGrid);
    }
  });

  const closeModalBtn = document.getElementById("close-landlord-modal");
  const modalBackdrop = document.getElementById("landlord-detail-modal");
  if (closeModalBtn && modalBackdrop) {
    closeModalBtn.addEventListener("click", () => modalBackdrop.classList.remove("active"));
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove("active");
    });
  }
}

function renderLandlordsGrid() {
  const grid = document.getElementById("landlords-listings-grid");
  if (!grid) return;

  const searchVal = (document.getElementById("landlord-search")?.value || "").toLowerCase().trim();
  const availFilter = document.getElementById("filter-ll-availability")?.value || "All";
  const maxRent = Number(document.getElementById("filter-ll-rent")?.value || 0);
  const typeFilter = document.getElementById("filter-ll-type")?.value || "All";

  const filtered = landlordsList.filter((ll) => {
    const matchesSearch =
      !searchVal ||
      ll.buildingName.toLowerCase().includes(searchVal) ||
      ll.address.toLowerCase().includes(searchVal) ||
      ll.landlordName.toLowerCase().includes(searchVal);

    const units = ll.units || [];
    const hasAvail = units.some((u) => u.status === "Available");
    if (availFilter === "Available" && !hasAvail) return false;

    if (maxRent > 0) {
      const hasWithinRent = units.some((u) => Number(u.rent) <= maxRent);
      if (!hasWithinRent) return false;
    }

    if (typeFilter !== "All") {
      const hasType = units.some((u) => u.type === typeFilter);
      if (!hasType) return false;
    }

    return matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <h3>No landlord profiles match your filters</h3>
        <p style="color: var(--text-secondary);">Try increasing the maximum rent filter or viewing all listings.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((ll) => {
      const units = ll.units || [];
      const availCount = units.filter((u) => u.status === "Available").length;
      const rents = units.map((u) => Number(u.rent)).filter((r) => r > 0);
      const minRent = rents.length ? Math.min(...rents) : 0;
      const maxRentVal = rents.length ? Math.max(...rents) : 0;
      const rentRangeText = rents.length
        ? minRent === maxRentVal
          ? `৳${minRent}/mo`
          : `৳${minRent} - ৳${maxRentVal}/mo`
        : "Contact for rent";

      const imgUrl = ll.images && ll.images.length > 0 ? ll.images[0] : "assets/housing-default.jpg";
      const waMsg = `Assalamu Alaikum! I found "${ll.buildingName}" on Campus Bondhon and would like to inquire about vacant rooms for students.`;
      const waLink = buildWhatsAppUrl(ll.phonePrimary, waMsg);
      const isOwner = currentUser && currentUser.uid === ll.uid;

      return `
        <article class="card">
          <div class="card-img-wrapper">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(ll.buildingName)}" loading="lazy" />
            <span class="price-tag-overlay ${availCount > 0 ? "badge-available" : "badge-booked"}">
              ${availCount > 0 ? `${availCount} Unit(s) Available` : "Currently Full"}
            </span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge badge-primary">${escapeHtml(rentRangeText)}</span>
              ${isOwner ? `<span class="badge badge-paid">Your Profile</span>` : ""}
            </div>
            <h3 class="card-title">${escapeHtml(ll.buildingName)}</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: 0.5rem;">
              📍 ${escapeHtml(ll.address)}
            </p>
            <div class="card-meta">
              ${(ll.facilities || [])
                .slice(0, 4)
                .map((f) => `<span class="badge badge-neutral">${escapeHtml(f)}</span>`)
                .join("")}
            </div>
            <div style="margin: 0.5rem 0; font-size: var(--font-size-xs); color: var(--text-secondary);">
              <strong>Units (${units.length}):</strong>
              ${units
                .slice(0, 2)
                .map(
                  (u) =>
                    `<div>• ${escapeHtml(u.roomNumber)} (${escapeHtml(u.type)}, ৳${escapeHtml(u.rent)}) — <strong>${escapeHtml(u.status)}</strong></div>`
                )
                .join("")}
            </div>
            <div class="card-footer" style="margin-top: auto;">
              <button type="button" class="btn btn-outline btn-sm" data-view-ll="${escapeHtml(ll.uid)}">
                View Full Details
              </button>
              <div style="display: flex; gap: 0.35rem;">
                <a href="tel:+${escapeHtml(ll.phonePrimary)}" class="btn btn-primary btn-sm">📞 Call</a>
                <a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm">💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-view-ll]").forEach((btn) => {
    btn.addEventListener("click", () => openLandlordModal(btn.dataset.viewLl));
  });
}

function openLandlordModal(uid) {
  const ll = landlordsList.find((item) => item.uid === uid);
  const modal = document.getElementById("landlord-detail-modal");
  const content = document.getElementById("landlord-modal-body");
  if (!ll || !modal || !content) return;

  const waMsg = `Assalamu Alaikum! I saw "${ll.buildingName}" on Campus Bondhon and want to ask about student room availability.`;
  const waLink = buildWhatsAppUrl(ll.phonePrimary, waMsg);

  content.innerHTML = `
    <h2 style="margin-bottom: 0.25rem;">${escapeHtml(ll.buildingName)}</h2>
    <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: 0.75rem;">
      Managed by <strong>${escapeHtml(ll.landlordName)}</strong> • 📍 ${escapeHtml(ll.address)}
      ${
        ll.mapLink
          ? ` — <a href="${escapeHtml(ll.mapLink)}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>`
          : ""
      }
    </p>
    <div style="margin-bottom: 1rem;">
      <strong>Facilities:</strong>
      <div class="card-meta" style="margin-top: 0.35rem;">
        ${(ll.facilities || []).map((f) => `<span class="badge badge-primary">${escapeHtml(f)}</span>`).join("")}
      </div>
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>House Rules & Regulations:</strong>
      <p style="font-size: var(--font-size-sm); color: var(--text-secondary); background: var(--bg-muted); padding: 0.65rem; border-radius: var(--radius-sm); margin-top: 0.25rem;">
        ${escapeHtml(ll.rules || "Standard student accommodation rules apply.")}
      </p>
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Listed Rooms & Flats (${(ll.units || []).length}):</strong>
      <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
        ${(ll.units || [])
          .map(
            (u) => `
          <div style="padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong>${escapeHtml(u.roomNumber)}</strong> — <span style="color: var(--primary-color); font-weight: 700;">৳${escapeHtml(u.rent)}/month</span>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary);">
                Type: ${escapeHtml(u.type)} | Gender: ${escapeHtml(u.gender)} | ${escapeHtml(u.notes)}
              </div>
            </div>
            <span class="badge ${u.status === "Available" ? "badge-available" : "badge-booked"}">${escapeHtml(u.status)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
      <div style="font-size: var(--font-size-sm);">
        📞 Primary: <strong>+${escapeHtml(ll.phonePrimary)}</strong>
        ${ll.phoneSecondary ? `<br/>📞 Caretaker/Alt: <strong>${escapeHtml(ll.phoneSecondary)}</strong>` : ""}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <a href="tel:+${escapeHtml(ll.phonePrimary)}" class="btn btn-primary">📞 Call Landlord</a>
        <a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">💬 Chat on WhatsApp</a>
      </div>
    </div>
  `;

  modal.classList.add("active");
}
