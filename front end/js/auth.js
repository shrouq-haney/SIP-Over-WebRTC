import { API_BASE_URL } from './api.js';

/**
 * Displays an error message on the form.
 * @param {string} message - The error message to display.
 */
function showServerError(message) {
    const errorElement = document.getElementById('server-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Hides the server error message.
 */
function clearServerError() {
    const errorElement = document.getElementById('server-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

/**
 * Parses a backend error response and displays the clean message.
 * @param {Response} response - The fetch response object.
 * @param {string} defaultMessage - A fallback message.
 */
async function displayBackendError(response, defaultMessage) {
    try {
        const errorText = await response.text();
        const errorJson = JSON.parse(errorText);
        if (errorJson && errorJson.error) {
            showServerError(errorJson.error);
        } else {
            showServerError(errorText || defaultMessage);
        }
    } catch (e) {
        // If the response isn't valid JSON, show the raw text or a default message.
        // We need to re-fetch the text if JSON.parse fails and we don't have it.
        // A better way is to get text first.
        try {
            const rawText = await response.text();
            showServerError(rawText || defaultMessage);
        } catch (finalError) {
            showServerError(defaultMessage);
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();
    clearServerError(); // Clear previous errors

    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const phoneError = document.getElementById('phone-error');

    const phoneValue = phoneInput.value;
    const password = passwordInput.value;

    if (phoneValue.length !== 11) {
        phoneError.textContent = 'Phone number must be 11 digits';
        phoneError.style.display = 'block';
        return;
    } else {
        phoneError.style.display = 'none';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ msisdn: phoneValue, password }),
        });

        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem('userId', data.userId);
            sessionStorage.setItem('username', phoneValue);
            window.location.href = 'main.html';
        } else {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                showServerError(errorJson.error || 'Invalid credentials.');
            } catch (e) {
                showServerError(errorText || 'Invalid credentials.');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showServerError('An error occurred. Please try again later.');
    }
}

// Make the function globally available
window.handleLogin = handleLogin;

async function handleRegister(event) {
    event.preventDefault();
    clearServerError(); // Clear previous errors

    const fullnameInput = document.getElementById('fullname');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    const fullname = fullnameInput.value;
    const phone = phoneInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (phone.length !== 11) {
        showServerError('Phone number must be 11 digits.');
        return;
    }
    if (password !== confirmPassword) {
        showServerError('Passwords do not match.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: fullname,
                password: password,
                msisdn: phone
            }),
        });

        if (response.status === 201) {
            window.location.href = 'login.html';
        } else {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                showServerError(errorJson.error || 'Registration failed.');
            } catch (e) {
                showServerError(errorText || 'Registration failed.');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showServerError('An error occurred during registration. Please try again.');
    }
}

// Make the function globally available
window.handleRegister = handleRegister; 