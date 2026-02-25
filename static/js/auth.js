/* ==========================================================================
   AUTH & REGISTRATION CONTROLLER
   Description: Handles validation, API calls, and UI interactions for Auth.
   Author: PropertyPlus Dev Team
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  setupValidation();
});

/* ==========================================================================
   MODULE 1: VALIDATION LOGIC & LISTENERS
   ========================================================================== */
function setupValidation() {

  // --- Helper: Lock/Unlock Buttons based on validity ---
  function attachListeners(inputs, buttonId, validatorFn) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    // Initial State: Locked
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "not-allowed";

    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        ["input", "change", "keyup"].forEach((evt) => {
          el.addEventListener(evt, () => {
            const isValid = validatorFn();
            btn.disabled = !isValid;
            btn.style.opacity = isValid ? "1" : "0.6";
            btn.style.cursor = isValid ? "pointer" : "not-allowed";

            // Hide generic error text on typing (Except for username which has its own real-time logic)
            if (id !== "username" && id !== "dob" && id !== "whatsapp") {
              const errorSmall = el.parentNode.querySelector("small");
              if (errorSmall) errorSmall.style.display = "none";
            }
          });
        });
      }
    });
  }

  // 1. SIGNUP STEP 1: EMAIL
  attachListeners(["email"], "btn-get-otp", () => {
    const email = document.getElementById("email").value;
    return validateEmailFormat(email);
  });

  // 2. SIGNUP STEP 2: OTP (simple 6-box logic)
  var verifyBtn = document.getElementById("btn-verify-otp");
  var otpDigits = document.querySelectorAll("#otp-step .otp-digit");

  function otpComplete() {
    if (!otpDigits || otpDigits.length !== 6) return false;
    for (var i = 0; i < otpDigits.length; i++) {
      if (!otpDigits[i].value || otpDigits[i].value.length !== 1) return false;
    }
    return true;
  }

  function updateOtpButton() {
    if (!verifyBtn || !otpDigits || !otpDigits.length) return;
    var ok = otpComplete();
    verifyBtn.disabled = !ok;
    verifyBtn.style.opacity = ok ? "1" : "0.6";
    verifyBtn.style.cursor = ok ? "pointer" : "not-allowed";
  }

  function cleanOneDigit(value) {
    if (!value) return "";
    value = value.replace(/[^0-9]/g, "");
    return value.substring(0, 1);
  }

  function resetOtpState(el) {
    if (!el) return;
    el.classList.remove("is-green");
    el.classList.remove("is-red");
  }

  function handleOtpInput(e) {
    var input = e.target;
    var idx = parseInt(input.getAttribute("data-otp-index"), 10);

    resetOtpState(input);

    input.value = cleanOneDigit(input.value);
    input.classList.toggle("filled", !!input.value);

    if (input.value && idx < otpDigits.length - 1) {
      otpDigits[idx + 1].focus();
    }

    updateOtpButton();
    if (otpComplete()) verifyOTP();
  }

  function handleOtpKeydown(e) {
    var input = e.target;
    var idx = parseInt(input.getAttribute("data-otp-index"), 10);

    // Block non-digit keys
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === "Backspace" && !input.value && idx > 0) {
      e.preventDefault();
      otpDigits[idx - 1].focus();
    }
  }

  if (otpDigits && otpDigits.length) {
    // add indexes and listeners
    for (var i = 0; i < otpDigits.length; i++) {
      otpDigits[i].setAttribute("data-otp-index", i);
      otpDigits[i].addEventListener("input", handleOtpInput);
      otpDigits[i].addEventListener("keydown", handleOtpKeydown);
    }
    // Paste support: allow pasting "123456" into any box
    var otpRow = document.querySelector("#otp-step .otp-row");
    if (otpRow) {
      otpRow.addEventListener("paste", function (e) {
        var text = (e.clipboardData || window.clipboardData || {}).getData
          ? (e.clipboardData || window.clipboardData).getData("text")
          : "";
        if (!text) return;
        var digits = text.replace(/[^0-9]/g, "").slice(0, 6);
        if (!digits) return;

        e.preventDefault();
        for (var j = 0; j < otpDigits.length; j++) {
          otpDigits[j].value = digits[j] || "";
          otpDigits[j].classList.toggle("filled", !!otpDigits[j].value);
          resetOtpState(otpDigits[j]);
        }
        updateOtpButton();
        if (otpComplete()) {
          verifyOTP();
        } else {
          // focus first empty
          for (var k = 0; k < otpDigits.length; k++) {
            if (!otpDigits[k].value) {
              otpDigits[k].focus();
              break;
            }
          }
        }
      });
    }

    updateOtpButton();
    otpDigits[0].focus();
  }

  // 3. SIGNUP STEP 3: USER DETAILS (Username, Password, Confirm)
  const passInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const userInput = document.getElementById("username");
  const usernameError = document.getElementById("usernameError");
  const matchError = document.getElementById("passwordMatchError");

  let isUsernameUnique = false; // Flag to track API result

  // --- Feature: Real-time Username Check with Debounce ---
  let usernameTimeout;
  if (userInput) {
    userInput.addEventListener('input', function () {
      const val = this.value;

      // Clear previous timeout
      clearTimeout(usernameTimeout);

      // Reset state if too short
      if (val.length < 3) {
        this.classList.remove('is-green');
        this.classList.add('is-red');
        if (usernameError) {
          usernameError.classList.remove('text-success');
          usernameError.classList.add('text-danger');
          usernameError.innerText = "Min 3 chars required";
          usernameError.style.color = "#ff3333";
          usernameError.style.display = "block";
        }
        isUsernameUnique = false;
        // Re-validate button state
        passInput.dispatchEvent(new Event('input'));
        return;
      }

      // Show "Checking..." state
      if (usernameError) {
        usernameError.innerText = "Checking availability...";
        usernameError.style.color = "var(--auth-subtext-color)";
        usernameError.style.display = "block";
      }

      // Debounce API call
      usernameTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: val })
          });

          const data = await response.json();

          if (data.exists) {
            // TAKEN
            userInput.classList.remove('is-green');
            userInput.classList.add('is-red');
            if (usernameError) {
              usernameError.classList.remove('text-success');
              usernameError.classList.add('text-danger');
              usernameError.innerText = "Username is taken!";
              usernameError.style.color = "#ff3333";
              usernameError.style.display = "block";
            }
            isUsernameUnique = false;
          } else {
            // AVAILABLE / VALID
            userInput.classList.remove('is-red');
            userInput.classList.add('is-green');
            if (usernameError) {
              usernameError.classList.remove('text-danger');
              usernameError.classList.add('text-success');
              usernameError.innerText = "Username is valid";
              usernameError.style.color = "#2dce89";
              usernameError.style.display = "block";
            }
            isUsernameUnique = true;
          }
          // Trigger button re-validation
          passInput.dispatchEvent(new Event('input'));
        } catch (err) {
          console.error("Username check failed", err);
        }
      }, 400); // 400ms debounce
    });
  }

  // --- Helper: Password Match Logic ---
  function checkPasswords() {
    const p = passInput.value;
    const cp = confirmInput.value;

    if (cp.length === 0) {
      confirmInput.classList.remove('is-green', 'is-red');
      if (matchError) matchError.style.display = 'none';
      confirmInput.setCustomValidity("");
      return;
    }

    if (p === cp) {
      confirmInput.classList.add('is-green');
      confirmInput.classList.remove('is-red');
      if (matchError) matchError.style.display = 'none';
      confirmInput.setCustomValidity("");
    } else {
      confirmInput.classList.add('is-red');
      confirmInput.classList.remove('is-green');
      if (matchError) matchError.style.display = 'block';
      confirmInput.setCustomValidity("Passwords do not match");
    }
  }

  // Attach Password Listeners
  if (passInput) {
    passInput.addEventListener("keyup", () => {
      checkStrength(passInput.value);
      if (confirmInput.value.length > 0) checkPasswords();
    });
  }
  if (confirmInput) {
    confirmInput.addEventListener("keyup", checkPasswords);
    confirmInput.addEventListener("input", checkPasswords);
  }

  // Prevent Copy-Paste on Password fields
  [passInput, confirmInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('copy', e => e.preventDefault());
      inp.addEventListener('paste', e => e.preventDefault());
      inp.addEventListener('contextmenu', e => e.preventDefault());
    }
  });

  // Unlock Step 3 Button
  // Button unlocks ONLY if username is unique AND password is valid
  attachListeners(["username", "password", "confirmPassword"], "btn-step1-next", () => {
    const p = passInput.value;
    const cp = confirmInput.value;

    const isStrong = checkStrength(p);
    const isMatch = p === cp && cp.length > 0;

    return isUsernameUnique && isStrong && isMatch;
  });

  // 4. SIGNUP STEP 2: CONTACT & NAMES
  // We check Contact Number (10 digits) AND First Name AND Last Name
  const whatsappInput = document.getElementById("whatsapp");
  const whatsappError = document.getElementById("whatsappError");

  if (whatsappInput) {
    whatsappInput.addEventListener("blur", function () {
      const val = this.value;
      if (val.length > 0 && val.length !== 10) {
        this.classList.remove("is-green");
        // Trigger shake
        this.classList.remove("is-red");
        void this.offsetWidth; // force reflow
        this.classList.add("is-red");

        if (whatsappError) {
          whatsappError.innerText = "Please enter a valid 10-digit mobile number";
          whatsappError.style.display = "block";
          whatsappError.style.color = "#ff3333";
        }
      } else if (val.length === 10) {
        this.classList.remove("is-red");
        this.classList.add("is-green");
        if (whatsappError) whatsappError.style.display = "none";
      } else {
        this.classList.remove("is-green", "is-red");
        if (whatsappError) whatsappError.style.display = "none";
      }
    });
  }

  attachListeners(["whatsapp", "firstName", "lastName"], "btn-step2-next", () => {
    const w = document.getElementById("whatsapp").value;
    const fName = document.getElementById("firstName").value;
    const lName = document.getElementById("lastName").value;

    // Check 10 digits for contact
    const isNumValid = w.length === 10 && !isNaN(w);
    // Check names are not empty
    const isNamesValid = fName.trim().length > 0 && lName.trim().length > 0;

    return isNumValid && isNamesValid;
  });

  // 5. SIGNUP STEP 3: FINAL DETAILS (Gender & Role & Location & DOB)
  const dobInput = document.getElementById("dob");
  const dobError = document.getElementById("dobError");

  const finalInputs = ["gender", "state", "city", "dob"];
  attachListeners(finalInputs, "btn-create-account", () => {
    const g = document.getElementById("gender")?.value;
    const s = document.getElementById("state")?.value;
    const c = document.getElementById("city")?.value;
    const d = document.getElementById("dob")?.value;
    const role = document.querySelector('input[name="role"]:checked');

    let isAgeVal = false;
    if (d) {
      const bDate = new Date(d);
      const today = new Date();
      let age = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
      isAgeVal = age >= 18;
    }

    return !!g && !!s && !!c && !!d && !!role && isAgeVal;
  });

  // Specific DOB Visual Validation (18+ check)
  if (dobInput) {
    dobInput.addEventListener("change", function () {
      if (!this.value) {
        this.classList.remove("is-green", "is-red");
        if (dobError) dobError.style.display = "none";
        return;
      }

      const bDate = new Date(this.value);
      const today = new Date();
      let age = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;

      if (age < 18) {
        this.classList.remove("is-green");
        // Trigger shake by removing and re-adding is-red
        this.classList.remove("is-red");
        void this.offsetWidth; // force reflow
        this.classList.add("is-red");

        if (dobError) {
          dobError.innerText = "You must be 18+ years old";
          dobError.style.display = "block";
          dobError.style.color = "#ff3333";
        }
      } else {
        this.classList.remove("is-red");
        this.classList.add("is-green");
        if (dobError) {
          dobError.innerText = "";
          dobError.style.display = "none";
        }
      }
    });
  }

  // 6. LOGIN PAGE (Username OR Email)
  attachListeners(["login-user", "login-pass"], "btn-login", () => {
    const u = document.getElementById("login-user").value;
    const p = document.getElementById("login-pass").value;
    return u.length > 0 && p.length > 0;
  });

  // Universal Dropdown Coloring (Gender, State, City)
  ['gender', 'state', 'city'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', function () {
        if (this.value && this.value !== "") {
          this.classList.add('is-green');
          this.classList.remove('is-red');
        } else {
          this.classList.remove('is-green');
        }
      });
    }
  });

  // --- NEW: State -> City Logic ---
  const stateSelect = document.getElementById("state");
  const citySelect = document.getElementById("city");

  if (stateSelect && citySelect) {
    stateSelect.addEventListener("change", async function() {
      const state = this.value;
      if (!state) return;

      // 1. Clear & Disable City
      citySelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
      citySelect.disabled = true;
      citySelect.classList.remove("is-green");

      try {
        // 2. Fetch Cities
        const res = await fetch(`/api/cities/${state}`);
        const cities = await res.json();

        // 3. Populate
        let html = '<option value="" disabled selected></option>';
        cities.forEach(city => {
          html += `<option value="${city}">${city}</option>`;
        });
        citySelect.innerHTML = html;
        citySelect.disabled = false;

        // Trigger validation if needed
        citySelect.focus();
      } catch (err) {
        console.error("Error fetching cities:", err);
        citySelect.innerHTML = '<option value="" disabled selected>Error loading cities</option>';
      }
    });
  }

  // --- RADIO BUTTON TRIGGER (NO LOCATION DEPENDENCY) ---
  const roleRadios = document.querySelectorAll('input[name="role"]');
  roleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      // Trigger validation check
      const genderInput = document.getElementById("gender");
      if (genderInput) {
        genderInput.dispatchEvent(new Event('change'));
      }
    });
  });

}

/* ==========================================================================
   MODULE 2: API ACTIONS & UTILITIES
   ========================================================================== */

// --- UTILS ---
function validateEmailFormat(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];

  if (name.length <= 2) return `${name[0] || ""}***@${domain}`;
  const first = name.slice(0, 2);
  const last = name.slice(-1);
  return `${first}***${last}@${domain}`;
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = message;
    el.style.display = "block";
    el.style.color = "#ff3333";
    el.classList.remove('text-success');
    el.classList.add('text-danger');
  }
}

function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = "";
    el.style.display = "none";
  }
}

function checkStrength(p) {
  const hasLen = p.length >= 8;
  const hasNum = /\d/.test(p);
  const hasSpec = /[!@#$%^&*(),.?":{}|<>]/.test(p);

  const lenEl = document.getElementById("crit-len");
  const numEl = document.getElementById("crit-num");
  const specEl = document.getElementById("crit-spec");

  if (lenEl) { lenEl.innerText = hasLen ? "✅ 8+ Chars" : "❌ 8+ Chars"; lenEl.style.color = hasLen ? "#2dce89" : "#ff3333"; }
  if (numEl) { numEl.innerText = hasNum ? "✅ Number" : "❌ Number"; numEl.style.color = hasNum ? "#2dce89" : "#ff3333"; }
  if (specEl) { specEl.innerText = hasSpec ? "✅ Special" : "❌ Special"; specEl.style.color = hasSpec ? "#2dce89" : "#ff3333"; }

  return hasLen && hasNum && hasSpec;
}

// --- SEND OTP ---
async function sendOTP() {
  const email = document.getElementById("email").value;
  const btn = document.getElementById("btn-get-otp");

  if (!validateEmailFormat(email)) {
    return showError("emailError", "Please enter a valid email address");
  }

  btn.innerText = "Checking...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("email-step").style.display = "none";
      document.getElementById("otp-step").style.display = "block";
      const maskedEl = document.getElementById("masked-email");
      if (maskedEl) maskedEl.innerText = maskEmail(email);
      startResendTimer();
    } else {
      showError("emailError", data.message || "Error sending OTP");
      btn.innerText = "Get OTP";
      btn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    btn.innerText = "Get OTP";
    btn.disabled = false;
    showError("emailError", "Server connection failed.");
  }
}

// --- VERIFY OTP ---
async function verifyOTP() {
  const otpBoxes = Array.from(document.querySelectorAll('#otp-step .otp-digit'));
  const otp = otpBoxes.length ? otpBoxes.map(i => (i.value || "")).join("") : (document.getElementById("otp")?.value || "");

  // Basic client-side check before API
  if (otp.length !== 6) return;

  try {
    const res = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otp }),
    });
    const data = await res.json();

    if (data.success) {
      // Logical UI: show green only when OTP is actually verified by server
      if (otpBoxes.length) {
        otpBoxes.forEach(el => {
          el.classList.remove("is-red");
          el.classList.add("is-green");
        });
      }

      // Small delay so user sees the success state before moving on
      setTimeout(() => {
        document.getElementById("otp-step").style.display = "none";
        document.getElementById("details-step").style.display = "block";
        document.getElementById("step1").style.display = "block";
      }, 220);
    } else {
      showError("otpError", "Invalid OTP");
      if (otpBoxes.length) {
        otpBoxes.forEach(el => {
          el.classList.remove("is-green");
          el.classList.add("is-red");
        });
        otpBoxes[0]?.focus?.();
      }
    }
  } catch (e) {
    console.error(e);
    showError("otpError", "Verification failed");
    if (otpBoxes.length) {
      otpBoxes.forEach(el => {
        el.classList.remove("is-green");
        el.classList.add("is-red");
      });
    }
  }
}

// --- NAVIGATION HELPERS ---
function goToStep2() {
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
}
function goToStep3() {
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "block";
}
function goToStep4() {
  document.getElementById("step3").style.display = "none";
  document.getElementById("step4").style.display = "block";

  // Set initial avatar preview in Step 4
  const fname = document.getElementById("firstName").value || "U";
  updateAvatarPreview(fname, '1f2a44');
}

    // --- UPDATE AVATAR PREVIEW ---
    // (Consolidated logic moved to initial definition)

// --- UPDATE AVATAR PREVIEW ---
function updateAvatarPreview(name, color, file = null) {
  const previewEl = document.getElementById('avatarPreview');
  if (!previewEl) return;

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewEl.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Update Display Text
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileNameDisplay) fileNameDisplay.innerText = file.name;
  } else {
    const letter = name[0] || 'U';
    previewEl.src = `https://ui-avatars.com/api/?name=${letter}&background=${color}&color=ffffff&size=256`;

    // Reset Display Text
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileNameDisplay) fileNameDisplay.innerText = "Choose Image...";
  }
}

// Global listener for file input in Step 4
document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById('profile_image');
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        updateAvatarPreview("", "", file);
      }
    });
  }

  // Color swatches interaction
  const radios = document.querySelectorAll('input[name="avatar_color"]');
  radios.forEach(r => {
    r.addEventListener('change', function () {
      // Update Preview if no file is currently selected
      const fInput = document.getElementById('profile_image');
      if (!fInput || !fInput.files.length) {
        const fname = document.getElementById("firstName").value || "U";
        updateAvatarPreview(fname, this.value);
      }
    });
  });
});

// --- REGISTER USER ---
async function createAccount() {
  const btn = document.getElementById("btn-create-account");
  const originalText = btn.innerText;

  btn.innerText = "Processing...";
  btn.disabled = true;

  try {
    const rawNumber = document.getElementById("whatsapp").value;
    const fName = document.getElementById("firstName").value.trim();
    const lName = document.getElementById("lastName").value.trim();
    const fullName = `${fName} ${lName}`;

    const formData = new FormData();
    formData.append("username", document.getElementById("username").value);
    formData.append("password", document.getElementById("password").value);
    formData.append("contact_number", "+91" + rawNumber);
    formData.append("full_name", fullName);
    formData.append("gender", document.getElementById("gender").value);
    formData.append("state", document.getElementById("state").value);
    formData.append("city", document.getElementById("city").value);
    formData.append("dob", document.getElementById("dob").value);
    formData.append("role", document.querySelector('input[name="role"]:checked')?.value);

    // Avatar/Color Logic
    const fileInput = document.getElementById("profile_image");
    if (fileInput && fileInput.files.length > 0) {
      formData.append("profile_image", fileInput.files[0]);
    }

    const colorInput = document.querySelector('input[name="avatar_color"]:checked');
    if (colorInput) {
      formData.append("avatar_color", colorInput.value);
    }

    const res = await fetch("/api/register", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      // Successful registration - redirect to appropriate dashboard
      const role = document.querySelector('input[name="role"]:checked')?.value;
      window.location.href = role === "Seller" ? "/dashboard/seller" : "/dashboard/buyer";
    } else {
      alert("Registration Failed: " + data.message);
      btn.innerText = originalText;
      btn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    alert("Connection Error. Please check your internet.");
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// --- TIMER LOGIC ---
let timerInterval;
function startResendTimer() {
  let timeLeft = 30;
  const link = document.getElementById("resend-link");
  const text = document.getElementById("timer-text");

  link.classList.add("disabled");
  link.style.cursor = "not-allowed";
  text.style.display = "inline";

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    const seconds = timeLeft < 10 ? "0" + timeLeft : timeLeft;
    text.innerText = `in 00:${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      link.classList.remove("disabled");
      link.style.cursor = "pointer";
      text.style.display = "none";
    }
  }, 1000);
}

// --- RESEND OTP ACTION ---
async function resendOTP() {
  const email = document.getElementById("email").value;
  const link = document.getElementById("resend-link");

  if (link.classList.contains("disabled")) return;

  link.innerText = "Sending...";

  try {
    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });

    link.innerText = "Resend OTP";
    startResendTimer();
  } catch (e) {
    console.error(e);
    link.innerText = "Try Again";
  }
}

// --- UI TOGGLES ---
function togglePassword(inputId, icon) {
  const id = inputId || "password";
  const input = document.getElementById(id);
  const iconEl = icon || document.querySelector(".password-toggle");

  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (iconEl) { iconEl.classList.remove("fa-eye"); iconEl.classList.add("fa-eye-slash"); }
  } else {
    input.type = "password";
    if (iconEl) { iconEl.classList.remove("fa-eye-slash"); iconEl.classList.add("fa-eye"); }
  }
}

/* ==========================================================================
   MODULE 3: FORGOT PASSWORD FUNCTIONS
   ========================================================================== */

// --- SEND FORGOT OTP ---
async function sendForgotOTP() {
  const email = document.getElementById("forgot-email").value;
  const btn = document.getElementById("btn-send-forgot-otp");

  if (!validateEmailFormat(email)) {
    return showError("forgotEmailError", "Please enter a valid email address");
  }

  btn.innerText = "Checking...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/send-forgot-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("forgot-email-step").style.display = "none";
      document.getElementById("forgot-otp-step").style.display = "block";
      const maskedEl = document.getElementById("forgot-masked-email");
      if (maskedEl) maskedEl.innerText = maskEmail(email);
      startForgotResendTimer();
    } else {
      showError("forgotEmailError", data.message || "Error sending reset code");
      btn.innerText = "Send Reset Code";
      btn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    btn.innerText = "Send Reset Code";
    btn.disabled = false;
    showError("forgotEmailError", "Server connection failed.");
  }
}

// --- VERIFY FORGOT OTP ---
async function verifyForgotOTP() {
  const otpBoxes = Array.from(document.querySelectorAll(".forgot-otp-digit"));
  const otp = otpBoxes.length ? otpBoxes.map(i => (i.value || "")).join("") : "";

  if (otp.length !== 6) return;

  try {
    const res = await fetch("/api/verify-forgot-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otp }),
    });
    const data = await res.json();

    if (data.success) {
      if (otpBoxes.length) {
        otpBoxes.forEach(el => {
          el.classList.remove("is-red");
          el.classList.add("is-green");
        });
      }

      setTimeout(() => {
        document.getElementById("forgot-otp-step").style.display = "none";
        document.getElementById("forgot-password-step").style.display = "block";
        document.getElementById("new-password").focus();
      }, 220);
    } else {
      showError("forgotOtpError", "Invalid reset code");
      if (otpBoxes.length) {
        otpBoxes.forEach(el => {
          el.classList.remove("is-green");
          el.classList.add("is-red");
        });
        otpBoxes[0]?.focus?.();
      }
    }
  } catch (e) {
    console.error(e);
    showError("forgotOtpError", "Verification failed");
    if (otpBoxes.length) {
      otpBoxes.forEach(el => {
        el.classList.remove("is-green");
        el.classList.add("is-red");
      });
    }
  }
}

// --- RESET PASSWORD ---
async function resetPassword() {
  const password = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-new-password").value;
  const btn = document.getElementById("btn-reset-password");

  if (password !== confirmPassword) {
    showError("newPasswordMatchError", "Passwords do not match");
    return;
  }

  btn.innerText = "Updating...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: password }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("forgot-password-step").style.display = "none";
      document.getElementById("forgot-success-step").style.display = "block";

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    } else {
      showError("newPasswordError", data.message || "Failed to update password");
      btn.innerText = "Update Password";
      btn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    showError("newPasswordError", "Server connection failed");
    btn.innerText = "Update Password";
    btn.disabled = false;
  }
}

// --- RESEND FORGOT OTP ---
async function resendForgotOTP() {
  const email = document.getElementById("forgot-email").value;
  const link = document.getElementById("forgot-resend-link");

  if (link.classList.contains("disabled")) return;

  link.innerText = "Sending...";

  try {
    const res = await fetch("/api/send-forgot-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });

    link.innerText = "Resend Code";
    startForgotResendTimer();
  } catch (e) {
    console.error(e);
    link.innerText = "Try Again";
  }
}

// --- FORGOT PASSWORD TIMER ---
let forgotTimerInterval;
function startForgotResendTimer() {
  let timeLeft = 30;
  const link = document.getElementById("forgot-resend-link");
  const text = document.getElementById("forgot-timer-text");

  link.classList.add("disabled");
  link.style.cursor = "not-allowed";
  text.style.display = "inline";

  clearInterval(forgotTimerInterval);

  forgotTimerInterval = setInterval(() => {
    timeLeft--;
    const seconds = timeLeft < 10 ? "0" + timeLeft : timeLeft;
    text.innerText = `in 00:${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(forgotTimerInterval);
      link.classList.remove("disabled");
      link.style.cursor = "pointer";
      text.style.display = "none";
    }
  }, 1000);
}

// --- Global "Enter Key" Support ---
document.addEventListener("DOMContentLoaded", function () {

  // 1. Select all input fields on the page
  const inputs = document.querySelectorAll("input");

  inputs.forEach(input => {
    input.addEventListener("keypress", function (event) {
      // Check if the key pressed is "Enter"
      if (event.key === "Enter") {
        event.preventDefault(); // Stop default reload if inside a form

        // 2. Determine which button to click based on the page
        let actionBtn = null;

        // Priority 1: Look for specific IDs (Best for Auth pages)
        if (document.getElementById("btn-login")) {
          actionBtn = document.getElementById("btn-login");
        } else if (document.getElementById("btn-signup")) {
          actionBtn = document.getElementById("btn-signup");
        } else if (document.getElementById("btn-verify")) {
          actionBtn = document.getElementById("btn-verify");
        } else if (document.getElementById("btn-forgot")) {
          actionBtn = document.getElementById("btn-forgot");
        }
        // Priority 2: Fallback to the first primary button found
        else {
          actionBtn = document.querySelector(".btn-primary");
        }

        // 3. Click the button if found
        if (actionBtn) {
          actionBtn.click();
        }
      }
    });
  });
});
