/* ==========================================================================
   DASHBOARD BASE CONTROLLER
   Description: Core logic for Sidebar, Themes, Tabs, Search, and Global Utilities.
   Author: PropertyPlus Dev Team
   ========================================================================== */

// Prevent BFCache showing dashboard after logout (extra safety)
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});

const ppAppBody = document.querySelector(".pp-app");
const ppUserId = ppAppBody ? ppAppBody.getAttribute("data-user-id") : "";

// --- Indian Price Formatting (Semester-3 Level) ---
function formatIndianPrice(num) {
  if (!num) return "0";
  let x = num.toString();
  let lastThree = x.substring(x.length - 3);
  let otherNumbers = x.substring(0, x.length - 3);
  if (otherNumbers != "") lastThree = "," + lastThree;
  let res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return res;
}

// 1) Mobile Sidebar Toggle
function toggleMobileSidebar() {
  const sidebar = document.getElementById("mainSidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (!sidebar || !overlay) return;

  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

// 2) Tab Switching
function openTab(tabId, clickedEl) {
  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach((t) => (t.style.display = "none"));

  const target = document.getElementById(tabId);
  if (target) target.style.display = "block";

  const links = document.querySelectorAll(".menu-link");
  links.forEach((a) => a.classList.remove("active"));

  if (clickedEl && clickedEl.classList) {
    clickedEl.classList.add("active");
  } else if (tabId.startsWith('tab-budget') || tabId.startsWith('tab-emi') || tabId.startsWith('tab-area') || tabId.startsWith('tab-loan') || tabId.startsWith('tab-tools')) {
    // If opening a specific tool, keep the main Tools link active
    const toolsLink = Array.from(document.querySelectorAll('.menu-link')).find(el => el.textContent.includes('Tools & Calculator'));
    if (toolsLink) toolsLink.classList.add('active');
  }

  // --- AUTO-CLOSE MODAL ON TAB CHANGE ---
  const modalEl = document.getElementById("ppPropertyModal");
  if (modalEl) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  }

  // Toggle "Add Property" button visibility
  const addPropBtn = document.getElementById("headerAddPropertyBtn");
  if (addPropBtn) {
    if (tabId === "tab-home") {
      addPropBtn.style.display = "inline-flex";
    } else {
      addPropBtn.style.display = "none";
    }
  }

  const overlay = document.querySelector(".sidebar-overlay");
  const sidebar = document.getElementById("mainSidebar");
  if (overlay && overlay.classList.contains("active")) {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  }


  // Refresh pagination when switching tabs (keeps counts accurate).
  ppRefreshAllPaginations();

  // --- MARK AS READ IF REQUESTS TAB OPENED ---
  if (tabId === "tab-requests") {
    clearNotificationBadge();
    markNotificationsAsRead();
  }
}

// 2A) Responsive Pagination (Buyer + Seller dashboards)
//     - Desktop: 12 cards/page
//     - Mobile:  6 cards/page
//     Notes:
//     - No backend changes required; cards are shown/hidden client-side.
//     - Works for any .pp-results container that contains .pp-property-card elements.

const ppPaginationState = new Map(); // Map<Element, { page:number, perPage:number }>

function ppGetCardsPerPage() {
  // Treat <= 767px as small devices.
  return window.matchMedia('(max-width: 767px)').matches ? 6 : 12;
}

function ppGetCards(container) {
  return Array.from(container.querySelectorAll('.pp-property-card'));
}

function ppEnsurePaginationUI(container) {
  // Create (or reuse) a pagination control bar right after the container.
  let ui = container.nextElementSibling;
  if (!ui || !ui.classList || !ui.classList.contains('pp-pagination')) {
    ui = document.createElement('div');
    ui.className = 'pp-pagination';
    ui.setAttribute('data-pp-pagination', '');
    container.insertAdjacentElement('afterend', ui);
  }
  return ui;
}

function ppSetPage(container, nextPage) {
  const state = ppPaginationState.get(container);
  if (!state) return;
  state.page = nextPage;
  ppRenderPagination(container);
}

function ppRenderPagination(container) {
  const cards = ppGetCards(container);
  const state = ppPaginationState.get(container);
  if (!state) return;

  const perPage = state.perPage;
  const total = cards.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, state.page), totalPages);
  state.page = page;

  // Show/Hide cards
  const start = (page - 1) * perPage;
  const end = start + perPage;
  cards.forEach((card, idx) => {
    card.style.display = (idx >= start && idx < end) ? '' : 'none';
  });

  // Empty state should remain visible when there are no cards
  const emptyState = container.querySelector('.pp-empty-state');
  if (emptyState) {
    emptyState.style.display = total === 0 ? '' : '';
  }

  // Build pagination UI
  const ui = ppEnsurePaginationUI(container);
  if (totalPages <= 1) {
    ui.style.display = 'none';
    ui.innerHTML = '';
    return;
  }
  ui.style.display = 'flex';

  const mkBtn = (label, disabled, onClick, extraClass = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pp-page-btn ${extraClass}`.trim();
    b.textContent = label;
    if (disabled) b.disabled = true;
    b.addEventListener('click', onClick);
    return b;
  };

  ui.innerHTML = '';

  ui.appendChild(mkBtn('Prev', page === 1, () => ppSetPage(container, page - 1)));

  // Windowed page numbers (max 5)
  const windowSize = 5;
  let startPage = Math.max(1, page - Math.floor(windowSize / 2));
  let endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);

  if (startPage > 1) {
    ui.appendChild(mkBtn('1', false, () => ppSetPage(container, 1), page === 1 ? 'active' : ''));
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'pp-page-dots';
      dots.textContent = '…';
      ui.appendChild(dots);
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    ui.appendChild(mkBtn(String(p), false, () => ppSetPage(container, p), p === page ? 'active' : ''));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'pp-page-dots';
      dots.textContent = '…';
      ui.appendChild(dots);
    }
    ui.appendChild(mkBtn(String(totalPages), false, () => ppSetPage(container, totalPages), page === totalPages ? 'active' : ''));
  }

  ui.appendChild(mkBtn('Next', page === totalPages, () => ppSetPage(container, page + 1)));

  const label = document.createElement('span');
  label.className = 'pp-page-label';
  label.textContent = `Page ${page} of ${totalPages}`;
  ui.appendChild(label);
}

function ppInitPagination() {
  const containers = Array.from(document.querySelectorAll('.pp-results'));
  containers.forEach((container) => {
    // Only paginate real property grids/lists
    if (container.querySelectorAll('.pp-property-card').length === 0) return;

    const perPage = ppGetCardsPerPage();
    ppPaginationState.set(container, { page: 1, perPage });
    ppRenderPagination(container);
  });

  // Responsive update (debounced)
  let t = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      const newPerPage = ppGetCardsPerPage();
      ppPaginationState.forEach((state, container) => {
        const oldPerPage = state.perPage;
        if (oldPerPage === newPerPage) return;

        const firstIndex = (state.page - 1) * oldPerPage;
        state.perPage = newPerPage;
        state.page = Math.floor(firstIndex / newPerPage) + 1;
        ppRenderPagination(container);
      });
    }, 150);
  });
}

function ppRefreshPagination(container) {
  if (!container) return;
  const state = ppPaginationState.get(container);
  if (!state) return;
  // Keep current page if possible
  ppRenderPagination(container);
}

function ppRefreshAllPaginations() {
  ppPaginationState.forEach((_, container) => ppRenderPagination(container));
}

// 3) Theme (Light/Dark)
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  const sw = document.getElementById("themeSwitch");
  const status = document.getElementById("themeStatus");

  if (sw) sw.checked = theme === "dark";
  if (status) status.textContent = theme === "dark" ? "Dark" : "Light";
}

document.addEventListener("DOMContentLoaded", () => {
  const home = document.getElementById("tab-home");
  if (home) home.style.display = "block";

  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);

  const sw = document.getElementById("themeSwitch");
  if (sw) {
    sw.addEventListener("change", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  document.addEventListener("click", (e) => {
    const overlay = document.querySelector(".sidebar-overlay");
    if (overlay && e.target === overlay) toggleMobileSidebar();
  });

  const searchHeader = document.getElementById("ppSearchHeader");
  const searchBrand = document.getElementById("ppSearchBrand");

  window.addEventListener("scroll", () => {
    if (!searchHeader || !searchBrand) return;
    if (window.scrollY > 60) {
      searchHeader.classList.add("is-sticky");
      searchBrand.classList.add("is-hidden");
    } else {
      searchHeader.classList.remove("is-sticky");
      searchBrand.classList.remove("is-hidden");
    }
  });

  const viewButtons = document.querySelectorAll(".pp-view-btn");

  function setView(view) {
    const allResults = document.querySelectorAll(".pp-results");
    if (allResults.length === 0) return;

    allResults.forEach(results => {
      results.setAttribute("data-view", view);
    });

    viewButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    });
    localStorage.setItem("pp_property_view", view);
  }

  const savedView = localStorage.getItem("pp_property_view");
  if (savedView && (savedView === "grid" || savedView === "list")) {
    setView(savedView);
  }

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      setView(view);
    });

  // Initialize responsive pagination for property grids/lists
  ppInitPagination();

  });

  initSearch();
});

// --- LIVE SEARCH & FILTERS ---
function initSearch() {
  const searchInput = document.getElementById("ppSearchInput");
  const suggestionsBox = document.getElementById("ppSuggestionsBox");
  if (!searchInput || !suggestionsBox) return;

  let debounceTimer;

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      suggestionsBox.style.display = "none";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
        const suggestions = await res.json();
        renderSuggestions(suggestions);
      } catch (err) {
        console.error("Suggestions error:", err);
      }
    }, 300);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      executeSearch();
    }
  });

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = "none";
    }
  });

  // Filter Pills logic
  document.querySelectorAll(".pp-filter-pill, .dropdown-item[data-filter-type]").forEach(pill => {
    pill.addEventListener("click", (e) => {
      const type = pill.getAttribute("data-filter-type");
      const val = pill.getAttribute("data-filter-value");
      if (type && val) {
        e.preventDefault();
        applyFilter(type, val);
      }
    });
  });
}

function renderSuggestions(suggestions) {
  const suggestionsBox = document.getElementById("ppSuggestionsBox");
  if (!suggestionsBox) return;

  if (suggestions.length === 0) {
    suggestionsBox.style.display = "none";
    return;
  }

  suggestionsBox.innerHTML = suggestions.map(s => {
    let icon = "fa-search";
    let text = s;
    if (s.startsWith("In City: ")) {
      icon = "fa-city";
      text = s.replace("In City: ", "");
    } else if (s.startsWith("In State: ")) {
      icon = "fa-map-marked-alt";
      text = s.replace("In State: ", "");
    } else if (s.startsWith("In Area: ")) {
      icon = "fa-location-dot";
      text = s.replace("In Area: ", "");
    } else if (s.startsWith("Category: ")) {
      icon = "fa-layer-group";
      text = s.replace("Category: ", "");
    } else if (s.startsWith("Type: ")) {
      icon = "fa-home";
      text = s.replace("Type: ", "");
    }

    return `<div class="pp-suggestion-item" onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">
              <i class="fas ${icon}"></i>${text}
            </div>`;
  }).join("");
  suggestionsBox.style.display = "block";
}

function selectSuggestion(val) {
  const searchInput = document.getElementById("ppSearchInput");

  // Strip label prefix and just put the raw value in the search input
  let cleanVal = val;
  if (val.startsWith("In City: ")) {
    cleanVal = val.replace("In City: ", "");
  } else if (val.startsWith("In State: ")) {
    cleanVal = val.replace("In State: ", "");
  } else if (val.startsWith("In Area: ")) {
    cleanVal = val.replace("In Area: ", "");
  } else if (val.startsWith("Category: ")) {
    cleanVal = val.replace("Category: ", "");
  } else if (val.startsWith("Type: ")) {
    cleanVal = val.replace("Type: ", "");
  }

  searchInput.value = cleanVal;
  executeSearch();
}

function executeSearch() {
  const searchInput = document.getElementById("ppSearchInput");
  const q = searchInput.value.trim();
  
  // Start with a clean URL (origin + pathname) to ensure no other filters are carried over
  const url = new URL(window.location.origin + window.location.pathname);
  
  if (q) {
    url.searchParams.set("q", q);
  }
  
  window.location.href = url.toString();
}

function applyFilter(type, value) {
  const url = new URL(window.location.href);
  if (value === "All") {
    url.searchParams.delete(type);
  } else {
    url.searchParams.set(type, value);
  }

  // If we change type/city/state, we might want to keep the 'q' if user wants.
  window.location.href = url.toString();
}

// --- Profile Image Update ---
function toggleEditAvatar() {
  const section = document.getElementById("editAvatarSection");
  if (section) section.style.display = section.style.display === "none" ? "block" : "none";
}

function previewFileImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const avatar = document.getElementById("profileAvatar");
      if (avatar) avatar.src = e.target.result;
    }
    reader.readAsDataURL(input.files[0]);
    document.querySelectorAll(".color-option").forEach(el => el.classList.remove("selected"));
    document.getElementById("selectedAvatarColor").value = "";
  }
}

function selectAvatarColor(color) {
  let colorWithHash = color.startsWith('#') ? color : '#' + color;
  let colorNoHash = color.startsWith('#') ? color.substring(1) : color;

  document.querySelectorAll(".avatar-color-option").forEach(el => {
    el.classList.toggle("selected", el.getAttribute("data-color") === colorNoHash);
  });

  const picker = document.getElementById("nativeColorPicker");
  if (picker) {
    picker.value = colorWithHash;
    picker.parentElement.style.borderColor = colorWithHash;
  }
  document.getElementById("selectedAvatarColor").value = colorWithHash;
}

async function saveProfileAvatar() {
  const fileInput = document.getElementById("profileImgInput");
  const colorInput = document.getElementById("selectedAvatarColor");
  const formData = new FormData();

  if (fileInput.files.length > 0) formData.append("profile_image", fileInput.files[0]);
  else if (colorInput.value) formData.append("avatar_color", colorInput.value);
  else {
    alert("Please select a file or a color to update.");
    return;
  }

  try {
    const res = await fetch("/api/update-profile-image", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      const avatar = document.getElementById("profileAvatar");
      if (avatar) avatar.src = data.image_url;
      toggleEditAvatar();
      fileInput.value = "";
      colorInput.value = "";
      document.querySelectorAll(".color-option").forEach(el => el.classList.remove("selected"));
    } else alert("Failed: " + data.message);
  } catch (err) {
    console.error(err);
    alert("Error saving profile image");
  }
}

// =========================================
// PROPERTY MODAL POPUP
// =========================================
let currentPropertyId = null;

async function openPropertyModal(id) {
  currentPropertyId = id;
  const modalEl = document.getElementById("ppPropertyModal");
  const loading = document.getElementById("propModalLoading");
  const content = document.getElementById("propModalContent");

  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  loading.classList.remove("d-none");
  content.classList.add("d-none");

  try {
    const res = await fetch(`/api/property/${id}`);
    const data = await res.json();

    if (data.success) {
      const prop = data.property;

      // 1. Media Grid & Buttons
      renderImageGrid(prop.images);
      const mediaToolbar = document.getElementById("modalMediaToolbar");
      const videoBtn = document.getElementById("btnViewVideo");
      const floorBtn = document.getElementById("btnViewFloorPlan");

      if (mediaToolbar) {
        // Helper to check if a path is valid and not just a placeholder
        const isValidPath = (path) => path && path !== "None" && path !== "null" && path !== "" && !path.endsWith('/None') && !path.endsWith('/undefined');

        const hasVideo = isValidPath(prop.video_path);
        const hasFloorPlan = isValidPath(prop.floor_plan);

        if (hasVideo || hasFloorPlan) {
          mediaToolbar.classList.remove("d-none");

          if (videoBtn) {
            if (hasVideo) {
              videoBtn.style.display = "inline-flex";
              const newVideoBtn = videoBtn.cloneNode(true);
              videoBtn.parentNode.replaceChild(newVideoBtn, videoBtn);
              newVideoBtn.addEventListener('click', () => {
                window.open(`/static/${prop.video_path}`, '_blank');
              });
            } else {
              videoBtn.style.display = "none";
            }
          }

          if (floorBtn) {
            if (hasFloorPlan) {
              floorBtn.style.display = "inline-flex";
              const newFloorBtn = floorBtn.cloneNode(true);
              floorBtn.parentNode.replaceChild(newFloorBtn, floorBtn);
              newFloorBtn.addEventListener('click', () => {
                window.open(`/static/${prop.floor_plan}`, '_blank');
              });
            } else {
              floorBtn.style.display = "none";
            }
          }
        } else {
          mediaToolbar.classList.add("d-none");
        }
      }

      // 2. Header Status & Price
      document.getElementById("modalTitle").innerText = prop.title;
      const priceVal = prop.listing_type === "Rent" ? prop.rent_amount : prop.expected_price;
      const priceStr = "₹" + formatIndianPrice(priceVal);
      document.getElementById("modalPrice").innerText = prop.listing_type === "Rent" ? `${priceStr}/month` : priceStr;

      const negBadge = document.getElementById("modalNegotiableBadge");
      if (negBadge) {
        if (prop.is_negotiable) {
          negBadge.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle">Negotiable</span>`;
        } else {
          negBadge.innerHTML = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Non-Negotiable</span>`;
        }
      }

      const listingCapsule = document.getElementById("modalListingCapsule");
      if (listingCapsule) {
        listingCapsule.innerText = prop.listing_type === "Rent" ? "For Rent" : "For Sale";
        listingCapsule.className = `pp-status-capsule position-relative float-none ${prop.listing_type === "Rent" ? "is-rent" : "is-sale"}`;
      }

      document.getElementById("modalLocation").innerHTML = `<i class="fas fa-map-marker-alt"></i> ${prop.city}, ${prop.state}`;
      const addrEl = document.getElementById("modalFullAddress");
      if (addrEl) addrEl.innerText = `${prop.house_no ? prop.house_no + ", " : ""}${prop.address1}, ${prop.area}, ${prop.city}, ${prop.state} - ${prop.pincode}`;

      // 3. Features
      renderFeatures(prop);
      document.getElementById("modalDescription").innerText = prop.description || "No description provided.";
      renderMap(prop.latitude, prop.longitude);

      // 4. Seller Details
      const sellerNameEl = document.getElementById("modalSellerName");
      if (sellerNameEl) sellerNameEl.innerText = prop.seller_full_name;
      const roleEl = document.getElementById("modalSellerRole");
      if (roleEl) {
        roleEl.innerText = prop.seller_role; // Owner or Builder

        // Dynamic color capsule styling
        const isBuilder = prop.seller_role === "Builder";
        roleEl.style.backgroundColor = isBuilder ? "rgba(241, 48, 48, 0.1)" : "rgba(40, 167, 69, 0.1)";
        roleEl.style.color = isBuilder ? "#F13030" : "#28a745";
        roleEl.style.border = `1px solid ${isBuilder ? "rgba(241, 48, 48, 0.2)" : "rgba(40, 167, 69, 0.2)"}`;
        roleEl.style.padding = "4px 12px";
        roleEl.style.borderRadius = "20px";
        roleEl.style.fontSize = "11px";
        roleEl.style.fontWeight = "700";
        roleEl.style.textTransform = "uppercase";
        roleEl.style.display = "inline-block";
      }

      const sellerPhoneEl = document.getElementById("modalSellerPhone");
      if (sellerPhoneEl) sellerPhoneEl.innerText = prop.seller_contact_main || prop.seller_mobile;
      const emailEl = document.getElementById("modalSellerEmail");
      if (emailEl) emailEl.innerText = prop.seller_email_main || "--";

      const sellerImg = document.getElementById("modalSellerImg");
      if (sellerImg) {
        if (prop.seller_profile_image) {
          // Normalize path: if it starts with 'http', use as is.
          // If it starts with 'static/', append '/'.
          // If it's just filename, append '/static/'.
          // If it already has '/static/', leave it.
          let p = prop.seller_profile_image;
          if (p.startsWith("http") || p.startsWith("//")) {
            sellerImg.src = p;
          } else if (p.startsWith("/static/")) {
            sellerImg.src = p;
          } else if (p.startsWith("static/")) {
            sellerImg.src = "/" + p;
          } else {
            sellerImg.src = "/static/" + p;
          }
        } else {
          sellerImg.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(prop.seller_full_name) + "&background=F45B69&color=fff";
        }
      }

      // 5. Save Button Status
      updateHeartUI(prop.is_saved);

      // 6. Interest Button State (User Request: Green 'Request Sent' effect)
      const interestBtn = document.getElementById("interestBtn");
      if (interestBtn) {
        if (ppUserId == prop.seller_id) {
          interestBtn.disabled = true;
          interestBtn.innerText = "Your Listing";
          interestBtn.classList.remove("pp-btn-success");
          interestBtn.classList.add("pp-btn-outline");
        } else {
          interestBtn.disabled = false;
          interestBtn.innerHTML = `<i class="fas fa-hand-pointer"></i> Interested`;
          interestBtn.classList.remove("pp-btn-success", "pp-btn-primary");
          interestBtn.classList.add("pp-btn-outline");
        }
      }

      content.classList.remove("d-none");
    }
  } catch (err) {
    console.error("Error fetching property:", err);
  } finally {
    loading.classList.add("d-none");
  }
}

function renderImageGrid(images) {
  const container = document.getElementById("modalCarouselInner");
  if (!container) return;
  const carousel = document.getElementById("propertyCarousel");

  container.innerHTML = "";

  const toggleControls = (show) => {
    if (!carousel) return;
    const controls = carousel.querySelectorAll(".carousel-control-prev, .carousel-control-next");
    controls.forEach(c => c.style.display = show ? "" : "none");
  };

  if (!images || images.length === 0) {
    container.innerHTML = `
      <div class="carousel-item active">
        <div class="d-flex flex-column align-items-center justify-content-center" style="height: 400px; border-radius: 12px; background: var(--bg); border: 1px solid var(--border);">
          <i class="fas fa-image" style="font-size: 3rem; color: var(--muted); margin-bottom: 1rem; opacity: 0.5;"></i>
          <span style="color: var(--muted); font-weight: 500;">No Images Available</span>
        </div>
      </div>
    `;
    toggleControls(false);
    return;
  }

  images.forEach((img, idx) => {
    const div = document.createElement("div");
    div.className = `carousel-item ${idx === 0 ? "active" : ""}`;
    div.innerHTML = `<img src="/static/${img}" class="d-block w-100" style="height: 400px; object-fit: cover; border-radius: 12px 12px 0 0; cursor: pointer;" alt="Property Image" onclick="window.open(this.src, '_blank')">`;
    container.appendChild(div);
  });

  toggleControls(images.length > 1);
}

function renderFeatures(prop) {
  const container = document.getElementById("modalFeatures");
  if (!container) return;
  container.innerHTML = "";

  const features = [];
  if (prop.category) features.push({ icon: "fa-city", label: "Type", value: prop.category });
  if (prop.property_type) features.push({ icon: "fa-home", label: "Category", value: prop.property_type });

  const isPlot = prop.property_type === 'Plot';

  if (prop.bedrooms && !isPlot) features.push({ icon: "fa-bed", label: "Bedrooms", value: prop.bedrooms + " BHK" });
  if (prop.bathrooms && !isPlot) features.push({ icon: "fa-bath", label: "Bathrooms", value: prop.bathrooms });
  if (prop.built_up_area) features.push({ icon: "fa-vector-square", label: "Built-up", value: prop.built_up_area + " sqft" });
  if (prop.carpet_area && !isPlot) features.push({ icon: "fa-square", label: "Carpet", value: prop.carpet_area + " sqft" });
  if (prop.floor_number !== null && !isPlot) features.push({ icon: "fa-stairs", label: "Floor", value: `${prop.floor_number} of ${prop.total_floors || "--"}` });
  if (prop.furnishing_status && !isPlot) features.push({ icon: "fa-couch", label: "Furnishing", value: prop.furnishing_status });
  if (prop.balcony && !isPlot) features.push({ icon: "fa-door-open", label: "Balcony", value: "Available" });
  if (prop.availability_date && !isPlot) features.push({ icon: "fa-calendar-check", label: "Available From", value: prop.availability_date });
  if (prop.ownership_type) features.push({ icon: "fa-file-signature", label: "Ownership", value: prop.ownership_type });
  if (prop.maintenance_charges) features.push({ icon: "fa-tools", label: "Maintenance", value: "₹" + formatIndianPrice(prop.maintenance_charges) + "/mo" });
  if (prop.token_amount) features.push({ icon: "fa-hand-holding-usd", label: "Token", value: "₹" + formatIndianPrice(prop.token_amount) });
  if (prop.security_deposit) features.push({ icon: "fa-shield-alt", label: "Deposit", value: "₹" + formatIndianPrice(prop.security_deposit) });

  features.forEach(f => {
    container.innerHTML += `
      <div class="pp-feature-pill">
        <i class="fas ${f.icon}"></i>
        <div class="pp-feature-info">
          <small>${f.label}</small>
          <strong>${f.value}</strong>
        </div>
      </div>
    `;
  });
}

function renderMap(lat, lon) {
  const container = document.getElementById("modalMapContainer");
  if (!container) return;
  if (lat && lon) {
    container.innerHTML = `<iframe width="100%" height="300" frameborder="0" style="border:0; border-radius: 12px;" src="https://maps.google.com/maps?q=${lat},${lon}&hl=en&z=14&output=embed" allowfullscreen></iframe>`;
  } else {
    container.innerHTML = `<div class="pp-map-placeholder"><i class="fas fa-map-marked-alt"></i><p>Location map not available</p></div>`;
  }
}

async function toggleSaveFromModal() {
  if (!currentPropertyId) return;
  try {
    const res = await fetch("/api/property/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: currentPropertyId })
    });
    const data = await res.json();
    if (data.success) {
      // Force sync logic
      const isNowSaved = data.is_saved;
      updateHeartUI(isNowSaved);

      // Show branded toast
      const msg = isNowSaved ? "Property saved to your list" : "Property removed from saved";
      // Check if showToast is available from add_property.js context or define a global one.
      // Since showToast is inside add_property.js scope, we might need a global fallback or just a simple alert if not present.
      // Ideally, we move showToast to dashboard_base.js or make it global.
      // For now, let's try to find a global toast function or create a simple one here.
      createGlobalToast(msg, 'success');
    }
  } catch (err) {
    console.error("Error toggling save:", err);
  }
}

function updateHeartUI(isSaved) {
  let btn = document.getElementById("modalHeartBtn");
  if (!btn) btn = document.querySelector(".pp-heart-btn");

  if (!btn) return;
  const heartPath = btn.querySelector(".heart path");
  if (!heartPath) return;

  // Add animation by triggering active class
  btn.classList.remove("active");
  void btn.offsetWidth; // Trigger reflow
  btn.classList.add("active");

  // Remove active class after animation completes
  setTimeout(() => {
    btn.classList.remove("active");
  }, 600);

  if (isSaved) {
    btn.classList.add("is-saved");
  } else {
    btn.classList.remove("is-saved");
  }
}

async function requestInterest() {
  const btn = document.getElementById("interestBtn");
  const msgEl = document.getElementById("interestCooldownMsg");
  if (!currentPropertyId || !btn) return;

  // --- 2 MINUTE COOLDOWN LOGIC ---
  const cooldownKey = `interest_cooldown_${ppUserId}_${currentPropertyId}`;
  const lastClick = localStorage.getItem(cooldownKey);
  const now = Date.now();
  const cooldownPeriod = 120000; // 2 minutes

  if (lastClick && (now - parseInt(lastClick)) < cooldownPeriod) {
    const remaining = Math.ceil((cooldownPeriod - (now - parseInt(lastClick))) / 1000);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    if (msgEl) {
      msgEl.innerText = `You can send another request in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
      msgEl.style.display = "block";
      // Hide message after 4 seconds
      setTimeout(() => { if (msgEl) msgEl.style.display = "none"; }, 4000);
    }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...`;

  try {
    const res = await fetch("/api/property/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: currentPropertyId })
    });
    const data = await res.json();
    if (data.success) {
      // User Request: Make it green and show Request Sent
      btn.classList.remove("pp-btn-outline", "pp-btn-primary");
      btn.classList.add("pp-btn-success");
      btn.innerHTML = `<i class="fas fa-check"></i> Request Sent`;
      btn.disabled = true; // Keep it disabled as it's already sent

      // Set cooldown start time on success
      localStorage.setItem(cooldownKey, Date.now().toString());

      createGlobalToast("Interest request sent to seller!", "success");
    } else {
      createGlobalToast(data.message || "Failed to send interest", "error");
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-hand-pointer"></i> Interested`;
    }
  } catch (err) {
    console.error("Interest API error:", err);
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-hand-pointer"></i> Interested`;
  }
}
// Global Toast Helper
function createGlobalToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'pp-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `pp-toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';

  toast.innerHTML = `
        <i class="fas ${icon} pp-toast-icon"></i>
        <div class="pp-toast-msg">${message}</div>
    `;

  container.appendChild(toast);

  // Auto-remove after 4s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px) scale(0.9)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// --- DOWNLOAD PDF ---
function downloadPropertyPDF(id) {
  if (!id) return;
  window.location.href = `/property/download-pdf/${id}`;
}

// --- FORMAT PRICES ON CARDS (Indian Standard) ---
function formatCardPrices() {
  document.querySelectorAll('.pp-prop-price').forEach(el => {
    let text = el.innerText.trim();
    // Remove currency symbol and commas to get raw number
    // We look for digits. If it contains /month, we handle it.
    let isRent = text.toLowerCase().includes('month');
    let raw = text.replace(/[^\d]/g, '');

    if (raw) {
      let val = parseInt(raw, 10);
      if (!isNaN(val)) {
        // Reformat
        let formatted = formatIndianPrice(val);
        if (isRent) {
          el.innerText = `₹${formatted}/month`;
        } else {
          el.innerText = `₹${formatted}`;
        }
      }
    }
  });
}
// --- TOGGLE SAVE FROM CARD ---
async function toggleSaveFromCard(id, btn) {
  if (!id) return;

  // Immediate feedback: add animation
  btn.classList.remove("active");
  void btn.offsetWidth;
  btn.classList.add("active");

  // Remove active class after animation
  setTimeout(() => {
    btn.classList.remove("active");
  }, 600);

  try {
    const res = await fetch("/api/property/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: id })
    });
    const data = await res.json();
    if (data.success) {
      const isSaved = data.is_saved;

      // 1. Update all instances of this heart (Home & Saved tabs)
      updateCardHeartUI(id, isSaved);

      // 2. If modal is open for THIS property, update it too
      if (currentPropertyId == id) {
        updateHeartUI(isSaved);
      }

      // 3. Sync Saved Properties Tab without refresh
      syncSavedTab(id, isSaved);

      const msg = isSaved ? "Property saved to your list" : "Property removed from saved";
      createGlobalToast(msg, 'success');
    }
  } catch (err) {
    console.error("Error toggling save from card:", err);
  }
}

function updateCardHeartUI(id, isSaved) {
  const buttons = document.querySelectorAll(`.pp-heart-btn-card[data-property-id="${id}"]`);
  buttons.forEach(btn => {
    if (isSaved) {
      btn.classList.add("is-saved");
    } else {
      btn.classList.remove("is-saved");
    }
  });
}

function syncSavedTab(id, isSaved) {
  const savedContainer = document.getElementById('savedPropertiesContainer');
  const homeContainer = document.getElementById('homePropertiesContainer');
  if (!savedContainer) return;

  if (isSaved) {
    // If it's saved but not in the saved container, add it
    const alreadyInSaved = savedContainer.querySelector(`.pp-property-card[data-id="${id}"]`);
    if (!alreadyInSaved && homeContainer) {
      // Find the card in home container to clone
      const sourceCard = homeContainer.querySelector(`.pp-property-card[data-id="${id}"]`);
      if (sourceCard) {
        const newCard = sourceCard.cloneNode(true);
        // Ensure the heart in cloned card is also marked as saved
        const heart = newCard.querySelector('.pp-heart-btn-card');
        if (heart) {
          heart.classList.add('is-saved');
        }

        // Remove empty state if present
        const empty = savedContainer.querySelector('.pp-empty-state');
        if (empty) empty.remove();

        savedContainer.appendChild(newCard);

        // Pagination: newly added card should appear immediately (no manual refresh)
        ppRefreshPagination(savedContainer);
      }
    }
  } else {
    // If it's unsaved, remove it from the saved container
    const cardToRemove = savedContainer.querySelector(`.pp-property-card[data-id="${id}"]`);
    if (cardToRemove) {
      cardToRemove.style.opacity = '0';
      cardToRemove.style.transform = 'scale(0.9)';
      setTimeout(() => {
        cardToRemove.remove();
        // If container is empty, show empty state
        if (savedContainer.children.length === 0) {
          savedContainer.innerHTML = `
            <div class="pp-empty-state">
              <div class="pp-empty-icon-wrapper">
                <i class="fas fa-heart"></i>
              </div>
              <h3>No Saved Properties</h3>
              <p>Properties you save will appear here for quick access later.</p>
            </div>`;
        }

        // Pagination: re-render after removal
        ppRefreshPagination(savedContainer);
      }, 300);
    }
  }
}

// Update existing updateHeartUI to also call card sync
const originalUpdateHeartUI = updateHeartUI;
updateHeartUI = function (isSaved) {
  // 1. Update Modal Heart
  let btn = document.getElementById("modalHeartBtn");
  if (!btn) btn = document.querySelector(".pp-heart-btn");

  if (btn) {
    // Add animation
    btn.classList.remove("active");
    void btn.offsetWidth;
    btn.classList.add("active");

    // Remove active class after animation
    setTimeout(() => {
      btn.classList.remove("active");
    }, 600);

    if (isSaved) {
      btn.classList.add("is-saved");
    } else {
      btn.classList.remove("is-saved");
    }
  }

  // 2. Sync with everything else
  if (currentPropertyId) {
    updateCardHeartUI(currentPropertyId, isSaved);
    syncSavedTab(currentPropertyId, isSaved);
  }
};

// Auto-run on load
document.addEventListener("DOMContentLoaded", () => {
  formatCardPrices();

  // Initialize notification system for seller dashboard
  initNotifications();
});

// =========================================
// NOTIFICATION SYSTEM FOR SELLER DASHBOARD
// =========================================

function initNotifications() {
  const notifyBtn = document.getElementById('sellerNotifyBtn');
  if (!notifyBtn) return; // Only run on seller dashboard

  // Initial load
  updateNotificationCount();

  // Poll every 30 seconds for new notifications
  setInterval(updateNotificationCount, 30000);
}

async function updateNotificationCount() {
  try {
    const res = await fetch('/api/notifications/count');
    const data = await res.json();

    if (data.success) {
      const badges = document.querySelectorAll('.pp-notify-badge');
      badges.forEach(badge => {
        if (data.count > 0) {
          badge.textContent = data.count > 99 ? '99+' : data.count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      });
    }
  } catch (err) {
    console.error('Error fetching notification count:', err);
  }
}

function openNotifications() {
  // Clear the notification badge immediately locally
  clearNotificationBadge();

  // Find the Requests menu link and trigger it
  const requestsLink = document.querySelector('a[onclick*="tab-requests"]');
  if (requestsLink) {
    requestsLink.click();

    // Optional: If already on the requests tab, maybe refresh lists?
    // But let's stick to the simplest "make it work" first.
  } else {
    // Fallback: manually open the tab
    openTab('tab-requests', null);
  }

  // Mark notifications as read on the server
  markNotificationsAsRead();
}

async function clearNotificationBadge() {
  const badges = document.querySelectorAll('.pp-notify-badge');
  badges.forEach(badge => {
    badge.style.display = 'none';
    badge.textContent = '0';
  });
}

async function markNotificationsAsRead() {
  try {
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.success) {
      // Hide all pending badges on the current page
      document.querySelectorAll('.pp-status-badge').forEach(badge => {
        badge.style.opacity = '0';
        setTimeout(() => badge.remove(), 300);
      });
    }
  } catch (err) {
    console.error('Error marking notifications as read:', err);
  }
}

async function clearInbox() {
  if (!confirm('Are you sure you want to clear your entire inbox? This action cannot be undone.')) return;

  try {
    const res = await fetch('/api/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.success) {
      const list = document.getElementById('requestsList');
      if (list) {
        list.style.opacity = '0';
        setTimeout(() => {
          list.innerHTML = `
            <div class="pp-empty-state">
              <div class="pp-empty-icon-wrapper">
                <i class="fas fa-inbox"></i>
              </div>
              <h3>No Activity Yet</h3>
              <p>Buyer interest and messages or messages will show up here.</p>
            </div>
          `;
          list.style.opacity = '1';

          // Hide clear button
          const btn = document.getElementById('btnClearInbox');
          if (btn) btn.style.display = 'none';
        }, 300);
      }
      createGlobalToast('Inbox cleared successfully', 'success');
    } else {
      alert('Failed to clear inbox: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error clearing inbox:', err);
    alert('An error occurred while clearing your inbox.');
  }
}

function togglePasswordVisibility(id, icon) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}