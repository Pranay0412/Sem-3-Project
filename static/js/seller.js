/* ==========================================================================
   SELLER DASHBOARD LOGIC
   Description: Manages property management, editing, deletion, and dashboard stats.
   Author: PropertyPlus Dev Team
   ========================================================================== */

/* =========================================
   SELLER DASHBOARD LOGIC (REFINED)
   ========================================= */

let editPropertyImages = [];
let editPropertyVideo = null;
let editPropertyFloorPlan = null;
let authMode = 'update'; // 'update' or 'delete'
let pendingDeleteId = null;
// Existing media deletion state (stored as relative paths)
let editDeleteImages = new Set();
let editDeleteVideo = false;
let editDeleteFloorPlan = false;

// 1. Sidebar Management
async function editPropertyFromModal() {
    if (!currentPropertyId) return;

    // Close detail modal
    const modalEl = document.getElementById('ppPropertyModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    openEditSidebar(currentPropertyId);
}

async function openEditSidebar(id) {
    const sidebar = document.getElementById('editPropertySidebar');
    const overlay = document.getElementById('editSidebarOverlay');

    // Reset state
    document.getElementById('editPropertyForm').reset();
    document.getElementById('edit_property_id').value = id;
    editPropertyImages = [];
    editPropertyVideo = null;
    editPropertyFloorPlan = null;
    editDeleteImages = new Set();
    editDeleteVideo = false;
    editDeleteFloorPlan = false;

// Reset hidden delete fields
const delImg = document.getElementById('edit_delete_images');
const delVid = document.getElementById('edit_delete_video');
const delFp = document.getElementById('edit_delete_floor_plan');
if (delImg) delImg.value = "";
if (delVid) delVid.value = "0";
if (delFp) delFp.value = "0";

    renderEditImagePreviews();
    document.getElementById('editVideoPreview').innerText = '';
    document.getElementById('editFloorPlanPreview').innerText = '';
    
    // Reset Seller Details
    document.getElementById('edit_seller_name').value = '';
    document.getElementById('edit_seller_mobile').value = '';
    document.getElementById('edit_seller_email').value = '';
    const defRole = document.getElementById('edit_role_owner');
    if (defRole) defRole.checked = true;

    togglePassPanel(false);

    // Clear validation states
    document.querySelectorAll('#editPropertyForm .is-invalid').forEach(el => el.classList.remove('is-invalid'));

    // Show sidebar & overlay
    sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');

    try {
        const res = await fetch(`/api/property/${id}`);
        const data = await res.json();

        if (data.success) {
            const prop = data.property;

            // Populate Fields
            document.getElementById('edit_title').value = prop.title || '';
            document.getElementById('edit_category').value = prop.category || 'Residential';
            document.getElementById('edit_property_type').value = prop.property_type || 'Apartment';
            document.getElementById('edit_listing_type').value = prop.listing_type || 'Sale';

            document.getElementById('edit_house_no').value = prop.house_no || '';
            document.getElementById('edit_area').value = prop.area || '';
            document.getElementById('edit_address1').value = prop.address1 || '';
            document.getElementById('edit_landmark').value = prop.landmark || '';
            document.getElementById('edit_city').value = prop.city || '';
            document.getElementById('edit_state').value = prop.state || '';
            document.getElementById('edit_pincode').value = prop.pincode || '';

            document.getElementById('edit_built_up_area').value = prop.built_up_area || '';
            document.getElementById('edit_carpet_area').value = prop.carpet_area || '';
            document.getElementById('edit_bedrooms').value = prop.bedrooms || '';
            document.getElementById('edit_bathrooms').value = prop.bathrooms || '';
            document.getElementById('edit_floor_number').value = prop.floor_number || '';
            document.getElementById('edit_total_floors').value = prop.total_floors || '';
            document.getElementById('edit_availability_date').value = prop.available_from || '';
            document.getElementById('edit_balcony').value = prop.balcony ? 'true' : 'false';
            document.getElementById('edit_furnishing_status').value = prop.furnishing_status || 'Semi-Furnished';

            document.getElementById('edit_expected_price').value = prop.expected_price || '';
            document.getElementById('edit_token_amount').value = prop.token_amount || '';
            document.getElementById('edit_rent_amount').value = prop.rent_amount || '';
            document.getElementById('edit_security_deposit').value = prop.security_deposit || '';
            document.getElementById('edit_maintenance_charges').value = prop.maintenance_charges || '';
            document.getElementById('edit_ownership_type').value = prop.ownership_type || 'Freehold';
            document.getElementById('edit_is_negotiable').checked = prop.is_negotiable;
            document.getElementById('edit_highlights').value = prop.highlights || '';
            document.getElementById('edit_description').value = prop.description || '';

            // Seller Details
            document.getElementById('edit_seller_name').value = prop.seller_name || prop.seller_full_name || '';
            document.getElementById('edit_seller_mobile').value = prop.seller_mobile || prop.seller_contact_main || '';
            document.getElementById('edit_seller_email').value = prop.seller_email_main || '';
            const role = prop.seller_role || 'Owner';
            const roleRadio = document.querySelector(`input[name="seller_role"][value="${role}"]`);
            if (roleRadio) roleRadio.checked = true;

            // Set Coordinates
            document.getElementById('edit_latitude').value = prop.latitude || '';
            document.getElementById('edit_longitude').value = prop.longitude || '';

            // Show existing media status
            if (prop.video_path) {
                const vidStatus = document.getElementById('editVideoPreview');
                if(vidStatus) {
                    vidStatus.innerText = "Current video available";
                    vidStatus.className = "text-primary small mt-1";
                }
            }
            if (prop.floor_plan) {
                const fpStatus = document.getElementById('editFloorPlanPreview');
                if(fpStatus) {
                    fpStatus.innerText = "Current floor plan available";
                    fpStatus.className = "text-primary small mt-1";
                }
            }

            renderEditExistingMedia(prop);

            toggleEditPriceFields();
            updateEditFormFields();
        }
    } catch (err) {
        console.error("Error loading property:", err);
        createGlobalToast("Failed to load details", "error");
    }
}

function closeEditSidebar() {
    document.getElementById('editPropertySidebar').classList.remove('active');
    const overlay = document.getElementById('editSidebarOverlay');
    if (overlay) overlay.classList.remove('active');
    togglePassPanel(false);
}

function renderEditExistingMedia(prop) {
    const wrap = document.getElementById('editExistingMediaWrap');
    const imgWrap = document.getElementById('editExistingImages');
    const removeVidRow = document.getElementById('editRemoveVideoRow');
    const removeFpRow = document.getElementById('editRemoveFloorPlanRow');

    if (!wrap || !imgWrap) return;

    // Normalize images into an array
    let imgs = prop.images || [];
    if (typeof imgs === "string") {
        imgs = imgs.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(imgs)) imgs = [];

    // Show wrapper only if any existing media exists
    const hasAny = (imgs.length > 0) || !!prop.video_path || !!prop.floor_plan;
    wrap.style.display = hasAny ? "block" : "none";

    // Render existing images with remove toggle
    imgWrap.innerHTML = "";
    imgs.forEach((p) => {
        const card = document.createElement("div");
        card.className = "position-relative";
        card.style.width = "100%";

        const img = document.createElement("img");
        img.src = p.startsWith("http") ? p : ("/static/" + p);
        img.alt = "Existing Photo";
        img.style.width = "100%";
        img.style.height = "90px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "12px";
        img.style.border = "1px solid var(--border)";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-sm btn-danger position-absolute";
        btn.style.top = "6px";
        btn.style.right = "6px";
        btn.style.borderRadius = "10px";
        btn.innerHTML = '<i class="fas fa-times"></i>';

        btn.addEventListener("click", () => {
            // Toggle deletion
            if (editDeleteImages.has(p)) {
                editDeleteImages.delete(p);
                card.style.opacity = "1";
                btn.classList.remove("btn-secondary");
                btn.classList.add("btn-danger");
            } else {
                editDeleteImages.add(p);
                card.style.opacity = "0.45";
                btn.classList.remove("btn-danger");
                btn.classList.add("btn-secondary");
            }
            const delImg = document.getElementById("edit_delete_images");
            if (delImg) delImg.value = Array.from(editDeleteImages).join(",");
        });

        card.appendChild(img);
        card.appendChild(btn);
        imgWrap.appendChild(card);
    });

    // Video toggle
    if (removeVidRow) {
        removeVidRow.style.display = prop.video_path ? "block" : "none";
        const chk = document.getElementById("edit_remove_video");
        if (chk) {
            chk.checked = false;
            chk.onchange = () => {
                editDeleteVideo = chk.checked;
                const h = document.getElementById("edit_delete_video");
                if (h) h.value = editDeleteVideo ? "1" : "0";
            };
        }
    }

    // Floor plan toggle
    if (removeFpRow) {
        removeFpRow.style.display = prop.floor_plan ? "block" : "none";
        const chk = document.getElementById("edit_remove_floor_plan");
        if (chk) {
            chk.checked = false;
            chk.onchange = () => {
                editDeleteFloorPlan = chk.checked;
                const h = document.getElementById("edit_delete_floor_plan");
                if (h) h.value = editDeleteFloorPlan ? "1" : "0";
            };
        }
    }
}

// 2. Drag and Drop Logic
function setupEditMediaHandling() {
    const zone = document.getElementById('editDropZone');
    const input = document.getElementById('edit_images');
    const videoInput = document.getElementById('edit_video');
    const floorPlanInput = document.getElementById('edit_floor_plan');

    if (zone && input) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
            zone.addEventListener(eName, (e) => { e.preventDefault(); e.stopPropagation(); });
        });

        zone.addEventListener('dragover', () => zone.classList.add('dragover'));
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', (e) => {
            zone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });

        input.addEventListener('change', (e) => {
            handleFiles(Array.from(e.target.files));
            input.value = ''; // Reset input
        });
    }

    if (videoInput) {
        videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                editPropertyVideo = file;
                document.getElementById('editVideoPreview').innerText = `Selected: ${file.name}`;
            }
        });
    }

    if (floorPlanInput) {
        floorPlanInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                editPropertyFloorPlan = file;
                document.getElementById('editFloorPlanPreview').innerText = `Selected: ${file.name}`;
            }
        });
    }

    function handleFiles(files) {
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                editPropertyImages.push(file);
            }
        });
        renderEditImagePreviews();
    }
}

function renderEditImagePreviews() {
    const grid = document.getElementById('editImagePreview');
    if (!grid) return;
    grid.innerHTML = '';

    editPropertyImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'pp-edit-preview-item';
            item.innerHTML = `
                <img src="${e.target.result}">
                <div class="pp-edit-remove-img" onclick="removeEditImage(${index})">✕</div>
            `;
            grid.appendChild(item);
        };
        reader.readAsDataURL(file);
    });
}

function removeEditImage(index) {
    editPropertyImages.splice(index, 1);
    renderEditImagePreviews();
}

// 3. Validation Logic (Mirroring Add Property)
function validateEditForm() {
    const form = document.getElementById('editPropertyForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    let isValid = true;

    inputs.forEach(input => {
        if (input.offsetParent === null) return; // Skip hidden

        const val = input.value.trim();
        let fieldValid = true;
        let errorMsg = '';

        if (input.hasAttribute('required') && !val) {
            fieldValid = false;
            errorMsg = 'This field is required';
        }

        // Numeric Validation: Cannot be negative
        if (input.type === 'number' && val !== '') {
            const numVal = parseFloat(val);
            if (numVal < 0) {
                fieldValid = false;
                errorMsg = 'Cannot be negative';
            }
        }

        // Seller specific validation
        if (input.id === 'edit_seller_mobile' && val) {
            // Allow +91, 91, or just 10 digits. Strip space/dashes.
            const cleanVal = val.replace(/[\s\-\(\)]/g, '');
            if (!/^(?:\+91|91)?\d{10}$/.test(cleanVal)) {
                fieldValid = false;
                errorMsg = 'Invalid mobile number';
            }
        }
        if (input.id === 'edit_seller_email' && val) {
            if (!/\S+@\S+\.\S+/.test(val)) {
                fieldValid = false;
                errorMsg = 'Invalid email address';
            }
        }

        // Specific checks for detailed messages
        if (input.id === 'edit_carpet_area') {
            const builtUp = parseFloat(document.getElementById('edit_built_up_area').value) || 0;
            if (parseFloat(val) > builtUp) {
                fieldValid = false;
                errorMsg = 'Cannot exceed built-up area';
            }
        }

        if (input.id === 'edit_floor_number') {
            const total = parseInt(document.getElementById('edit_total_floors').value) || 0;
            if (parseInt(val) > total) {
                fieldValid = false;
                errorMsg = 'Cannot exceed total floors';
            }
        }

        const feedback = input.parentNode.querySelector('.invalid-feedback');
        if (!fieldValid) {
            isValid = false;
            input.classList.add('is-invalid');
            input.classList.add('is-invalid-shake');
            if (feedback) feedback.innerText = errorMsg;
            setTimeout(() => input.classList.remove('is-invalid-shake'), 400);
        } else {
            input.classList.remove('is-invalid');
            if (feedback) feedback.innerText = '';
        }
    });

    if (!isValid) {
        createGlobalToast("Please correct the highlighted errors", "error");
        // Open the first accordion with an error
        const firstError = form.querySelector('.is-invalid');
        if (firstError) {
            const accordionItem = firstError.closest('.accordion-collapse');
            if (accordionItem) {
                const bsCollapse = bootstrap.Collapse.getOrCreateInstance(accordionItem);
                bsCollapse.show();
            }
        }
    }

    return isValid;
}

// 1a. Modal Actions
function deletePropertyFromModal() {
    if (typeof currentPropertyId !== 'undefined' && currentPropertyId) {
        // Close detail modal first
        const modalEl = document.getElementById('ppPropertyModal');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }
        openDeleteConfirm(currentPropertyId);
    }
}

function openDeleteConfirm(id) {
    authMode = 'delete';
    pendingDeleteId = id;

    // Reset Modal UI
    document.querySelectorAll('input[name="modal_delete_reason"]').forEach(r => r.checked = false);
    document.getElementById('mOtherReasonContainer').style.display = 'none';
    document.getElementById('mOtherReasonText').value = '';
    document.getElementById('modal_confirm_delete_password').value = '';

    showDeleteStep(1);

    const delModal = new bootstrap.Modal(document.getElementById('deletePropertyModal'));
    delModal.show();
}

function showDeleteStep(step) {
    if (step === 1) {
        document.getElementById('deleteStepReason').style.display = 'block';
        document.getElementById('deleteStepPassword').style.display = 'none';
    } else {
        document.getElementById('deleteStepReason').style.display = 'none';
        document.getElementById('deleteStepPassword').style.display = 'block';
    }
}

function proceedToDeleteStep2() {
    const selected = document.querySelector('input[name="modal_delete_reason"]:checked');
    if (!selected) {
        createGlobalToast("Please select a reason", "error");
        return;
    }

    let reason = selected.value;
    if (reason === 'Other') {
        reason = document.getElementById('mOtherReasonText').value.trim();
        if (!reason) {
            createGlobalToast("Please specify the reason", "error");
            return;
        }
    }

    window.pendingDeleteReason = reason;
    showDeleteStep(2);
    setTimeout(() => document.getElementById('modal_confirm_delete_password').focus(), 400);
}

async function submitModalDelete() {
    const password = document.getElementById('modal_confirm_delete_password').value;
    if (!password) {
        createGlobalToast("Password required to confirm deletion", "error");
        return;
    }

    const btn = document.getElementById('btnFinalModalDelete');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Deleting permanently...';

    try {
        const res = await fetch('/api/property/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                property_id: pendingDeleteId,
                password: password,
                reason: window.pendingDeleteReason
            })
        });
        const data = await res.json();

        if (data.success) {
            createGlobalToast("Property deleted successfully", "success");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            createGlobalToast(data.message || "Deletion failed", "error");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (err) {
        console.error("Modal delete error:", err);
        createGlobalToast("Network error. Try again.", "error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Sidebar functions kept for updates
function togglePassPanel(show) {
    const panel = document.getElementById('sidebarPassPanel');
    const footer = document.querySelector('.pp-sidebar-footer');

    const passInput = document.getElementById('sidebar_confirm_password');
    if (show) {
        authMode = 'update';
        if (!validateEditForm()) return;

        // Reset panel UI for update
        panel.querySelector('h4').innerText = "Confirm Identity";
        panel.querySelector('p').innerText = "Enter your password to authorize updates";
        const updateBtn = document.getElementById('btnFinalUpdate');
        updateBtn.innerText = "Confirm & Update";
        updateBtn.className = "btn btn-primary";

        panel.classList.add('active');
        footer.style.opacity = '0.3';
        footer.style.pointerEvents = 'none';
        passInput.focus();

        // Add Enter key listener specific to this opening
        passInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateBtn.click();
            }
        };
    } else {
        panel.classList.remove('active');
        footer.style.opacity = '1';
        footer.style.pointerEvents = 'all';
        passInput.value = '';
        passInput.onkeydown = null; // Clean up listener
        // CRITICAL BUG FIX: Don't clear pendingDeleteId here if we're in modal delete flow
        // Only clear if we're explicitly canceling an update
        if (authMode === 'update') {
            pendingDeleteId = null;
        }
    }
}

// DEPRECATED: Deletion now uses Bootstrap Modal #deletePropertyModal
// Keeping sidebar logic exclusively for property updates

function setupBlurValidation() {
    const editForm = document.getElementById('editPropertyForm');
    if (!editForm) return;

    const inputs = editForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (input.offsetParent === null) return;

            const val = input.value.trim();
            let fieldValid = true;
            let errorMsg = '';

            if (input.hasAttribute('required') && !val) {
                fieldValid = false;
                errorMsg = 'This field is required';
            }

            if (input.type === 'number' && val !== '') {
                if (parseFloat(val) < 0) {
                    fieldValid = false;
                    errorMsg = 'Cannot be negative';
                }
            }

            // Seller specific validation
            if (input.id === 'edit_seller_mobile' && val) {
                const cleanVal = val.replace(/[\s\-\(\)]/g, '');
                if (!/^(?:\+91|91)?\d{10}$/.test(cleanVal)) {
                    fieldValid = false;
                    errorMsg = 'Invalid mobile number';
                }
            }
            if (input.id === 'edit_seller_email' && val) {
                if (!/\S+@\S+\.\S+/.test(val)) {
                    fieldValid = false;
                    errorMsg = 'Invalid email address';
                }
            }

            // Cross-Validation: Carpet vs Built-up
            if (input.id === 'edit_carpet_area' || input.id === 'edit_built_up_area') {
                const carpetInput = document.getElementById('edit_carpet_area');
                const builtUpInput = document.getElementById('edit_built_up_area');
                const cVal = parseFloat(carpetInput.value) || 0;
                const bVal = parseFloat(builtUpInput.value) || 0;

                if (cVal > 0 && bVal > 0 && cVal > bVal) {
                    // Mark carpet as invalid
                    carpetInput.classList.add('is-invalid');
                    carpetInput.classList.add('is-invalid-shake');
                    const cFeedback = carpetInput.parentNode.querySelector('.invalid-feedback');
                    if (cFeedback) cFeedback.innerText = 'Carpet cannot exceed Built-up area';
                    if (input.id === 'edit_carpet_area') { fieldValid = false; errorMsg = 'Carpet cannot exceed Built-up area'; }
                    setTimeout(() => carpetInput.classList.remove('is-invalid-shake'), 400);
                } else if (cVal <= bVal) {
                    // Clear error if now valid
                    carpetInput.classList.remove('is-invalid');
                    const cFeedback = carpetInput.parentNode.querySelector('.invalid-feedback');
                    if (cFeedback) cFeedback.innerText = '';
                }
            }

            // Floor check
            if (input.id === 'edit_floor_number' || input.id === 'edit_total_floors') {
                const floor = parseInt(document.getElementById('edit_floor_number').value) || 0;
                const total = parseInt(document.getElementById('edit_total_floors').value) || 0;
                if (floor > total) {
                    fieldValid = false;
                    errorMsg = 'Cannot exceed total floors';
                }
            }

            const feedback = input.parentNode.querySelector('.invalid-feedback');
            if (!fieldValid) {
                input.classList.add('is-invalid');
                input.classList.add('is-invalid-shake');
                if (feedback) feedback.innerText = errorMsg;
                setTimeout(() => input.classList.remove('is-invalid-shake'), 400);
            } else {
                input.classList.remove('is-invalid');
                if (feedback) feedback.innerText = '';
            }
        });
    });
}

// 4. Password Panel Management
// 4. Submission Link

// 5. Final Submission
async function submitEditProperty() {
    const password = document.getElementById('sidebar_confirm_password').value;
    if (!password) {
        createGlobalToast("Identity verification required", "error");
        return;
    }

    if (authMode === 'delete') {
        performPropertyDelete(pendingDeleteId, password, window.pendingDeleteReason);
        return;
    }

    const btn = document.getElementById('btnFinalUpdate');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';

    const form = document.getElementById('editPropertyForm');
    const formData = new FormData(form);
    formData.append('password', password);

    // Append our custom images store
    editPropertyImages.forEach(file => {
        formData.append('images', file);
    });

    if (editPropertyVideo) {
        formData.append('video', editPropertyVideo);
    }
    if (editPropertyFloorPlan) {
        formData.append('floor_plan', editPropertyFloorPlan);
    }

    try {
        const res = await fetch('/api/property/update', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            createGlobalToast("Property updated successfully!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            createGlobalToast(data.message || "Update failed", "error");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (err) {
        console.error("Update error:", err);
        createGlobalToast("Network error. Try again.", "error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function performPropertyDelete(id, password, reason) {
    const btn = document.getElementById('btnFinalUpdate');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Deleting...';

    try {
        const res = await fetch('/api/property/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ property_id: id, password: password, reason: reason })
        });
        const data = await res.json();

        if (data.success) {
            createGlobalToast("Property deleted successfully", "success");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            createGlobalToast(data.message || "Deletion failed", "error");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (err) {
        console.error("Delete error:", err);
        createGlobalToast("Network error. Try again.", "error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Utility: Toggle Price Fields (Already used in populate)
function toggleEditPriceFields() {
    const type = document.getElementById('edit_listing_type').value;
    const sellSec = document.getElementById('editSellPriceSection');
    const rentSec = document.getElementById('editRentPriceSection');

    const priceInput = document.getElementById('edit_expected_price');
    const rentInput = document.getElementById('edit_rent_amount');

    if (type === 'Rent') {
        sellSec.style.display = 'none';
        rentSec.style.display = 'block';
        if (priceInput) priceInput.removeAttribute('required');
        if (rentInput) rentInput.setAttribute('required', 'true');
    } else {
        sellSec.style.display = 'block';
        rentSec.style.display = 'none';
        if (priceInput) priceInput.setAttribute('required', 'true');
        if (rentInput) rentInput.removeAttribute('required');
    }
}

// 6. Tab Switching (from previous implementation)
function openTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(el => el.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    const sidebarLinks = document.querySelectorAll('.menu-link');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(tabId)) {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
    // Auto-close sidebar on small screens after selecting a menu item (matches buyer dashboard behavior)
    const overlay = document.querySelector('.sidebar-overlay');
    const sidebar = document.getElementById('mainSidebar');
    if (overlay && overlay.classList.contains('active')) {
        if (sidebar) sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// 7. Area Suggestions & Auto-Coordinates for Edit
function setupEditPostalAPI() {
    const areaInput = document.getElementById('edit_area');
    const suggestionsBox = document.getElementById('editAreaSuggestions');

    if (areaInput && suggestionsBox) {
        let timer;
        areaInput.addEventListener('input', function () {
            const q = this.value;
            clearTimeout(timer);
            if (q.length < 3) { suggestionsBox.style.display = 'none'; return; }
            timer = setTimeout(async () => {
                try {
                    const res = await fetch(`https://api.postalpincode.in/postoffice/${q}`);
                    const data = await res.json();
                    if (data[0].Status === 'Success') {
                        suggestionsBox.innerHTML = '';
                        data[0].PostOffice.slice(0, 5).forEach(p => {
                            const d = document.createElement('div');
                            d.className = 'pp-suggestion-item';
                            d.style.padding = '12px';
                            d.style.cursor = 'pointer';
                            d.style.borderBottom = '1px solid var(--border)';
                            d.innerHTML = `<i class="fas fa-map-marker-alt me-2 text-primary"></i><b>${p.Name}</b>, ${p.District}`;
                            d.onclick = () => {
                                areaInput.value = p.Name;
                                document.getElementById('edit_city').value = p.District;
                                document.getElementById('edit_state').value = p.State;
                                document.getElementById('edit_pincode').value = p.Pincode;
                                suggestionsBox.style.display = 'none';

                                // Automatically update coordinates based on selected area
                                updateEditCoordinates(`${p.Name}, ${p.District}, ${p.State}`);
                            };
                            suggestionsBox.appendChild(d);
                        });
                        suggestionsBox.style.display = 'block';
                    }
                } catch (e) { console.error("Postal API Error:", e); }
            }, 400);
        });

        document.addEventListener('click', e => {
            if (!areaInput.contains(e.target)) suggestionsBox.style.display = 'none';
        });
    }
}

function updateEditFormFields() {
    const propType = document.getElementById('edit_property_type').value;

    // Select elements (IDs from seller_dashboard.html)
    const builtUpLabel = document.querySelector('label[for="edit_built_up_area"]') || document.getElementById('edit_built_up_area').previousElementSibling;
    const carpetAreaGroup = document.getElementById('edit_carpet_area').closest('.col-6');
    const bedroomsGroup = document.getElementById('edit_bedrooms').closest('.col-3');
    const bathroomsGroup = document.getElementById('edit_bathrooms').closest('.col-3');
    const floorNoGroup = document.getElementById('edit_floor_number').closest('.col-3');
    const totalFloorsGroup = document.getElementById('edit_total_floors').closest('.col-3');

    // Select the row containing balcony, availability, furnishing
    const nextRow = document.getElementById('edit_balcony').closest('.row');
    const bathroomsLabel = bathroomsGroup.querySelector('.form-label');

    if (propType === 'Plot') {
        if (builtUpLabel) builtUpLabel.innerText = 'Plot Area (sqft) *';
        if (carpetAreaGroup) carpetAreaGroup.style.display = 'none';
        if (bedroomsGroup) bedroomsGroup.style.display = 'none';
        if (bathroomsGroup) bathroomsGroup.style.display = 'none';
        if (floorNoGroup) floorNoGroup.style.display = 'none';
        if (totalFloorsGroup) totalFloorsGroup.style.display = 'none';
        if (nextRow) nextRow.style.display = 'none';
    } else if (propType === 'Commercial' || propType === 'Office') {
        if (builtUpLabel) builtUpLabel.innerText = 'Built-up Area (sqft) *';
        if (carpetAreaGroup) carpetAreaGroup.style.display = 'block';
        if (bedroomsGroup) bedroomsGroup.style.display = 'none';
        if (bathroomsGroup) {
            bathroomsGroup.style.display = 'block';
            if (bathroomsLabel) bathroomsLabel.innerText = 'Washrooms';
        }
        if (floorNoGroup) floorNoGroup.style.display = 'block';
        if (totalFloorsGroup) totalFloorsGroup.style.display = 'block';
        if (nextRow) {
            nextRow.style.display = 'flex';
            const balconyWrapper = document.getElementById('edit_balcony').closest('.col-4');
            if (balconyWrapper) balconyWrapper.style.display = 'none';

            // Adjust widths of remaining items in the row
            const availWrapper = document.getElementById('edit_availability_date').closest('.col-4');
            const furnWrapper = document.getElementById('edit_furnishing_status').closest('.col-4');
            if (availWrapper) { availWrapper.className = 'col-6'; availWrapper.style.display = 'block'; }
            if (furnWrapper) { furnWrapper.className = 'col-6'; furnWrapper.style.display = 'block'; }
        }
    } else {
        if (builtUpLabel) builtUpLabel.innerText = 'Built-up Area (sqft) *';
        if (carpetAreaGroup) carpetAreaGroup.style.display = 'block';
        if (bedroomsGroup) bedroomsGroup.style.display = 'block';
        if (bathroomsGroup) {
            bathroomsGroup.style.display = 'block';
            if (bathroomsLabel) bathroomsLabel.innerText = 'Baths';
        }
        if (floorNoGroup) floorNoGroup.style.display = 'block';
        if (totalFloorsGroup) totalFloorsGroup.style.display = 'block';
        if (nextRow) {
            nextRow.style.display = 'flex';
            const balconyWrapper = document.getElementById('edit_balcony').closest('.col-4');
            if (balconyWrapper) balconyWrapper.style.display = 'block';
            const availWrapper = document.getElementById('edit_availability_date').closest('.col-4');
            const furnWrapper = document.getElementById('edit_furnishing_status').closest('.col-4');
            if (availWrapper) { availWrapper.className = 'col-4'; availWrapper.style.display = 'block'; }
            if (furnWrapper) { furnWrapper.className = 'col-4'; furnWrapper.style.display = 'block'; }
        }
    }
}

function setupEditPropertyTypeLogic() {
    const editPropType = document.getElementById('edit_property_type');
    if (editPropType) {
        editPropType.addEventListener('change', updateEditFormFields);
    }
}

async function updateEditCoordinates(query) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        if (data.length > 0) {
            const place = data[0];
            document.getElementById('edit_latitude').value = parseFloat(place.lat).toFixed(6);
            document.getElementById('edit_longitude').value = parseFloat(place.lon).toFixed(6);
            createGlobalToast("Coordinates updated for " + query, "success");
        }
    } catch (err) {
        console.error("Nominatim Error:", err);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEditMediaHandling();
    setupBlurValidation();
    setupEditPostalAPI();
    setupEditPropertyTypeLogic();

    // Prevent random enter key submission
    const editForm = document.getElementById('editPropertyForm');
    if (editForm) {
        editForm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                if (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'button') {
                    return;
                }
                e.preventDefault();
            }
        });
    }
});
