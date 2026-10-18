/**
 * ============================================================================
 * CAMPUS BONDHON - STUDY RESOURCES LOGIC (js/study.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Features:
 * - Post study books, notes, past papers, or lab equipment (Free or minimum fee)
 * - Upload one or more photos (validated <= 2MB)
 * - Search by keyword and filter by Category, Department, and Price Type
 * - Contact poster directly on WhatsApp with pre-filled resource title
 * - Mark item as "Taken/Sold" or Delete item
 */

import {
  IS_FIREBASE_CONFIGURED,
  db,
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
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

const STORAGE_KEY = "bondhon_study_resources_v1";

// Starter sample posts so the page looks complete out of the box
const INITIAL_STUDY_ITEMS = [
  {
    id: "study-1",
    title: "Introduction to Algorithms (CLRS 3rd Edition) + Handwritten Notes",
    category: "Book",
    department: "CSE",
    condition: "Good",
    priceType: "Free",
    priceAmount: 0,
    description: "Complete textbook with highlighted exam topics and my CSE-203 handwritten complexity sheets. Free for junior batch students!",
    whatsapp: "8801711223344",
    images: ["assets/study-default.jpg"],
    status: "Available",
    isOwner: true,
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: "study-2",
    title: "Microelectronic Circuits (Sedra & Smith) + Solved Past Papers (2019-2025)",
    category: "Past Papers",
    department: "EEE",
    condition: "Like New",
    priceType: "Paid",
    priceAmount: 150,
    description: "Printed past 5 years mid & final exam solutions with circuit diagrams. Minimum printing cost only.",
    whatsapp: "8801811223355",
    images: ["assets/study-default.jpg"],
    status: "Available",
    isOwner: true,
    createdAt: Date.now() - 86400000
  },
  {
    id: "study-3",
    title: "Financial Accounting & Business Statistics Complete Lecture Pack",
    category: "Notes",
    department: "BBA",
    condition: "Like New",
    priceType: "Free",
    priceAmount: 0,
    description: "Spiral-bound lecture notes, formula cheat sheets, and practice sets for 2nd year BBA students.",
    whatsapp: "8801911223366",
    images: ["assets/study-default.jpg"],
    status: "Available",
    isOwner: false,
    createdAt: Date.now() - 3600000 * 6
  }
];

let studyItems = [];

document.addEventListener("DOMContentLoaded", () => {
  initStudyPage();
});

async function initStudyPage() {
  const form = document.getElementById("study-post-form");
  const priceTypeSelect = document.getElementById("study-price-type");
  const priceAmountGroup = document.getElementById("study-price-amount-group");
  const photoInput = document.getElementById("study-photos");
  const previewContainer = document.getElementById("study-photo-preview");

  // Toggle fee input field when user selects "Paid (Minimum Fee)"
  if (priceTypeSelect && priceAmountGroup) {
    priceTypeSelect.addEventListener("change", () => {
      priceAmountGroup.style.display = priceTypeSelect.value === "Paid" ? "flex" : "none";
    });
  }

  // Show live thumbnail previews when images are chosen
  if (photoInput && previewContainer) {
    photoInput.addEventListener("change", () => {
      previewContainer.innerHTML = "";
      Array.from(photoInput.files).slice(0, 4).forEach((file) => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        previewContainer.appendChild(img);
      });
    });
  }

  // Bind search and filter controls
  ["study-search", "filter-study-category", "filter-study-dept", "filter-study-price"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", renderStudyGrid);
      el.addEventListener("change", renderStudyGrid);
    }
  });

  // Handle new Study Resource submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleStudySubmit(form);
    });
  }

  await loadStudyItems();
}

async function loadStudyItems() {
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const q = query(collection(db, "study_resources"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      studyItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Error loading Firestore study resources:", err);
      studyItems = getLocalData(STORAGE_KEY, INITIAL_STUDY_ITEMS);
    }
  } else {
    studyItems = getLocalData(STORAGE_KEY, INITIAL_STUDY_ITEMS);
  }
  renderStudyGrid();
}

async function handleStudySubmit(form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const title = document.getElementById("study-title").value.trim();
  const category = document.getElementById("study-category").value;
  const department = document.getElementById("study-dept").value;
  const condition = document.getElementById("study-condition").value;
  const priceType = document.getElementById("study-price-type").value;
  const priceAmount = priceType === "Paid" ? Number(document.getElementById("study-price-amount").value || 0) : 0;
  const description = document.getElementById("study-desc").value.trim();
  const whatsappRaw = document.getElementById("study-whatsapp").value.trim();
  const photoFiles = document.getElementById("study-photos").files;

  if (!title || !description) {
    showToast("Please fill in the title and short description.", "error");
    return;
  }

  if (priceType === "Paid" && (isNaN(priceAmount) || priceAmount <= 0)) {
    showToast("Please enter a valid minimum fee amount.", "error");
    return;
  }

  const phoneCheck = validatePhone(whatsappRaw);
  if (!phoneCheck.valid) {
    showToast(phoneCheck.error, "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting Resource...";

    const images = await processImageFiles(photoFiles, "study", "assets/study-default.jpg");

    const newItem = {
      title,
      category,
      department,
      condition,
      priceType,
      priceAmount,
      description,
      whatsapp: phoneCheck.cleaned,
      images,
      status: "Available",
      isOwner: true,
      createdAt: Date.now()
    };

    if (IS_FIREBASE_CONFIGURED && db) {
      const docRef = await addDoc(collection(db, "study_resources"), {
        ...newItem,
        createdAtServer: serverTimestamp()
      });
      newItem.id = docRef.id;
    } else {
      newItem.id = "study-" + Date.now();
      studyItems.unshift(newItem);
      setLocalData(STORAGE_KEY, studyItems);
    }

    form.reset();
    const previewContainer = document.getElementById("study-photo-preview");
    if (previewContainer) previewContainer.innerHTML = "";
    const priceAmountGroup = document.getElementById("study-price-amount-group");
    if (priceAmountGroup) priceAmountGroup.style.display = "none";

    await loadStudyItems();
    showToast("Study resource posted successfully!");
  } catch (err) {
    showToast(err.message || "Could not post study resource.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Study Resource";
  }
}

function renderStudyGrid() {
  const grid = document.getElementById("study-listings-grid");
  const countEl = document.getElementById("study-results-count");
  if (!grid) return;

  const searchVal = (document.getElementById("study-search")?.value || "").toLowerCase().trim();
  const catFilter = document.getElementById("filter-study-category")?.value || "All";
  const deptFilter = document.getElementById("filter-study-dept")?.value || "All";
  const priceFilter = document.getElementById("filter-study-price")?.value || "All";

  const filtered = studyItems.filter((item) => {
    const matchesSearch =
      !searchVal ||
      item.title.toLowerCase().includes(searchVal) ||
      item.description.toLowerCase().includes(searchVal) ||
      item.department.toLowerCase().includes(searchVal);
    const matchesCat = catFilter === "All" || item.category === catFilter;
    const matchesDept = deptFilter === "All" || item.department === deptFilter;
    const matchesPrice = priceFilter === "All" || item.priceType === priceFilter;
    return matchesSearch && matchesCat && matchesDept && matchesPrice;
  });

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${studyItems.length} resources`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <h3>No matching study resources found</h3>
        <p style="color: var(--text-secondary); margin-top: 0.35rem;">Try clearing your search filters or share the first resource above!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const isTaken = item.status === "Taken/Sold";
      const priceLabel = item.priceType === "Free" ? "FREE" : `৳${escapeHtml(item.priceAmount)} Fee`;
      const priceBadgeClass = isTaken ? "badge-sold" : item.priceType === "Free" ? "badge-free" : "badge-paid";
      const imgUrl = item.images && item.images.length > 0 ? item.images[0] : "assets/study-default.jpg";
      const waMsg = `Assalamu Alaikum / Hi! I saw your "${item.title}" (${priceLabel}) on Campus Bondhon Study Resources. Is it still available?`;
      const waLink = buildWhatsAppUrl(item.whatsapp, waMsg);

      return `
        <article class="card">
          <div class="card-img-wrapper">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="price-tag-overlay ${priceBadgeClass}">
              ${isTaken ? "TAKEN / SOLD" : priceLabel}
            </span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge badge-primary">${escapeHtml(item.category)}</span>
              <span class="badge badge-neutral">${escapeHtml(item.department)} Dept</span>
              <span class="badge badge-neutral">Condition: ${escapeHtml(item.condition)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <p class="card-text">${escapeHtml(item.description)}</p>
            <div class="card-footer">
              ${
                !isTaken
                  ? `<a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm">
                       💬 Contact on WhatsApp
                     </a>`
                  : `<span class="badge badge-sold">Already Taken / Sold</span>`
              }
              <div style="display: flex; gap: 0.35rem;">
                <button type="button" class="btn btn-outline btn-sm" data-action="toggle-status" data-id="${escapeHtml(item.id)}">
                  ${isTaken ? "Mark Available" : "Mark Taken"}
                </button>
                <button type="button" class="btn btn-danger btn-sm" data-action="delete-study" data-id="${escapeHtml(item.id)}">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // Attach button listeners
  grid.querySelectorAll("[data-action='toggle-status']").forEach((btn) => {
    btn.addEventListener("click", () => toggleStudyStatus(btn.dataset.id));
  });
  grid.querySelectorAll("[data-action='delete-study']").forEach((btn) => {
    btn.addEventListener("click", () => deleteStudyItem(btn.dataset.id));
  });
}

async function toggleStudyStatus(id) {
  const target = studyItems.find((i) => i.id === id);
  if (!target) return;
  const nextStatus = target.status === "Taken/Sold" ? "Available" : "Taken/Sold";

  if (IS_FIREBASE_CONFIGURED && db) {
    await updateDoc(doc(db, "study_resources", id), { status: nextStatus });
  } else {
    target.status = nextStatus;
    setLocalData(STORAGE_KEY, studyItems);
  }
  await loadStudyItems();
  showToast(`Resource marked as ${nextStatus}.`);
}

async function deleteStudyItem(id) {
  if (IS_FIREBASE_CONFIGURED && db) {
    await deleteDoc(doc(db, "study_resources", id));
  } else {
    studyItems = studyItems.filter((i) => i.id !== id);
    setLocalData(STORAGE_KEY, studyItems);
  }
  await loadStudyItems();
  showToast("Study resource removed.");
}
