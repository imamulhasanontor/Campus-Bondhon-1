/**
 * ============================================================================
 * CAMPUS BONDHON - CLOTHING RESOURCES LOGIC (js/clothing.js)
 * Team Name: Bondhon | Project: Campus Bondhon
 * ============================================================================
 * Features:
 * - Donate clean used or surplus clothes (100% Free & Dignified)
 * - Privacy-first: Donors can post as "Anonymous" ("Bondhon Donor") or use a
 *   community alias. Real names & personal details are NEVER shown publicly.
 * - Filter by Clothing Type and Size
 * - Receivers coordinate pickup discreetly via WhatsApp link
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

const STORAGE_KEY = "bondhon_clothing_resources_v1";

const INITIAL_CLOTHING_ITEMS = [
  {
    id: "cloth-1",
    title: "2 Warm Winter Hoodies (Navy & Olive)",
    type: "Winter Wear / Hoodie",
    size: "L",
    condition: "Very Good",
    description: "Freshly washed, warm fleece hoodies. Ideal for winter morning classes on campus. Pickup at Student TSC gate or hall gate.",
    donorAlias: "Bondhon Donor",
    anonymous: true,
    whatsapp: "8801711223344",
    images: ["assets/clothing-default.jpg"],
    status: "Available",
    createdAt: Date.now() - 86400000
  },
  {
    id: "cloth-2",
    title: "Formal Presentation Shirt & Black Trousers",
    type: "Formal / Presentation Wear",
    size: "M",
    condition: "Like New",
    description: "Worn only twice for thesis defense. Great for any student preparing for viva, presentation, or internship interviews.",
    donorAlias: "Bondhon Senior Batch",
    anonymous: true,
    whatsapp: "8801811223355",
    images: ["assets/clothing-default.jpg"],
    status: "Available",
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: "cloth-3",
    title: "Cotton Salwar Kameez Set (2 Pieces, Unstitched/Lightly Used)",
    type: "Traditional / Everyday",
    size: "M",
    condition: "Like New",
    description: "Clean, breathable cotton wear suitable for regular university classes. Discreet drop-off via female hall reception available.",
    donorAlias: "Bondhon Donor",
    anonymous: true,
    whatsapp: "8801911223366",
    images: ["assets/clothing-default.jpg"],
    status: "Available",
    createdAt: Date.now() - 3600000 * 4
  }
];

let clothingItems = [];

document.addEventListener("DOMContentLoaded", () => {
  initClothingPage();
});

async function initClothingPage() {
  const form = document.getElementById("clothing-post-form");
  const anonCheckbox = document.getElementById("clothing-anonymous");
  const aliasInput = document.getElementById("clothing-alias");
  const photoInput = document.getElementById("clothing-photos");
  const previewContainer = document.getElementById("clothing-photo-preview");

  if (anonCheckbox && aliasInput) {
    anonCheckbox.addEventListener("change", () => {
      if (anonCheckbox.checked) {
        aliasInput.value = "Bondhon Donor";
        aliasInput.disabled = true;
      } else {
        aliasInput.disabled = false;
        aliasInput.value = "";
        aliasInput.placeholder = "e.g., Campus Well-Wisher (No real name required)";
      }
    });
  }

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

  ["clothing-search", "filter-clothing-type", "filter-clothing-size"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", renderClothingGrid);
      el.addEventListener("change", renderClothingGrid);
    }
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleClothingSubmit(form);
    });
  }

  await loadClothingItems();
}

async function loadClothingItems() {
  if (IS_FIREBASE_CONFIGURED && db) {
    try {
      const q = query(collection(db, "clothing_resources"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      clothingItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      clothingItems = getLocalData(STORAGE_KEY, INITIAL_CLOTHING_ITEMS);
    }
  } else {
    clothingItems = getLocalData(STORAGE_KEY, INITIAL_CLOTHING_ITEMS);
  }
  renderClothingGrid();
}

async function handleClothingSubmit(form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const title = document.getElementById("clothing-title").value.trim();
  const type = document.getElementById("clothing-type").value;
  const size = document.getElementById("clothing-size").value;
  const condition = document.getElementById("clothing-condition").value;
  const description = document.getElementById("clothing-desc").value.trim();
  const whatsappRaw = document.getElementById("clothing-whatsapp").value.trim();
  const isAnon = document.getElementById("clothing-anonymous").checked;
  const rawAlias = document.getElementById("clothing-alias")?.value.trim() || "Bondhon Donor";
  const photoFiles = document.getElementById("clothing-photos").files;

  if (!title || !description) {
    showToast("Please provide an item title and short description.", "error");
    return;
  }

  const phoneCheck = validatePhone(whatsappRaw);
  if (!phoneCheck.valid) {
    showToast(phoneCheck.error, "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing Donation...";

    const images = await processImageFiles(photoFiles, "clothing", "assets/clothing-default.jpg");

    const newItem = {
      title,
      type,
      size,
      condition,
      description,
      donorAlias: isAnon ? "Bondhon Donor" : rawAlias || "Bondhon Donor",
      anonymous: isAnon,
      whatsapp: phoneCheck.cleaned,
      images,
      status: "Available",
      createdAt: Date.now()
    };

    if (IS_FIREBASE_CONFIGURED && db) {
      const docRef = await addDoc(collection(db, "clothing_resources"), {
        ...newItem,
        createdAtServer: serverTimestamp()
      });
      newItem.id = docRef.id;
    } else {
      newItem.id = "cloth-" + Date.now();
      clothingItems.unshift(newItem);
      setLocalData(STORAGE_KEY, clothingItems);
    }

    form.reset();
    const aliasInput = document.getElementById("clothing-alias");
    if (aliasInput) {
      aliasInput.value = "Bondhon Donor";
      aliasInput.disabled = true;
    }
    const previewContainer = document.getElementById("clothing-photo-preview");
    if (previewContainer) previewContainer.innerHTML = "";

    await loadClothingItems();
    showToast("Clothing donation listed! Identity remains protected.");
  } catch (err) {
    showToast(err.message || "Could not post clothing donation.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Donate Clothes Now";
  }
}

function renderClothingGrid() {
  const grid = document.getElementById("clothing-listings-grid");
  const countEl = document.getElementById("clothing-results-count");
  if (!grid) return;

  const searchVal = (document.getElementById("clothing-search")?.value || "").toLowerCase().trim();
  const typeFilter = document.getElementById("filter-clothing-type")?.value || "All";
  const sizeFilter = document.getElementById("filter-clothing-size")?.value || "All";

  const filtered = clothingItems.filter((item) => {
    const matchesSearch =
      !searchVal ||
      item.title.toLowerCase().includes(searchVal) ||
      item.description.toLowerCase().includes(searchVal);
    const matchesType = typeFilter === "All" || item.type === typeFilter;
    const matchesSize = sizeFilter === "All" || item.size === sizeFilter;
    return matchesSearch && matchesType && matchesSize;
  });

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${clothingItems.length} free clothing items`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <h3>No clothing donations match your filter</h3>
        <p style="color: var(--text-secondary); margin-top: 0.35rem;">Try selecting "All Sizes" or donate surplus clothes above.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const isClaimed = item.status === "Claimed";
      const imgUrl = item.images && item.images.length > 0 ? item.images[0] : "assets/clothing-default.jpg";
      const waMsg = `Assalamu Alaikum / Hello! I am reaching out via Campus Bondhon Clothing Resources regarding "${item.title}" (Size: ${item.size}). Could we arrange a discreet pickup? (No personal ID needed)`;
      const waLink = buildWhatsAppUrl(item.whatsapp, waMsg);

      return `
        <article class="card">
          <div class="card-img-wrapper">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="price-tag-overlay ${isClaimed ? "badge-sold" : "badge-free"}">
              ${isClaimed ? "CLAIMED" : "100% FREE"}
            </span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge badge-primary">${escapeHtml(item.type)}</span>
              <span class="badge badge-neutral">Size: ${escapeHtml(item.size)}</span>
              <span class="badge badge-neutral">${escapeHtml(item.condition)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <p class="card-text">${escapeHtml(item.description)}</p>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: 0.75rem;">
              🛡️ Shared by: <strong>${escapeHtml(item.donorAlias || "Bondhon Donor")}</strong> (Identity Protected)
            </p>
            <div class="card-footer">
              ${
                !isClaimed
                  ? `<a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm">
                       💬 Request Discreet Pickup
                     </a>`
                  : `<span class="badge badge-sold">Collected</span>`
              }
              <div style="display: flex; gap: 0.35rem;">
                <button type="button" class="btn btn-outline btn-sm" data-action="toggle-cloth" data-id="${escapeHtml(item.id)}">
                  ${isClaimed ? "Re-open" : "Mark Claimed"}
                </button>
                <button type="button" class="btn btn-danger btn-sm" data-action="delete-cloth" data-id="${escapeHtml(item.id)}">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-action='toggle-cloth']").forEach((btn) => {
    btn.addEventListener("click", () => toggleClothingStatus(btn.dataset.id));
  });
  grid.querySelectorAll("[data-action='delete-cloth']").forEach((btn) => {
    btn.addEventListener("click", () => deleteClothingItem(btn.dataset.id));
  });
}

async function toggleClothingStatus(id) {
  const target = clothingItems.find((i) => i.id === id);
  if (!target) return;
  const nextStatus = target.status === "Claimed" ? "Available" : "Claimed";

  if (IS_FIREBASE_CONFIGURED && db) {
    await updateDoc(doc(db, "clothing_resources", id), { status: nextStatus });
  } else {
    target.status = nextStatus;
    setLocalData(STORAGE_KEY, clothingItems);
  }
  await loadClothingItems();
  showToast(`Item marked as ${nextStatus}.`);
}

async function deleteClothingItem(id) {
  if (IS_FIREBASE_CONFIGURED && db) {
    await deleteDoc(doc(db, "clothing_resources", id));
  } else {
    clothingItems = clothingItems.filter((i) => i.id !== id);
    setLocalData(STORAGE_KEY, clothingItems);
  }
  await loadClothingItems();
  showToast("Clothing listing removed.");
}
