/**
 * ============================================================================
 * CAMPUS BONDHON - SHARED HELPERS & UI UTILITIES (js/main.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Contains:
 * - Mobile navbar menu toggle
 * - Input validation (phone numbers, required text, max 2MB image size)
 * - WhatsApp link builder (wa.me with pre-filled messages)
 * - Image upload & preview helper (Firebase Storage + Base64 fallback)
 * - Non-blocking Toast notification & Confirmation Modal helpers
 */

import { IS_FIREBASE_CONFIGURED, storage, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

// Initialize mobile navigation menu on page load
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const navLinks = document.getElementById("nav-links");

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }
});

/**
 * Show a temporary toast notification message in the bottom-right corner
 * @param {string} message - Notification text
 * @param {"success"|"error"} type - Visual style
 */
export function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3800);
}

/**
 * Validate a WhatsApp / mobile phone number (supports +8801..., 01..., or 10-15 digits)
 * @param {string} rawPhone
 * @returns {{valid: boolean, cleaned: string, error?: string}}
 */
export function validatePhone(rawPhone) {
  if (!rawPhone || !rawPhone.trim()) {
    return { valid: false, cleaned: "", error: "Please enter a valid WhatsApp/contact phone number." };
  }
  // Strip spaces, dashes, and parentheses
  const digitsOnly = rawPhone.replace(/[^0-9+]/g, "");
  const numeric = digitsOnly.replace(/\+/g, "");

  if (numeric.length < 10 || numeric.length > 15) {
    return {
      valid: false,
      cleaned: "",
      error: "Phone number must be between 10 and 15 digits (e.g., 01712345678 or +8801712345678)."
    };
  }

  // Format Bangladeshi 11-digit numbers (01XXXXXXXXX) to international 8801XXXXXXXXX for wa.me
  let waNumber = numeric;
  if (numeric.length === 11 && numeric.startsWith("01")) {
    waNumber = "88" + numeric;
  }
  return { valid: true, cleaned: waNumber };
}

/**
 * Build an official WhatsApp click-to-chat URL with pre-filled message
 * @param {string} phone - Phone number
 * @param {string} message - Pre-filled message text
 */
export function buildWhatsAppUrl(phone, message) {
  const check = validatePhone(phone);
  const targetPhone = check.valid ? check.cleaned : phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Validate and convert selected image files (Max 2MB per image, max 4 images)
 * Uploads to Firebase Storage when configured, or returns compressed Data URLs in Demo Mode.
 * @param {FileList} fileList
 * @param {string} folderName - Storage folder ('study', 'clothing', 'landlords')
 * @param {string} fallbackAsset - Fallback image path if user selects no image
 * @returns {Promise<string[]>} Array of image URLs
 */
export async function processImageFiles(fileList, folderName, fallbackAsset) {
  if (!fileList || fileList.length === 0) {
    return [fallbackAsset];
  }

  const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit per file
  const files = Array.from(fileList).slice(0, 4);

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`"${file.name}" is not a valid image file.`);
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`"${file.name}" exceeds the 2 MB image size limit.`);
    }
  }

  const urls = [];
  for (const file of files) {
    if (IS_FIREBASE_CONFIGURED && storage) {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      const storageRef = ref(storage, `${folderName}/${safeName}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      urls.push(downloadUrl);
    } else {
      const dataUrl = await readFileAsDataURL(file);
      urls.push(dataUrl);
    }
  }
  return urls;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Safe localStorage wrapper with in-memory fallback
 */
const memoryStore = {};
export function getLocalData(key, defaultData) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return JSON.parse(JSON.stringify(defaultData));
    }
    return JSON.parse(raw);
  } catch (e) {
    if (!memoryStore[key]) {
      memoryStore[key] = JSON.parse(JSON.stringify(defaultData));
    }
    return memoryStore[key];
  }
}

export function setLocalData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    memoryStore[key] = data;
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
