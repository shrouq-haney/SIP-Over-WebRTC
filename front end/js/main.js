import { API_BASE_URL } from './api.js';

// --- Global State ---
let heartbeatInterval;
let callCheckInterval;
let messageCheckInterval;
let onlineUsers = []; // Cache for online users
let snoozedSenders = new Set(); // To prevent repeated message popups
const currentUserId = sessionStorage.getItem('userId');

// --- DOM Elements ---
const sidebar = document.querySelector('.sidebar');
const detailsView = document.getElementById('details');
const logo = document.getElementById('logo');
// Call Modal Elements
const callModal = document.getElementById('incomingCallModal');
const callerNameSpan = document.getElementById('callerName');
const callTypeSpan = document.getElementById('callType');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
// Message Modal Elements
const messageModal = document.getElementById('incomingMessageModal');
const messageSenderNameSpan = document.getElementById('messageSenderName');
const viewChatBtn = document.getElementById('viewChatBtn');
const closeMessageBtn = document.getElementById('closeMessageBtn');

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
        if (!response.ok) throw new Error('Failed to fetch online users.');
        
        const users = await response.json();
        onlineUsers = users; // Update cache

        sidebar.innerHTML = '<h2>Online Users</h2>'; // Clear existing users

        users.forEach(user => {
            if (user.userId.toString() === currentUserId) return; // Don't show self

            const userElement = document.createElement('div');
            userElement.className = 'user';
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
 * Periodically checks for incoming calls.
 */
async function checkForIncomingCalls() {
    // Don't check for calls if any modal is already open
    if (callModal.style.display === 'flex' || messageModal.style.display === 'flex') return;

    try {
        const response = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        if (response.ok) {
            const sdpData = await response.json();
            // An SDP offer indicates a new incoming call
            if (sdpData && sdpData.sdp && JSON.parse(sdpData.sdp).type === 'offer') {
                const sdp = JSON.parse(sdpData.sdp).sdp;
                // Determine call type by checking for video in the SDP
                const isVideoCall = sdp.includes('m=video');
                const callType = isVideoCall ? 'video' : 'voice';

                // Find caller's username from the cached list
                const caller = onlineUsers.find(u => u.userId === sdpData.senderId);
                const callerName = caller ? caller.username : 'Unknown Caller';

                showIncomingCallPopup(sdpData.senderId, callerName, callType);
            }
        }
    } catch (error) {
        console.error('Error checking for incoming calls:', error);
    }
}

/**
 * Periodically checks for new, unread messages.
 */
async function checkForNewMessages() {
    // Don't check if any modal is already open
    if (callModal.style.display === 'flex' || messageModal.style.display === 'flex') return;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/unread?userId=${currentUserId}`);
        if (response.ok) {
            const unreadMessages = await response.json();
            if (unreadMessages.length > 0) {
                // Find the first message from a sender who hasn't been snoozed
                const newMessage = unreadMessages.find(msg => !snoozedSenders.has(msg.senderId));
                
                if (newMessage) {
                    const sender = onlineUsers.find(u => u.userId === newMessage.senderId);
                    const senderName = sender ? sender.username : 'Unknown User';
                    showNewMessagePopup(newMessage.senderId, senderName);
                }
            }
        }
    } catch (error) {
        console.error('Error checking for new messages:', error);
    }
}

/**
 * Displays the incoming call popup.
 */
function showIncomingCallPopup(callerId, name, callType) {
    callerNameSpan.textContent = name;
    callTypeSpan.textContent = callType;
    callModal.style.display = 'flex';

    acceptCallBtn.onclick = () => acceptCall(callerId, name, callType);
    rejectCallBtn.onclick = () => rejectCall(callerId);
}

/**
 * Displays the new message popup.
 */
function showNewMessagePopup(senderId, name) {
    messageSenderNameSpan.textContent = name;
    messageModal.style.display = 'flex';

    viewChatBtn.onclick = () => {
        // When user clicks to view, un-snooze the sender
        snoozedSenders.delete(senderId);
        goTo('chat.html', senderId, name);
    };

    closeMessageBtn.onclick = () => {
        // Snooze notifications from this sender to prevent repeated popups
        snoozedSenders.add(senderId);
        hideNewMessagePopup();
    };
}

/**
 * Hides the incoming call popup.
 */
function hideIncomingCallPopup() {
    callModal.style.display = 'none';
}

/**
 * Hides the new message popup.
 */
function hideNewMessagePopup() {
    messageModal.style.display = 'none';
}

/**
 * Handles accepting a call.
 * @param {number} callerId - The ID of the user who initiated the call.
 * @param {string} callerName - The name of the caller.
 * @param {string} callType - The type of call ('video' or 'voice').
 */
function acceptCall(callerId, callerName, callType) {
    // Store the caller's info to be used on the next page
    sessionStorage.setItem('receiverId', callerId);
    sessionStorage.setItem('receiverName', callerName);

    // Redirect to the appropriate page
    const page = callType === 'video' ? 'video.html' : 'voice.html';
    window.location.href = `${page}?user=${callerId}`;
    
    hideIncomingCallPopup();
}

/**
 * Handles rejecting a call.
 * @param {number} callerId - The ID of the user who initiated the call.
 */
async function rejectCall(callerId) {
    try {
        await fetch(`${API_BASE_URL}/signaling/reject-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: callerId,       // The one who started the call
                receiverId: currentUserId // The one who is rejecting
            })
        });
    } catch (error) {
        console.error('Failed to reject call on server:', error);
    } finally {
        hideIncomingCallPopup();
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error('Heartbeat failed:', error);
    }
}

/**
 * Logs the user out.
 */
async function handleLogout() {
    clearInterval(heartbeatInterval);
    clearInterval(callCheckInterval);
    clearInterval(messageCheckInterval); // Stop checking for messages on logout
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error('Logout failed on server:', error);
    } finally {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// --- Initialization ---

function initialize() {
    if (protectPage()) {
        fetchAndDisplayOnlineUsers();
        setInterval(fetchAndDisplayOnlineUsers, 10000);

        heartbeatInterval = setInterval(sendHeartbeat, 30000);
        callCheckInterval = setInterval(checkForIncomingCalls, 3000);
        messageCheckInterval = setInterval(checkForNewMessages, 5000); // Check for messages every 5 seconds

        window.selectUser = selectUser;
        window.handleLogout = handleLogout;
        window.goTo = goTo;
        logo.addEventListener('click', () => {
            window.location.href = 'main.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize); 