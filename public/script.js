// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const messageDiv = document.getElementById('message');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const toggleLink = document.getElementById('toggleLink');
const toggleQuestion = document.getElementById('toggleQuestion');

let isLoginMode = true;

// ===== Tab Switching (Email / Phone) =====
document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const form = btn.closest('.auth-form');
        const tab = btn.dataset.tab; // 'email' or 'phone'

        // Toggle active tab button
        form.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle tab content
        form.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        form.querySelector(`.${tab}-tab`).classList.add('active');

        // Toggle required attributes so HTML validation works correctly
        const emailInputs = form.querySelectorAll('.email-tab input');
        const phoneInputs = form.querySelectorAll('.phone-tab input');

        if (tab === 'phone') {
            emailInputs.forEach(i => i.removeAttribute('required'));
            form.querySelector('.phone-tab input[type="tel"]').setAttribute('required', '');
        } else {
            emailInputs.forEach(i => i.setAttribute('required', ''));
            phoneInputs.forEach(i => i.removeAttribute('required'));
        }

        hideMessage();
    });
});

// ===== OTP Send & Cooldown =====
function startCooldown(button) {
    let seconds = 60;
    button.disabled = true;
    button.textContent = `${seconds}s`;

    const timer = setInterval(() => {
        seconds--;
        button.textContent = `${seconds}s`;
        if (seconds <= 0) {
            clearInterval(timer);
            button.disabled = false;
            button.textContent = 'Send Code';
        }
    }, 1000);
}

// ===== OTP digit box behavior =====
document.querySelectorAll('.otp-boxes').forEach(container => {
    const digits = container.querySelectorAll('.otp-digit');

    digits.forEach((input, idx) => {
        // Only allow single digit
        input.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val.slice(0, 1);
            e.target.classList.toggle('filled', val.length > 0);

            // Auto-advance to next box
            if (val && idx < 5) {
                digits[idx + 1].focus();
            }
        });

        // Backspace moves to previous box
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && idx > 0) {
                digits[idx - 1].focus();
                digits[idx - 1].value = '';
                digits[idx - 1].classList.remove('filled');
            }
        });

        // Paste support — fill all 6 boxes from clipboard
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((ch, i) => {
                if (digits[i]) {
                    digits[i].value = ch;
                    digits[i].classList.add('filled');
                }
            });
            if (pasted.length > 0) {
                digits[Math.min(pasted.length, 5)].focus();
            }
        });
    });
});

// Read combined OTP from 6 boxes
function getOtpValue(containerId) {
    const digits = document.getElementById(containerId).querySelectorAll('.otp-digit');
    return Array.from(digits).map(d => d.value).join('');
}

async function sendOtp(phoneInputId, otpGroupId, sendBtnId, otpBoxesId) {
    const phone = document.getElementById(phoneInputId).value.trim();
    if (!phone || phone.length < 8) {
        showMessage('Please enter a valid phone number.', 'error');
        return;
    }

    const sendBtn = document.getElementById(sendBtnId);
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
        const res = await fetch('/api/auth/phone/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Code sent! Check your phone (or server console).', 'success');
            document.getElementById(otpGroupId).classList.remove('hidden');
            // Focus first OTP digit box
            document.getElementById(otpBoxesId).querySelector('.otp-digit').focus();
            startCooldown(sendBtn);
        } else {
            showMessage(data.message, 'error');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Code';
        }
    } catch {
        showMessage('Connection error.', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Code';
    }
}

// Wire up Send Code buttons
document.getElementById('loginSendOtp').addEventListener('click', () => {
    sendOtp('loginPhone', 'loginOtpGroup', 'loginSendOtp', 'loginOtpBoxes');
});

document.getElementById('registerSendOtp').addEventListener('click', () => {
    sendOtp('registerPhone', 'registerOtpGroup', 'registerSendOtp', 'registerOtpBoxes');
});

// ===== OTP Verify helper =====
async function verifyOtp(phoneInputId, otpBoxesId) {
    const phone = document.getElementById(phoneInputId).value.trim();
    const code = getOtpValue(otpBoxesId);

    if (!code || code.length !== 6) {
        showMessage('Please enter the 6-digit code.', 'error');
        return false;
    }

    try {
        const res = await fetch('/api/auth/phone/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Success!', 'success');
            setTimeout(() => window.location.href = '/success.html', 800);
            return true;
        } else {
            showMessage(data.message, 'error');
            return false;
        }
    } catch {
        showMessage('Connection error.', 'error');
        return false;
    }
}

// ===== Detect active tab =====
function getActiveTab(form) {
    const activeBtn = form.querySelector('.tab-btn.active');
    return activeBtn ? activeBtn.dataset.tab : 'email';
}

// ===== Check for OAuth errors in URL =====
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
        const errorMessages = {
            'auth_failed': 'Authentication failed. Please try again.',
            'google_not_configured': 'Google login not configured.',
            'github_not_configured': 'GitHub login not configured.',
            'facebook_not_configured': 'Facebook login not configured.'
        };
        showMessage(errorMessages[error] || 'An error occurred.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// ===== Toggle between Login and Register =====
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    if (isLoginMode) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        formTitle.textContent = 'Sign in';
        formSubtitle.textContent = 'Welcome back. Enter your credentials.';
        toggleQuestion.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign up';
    } else {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        formTitle.textContent = 'Create account';
        formSubtitle.textContent = 'Enter your details to get started.';
        toggleQuestion.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign in';
    }
    hideMessage();
});

// ===== Show/hide messages =====
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => hideMessage(), 4000);
}

function hideMessage() {
    messageDiv.classList.add('hidden');
}

// ===== Login =====
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeTab = getActiveTab(loginForm);

    if (activeTab === 'phone') {
        // Phone OTP login
        await verifyOtp('loginPhone', 'loginOtpBoxes');
        return;
    }

    // Email login
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Success!', 'success');
            setTimeout(() => window.location.href = '/success.html', 800);
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }
});

// ===== Register =====
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeTab = getActiveTab(registerForm);

    if (activeTab === 'phone') {
        // Phone OTP register
        await verifyOtp('registerPhone', 'registerOtpBoxes');
        return;
    }

    // Email register
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showMessage('Passwords do not match.', 'error');
        return;
    }
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Account created!', 'success');
            setTimeout(() => window.location.href = '/success.html', 800);
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }
});

// ===== Forgot Password Flow =====
const forgotForm = document.getElementById('forgotForm');
const forgotLink = document.getElementById('forgotLink');
const backToLogin = document.getElementById('backToLogin');

let forgotEmail = '';
let forgotOtpCode = '';

// Initialize OTP digit boxes for forgot password form
(function initForgotOtpBoxes() {
    const container = document.getElementById('forgotOtpBoxes');
    if (!container) return;
    const digits = container.querySelectorAll('.otp-digit');

    digits.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val.slice(0, 1);
            e.target.classList.toggle('filled', val.length > 0);
            if (val && idx < 5) digits[idx + 1].focus();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && idx > 0) {
                digits[idx - 1].focus();
                digits[idx - 1].value = '';
                digits[idx - 1].classList.remove('filled');
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((ch, i) => {
                if (digits[i]) {
                    digits[i].value = ch;
                    digits[i].classList.add('filled');
                }
            });
            if (pasted.length > 0) digits[Math.min(pasted.length, 5)].focus();
        });
    });
})();

// Show forgot password form
forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.remove('hidden');
    formTitle.textContent = 'Reset password';
    formSubtitle.textContent = 'Enter your email to receive a reset code.';
    document.querySelector('.toggle-text').classList.add('hidden');
    hideMessage();
});

// Back to login
backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    forgotForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    formTitle.textContent = 'Sign in';
    formSubtitle.textContent = 'Welcome back. Enter your credentials.';
    document.querySelector('.toggle-text').classList.remove('hidden');
    isLoginMode = true;
    // Reset forgot form steps
    document.getElementById('forgotStep1').classList.remove('hidden');
    document.getElementById('forgotStep2').classList.add('hidden');
    document.getElementById('forgotStep3').classList.add('hidden');
    document.getElementById('forgotEmail').value = '';
    document.getElementById('forgotOtpBoxes').querySelectorAll('.otp-digit').forEach(d => { d.value = ''; d.classList.remove('filled'); });
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    hideMessage();
});

// Step 1: Send OTP
document.getElementById('forgotSendOtp').addEventListener('click', async () => {
    forgotEmail = document.getElementById('forgotEmail').value.trim();
    if (!forgotEmail) {
        showMessage('Please enter your email.', 'error');
        return;
    }

    const btn = document.getElementById('forgotSendOtp');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        const res = await fetch('/api/auth/password/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Code sent! Check your email (or server console).', 'success');
            document.getElementById('forgotStep1').classList.add('hidden');
            document.getElementById('forgotStep2').classList.remove('hidden');
            formSubtitle.textContent = `Code sent to ${forgotEmail}`;
            document.getElementById('forgotOtpBoxes').querySelector('.otp-digit').focus();
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Send Reset Code';
});

// Step 2: Verify OTP
document.getElementById('forgotVerifyOtp').addEventListener('click', async () => {
    forgotOtpCode = getOtpValue('forgotOtpBoxes');
    if (!forgotOtpCode || forgotOtpCode.length !== 6) {
        showMessage('Please enter the 6-digit code.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/password/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail, code: forgotOtpCode })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Code verified!', 'success');
            document.getElementById('forgotStep2').classList.add('hidden');
            document.getElementById('forgotStep3').classList.remove('hidden');
            formSubtitle.textContent = 'Choose your new password.';
            document.getElementById('newPassword').focus();
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }
});

// Step 3: Reset Password
forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (newPass !== confirmPass) {
        showMessage('Passwords do not match.', 'error');
        return;
    }
    if (newPass.length < 6) {
        showMessage('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/password/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail, code: forgotOtpCode, newPassword: newPass })
        });
        const data = await res.json();

        if (res.ok) {
            showMessage('Password reset! Redirecting to sign in...', 'success');
            setTimeout(() => backToLogin.click(), 1500);
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }
});
