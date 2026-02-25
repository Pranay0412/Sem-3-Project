/* ==========================================================================
   ADD PROPERTY CONTROLLER
   Description: Manages the multi-step form for adding new properties.
   Author: PropertyPlus Dev Team
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let currentStep = 1;
    const totalSteps = 8;

    // Global File Stores
    let allPropertyImages = []; // Array of File objects

    // DOM Elements
    const steps = document.querySelectorAll('.ap-step-content');
    const progressBar = document.getElementById('apProgressFill');
    const stepIndicator = document.getElementById('apStepIndicator');
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    const btnCancel = document.getElementById('btnCancel');
    const btnSubmit = document.getElementById('btnSubmit');
    const form = document.getElementById('addPropertyForm');

    // Init
    updateUI();
    setupListingTypeLogic();
    setupPostalAPI();
    setupMediaHandling(); // Updated file handling
    setupMapSearch();     // Updated map + autocomplete
    setupEnterKeyPrevention();
    setupPropertyTypeLogic();

    // --- Fullscreen Media Viewer ---
    window.openFullscreenViewer = function (type, src, name) {
        const viewer = document.getElementById('fullscreenViewer');
        const content = document.getElementById('fullscreenContent');
        const info = document.getElementById('fullscreenInfo');

        if (!viewer || !content || !info) return;

        content.innerHTML = '';
        if (type === 'image') {
            const img = document.createElement('img');
            img.src = src;
            content.appendChild(img);
        } else if (type === 'video') {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            content.appendChild(video);
        }

        info.innerText = name || (type === 'image' ? 'Image Preview' : 'Video Preview');
        viewer.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    };

    window.closeFullscreenViewer = function () {
        const viewer = document.getElementById('fullscreenViewer');
        const content = document.getElementById('fullscreenContent');
        if (!viewer) return;

        viewer.classList.remove('active');
        if (content) content.innerHTML = ''; // Stop video playback
        document.body.style.overflow = ''; // Restore scroll
    };

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeFullscreenViewer();
    });

    // Close on click outside content
    const viewer = document.getElementById('fullscreenViewer');
    if (viewer) {
        viewer.addEventListener('click', (e) => {
            if (e.target === viewer) closeFullscreenViewer();
        });
    }

    // --- Enter Key Prevention ---
    function setupEnterKeyPrevention() {
        if (!form) return;
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                // Allow Enter in textareas and on buttons
                if (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'button' || target.type === 'submit') {
                    return;
                }
                e.preventDefault();
                // Optional: Trigger 'Next Step' if appropriate
                if (currentStep < totalSteps) {
                    btnNext.click();
                }
            }
        });
    }

    // --- Navigation ---
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                if (currentStep < totalSteps) {
                    currentStep++;
                    if (currentStep === totalSteps) {
                        populatePreview();
                    }
                    updateUI();
                }
            }
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateUI();
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            const cancelModal = new bootstrap.Modal(document.getElementById('cancelPropertyModal'));
            cancelModal.show();

            const confirmBtn = document.getElementById('confirmCancelBtn');
            // Remove any existing listeners to avoid multiple resets
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            newConfirmBtn.addEventListener('click', () => {
                cancelModal.hide();

                // Reset Form logic
                form.reset();
                allPropertyImages = [];
                const imgContainer = document.getElementById('imagePreviewContainer');
                if (imgContainer) imgContainer.innerHTML = '';

                // Go back to step 1
                currentStep = 1;
                updateUI();

                // Switch to Home tab
                const homeLink = document.querySelector('.pp-nav__item[onclick*="tab-home"]');
                if (homeLink) {
                    homeLink.click();
                } else {
                    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
                    document.getElementById('tab-home').style.display = 'block';
                }

                showToast('Property addition cancelled', 'info');
            });
        });
    }

    // --- Form Submission ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Loading state
            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                btnSubmit.disabled = true;
            }

            // Create formData and Append our arrays
            const formData = new FormData(form);

            // Re-append images from our custom store
            formData.delete('images'); // Clear default input value
            allPropertyImages.forEach(file => {
                formData.append('images', file);
            });

            try {
                const response = await fetch('/property/add', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    showToast('Property added successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/dashboard/seller'; // Redirect to clear state
                    }, 1500);
                } else {
                    showToast(result.message || 'Error submitting property', 'error');
                    resetSubmitBtn();
                }
            } catch (error) {
                console.error("Submission error:", error);
                showToast('An error occurred. Please try again.', 'error');
                resetSubmitBtn();
            }
        });
    }

    // Explicit click handler for the submit button as a fallback
    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            // If the form is valid and we are on the last step, trigger submission manually if needed
            // But 'type="submit"' should handle it. This just logs.
        });
    }

    function resetSubmitBtn() {
        if (btnSubmit) {
            btnSubmit.innerHTML = 'Submit Property';
            btnSubmit.disabled = false;
        }
    }

    // --- UI Helpers ---
    function updateUI() {
        steps.forEach(step => step.classList.remove('active'));
        const currentStepEl = document.querySelector(`[data-step="${currentStep}"]`);
        if (currentStepEl) currentStepEl.classList.add('active');

        const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (stepIndicator) stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;

        if (btnPrev) btnPrev.style.display = currentStep === 1 ? 'none' : 'inline-block';

        if (btnNext) {
            if (currentStep === totalSteps) {
                btnNext.style.display = 'none';
                if (btnSubmit) btnSubmit.style.display = 'inline-block';
            } else {
                btnNext.style.display = 'inline-block';
                btnNext.innerText = currentStep === totalSteps - 1 ? 'Review & Submit' : 'Next Step';
                if (btnSubmit) btnSubmit.style.display = 'none';
            }
        }
    }

    // --- Custom Toast Notification ---
    // Uses global toast if available, otherwise fallback
    function showToast(message, type = 'success') {
        if (window.createGlobalToast) {
            window.createGlobalToast(message, type);
            return;
        }

        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `pp-toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

        toast.innerHTML = `
            <i class="fas ${icon} pp-toast-icon"></i>
            <div class="pp-toast-msg">${message}</div>
        `;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // --- Validation ---
    // --- Step Validation ---
    // --- Step Validation ---
    function validateStep(step) {
        const stepEl = document.querySelector(`.ap-step-content[data-step="${step}"]`);
        if (!stepEl) return true; // Should not happen

        const inputs = stepEl.querySelectorAll('input, select, textarea');
        let valid = true;

        inputs.forEach(i => i.classList.remove('is-invalid'));

        inputs.forEach(input => {
            // Skip hidden inputs (e.g., if a section is toggled off)
            if (input.offsetParent === null) return;

            if (input.hasAttribute('required') && !input.value.trim() && input.type !== 'checkbox') {
                valid = false;
                input.classList.add('is-invalid');
            }
            if (input.type === 'checkbox' && input.hasAttribute('required') && !input.checked) {
                valid = false;
                input.classList.add('is-invalid');
            }

            // Numeric Validation: Cannot be negative
            if (input.type === 'number' && input.value !== '') {
                const val = parseFloat(input.value);
                if (val < 0) {
                    valid = false;
                    input.classList.add('is-invalid');
                    showToast(`${input.name.replace(/_/g, ' ')} cannot be negative`, 'error');
                }
            }
        });

        // Specific Step Validations
        if (step == 3) {
            const builtUpInput = stepEl.querySelector('input[name="built_up_area"]');
            const carpetInput = stepEl.querySelector('input[name="carpet_area"]');
            const floorInput = stepEl.querySelector('input[name="floor_number"]');
            const totalInput = stepEl.querySelector('input[name="total_floors"]');
            const dateInput = stepEl.querySelector('input[name="availability_date"]');

            const builtUp = parseFloat(builtUpInput.value) || 0;
            const carpet = parseFloat(carpetInput.value) || 0;
            const floorNo = parseInt(floorInput.value) || 0;
            const totalFloors = parseInt(totalInput.value) || 0;

            if (carpetInput.offsetParent !== null && carpetInput.value && carpet > builtUp) {
                showToast('Carpet area cannot be greater than Built-up area', 'error');
                return false;
            }
            if (floorInput.offsetParent !== null && floorInput.value && floorNo < 0) {
                showToast('Floor number cannot be negative', 'error');
                return false;
            }
            if (totalInput.offsetParent !== null && totalInput.value && totalFloors < 0) {
                showToast('Total floors cannot be negative', 'error');
                return false;
            }
            if (floorInput.offsetParent !== null && totalInput.offsetParent !== null && floorInput.value && totalInput.value && floorNo > totalFloors) {
                showToast('Floor number cannot be greater than Total floors', 'error');
                return false;
            }

            // Date Validation (Today or Future)
            if (dateInput && dateInput.value) {
                const selected = new Date(dateInput.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize today to start of day
                if (selected < today) {
                    showToast('Availability date cannot be in the past', 'error');
                    return false;
                }
            }
        }

        if (step == 6) {
            const mobileInput = stepEl.querySelector('input[name="seller_mobile"]');
            const emailInput = stepEl.querySelector('input[name="seller_email"]');

            // Allow optional +91 prefix followed by 10 digits
            if (mobileInput && !/^(\+91)?[0-9]{10}$/.test(mobileInput.value.trim())) {
                showToast('Please enter a valid 10-digit mobile number', 'error');
                return false;
            }
            if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
                showToast('Please enter a valid email address', 'error');
                return false;
            }
        }

        if (!valid) {
            showToast('Please fill in all required fields.', 'error');
        }
        return valid;
    }

    // --- Listing Logic ---
    function setupListingTypeLogic() {
        const sellWrapper = document.getElementById('sellPriceWrapper');
        const rentWrapper = document.getElementById('rentPriceWrapper');
        const listTypeRadios = document.querySelectorAll('input[name="listing_type"]');
        const sellInput = document.getElementById('expectedPrice');
        const rentInput = document.getElementById('rentAmount');

        if (!sellWrapper || !rentWrapper) return;

        function togglePriceFields() {
            let selectedType = 'Sale';
            listTypeRadios.forEach(r => { if (r.checked) selectedType = r.value; });

            if (selectedType === 'Sale') {
                sellWrapper.style.display = 'grid';
                rentWrapper.style.display = 'none';
                if (sellInput) sellInput.setAttribute('required', 'true');
                if (rentInput) rentInput.removeAttribute('required');
            } else if (selectedType === 'Rent') {
                sellWrapper.style.display = 'none';
                rentWrapper.style.display = 'grid';
                if (sellInput) sellInput.removeAttribute('required');
                if (rentInput) rentInput.setAttribute('required', 'true');
            } else if (selectedType === 'Both') {
                sellWrapper.style.display = 'grid';
                rentWrapper.style.display = 'grid';
                if (sellInput) sellInput.setAttribute('required', 'true');
                if (rentInput) rentInput.setAttribute('required', 'true');
            }
        }
        listTypeRadios.forEach(r => r.addEventListener('change', togglePriceFields));
        togglePriceFields();
    }

    // --- Property Type Logic (Plot/Land Specifics) ---
    function setupPropertyTypeLogic() {
        const propTypeRadios = document.querySelectorAll('input[name="property_type"]');

        function updateFormFields() {
            let selectedType = 'Apartment';
            propTypeRadios.forEach(r => { if (r.checked) selectedType = r.value; });

            const builtUpLabel = document.querySelector('label[for="built_up_area"]') || document.querySelector('input[name="built_up_area"]').previousElementSibling;
            const carpetAreaGroup = document.querySelector('input[name="carpet_area"]').closest('.ap-form-group');
            const floorNoGroup = document.querySelector('input[name="floor_number"]').closest('.ap-form-group');
            const totalFloorsGroup = document.querySelector('input[name="total_floors"]').closest('.ap-form-group');
            const availabilityGroup = document.querySelector('input[name="availability_date"]').closest('.ap-form-group');
            const furnishingGroup = document.querySelector('input[name="furnishing_status"]').closest('.ap-form-group');
            const bedroomsGroup = document.querySelector('input[name="bedrooms"]').closest('.ap-form-group');
            const bathroomsGroup = document.querySelector('input[name="bathrooms"]').closest('.ap-form-group');
            const balconyGroup = document.querySelector('input[name="balcony"]').closest('.ap-form-group');

            if (selectedType === 'Plot') {
                // Relate with Plot
                if (builtUpLabel) builtUpLabel.innerHTML = 'Plot Area (sq.ft) <span class="text-danger">*</span>';
                if (carpetAreaGroup) carpetAreaGroup.style.display = 'none';
                if (floorNoGroup) floorNoGroup.style.display = 'none';
                if (totalFloorsGroup) totalFloorsGroup.style.display = 'none';
                if (availabilityGroup) availabilityGroup.style.display = 'none';
                if (furnishingGroup) furnishingGroup.style.display = 'none';
                if (bedroomsGroup) bedroomsGroup.style.display = 'none';
                if (bathroomsGroup) bathroomsGroup.style.display = 'none';
                if (balconyGroup) balconyGroup.style.display = 'none';
            } else if (selectedType === 'Commercial' || selectedType === 'Office') {
                // Relate with Commercial/Office
                if (builtUpLabel) builtUpLabel.innerHTML = 'Built-up Area (sq.ft) <span class="text-danger">*</span>';
                if (carpetAreaGroup) carpetAreaGroup.style.display = 'block';
                if (floorNoGroup) floorNoGroup.style.display = 'block';
                if (totalFloorsGroup) totalFloorsGroup.style.display = 'block';
                if (availabilityGroup) availabilityGroup.style.display = 'block';
                if (furnishingGroup) furnishingGroup.style.display = 'block';
                if (bedroomsGroup) bedroomsGroup.style.display = 'none';
                if (bathroomsGroup) {
                    bathroomsGroup.style.display = 'block';
                    const label = bathroomsGroup.querySelector('.ap-label');
                    if (label) label.innerHTML = 'Washrooms';
                }
                if (balconyGroup) balconyGroup.style.display = 'none';
            } else {
                // Restore defaults
                if (builtUpLabel) builtUpLabel.innerHTML = 'Built-up Area (sq.ft) <span class="text-danger">*</span>';
                if (carpetAreaGroup) carpetAreaGroup.style.display = 'block';
                if (floorNoGroup) floorNoGroup.style.display = 'block';
                if (totalFloorsGroup) totalFloorsGroup.style.display = 'block';
                if (availabilityGroup) availabilityGroup.style.display = 'block';
                if (furnishingGroup) furnishingGroup.style.display = 'block';
                if (bedroomsGroup) bedroomsGroup.style.display = 'block';
                if (bathroomsGroup) {
                    bathroomsGroup.style.display = 'block';
                    const label = bathroomsGroup.querySelector('.ap-label');
                    if (label) label.innerHTML = 'Bathrooms';
                }
                if (balconyGroup) balconyGroup.style.display = 'block';
            }
        }

        propTypeRadios.forEach(r => r.addEventListener('change', updateFormFields));
        updateFormFields(); // Run on init
    }

    // --- Media Handling (Append Support) ---
    function setupMediaHandling() {
        const imageInput = document.getElementById('propImages');
        const imgContainer = document.getElementById('imagePreviewContainer');
        const videoInput = document.getElementById('propVideo');
        const videoPreview = document.getElementById('videoPreview');
        const floorPlanInput = document.getElementById('propFloorPlan');
        const floorPlanPreview = document.getElementById('floorPlanPreview');

        // Listener for click-upload images
        if (imageInput && imgContainer) {
            imageInput.addEventListener('change', (e) => {
                const newFiles = Array.from(e.target.files);
                newFiles.forEach(f => {
                    if (f.type.startsWith('image/')) {
                        allPropertyImages.push(f);
                    }
                });
                renderImagePreviews(imgContainer);
                imageInput.value = '';
            });
        }

        // Listener for click-upload video (Includes Fullscreen Support)
        if (videoInput && videoPreview) {
            videoInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    if (file.type.startsWith('video/')) {
                        const videoURL = URL.createObjectURL(file);
                        videoPreview.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                                <div style="width: 60px; height: 40px; background: var(--accent); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="openFullscreenViewer('video', '${videoURL}', '${file.name}')">
                                    <i class="fas fa-play" style="color: white; font-size: 14px;"></i>
                                </div>
                                <div style="font-size: 13px; color: var(--text);">
                                    <i class="fas fa-check-circle" style="color: #2ed573;"></i> Selected: <b>${file.name}</b>
                                    <br><span style="font-size: 11px; opacity: 0.7;">Click play icon for fullscreen</span>
                                </div>
                            </div>`;
                    } else {
                        videoPreview.innerHTML = `<span style="color: red;">Please select a valid video file</span>`;
                        videoInput.value = '';
                    }
                }
            });
        }

        // Listener for click-upload floor plan (Includes Fullscreen Support)
        if (floorPlanInput && floorPlanPreview) {
            floorPlanInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function (event) {
                            floorPlanPreview.innerHTML = `
                                <div style="position: relative; display: inline-block; cursor: pointer;" onclick="openFullscreenViewer('image', '${event.target.result}', '${file.name}')">
                                    <img src="${event.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 2px solid var(--accent);">
                                    <div style="margin-top: 5px; font-size: 12px; color: var(--accent);">
                                        <i class="fas fa-check-circle"></i> ${file.name}
                                        <br><span style="font-size: 11px; opacity: 0.7;">Click image for fullscreen</span>
                                    </div>
                                </div>
                            `;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        floorPlanPreview.innerHTML = `<span style="color: red;">Please select a valid image file</span>`;
                        floorPlanInput.value = '';
                    }
                }
            });
        }

        // Drag and drop logic
        const zones = document.querySelectorAll('.ap-upload-zone');
        zones.forEach(zone => {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                zone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
            });
            zone.addEventListener('dragover', () => zone.style.background = 'rgba(244, 91, 105, 0.1)', false);
            zone.addEventListener('dragleave', () => zone.style.background = '', false);

            zone.addEventListener('drop', (e) => {
                zone.style.background = '';
                const dt = e.dataTransfer;
                const files = Array.from(dt.files);
                const input = zone.querySelector('input');

                if (input && input.id === 'propImages') {
                    files.forEach(f => {
                        if (f.type.startsWith('image/')) allPropertyImages.push(f);
                    });
                    renderImagePreviews(imgContainer);
                } else if (input && input.id === 'propVideo') {
                    if (files[0] && files[0].type.startsWith('video/')) {
                        const file = files[0];
                        const videoURL = URL.createObjectURL(file);
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        // Trigger manual update since drop doesn't trigger change event on input automatically in all browsers
                        input.dispatchEvent(new Event('change'));
                    }
                } else if (input && input.id === 'propFloorPlan') {
                    if (files[0] && files[0].type.startsWith('image/')) {
                        const file = files[0];
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        input.files = dataTransfer.files;
                        input.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    }

    function renderImagePreviews(container) {
        container.innerHTML = '';
        allPropertyImages.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const div = document.createElement('div');
                div.className = 'ap-preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}" style="cursor: pointer;" onclick="openFullscreenViewer('image', '${e.target.result}', '${file.name}')">
                    <div class="ap-remove-img" data-idx="${index}">✕</div>
                `;
                div.querySelector('.ap-remove-img').onclick = function (event) {
                    event.stopPropagation(); // Don't trigger fullscreen
                    allPropertyImages.splice(index, 1);
                    renderImagePreviews(container); // Re-render
                };
                container.appendChild(div);
            }
            reader.readAsDataURL(file);
        });
    }

    // --- Map Search (Manual Only) ---
    function setupMapSearch() {
        const input = document.getElementById('locationSearch');
        const mapFrame = document.getElementById('mapFrame');
        const btnSearch = document.getElementById('btnSearchLoc');

        // Remove suggestions box logic if it existed
        const box = document.getElementById('locationSuggestions');
        if (box) box.style.display = 'none';

        if (btnSearch && input) {
            btnSearch.addEventListener('click', () => {
                const query = input.value.trim();
                if (!query) return;

                btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btnSearch.disabled = true;

                // Nominatim Search (Free)
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`)
                    .then(res => res.json())
                    .then(data => {
                        btnSearch.innerHTML = 'Search';
                        btnSearch.disabled = false;

                        if (data.length > 0) {
                            const place = data[0];
                            // Update Map Iframe
                            const lat = parseFloat(place.lat);
                            const lon = parseFloat(place.lon);
                            mapFrame.src = `https://maps.google.com/maps?q=${lat},${lon}&hl=es;z=14&output=embed`;

                            // Update Hidden Fields
                            document.getElementById("lat").value = lat.toFixed(6);
                            document.getElementById("lng").value = lon.toFixed(6);

                            showToast('Location found on map', 'success');
                        } else {
                            showToast('Location not found. Try a broader search.', 'error');
                        }
                    })
                    .catch(e => {
                        console.error(e);
                        btnSearch.innerText = 'Search';
                        btnSearch.disabled = false;
                        showToast('Error searching location', 'error');
                    });
            });
        }
    }

    // --- Postal API ---
    function setupPostalAPI() {
        const areaInput = document.getElementById('area');
        const suggestionsBox = document.getElementById('areaSuggestions');
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
                                d.style.padding = '10px'; d.style.cursor = 'pointer';
                                d.style.borderBottom = '1px solid #eee';
                                d.innerHTML = `<b>${p.Name}</b>, ${p.District}`;
                                d.onclick = () => {
                                    areaInput.value = p.Name;
                                    document.getElementById('city').value = p.District;
                                    document.getElementById('state').value = p.State;
                                    document.getElementById('pincode').value = p.Pincode;
                                    suggestionsBox.style.display = 'none';
                                };
                                suggestionsBox.appendChild(d);
                            });
                            suggestionsBox.style.display = 'block';
                        }
                    } catch (e) { }
                }, 400);
            });
            document.addEventListener('click', e => { if (!areaInput.contains(e.target)) suggestionsBox.style.display = 'none'; });
        }
    }

    // --- Detailed Preview (Professional Layout) ---
    function populatePreview() {
        const previewHost = document.getElementById('previewContainer');
        if (!previewHost) return;

        const f = new FormData(document.getElementById('addPropertyForm'));

        // Helper to safely get values - Return NULL if empty so we can skip rows
        const getVal = (name) => {
            const v = f.get(name);
            return (v && v.trim() !== '') ? v : null;
        };

        // Date Formatter (YYYY-MM-DD -> DD-MM-YYYY)
        const formatDate = (dateStr) => {
            if (!dateStr) return null;
            const [y, m, d] = dateStr.split('-');
            return `${d}-${m}-${y}`;
        };

        // --- Template Generators ---
        const createSection = (title, content, fullWidth = false) => `
            <div class="ap-preview-section">
                <div class="ap-preview-header">${title}</div>
                <div class="ap-preview-content ${fullWidth ? 'full-width' : ''}">
                    ${content}
                </div>
            </div>`;

        // Updated createRow: Returns empty string if value is null
        const createRow = (label, value, fullWidth = false) => {
            if (value === null || value === undefined || value === '') return '';
            return `
            <div class="ap-preview-row ${fullWidth ? 'full-width' : ''}">
                <span class="ap-preview-label">${label}</span>
                <span class="ap-preview-value">${value}</span>
            </div>`;
        };

        // 1. Basic Info
        const basicContent =
            createRow('Title', getVal('title')) +
            createRow('Type', getVal('category')) +
            createRow('Category', getVal('property_type')) +
            createRow('Listing Type', getVal('listing_type')) +
            createRow('Description', getVal('description'), true) +
            createRow('Highlights', getVal('highlights'), true);

        // 2. Location
        const locContent = `
            <div class="ap-preview-row full-width">
                <span class="ap-preview-label">Full Address</span>
                <span class="ap-preview-value">
                    ${getVal('house_no') ? '<b>' + getVal('house_no') + '</b>, ' : ''}
                    ${getVal('address1') ? getVal('address1') + '<br>' : ''}
                    ${getVal('landmark') ? 'Near ' + getVal('landmark') + ', ' : ''}
                    ${getVal('area') ? getVal('area') + ', ' : ''} ${getVal('city') || ''}<br>
                    ${getVal('state') || ''} ${getVal('pincode') ? '- ' + getVal('pincode') : ''}
                </span>
            </div>
            ${createRow('Coordinates', getVal('latitude') ? `${getVal('latitude')}, ${getVal('longitude')}` : null, true)}`;

        // 3. Specifications
        const propType = getVal('property_type');
        const isCommOrOffice = (propType === 'Commercial' || propType === 'Office');
        const specsContent =
            createRow(propType === 'Plot' ? 'Plot Area' : 'Built-up Area', getVal('built_up_area') ? `${getVal('built_up_area')} sq.ft` : null) +
            (propType !== 'Plot' ? createRow('Carpet Area', getVal('carpet_area') ? `${getVal('carpet_area')} sq.ft` : null) : '') +
            (propType !== 'Plot' && !isCommOrOffice ? createRow('Bedrooms', getVal('bedrooms')) : '') +
            (propType !== 'Plot' ? createRow(isCommOrOffice ? 'Washrooms' : 'Bathrooms', getVal('bathrooms')) : '') +
            (propType !== 'Plot' && !isCommOrOffice ? createRow('Balcony', getVal('balcony') === 'true' ? 'Yes' : 'No') : '') +
            (propType !== 'Plot' ? createRow('Floor', (getVal('floor_number') && getVal('total_floors')) ? `${getVal('floor_number')} of ${getVal('total_floors')}` : null) : '') +
            (propType !== 'Plot' ? createRow('Furnishing', getVal('furnishing_status')) : '') +
            (propType !== 'Plot' ? createRow('Available From', formatDate(getVal('availability_date'))) : '');

        // 4. Financials
        let priceDisp = '';
        if (getVal('listing_type') === 'Sale' || getVal('listing_type') === 'Both') {
            if (getVal('expected_price')) priceDisp += `₹${getVal('expected_price')} (Sale) `;
        }
        if (getVal('listing_type') === 'Rent' || getVal('listing_type') === 'Both') {
            if (getVal('rent_amount')) priceDisp += `₹${getVal('rent_amount')} (Rent) `;
        }

        // Maintenance Formatting
        let maintDisp = null;
        if (getVal('maintenance_charges')) {
            maintDisp = `₹${getVal('maintenance_charges')}`;
            if (getVal('maintenance_period')) maintDisp += ` (${getVal('maintenance_period')})`;
        }

        const finContent =
            createRow('Price / Rent', priceDisp || null) +
            createRow('Maintenance', maintDisp) +
            createRow('Token Amount', getVal('token_amount') ? `₹${getVal('token_amount')}` : null) +
            createRow('Security Deposit', getVal('security_deposit') ? `₹${getVal('security_deposit')}` : null) +
            createRow('Ownership', getVal('ownership_type')) +
            createRow('Negotiable', f.get('is_negotiable') ? 'Yes' : 'No');

        // 5. Amenities (Hide if empty)
        const amenities = [];
        document.querySelectorAll('input[name="amenities"]:checked').forEach(c => amenities.push(c.value));
        let amSection = '';
        if (amenities.length > 0) {
            const amContent = `<div class="ap-preview-row full-width">${amenities.map(a => `<span class="ap-tag">${a}</span>`).join('')}</div>`;
            amSection = createSection('Amenities', amContent, true);
        }

        // 6. Media - Enhanced to show Photos, Video, and Floor Plan
        let mediaContent = '<div class="ap-preview-row full-width"><span class="text-muted">No media selected</span></div>';

        // Get video and floor plan files
        const videoInput = document.getElementById('propVideo');
        const floorPlanInput = document.getElementById('propFloorPlan');
        const videoFile = videoInput && videoInput.files && videoInput.files[0] ? videoInput.files[0] : null;
        const floorPlanFile = floorPlanInput && floorPlanInput.files && floorPlanInput.files[0] ? floorPlanInput.files[0] : null;

        // Debug logging
        console.log('Preview Debug:', {
            videoInput: videoInput,
            videoFiles: videoInput ? videoInput.files : null,
            videoFile: videoFile,
            floorPlanInput: floorPlanInput,
            floorPlanFiles: floorPlanInput ? floorPlanInput.files : null,
            floorPlanFile: floorPlanFile,
            imagesCount: allPropertyImages.length
        });

        // Check if any media exists
        if (allPropertyImages.length > 0 || videoFile || floorPlanFile) {
            let mediaItems = '';

            // Photos Section
            if (allPropertyImages.length > 0) {
                mediaItems += `
                    <div class="ap-preview-row full-width" style="border-bottom: 1px solid var(--border);">
                        <span class="ap-preview-label" style="margin-bottom: 12px;">
                            <i class="fas fa-camera" style="margin-right: 5px;"></i>Photos (${allPropertyImages.length})
                        </span>
                        <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:10px;">
                            ${allPropertyImages.map(file => {
                    const url = URL.createObjectURL(file);
                    return `
                                <div style="min-width:100px; height:100px; border-radius:8px; overflow:hidden; border:2px solid var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer;" onclick="openFullscreenViewer('image', '${url}', '${file.name}')">
                                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                                </div>`;
                }).join('')}
                        </div>
                    </div>
                `;
            }

            // Video Section
            if (videoFile) {
                const videoURL = URL.createObjectURL(videoFile);
                mediaItems += `
                    <div class="ap-preview-row full-width" style="border-bottom: 1px solid var(--border);">
                        <span class="ap-preview-label" style="margin-bottom: 12px;">
                            <i class="fas fa-video" style="margin-right: 5px;"></i>Property Video
                        </span>
                        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(244, 91, 105, 0.05); border-radius: 8px; border: 1px solid rgba(244, 91, 105, 0.2); cursor: pointer;" onclick="openFullscreenViewer('video', '${videoURL}', '${videoFile.name}')">
                            <div style="width: 120px; height: 80px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i class="fas fa-play-circle" style="font-size: 32px; color: white; opacity: 0.9;"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${videoFile.name}
                                </div>
                                <div style="font-size: 12px; color: var(--muted);">
                                    ${(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                                    <br><span style="font-size: 11px; color: var(--accent); opacity: 0.8;">Click to play fullscreen</span>
                                </div>
                            </div>
                            <i class="fas fa-check-circle" style="color: #2ed573; font-size: 24px;"></i>
                        </div>
                    </div>
                `;
            }

            // Floor Plan Section
            if (floorPlanFile) {
                const floorPlanURL = URL.createObjectURL(floorPlanFile);
                mediaItems += `
                    <div class="ap-preview-row full-width">
                        <span class="ap-preview-label" style="margin-bottom: 12px;">
                            <i class="fas fa-ruler-combined" style="margin-right: 5px;"></i>Floor Plan
                        </span>
                        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(244, 91, 105, 0.05); border-radius: 8px; border: 1px solid rgba(244, 91, 105, 0.2); cursor: pointer;" onclick="openFullscreenViewer('image', '${floorPlanURL}', '${floorPlanFile.name}')">
                            <div style="width: 120px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid var(--accent); flex-shrink: 0;">
                                <img src="${floorPlanURL}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${floorPlanFile.name}
                                </div>
                                <div style="font-size: 12px; color: var(--muted);">
                                    ${(floorPlanFile.size / 1024).toFixed(2)} KB
                                    <br><span style="font-size: 11px; color: var(--accent); opacity: 0.8;">Click to view fullscreen</span>
                                </div>
                            </div>
                            <i class="fas fa-check-circle" style="color: #2ed573; font-size: 24px;"></i>
                        </div>
                    </div>
                `;
            }

            mediaContent = mediaItems;
        }

        // 7. Seller Details
        const sellerContent =
            createRow('Name', getVal('seller_name')) +
            createRow('Role', getVal('seller_role')) +
            createRow('Mobile', getVal('seller_mobile')) +
            createRow('Email', getVal('seller_email'));

        // Assemble sections directly
        previewHost.innerHTML =
            createSection('Basic Details', basicContent) +
            createSection('Location', locContent) +
            createSection('Property Specifications', specsContent) +
            createSection('Financials', finContent) +
            amSection +
            createSection('Property Media', mediaContent, true) +
            createSection('Seller Info', sellerContent);
    }
});
