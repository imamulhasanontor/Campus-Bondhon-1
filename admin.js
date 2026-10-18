/**
 * ============================================================================
 * CAMPUS BONDHON - ADMIN LIVE DASHBOARD (js/admin.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Real-time view (Firestore onSnapshot) of:
 * - All registered users (name, email, phone, last login, login count, online)
 * - Live signup / login / logout activity feed
 * Only the UID written inside firestore.rules (isAdmin) can read this data.
 */

import {
  IS_FIREBASE_CONFIGURED,
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from "./firebase-config.js";
import { showToast, escapeHtml } from "./main.js";

const ONLINE_WINDOW_MS = 150000; // user is "online" if seen in the last 2.5 minutes

let users = [];
let logs = [];
let unsubUsers = null;
let unsubLogs = null;
let refreshTimer = null;
let dashboardShown = false;

const $ = (id) => document.getElementById(id);

function show(id, visible) {
  const el = $(id);
  if (el) el.style.display = visible ? "block" : "none";
}

function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return Number(ts) || 0;
}

function fmtDate(ts) {
  const ms = toMs(ts);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(ts) {
  const ms = toMs(ts);
  if (!ms) return "just now";
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return Math.floor(sec / 60) + " min ago";
  if (sec < 86400) return Math.floor(sec / 3600) + " hr ago";
  return Math.floor(sec / 86400) + " day(s) ago";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isOnline(u) {
  return u.isOnline === true && Date.now() - toMs(u.lastSeen) < ONLINE_WINDOW_MS;
}

function deviceLabel(ua) {
  ua = ua || "";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "Mac"
    : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Firefox/i.test(ua) ? "Firefox"
    : /Chrome/i.test(ua) ? "Chrome"
    : /Safari/i.test(ua) ? "Safari" : "Browser";
  return `${os} • ${br}`;
}

function friendlyAuthError(err) {
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/invalid-email": "That email address doesn't look valid.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network problem. Check your internet connection."
  };
  return map[err && err.code] || (err && err.message) || "Login failed.";
}

function renderStats() {
  const today = startOfToday();
  $("stat-total").textContent = users.length;
  $("stat-online").textContent = users.filter(isOnline).length;
  $("stat-active-today").textContent = users.filter((u) => toMs(u.lastLoginAt) >= today).length;
  $("stat-new-today").textContent = users.filter((u) => toMs(u.createdAt) >= today).length;
}

function renderUsers() {
  const body = $("admin-users-body");
  if (!body) return;
  const term = ($("admin-user-search").value || "").toLowerCase().trim();

  const rows = users
    .filter((u) => {
      if (!term) return true;
      return [u.name, u.email, u.phone].some((v) => String(v || "").toLowerCase().includes(term));
    })
    .sort((a, b) => {
      const onlineDiff = Number(isOnline(b)) - Number(isOnline(a));
      if (onlineDiff) return onlineDiff;
      return toMs(b.lastLoginAt || b.createdAt) - toMs(a.lastLoginAt || a.createdAt);
    });

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color: var(--text-secondary);">No users found yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((u) => {
      const on = isOnline(u);
      return `
        <tr>
          <td><span class="dot ${on ? "on" : ""}"></span>${on ? "Online" : "Offline"}</td>
          <td><strong>${escapeHtml(u.name || "—")}</strong><div class="feed-time">${escapeHtml(u.role || "")}</div></td>
          <td>${escapeHtml(u.email || "—")}</td>
          <td>${u.phone ? "+" + escapeHtml(u.phone) : "—"}</td>
          <td>${escapeHtml(fmtDate(u.createdAt))}</td>
          <td>${escapeHtml(fmtDate(u.lastLoginAt))}<div class="feed-time">${u.lastLoginAt ? escapeHtml(timeAgo(u.lastLoginAt)) : ""}</div></td>
          <td>${escapeHtml(u.loginCount || 0)}</td>
          <td>
            <span style="color: var(--text-secondary);">••••••••</span><br />
            <button type="button" class="btn btn-outline btn-sm" data-reset-email="${escapeHtml(u.email || "")}" style="margin-top:0.25rem;">Send reset link</button>
          </td>
        </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-reset-email]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.resetEmail;
      if (!email) return;
      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset link sent to " + email);
      } catch (err) {
        showToast(friendlyAuthError(err), "error");
      }
    });
  });
}

function renderFeed() {
  const feed = $("admin-activity-feed");
  if (!feed) return;
  if (logs.length === 0) {
    feed.innerHTML = `<p style="color: var(--text-secondary); font-size: var(--font-size-sm);">No activity yet. Sign up or log in on the Landlords page and it will appear here instantly.</p>`;
    return;
  }
  const icons = { signup: "🆕", login: "🔓", logout: "🚪" };
  const verbs = { signup: "created an account", login: "logged in", logout: "logged out" };
  feed.innerHTML = logs
    .map(
      (l) => `
      <div class="feed-item">
        <div>${icons[l.type] || "•"}</div>
        <div>
          <strong>${escapeHtml(l.name || l.email || "Unknown")}</strong> ${escapeHtml(verbs[l.type] || l.type)}
          <div class="feed-time">${escapeHtml(l.email || "")} • ${escapeHtml(deviceLabel(l.userAgent))} • ${escapeHtml(timeAgo(l.at))} (${escapeHtml(fmtDate(l.at))})</div>
        </div>
      </div>`
    )
    .join("");
}

function renderAll() {
  renderStats();
  renderUsers();
  renderFeed();
}

function stopListening() {
  if (unsubUsers) unsubUsers();
  if (unsubLogs) unsubLogs();
  unsubUsers = null;
  unsubLogs = null;
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  dashboardShown = false;
}

function handleListenError(err, user) {
  if (err && err.code === "permission-denied") {
    stopListening();
    show("admin-dashboard", false);
    $("denied-email").textContent = user.email || "";
    $("denied-uid").textContent = user.uid;
    show("admin-denied-box", true);
  } else {
    console.error(err);
    showToast("Live data error: " + (err.message || err), "error");
  }
}

function showDashboardOnce(user) {
  if (dashboardShown) return;
  dashboardShown = true;
  show("admin-denied-box", false);
  show("admin-login-box", false);
  show("admin-dashboard", true);
  $("admin-logged-email").textContent = user.email || "";
}

function startListening(user) {
  stopListening();

  unsubUsers = onSnapshot(
    collection(db, "users"),
    (snap) => {
      users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      showDashboardOnce(user);
      renderStats();
      renderUsers();
    },
    (err) => handleListenError(err, user)
  );

  unsubLogs = onSnapshot(
    query(collection(db, "login_logs"), orderBy("at", "desc"), limit(50)),
    (snap) => {
      logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      showDashboardOnce(user);
      renderFeed();
    },
    (err) => handleListenError(err, user)
  );

  // Keep "online" badges and "x min ago" text fresh without new data
  refreshTimer = setInterval(renderAll, 20000);
}

async function doLogout() {
  stopListening();
  await signOut(auth);
}

function init() {
  if (!(IS_FIREBASE_CONFIGURED && auth && db)) {
    show("admin-noconfig", true);
    return;
  }

  $("admin-user-search").addEventListener("input", renderUsers);
  $("admin-logout-btn").addEventListener("click", doLogout);
  $("denied-logout-btn").addEventListener("click", doLogout);

  $("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("admin-email").value.trim();
    const password = $("admin-password").value;
    if (!email || !password) {
      showToast("Enter admin email and password.", "error");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      $("admin-login-form").reset();
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      show("admin-login-box", false);
      startListening(user);
    } else {
      stopListening();
      users = [];
      logs = [];
      show("admin-dashboard", false);
      show("admin-denied-box", false);
      show("admin-login-box", true);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
