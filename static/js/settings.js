/* ==========================================================================
   SETTINGS & PROFILE CONTROLLER
   Description: Handles user profile updates, password management, and 2FA.
   Author: PropertyPlus Dev Team
   ========================================================================== */

// settings.js

// --- CONFIG & STATE ---
const TIMER_SECONDS = 30;
let cooldowns = {
    pwd: 0,
    twofa: 0,
    del: 0
};

/**
 * INITIALIZATION
 * Sets up OTP groups and binds password validation listeners.
 */
function initSettings() {
    // 1. Setup OTP Groups with auto-forward, auto-submit and explicit verify buttons
    setupOtpGroup('pwd-otp-digit', 'pwdOtpError', showPwdFormStep, 'btn-verify-pwd-otp');
    setupOtpGroup('otp-digit-2fa', 'twoFaOtpError', confirm2FAToggleStep1, 'btn-verify-2fa-otp');
    setupOtpGroup('delete-otp-digit', 'deleteOtpError', verifyAndDeleteAccountStep1, 'btn-verify-del-otp');

    // 2. Password Validation (bind when available)
    bindPwdValidation(false);
}

// Ensure initialization on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettings);
    // 3. Bind Enter Keys for Modals
    // Password Change Flow
    const oldPwdInput = document.getElementById('oldPwdInput');
    if (oldPwdInput) {
        oldPwdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') verifyOldPasswordAndNext();
        });
    }
    const newPwdInput = document.getElementById('newPwdInput');
    const confirmPwdInput = document.getElementById('confirmPwdInput');
    const btnFinishPwd = document.getElementById('btn-finish-pwd-update');
    // For new password inputs, trigger ONLY if valid
    [newPwdInput, confirmPwdInput].forEach(inp => {
        if (inp) {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!btnFinishPwd.disabled) btnFinishPwd.click();
                }
            });
        }
    });

    // 2FA Flow
    const twoFaPwdInput = document.getElementById('twoFaPwdInput');
    if (twoFaPwdInput) {
        twoFaPwdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm2FAToggle();
            }
        });
    }

    // Account Deletion Flow
    const delPwdInput = document.getElementById('deletePwdInput');
    if (delPwdInput) {
        delPwdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyAndDeleteAccount();
            }
        });
    }
} else {
    initSettings();
}

/**
 * OTP HELPERS
 * Handles numerical input, auto-focus, backspace logic, and paste events.
 */
function setupOtpGroup(className, errorId, onComplete = null, btnId = null) {
    const digits = document.querySelectorAll(`.${className}`);
    const errorEl = document.getElementById(errorId);
    const verifyBtn = btnId ? document.getElementById(btnId) : null;

    function updateButtonState() {
        if (!verifyBtn) return;
        const fullOtp = Array.from(digits).map(input => input.value).join('');
        const isComplete = fullOtp.length === 6;
        verifyBtn.disabled = !isComplete;
        verifyBtn.style.opacity = isComplete ? "1" : "0.6";
        verifyBtn.style.cursor = isComplete ? "pointer" : "not-allowed";
    }

    digits.forEach((d, idx) => {
        // Handle numerical digit input
        d.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = val.slice(0, 1);
            e.target.classList.toggle('filled', !!e.target.value);
            e.target.classList.remove('is-red', 'is-green');

            if (errorEl) errorEl.style.display = 'none';

            // Move to next field
            if (e.target.value && idx < digits.length - 1) {
                digits[idx + 1].focus();
            }

            updateButtonState();

            // Auto-trigger on complete (all 6 digits entered)
            const fullOtp = Array.from(digits).map(input => input.value).join('');
            if (fullOtp.length === 6 && onComplete) {
                onComplete();
            }
        });

        // Handle backspace navigation
        d.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                digits[idx - 1].focus();
            }
        });

        // Handle pasting of full 6-digit codes
        d.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').slice(0, 6).replace(/[^0-9]/g, '');
            data.split('').forEach((char, i) => {
                if (digits[idx + i]) {
                    digits[idx + i].value = char;
                    digits[idx + i].classList.add('filled');
                }
            });
            const lastIdx = Math.min(idx + data.length, digits.length - 1);
            digits[lastIdx].focus();

            updateButtonState();

            const fullOtp = Array.from(digits).map(input => input.value).join('');
            if (fullOtp.length === 6 && onComplete) {
                onComplete();
            }
        });
    });

    updateButtonState();
}

function getOtpValue(className) {
    return Array.from(document.querySelectorAll(`.${className}`)).map(d => d.value).join('');
}

/**
 * TIMER UTILS
 * Manages the 30-second cooldown for sending/resending OTPs.
 */
function startResendTimer(type) {
    const now = Date.now();
    cooldowns[type] = now + TIMER_SECONDS * 1000;
    updateTimerUI(type);
}

function updateTimerUI(type) {
    const btn = document.getElementById(type + 'ResendBtn');
    const disp = document.getElementById(type + 'TimerDisp');
    const count = document.getElementById(type + 'TimerCount');

    if (!btn || !disp || !count) return;

    const remaining = Math.ceil((cooldowns[type] - Date.now()) / 1000);

    if (remaining > 0) {
        btn.style.display = 'none';
        disp.style.display = 'inline';
        count.innerText = remaining;
        setTimeout(() => updateTimerUI(type), 1000);
    } else {
        btn.style.display = 'inline';
        disp.style.display = 'none';
    }
}

/**
 * API SERVICE
 * Standard POST request helper.
 */
async function postJSON(url, data) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error("Fetch error:", e);
        return { success: false, message: "Network error occurred." };
    }
}

/**
 * PASSWORD CHANGE FLOW
 * Supports two modes: OTP-based (if 2FA on) or Old Password based (if 2FA off).
 */
async function initiateChangePassword(btn) {
    if (!btn) return;
    const is2FA = document.getElementById('2faStatusBadge').innerText.trim() === 'Enabled';

    // Reset Modal States
    document.querySelectorAll('.pwd-otp-digit').forEach(i => { i.value = ""; i.classList.remove('filled', 'is-red', 'is-green'); });
    document.getElementById('oldPwdInput').value = "";
    document.getElementById('pwdOtpError').style.display = 'none';
    document.getElementById('oldPwdError').style.display = 'none';

    document.getElementById('pwd-step-verify').style.display = 'block';
    document.getElementById('pwd-step-form').style.display = 'none';
    document.getElementById('pwd-step-success').style.display = 'none';

    if (is2FA) {
        const originalText = btn.innerText;
        btn.innerText = "Sending Code...";
        btn.disabled = true;

        const res = await postJSON('/api/settings/change-password', {});
        btn.innerText = originalText;
        btn.disabled = false;

        if (res.success) {
            document.getElementById('pwd-verify-otp-view').style.display = 'block';
            document.getElementById('pwd-verify-old-view').style.display = 'none';
            startResendTimer('pwd');
        } else {
            alert(res.message);
            return;
        }
    } else {
        document.getElementById('pwd-verify-otp-view').style.display = 'none';
        document.getElementById('pwd-verify-old-view').style.display = 'block';
    }

    new bootstrap.Modal(document.getElementById('pwdOtpModal')).show();
}

/**
 * Step 1 Verification (Old Password)
 */
async function verifyOldPasswordAndNext() {
    const pwd = document.getElementById('oldPwdInput').value;
    const err = document.getElementById('oldPwdError');
    if (!pwd) { err.innerText = "Password required"; err.style.display = "block"; return; }

    const res = await postJSON('/api/settings/verify-old-pwd', { password: pwd });
    if (res.success) {
        document.getElementById('pwd-step-verify').style.display = 'none';
        document.getElementById('pwd-step-form').style.display = 'block';
        bindPwdValidation(true);
    } else {
        err.innerText = res.message || "Incorrect password";
        err.style.display = 'block';
    }
}

/**
 * Step 1 Verification (OTP)
 */
async function showPwdFormStep() {
    const otp = getOtpValue('pwd-otp-digit');
    const errorEl = document.getElementById('pwdOtpError');

    if (otp.length < 6) return;

    const res = await postJSON('/api/settings/verify-otp-only', { otp });
    if (res.success) {
        document.getElementById('pwd-step-verify').style.display = 'none';
        document.getElementById('pwd-step-form').style.display = 'block';
        bindPwdValidation(true);
    } else {
        if (errorEl) { errorEl.style.display = 'block'; }
        document.querySelectorAll('.pwd-otp-digit').forEach(d => {
            d.classList.add('is-red');
            setTimeout(() => d.classList.remove('is-red'), 2000);
        });
    }
}

/**
 * Final Password Update Confirmation
 */
async function verifyAndChangePwd() {
    const newPwd = document.getElementById('newPwdInput').value;
    const btn = document.getElementById('btn-finish-pwd-update');
    const is2FA = document.getElementById('2faStatusBadge').innerText.trim() === 'Enabled';

    if (!checkPwdMatch()) return;

    btn.disabled = true;
    btn.innerText = "Processing...";

    const payload = { new_password: newPwd };
    if (is2FA) payload.otp = getOtpValue('pwd-otp-digit');
    else payload.old_password = document.getElementById('oldPwdInput').value;

    const res = await postJSON('/api/settings/verify-pwd-final', payload);

    if (res.success) {
        document.getElementById('pwd-step-form').style.display = 'none';
        document.getElementById('pwd-step-success').style.display = 'block';
        setTimeout(() => location.reload(), 3000);
    } else {
        btn.disabled = false;
        btn.innerText = "Update Password";
        const matchError = document.getElementById("pwdMatchError");
        if (matchError) {
            matchError.innerText = res.message || "Failed to update password.";
            matchError.style.display = 'block';
        }
    }
}

/**
 * 2FA FLOW
 * Handles toggling 2FA with step-by-step verification.
 */
let pending2FAStatus = false;

function toggle2FA(checkbox) {
    pending2FAStatus = checkbox.checked;

    // Clear state
    document.getElementById('twoFaStepOtp').style.display = 'none';
    document.getElementById('twoFaStepPwd').style.display = 'none';
    document.getElementById('twoFaPwdInput').value = "";
    document.getElementById('twoFaPwdError').style.display = 'none';
    document.getElementById('twoFaOtpError').style.display = 'none';
    document.querySelectorAll('.otp-digit-2fa').forEach(i => { i.value = ""; i.classList.remove('filled', 'is-red'); });

    if (pending2FAStatus) {
        // Step 1: Pwd only for enabling
        document.getElementById('twoFaStepPwd').style.display = 'block';
    } else {
        // Step 1: OTP, then Step 2: Pwd for disabling
        document.getElementById('twoFaStepOtp').style.display = 'block';
        initiateDisable2FAOTP();
    }

    // Keep switch state unchanged until confirmed
    checkbox.checked = !pending2FAStatus;
    new bootstrap.Modal(document.getElementById('twoFaConfirmModal')).show();
}

async function initiateDisable2FAOTP() {
    const res = await postJSON('/api/settings/toggle-2fa-otp', {});
    if (res.success) {
        startResendTimer('twoFa');
    } else {
        alert(res.message);
    }
}

async function confirm2FAToggleStep1() {
    const otp = getOtpValue('otp-digit-2fa');
    if (otp.length < 6) return;

    const res = await postJSON('/api/settings/verify-2fa-otp', { otp });
    if (res.success) {
        document.getElementById('twoFaStepOtp').style.display = 'none';
        document.getElementById('twoFaStepPwd').style.display = 'block';
    } else {
        document.getElementById('twoFaOtpError').style.display = 'block';
        document.querySelectorAll('.otp-digit-2fa').forEach(d => {
            d.classList.add('is-red');
            setTimeout(() => d.classList.remove('is-red'), 2000);
        });
    }
}

async function confirm2FAToggle() {
    const pwd = document.getElementById('twoFaPwdInput').value;
    const otp = !pending2FAStatus ? getOtpValue('otp-digit-2fa') : null;
    const err = document.getElementById('twoFaPwdError');

    if (!pwd) { err.innerText = "Password required"; err.style.display = 'block'; return; }

    const res = await postJSON('/api/settings/toggle-2fa-final', {
        status: pending2FAStatus, password: pwd, otp: otp
    });

    if (res.success) {
        document.getElementById('twoFaStepPwd').style.display = 'none';
        document.getElementById('twoFaStepSuccess').style.display = 'block';
        update2FAUI(pending2FAStatus);
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('twoFaConfirmModal'));
            if (modal) modal.hide();
            // Reset for next time
            setTimeout(() => {
                document.getElementById('twoFaStepSuccess').style.display = 'none';
                document.getElementById('twoFaStepOtp').style.display = 'block';
            }, 500);
        }, 3000);
    } else {
        err.innerText = res.message || "Incorrect password";
        err.style.display = 'block';
    }
}

/**
 * Immediate UI Update for 2FA status
 */
function update2FAUI(enabled) {
    const badge = document.getElementById('2faStatusBadge');
    const switchEl = document.getElementById('switch2FA');
    const textEl = document.getElementById('switch2FAText');

    badge.className = `badge rounded-pill bg-${enabled ? 'success' : 'danger'}`;
    badge.innerText = enabled ? 'Enabled' : 'Disabled';
    switchEl.checked = enabled;
    textEl.innerText = enabled ? 'Disable' : 'Enable';

    // Keep internal persistence
    localStorage.setItem('pp_2fa_enabled', enabled ? 'true' : 'false');
}

/**
 * ACCOUNT DELETION FLOW
 * Verified with OTP then Password.
 */
async function initiateDeleteAccount(btn) {
    if (!btn) return;
    const orig = btn.innerText;
    btn.innerText = "Sending Code...";
    btn.disabled = true;

    const res = await postJSON('/api/settings/delete-account-request', {});
    btn.innerText = orig;
    btn.disabled = false;

    if (res.success) {
        document.getElementById('delStepOtp').style.display = 'block';
        document.getElementById('delStepPwd').style.display = 'none';
        document.getElementById('deleteOtpError').style.display = 'none';
        document.getElementById('deletePwdError').style.display = 'none';
        document.querySelectorAll('.delete-otp-digit').forEach(i => { i.value = ""; i.classList.remove('filled', 'is-red'); });

        startResendTimer('del');
        new bootstrap.Modal(document.getElementById('deleteAccountModal')).show();
    } else {
        alert(res.message);
    }
}

async function verifyAndDeleteAccountStep1() {
    const otp = getOtpValue('delete-otp-digit');
    if (otp.length < 6) return;

    const res = await postJSON('/api/settings/verify-otp-only-del', { otp });
    if (res.success) {
        document.getElementById('delStepOtp').style.display = 'none';
        document.getElementById('delStepPwd').style.display = 'block';
    } else {
        document.getElementById('deleteOtpError').style.display = 'block';
        document.querySelectorAll('.delete-otp-digit').forEach(d => {
            d.classList.add('is-red');
            setTimeout(() => d.classList.remove('is-red'), 2000);
        });
    }
}

async function verifyAndDeleteAccount() {
    const otp = getOtpValue('delete-otp-digit');
    const pwd = document.getElementById('deletePwdInput').value;
    const err = document.getElementById('deletePwdError');

    if (!pwd) { err.innerText = "Password required"; err.style.display = "block"; return; }

    const res = await postJSON('/api/settings/delete-account-verify', { otp, password: pwd });
    if (res.success) {
        document.getElementById('delStepPwd').style.display = 'none';
        document.getElementById('delStepSuccess').style.display = 'block';
        localStorage.clear();
        setTimeout(() => {
            window.location.href = "/";
        }, 3000);
    } else {
        err.innerText = res.message || "Incorrect password";
        err.style.display = 'block';
    }
}

/**
 * FORM VALIDATION LOGIC
 */
function bindPwdValidation(forceReset = false) {
    const npi = document.getElementById("newPwdInput");
    const cpi = document.getElementById("confirmPwdInput");
    const btn = document.getElementById("btn-finish-pwd-update");

    if (!npi || !cpi || !btn) return;

    if (forceReset) { npi.value = ""; cpi.value = ""; }

    const validate = () => { checkPwdStrength(npi.value); checkPwdMatch(); };
    ["keyup", "input"].forEach(e => {
        npi.addEventListener(e, validate);
        cpi.addEventListener(e, checkPwdMatch);
    });

    // Prevent Copy-Paste on Confirmation
    [npi, cpi].forEach(inp => {
        inp.addEventListener('copy', e => e.preventDefault());
        inp.addEventListener('paste', e => e.preventDefault());
        inp.addEventListener('contextmenu', e => e.preventDefault());
    });
}

function checkPwdStrength(p) {
    const hasLen = p.length >= 8;
    const hasNum = /\d/.test(p);
    const hasSpec = /[!@#$%^&*(),.?":{}|<>]/.test(p);

    const lenEl = document.getElementById("pwd-crit-len");
    const numEl = document.getElementById("pwd-crit-num");
    const specEl = document.getElementById("pwd-crit-spec");

    if (lenEl) { lenEl.innerHTML = hasLen ? "✅ 8+ Chars" : "❌ 8+ Chars"; lenEl.className = hasLen ? "me-2 text-success" : "me-2 text-danger"; }
    if (numEl) { numEl.innerHTML = hasNum ? "✅ Number" : "❌ Number"; numEl.className = hasNum ? "me-2 text-success" : "me-2 text-danger"; }
    if (specEl) { specEl.innerHTML = hasSpec ? "✅ Special" : "❌ Special (@#$%)"; specEl.className = hasSpec ? "me-2 text-success" : "me-2 text-danger"; }

    return (hasLen && hasNum && hasSpec);
}

function checkPwdMatch() {
    const npi = document.getElementById("newPwdInput");
    const cpi = document.getElementById("confirmPwdInput");
    const btn = document.getElementById("btn-finish-pwd-update");
    const matchError = document.getElementById("pwdMatchError");

    if (!npi || !cpi || !btn) return;

    const p = npi.value;
    const cp = cpi.value;
    const isStrong = checkPwdStrength(p);
    const matches = (p === cp && cp.length > 0);

    if (cp.length > 0) {
        if (matches) {
            if (matchError) matchError.style.display = 'none';
            cpi.style.borderColor = "#2dce89";
        } else {
            if (matchError) { matchError.innerText = "Passwords do not match"; matchError.style.display = 'block'; }
            cpi.style.borderColor = "#f5365c";
        }
    } else {
        if (matchError) matchError.style.display = 'none';
        cpi.style.borderColor = "";
    }

    const isValid = isStrong && matches;
    btn.disabled = !isValid;
    btn.style.opacity = isValid ? "1" : "0.5";
    btn.style.cursor = isValid ? "pointer" : "not-allowed";

    return isValid;
}
