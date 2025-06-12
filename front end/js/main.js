import { API_BASE_URL } from './api.js';

// --- Global State ---
let heartbeatInterval;
const currentUserId = sessionStorage.getItem('userId');

// --- DOM Elements ---
const sidebar = document.querySelector('.sidebar');
const detailsView = document.getElementById('details');
const logo = document.getElementById('logo');


// --- Functions ---

/**
 * Checks if a user is logged in. If not, redirects to the login page.
 */
function protectPage() {
    if (!currentUserId) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Fetches the list of online users and renders them in the sidebar.
 */
async function fetchAndDisplayOnlineUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/online`);
        if (!response.ok) {
            throw new Error('Failed to fetch online users.');
        }
        const users = await response.json();

        // Clear existing static users
        sidebar.innerHTML = '<h2>Online Users</h2>';

        users.forEach(user => {
            // Don't display the current user in the list
            if (user.userId.toString() === currentUserId) {
                return;
            }

            const userElement = document.createElement('div');
            userElement.className = 'user';
            // Store userId and username in a data attribute for easy access
            userElement.dataset.userId = user.userId;
            userElement.dataset.username = user.username;
            userElement.innerHTML = `<span class="status">🟢</span> ${user.username}`;
            userElement.onclick = () => selectUser(user);
            sidebar.appendChild(userElement);
        });

    } catch (error) {
        console.error(error);
        sidebar.innerHTML += '<p style="color: red;">Could not load users.</p>';
    }
}

/**
 * Displays action buttons for the selected user.
 * @param {object} user - The user object containing userId and username.
 */
function selectUser(user) {
    detailsView.innerHTML = `
        <h2>Talk to ${user.username}</h2>
        <div class="buttons">
            <button class="btn btn-video" onclick="goTo('video.html', ${user.userId}, '${user.username}')">📹 Video Call</button>
            <button class="btn btn-voice" onclick="goTo('voice.html', ${user.userId}, '${user.username}')">📞 Voice Call</button>
            <button class="btn btn-chat" onclick="goTo('chat.html', ${user.userId}, '${user.username}')">💬 Chat</button>
        </div>
    `;
}

/**
 * Navigates to a page, storing the target user's info in session storage.
 * @param {string} page - The URL of the page to navigate to.
 * @param {number} userId - The ID of the user to interact with.
 * @param {string} username - The username of the user to interact with.
 */
function goTo(page, userId, username) {
    sessionStorage.setItem('receiverId', userId);
    sessionStorage.setItem('receiverName', username);
    window.location.href = `${page}?user=${userId}`;
}

/**
 * Sends a heartbeat to the server to keep the user's session active.
 */
async function sendHeartbeat() {
    try {
        await fetch(`${API_BASE_URL}/users/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error('Heartbeat failed:', error);
        // If heartbeat fails, the user might be logged out by the server.
        // We could stop the interval here or let the server handle the timeout.
    }
}

/**
 * Logs the user out by calling the logout endpoint and clearing session data.
 */
async function handleLogout() {
    clearInterval(heartbeatInterval); // Stop sending heartbeats
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error('Logout failed on server:', error);
    } finally {
        // Always clear session and redirect, even if server call fails.
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}


// --- Initialization ---

function initialize() {
    if (protectPage()) {
        // Initial fetch of users
        fetchAndDisplayOnlineUsers();
        // Fetch users every 10 seconds to keep the list updated
        setInterval(fetchAndDisplayOnlineUsers, 10000);

        // Start sending heartbeats every 30 seconds
        heartbeatInterval = setInterval(sendHeartbeat, 30000);

        // Make functions globally available for inline event handlers
        window.selectUser = selectUser;
        window.handleLogout = handleLogout;
        window.goTo = goTo;
        logo.addEventListener('click', () => {
            window.location.href = 'main.html';
        });
    }
}

// Run initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initialize); 