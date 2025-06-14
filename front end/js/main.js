import { API_BASE_URL } from './api.js';

// --- Global State ---
let heartbeatInterval;
let callCheckInterval;
let messageCheckInterval;
let unreadCountInterval; // Interval for checking unread counts
let onlineUsers = []; // Cache for online users
const currentUserId = sessionStorage.getItem('userId');

// --- DOM Elements ---
const sidebar = document.querySelector('.sidebar');
const detailsView = document.getElementById('details');
const logo = document.getElementById('logo');
const logoutBtn = document.getElementById('logoutBtn');
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
// Logout Modal Elements
const logoutModal = document.getElementById('logoutModal');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');

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
 * Fetches unread message counts and updates the UI.
 */
async function updateUnreadCounts() {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/unread-count?userId=${currentUserId}`);
        if (!response.ok) {
            console.error(`Failed to fetch unread counts. Status: ${response.status}`);
            return;
        }

        const rawCounts = await response.json();
        console.log('Unread counts from API:', rawCounts);

        // Check if rawCounts is a valid object with keys
        if (!rawCounts || typeof rawCounts !== 'object' || Object.keys(rawCounts).length === 0) {
            return; // Exit if there's no data, it's not an object, or it's an empty object
        }
        
        // The API returns an object like { "senderId": count, ... }.
        // We can convert this directly into a Map.
        const countsMap = new Map(Object.entries(rawCounts));

        countsMap.forEach((count, senderId) => {
            if (count > 0) {
                // Ensure senderId is a string for the querySelector
                const userElement = sidebar.querySelector(`.user[data-user-id='${senderId}']`);
                if (userElement) {
                    // Prevent adding duplicate badges
                    let badge = userElement.querySelector('.unread-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'unread-badge';
                        userElement.appendChild(badge);
                    }
                    badge.textContent = count;
                } else {
                    // This log helps if the user list doesn't contain the sender
                    console.warn(`updateUnreadCounts: Did not find user element for senderId ${senderId}`);
                }
            }
        });
    } catch (error) {
        console.error('Error updating unread counts:', error);
    }
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

        sidebar.innerHTML = '<h2>Online Users</h2>'; // Clear container

        users.forEach(user => {
            if (user.userId.toString() === currentUserId) return;

            const userElement = document.createElement('div');
            userElement.className = 'user';
            userElement.dataset.userId = user.userId;
            userElement.dataset.username = user.username; // Store username for easy access

            // Create a container for the name and status to align them properly
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            
            const nameSpan = document.createElement('span');
            nameSpan.innerHTML = `<span class="status">🟢</span> ${user.username}`;
            userInfo.appendChild(nameSpan);

            userElement.appendChild(userInfo);
            userElement.onclick = () => selectUser(user);
            sidebar.appendChild(userElement);
        });

        // After rendering the user list, update the unread counts
        await updateUnreadCounts();

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
        
        if (response.status === 404) {
            return; // Expected when no call is waiting
        }
        
        if (response.ok) {
            const sdpData = await response.json();
            // An SDP with type 'offer' indicates a new incoming call.
            // This now checks the top-level 'type' property correctly.
            if (sdpData && sdpData.sdp && sdpData.type === 'offer') {
                const sdpString = sdpData.sdp;
                // Determine call type by checking for a video line in the SDP string
                const isVideoCall = sdpString.includes('m=video');
                const callType = isVideoCall ? 'video' : 'voice';

                // Find caller's username from the cached list
                const caller = onlineUsers.find(u => u.userId === sdpData.senderId);
                const callerName = caller ? caller.username : 'Unknown Caller';

                showIncomingCallPopup(sdpData.senderId, callerName, callType);
            }
        } else {
            console.error('Error checking for incoming calls:', response.statusText);
        }
    } catch (error) {
        console.error('Network error while checking for calls:', error);
    }
}

/**
 * Periodically checks for new, unread messages.
 */
async function checkForNewMessages() {
    if (callModal.style.display === 'flex' || messageModal.style.display === 'flex') return;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/unread?userId=${currentUserId}`);
        if (response.ok) {
            const rawData = await response.json();
            
            // Exit if there's no data.
            if (!rawData || (typeof rawData === 'object' && Object.keys(rawData).length === 0)) {
                return;
            }

            // Standardize the API response to always be an array.
            const unreadMessages = Array.isArray(rawData) ? rawData : [rawData];

            if (unreadMessages.length > 0) {
                // Get the list of users we have already shown a popup for from session storage.
                const notifiedSenders = new Set(JSON.parse(sessionStorage.getItem('notifiedSenders') || '[]'));
                
                // Find the first message from a user we haven't notified yet.
                // Ensure we compare numbers with numbers for consistency.
                const newMessage = unreadMessages.find(msg => msg && !notifiedSenders.has(Number(msg.senderId)));
                
                if (newMessage) {
                    // Mark this sender as notified for this session BEFORE showing the popup.
                    // Also ensure we add a number to the set.
                    notifiedSenders.add(Number(newMessage.senderId));
                    sessionStorage.setItem('notifiedSenders', JSON.stringify(Array.from(notifiedSenders)));
                    
                    // --- Get sender's name ---
                    // First, try to find the user in the cached online list
                    let sender = onlineUsers.find(u => u.userId === newMessage.senderId);
                    let senderName;

                    if (sender) {
                        senderName = sender.username;
                    } else {
                        // If not in the online list, fetch user details directly from the backend
                        try {
                            const userResponse = await fetch(`${API_BASE_URL}/users/details?userId=${newMessage.senderId}`);
                            if (userResponse.ok) {
                                const userDetails = await userResponse.json();
                                senderName = userDetails.username;
                            } else {
                                senderName = 'Unknown User'; // Fallback
                            }
                        } catch (e) {
                            senderName = 'Unknown User';
                        }
                    }
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
        // Simply go to the chat. The notification state is reset when the chat page loads.
        goTo('chat.html', senderId, name);
        hideNewMessagePopup();
    };

    closeMessageBtn.onclick = () => {
        // Simply hide the popup. The user is already marked as notified.
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
        <div class="user-details-content">
            <h2>Talk to ${user.username}</h2>
            <img src="../images/choose.gif" alt="Choose an option" class="choose-gif"/>
            <div class="buttons">
                <button class="btn btn-video" onclick="goTo('video.html', ${user.userId}, '${user.username}')">📹 Video Call</button>
                <button class="btn btn-voice" onclick="goTo('voice.html', ${user.userId}, '${user.username}')">📞 Voice Call</button>
                <button class="btn btn-chat" onclick="goTo('chat.html', ${user.userId}, '${user.username}')">💬 Chat</button>
            </div>
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
    logoutModal.style.display = 'flex';
}

async function confirmLogout() {
    // Clear all intervals
    clearInterval(heartbeatInterval);
    clearInterval(callCheckInterval);
    clearInterval(messageCheckInterval);
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
        // Run once immediately, then set intervals
        fetchAndDisplayOnlineUsers(); 
        sendHeartbeat();
        checkForIncomingCalls();
        checkForNewMessages();

        setInterval(fetchAndDisplayOnlineUsers, 10000); // Refreshes users and then updates counts
        heartbeatInterval = setInterval(sendHeartbeat, 30000);
        callCheckInterval = setInterval(checkForIncomingCalls, 3000);
        messageCheckInterval = setInterval(checkForNewMessages, 5000);

        // Event Listeners
        logoutBtn.addEventListener('click', handleLogout);
        confirmLogoutBtn.addEventListener('click', confirmLogout);
        cancelLogoutBtn.addEventListener('click', () => {
            logoutModal.style.display = 'none';
        });

        window.selectUser = selectUser;
        window.goTo = goTo;
        logo.addEventListener('click', () => {
            window.location.href = 'main.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize); 