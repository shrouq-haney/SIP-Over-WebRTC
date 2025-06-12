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

async function handleLogin(event) {
    event.preventDefault();
    clearServerError(); // Clear previous errors

    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const phoneError = document.getElementById('phone-error');

    const phoneValue = phoneInput.value; // Get phone number from form
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
            // The backend error shows it expects the phone number in the 'msisdn' field
            body: JSON.stringify({ msisdn: phoneValue, password }),
        });

        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem('userId', data.userId);
            // Store the phone number as the 'username' for this session
            sessionStorage.setItem('username', phoneValue);
            window.location.href = 'main.html';
        } else {
            // Display detailed error from server
            const errorText = await response.text();
            showServerError(errorText || 'Invalid credentials.');
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
                username: fullname, // Send Full Name as username
                password: password,
                msisdn: phone      // Send Phone Number as msisdn
            }),
        });

        if (response.status === 201) {
            // Redirect to login page on successful registration
            window.location.href = 'login.html';
        } else {
            // Display detailed error from server
            const errorText = await response.text();
            showServerError(errorText || 'Registration failed.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showServerError('An error occurred during registration. Please try again.');
    }
}

// Make the function globally available
window.handleRegister = handleRegister; 