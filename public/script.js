// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const messageDiv = document.getElementById('message');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const toggleLink = document.getElementById('toggleLink');
const toggleQuestion = document.getElementById('toggleQuestion');

let isLoginMode = true;

// Check for OAuth errors in URL
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

// Toggle between login and register
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

// Show/hide messages
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => hideMessage(), 4000);
}

function hideMessage() {
    messageDiv.classList.add('hidden');
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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
            setTimeout(() => toggleLink.click(), 1500);
        } else {
            showMessage(data.message, 'error');
        }
    } catch {
        showMessage('Connection error.', 'error');
    }
});
