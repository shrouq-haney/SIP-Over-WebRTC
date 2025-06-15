import { API_BASE_URL } from './api.js';

// --- Global State ---
let heartbeatInterval;
let callCheckInterval;
let messageCheckInterval;
let unreadCountInterval; // Interval for checking unread counts
let onlineUsers = []; // Cache for online users
const currentUserId = sessionStorage.getItem('userId');
let currentRingingSenderId = null; // Track who is currently calling
let isAudioUnlocked = false; // To track if user interaction has occurred
let websocket; // Add WebSocket variable
let currentUsername = sessionStorage.getItem('username');
let lastMessageCheck = 0; // Add timestamp for last message check

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
// Audio Elements
const voiceRingtone = document.getElementById('ringtone');
const videoRingtone = document.getElementById('videoRingtone');
const messageSound = document.getElementById('messageSound');

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
 * Plays a notification sound.
 * @param {HTMLAudioElement} sound - The audio element to play
 * @param {boolean} loop - Whether the sound should loop
 */
function playNotificationSound(sound, loop = false) {
    if (!sound) return;

    // Reset the sound
    sound.pause();
    sound.currentTime = 0;
    sound.loop = loop;

    // Try to play immediately
    const playAttempt = () => {
        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Error playing sound:', error);
                // If autoplay is blocked, try to unlock audio
                const unlockAudio = () => {
                    sound.play().then(() => {
                        sound.pause();
                        sound.currentTime = 0;
                        isAudioUnlocked = true;
                        if (loop) {
                            sound.play();
                        }
                    }).catch(e => console.error('Failed to unlock audio:', e));
                };
                // Try to unlock on any user interaction
                document.addEventListener('click', unlockAudio, { once: true });
                document.addEventListener('touchstart', unlockAudio, { once: true });
                document.addEventListener('keydown', unlockAudio, { once: true });
            });
        }
    };

    // Try to play immediately
    playAttempt();

    // Also try again after a short delay
    setTimeout(playAttempt, 100);
}

/**
 * Stops all notification sounds.
 */
function stopAllSounds() {
    if (voiceRingtone) {
        voiceRingtone.pause();
        voiceRingtone.currentTime = 0;
    }
    if (videoRingtone) {
        videoRingtone.pause();
        videoRingtone.currentTime = 0;
    }
    if (messageSound) {
        messageSound.pause();
        messageSound.currentTime = 0;
    }
}

/**
 * Connects to the WebSocket for signaling.
 */
function connectWebSocket() {
    const wsUrl = `ws://localhost:8080/WebRTC_BackEnd/signaling/${currentUserId}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('Signaling WebSocket connected');
    };
        
    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const payload = message.payload;
        
        if (payload) {
            switch (payload.type) {
                case 'offer':
                    handleIncomingCall(payload);
                    break;
                case 'hangup':
                    if (currentRingingSenderId === payload.senderId) {
                        console.log("Call was ended by the caller");
                        hideIncomingCallPopup();
                    }
                    break;
            }
        }
    };

    websocket.onclose = () => {
        console.log('Signaling WebSocket closed');
        // Try to reconnect after a short delay
        setTimeout(connectWebSocket, 3000);
    };

    websocket.onerror = (error) => {
        console.error('Signaling WebSocket error:', error);
    };
}

/**
 * Handles incoming calls from WebSocket.
 * @param {object} payload - The incoming call payload.
 */
function handleIncomingCall(payload) {
    // Don't show if any modal is already open
    if (callModal.style.display === 'flex' || messageModal.style.display === 'flex') return;

    // If a call is already ringing, ignore new calls
    if (currentRingingSenderId) return;

    currentRingingSenderId = payload.senderId;
    const isVideoCall = payload.sdp.includes('m=video');
    const callType = isVideoCall ? 'video' : 'voice';

    // Store the offer in session storage for the call page
    sessionStorage.setItem('incomingSdpOffer', JSON.stringify(payload));

    // Fetch caller details if not in onlineUsers
    const caller = onlineUsers.find(u => u.userId.toString() === payload.senderId.toString());
    if (caller) {
        showIncomingCallPopup(payload.senderId, caller.username, callType);
    } else {
        // If caller not in onlineUsers, fetch their details
        fetch(`${API_BASE_URL}/users/details?userId=${payload.senderId}`)
            .then(response => response.json())
            .then(userDetails => {
                showIncomingCallPopup(payload.senderId, userDetails.username, callType);
            })
            .catch(error => {
                console.error('Error fetching caller details:', error);
                showIncomingCallPopup(payload.senderId, 'Unknown Caller', callType);
            });
    }
}

/**
 * Periodically checks for new, unread messages.
 */
async function checkForNewMessages() {
    // Don't check if modals are open
    if (callModal.style.display === 'flex' || messageModal.style.display === 'flex') return;

    try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE_URL}/chat/unread?userId=${currentUserId}&t=${timestamp}`);
        
        if (response.ok) {
            const rawData = await response.json();
            
            // Exit if there's no data
            if (!rawData || (typeof rawData === 'object' && Object.keys(rawData).length === 0)) {
                return;
            }

            // Standardize the API response to always be an array
            const unreadMessages = Array.isArray(rawData) ? rawData : [rawData];

            if (unreadMessages.length > 0) {
                // Get the list of users we have already shown a popup for from session storage
                const notifiedSenders = new Set(JSON.parse(sessionStorage.getItem('notifiedSenders') || '[]'));
                
                // Find messages from users we haven't notified yet
                const newMessages = unreadMessages.filter(msg => 
                    msg && !notifiedSenders.has(Number(msg.senderId))
                );

                for (const newMessage of newMessages) {
                    // Mark this sender as notified
                    notifiedSenders.add(Number(newMessage.senderId));
                    
                    // Get sender's name
                    let sender = onlineUsers.find(u => u.userId === newMessage.senderId);
                    let senderName;

                    if (sender) {
                        senderName = sender.username;
                    } else {
                        try {
                            const userResponse = await fetch(`${API_BASE_URL}/users/details?userId=${newMessage.senderId}`);
                            if (userResponse.ok) {
                                const userDetails = await userResponse.json();
                                senderName = userDetails.username;
                            } else {
                                senderName = 'Unknown User';
                            }
                        } catch (e) {
                            senderName = 'Unknown User';
                        }
                    }

                    // Show notification immediately
                    showNewMessagePopup(newMessage.senderId, senderName);
                    
                    // Update unread count
                    updateUnreadCount(newMessage.senderId, newMessage.unreadCount || 0);
                }

                // Save updated notified senders
                sessionStorage.setItem('notifiedSenders', JSON.stringify(Array.from(notifiedSenders)));
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
    const callerNameSpan = document.getElementById('callerName');
    const callTypeSpan = document.getElementById('callType');
    const acceptBtn = document.getElementById('acceptCallBtn');
    const rejectBtn = document.getElementById('rejectCallBtn');

    callerNameSpan.textContent = name;
    callTypeSpan.textContent = callType;
    callModal.style.display = 'flex';

    // Play appropriate ringtone based on call type
    const ringtone = callType === 'video' ? videoRingtone : voiceRingtone;
    playNotificationSound(ringtone, true);

    // Set up button actions
    acceptBtn.onclick = () => acceptCall(callerId, name, callType);
    rejectBtn.onclick = () => rejectCall(callerId);
}

/**
 * Displays the new message popup.
 */
function showNewMessagePopup(senderId, senderName) {
    // Stop any existing sounds first
    stopAllSounds();
    
    // Update the modal content
    messageSenderNameSpan.textContent = senderName;
    
    // Show the modal
    messageModal.style.display = 'flex';
    
    // Play the message sound immediately
    playNotificationSound(messageSound, false);
    
    // Set up button actions
    viewChatBtn.onclick = () => {
        goTo('chat.html', senderId, senderName);
        hideMessagePopup();
    };
    
    closeMessageBtn.onclick = () => {
        hideMessagePopup();
    };
}

/**
 * Hides the incoming call popup and stops the ringtone.
 */
function hideIncomingCallPopup() {
    callModal.style.display = 'none';
    stopAllSounds();
    currentRingingSenderId = null; // Reset the ringing state
}

/**
 * Hides the new message popup.
 */
function hideMessagePopup() {
    messageModal.style.display = 'none';
    stopAllSounds();
}

/**
 * Handles accepting a call.
 * @param {number} callerId - The ID of the user who initiated the call.
 * @param {string} callerName - The name of the caller.
 * @param {string} callType - The type of call ('video' or 'voice').
 */
function acceptCall(callerId, callerName, callType) {
    stopAllSounds();
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
    console.log(`Rejecting call from ${callerId}`);
    hideIncomingCallPopup(); // Hide UI and stop ringtone immediately

    try {
        // Notify the server that the call was rejected.
        // This allows the caller to know their call was not answered.
        await fetch(`${API_BASE_URL}/signaling/reject-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: callerId, // The one who sent the offer
                receiverId: currentUserId // The one who is rejecting
            })
        });
    } catch (error) {
        console.error('Error sending rejection signal:', error);
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

    // For calls, we mark this user as the one initiating the call.
    // This helps the call page decide who sends the 'offer'.
    if (page.includes('video.html') || page.includes('voice.html')) {
        window.location.href = `${page}?user=${userId}&isCaller=true`;
    } else {
        window.location.href = `${page}?user=${userId}`;
    }
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
 * Shows the logout confirmation modal.
 */
function handleLogout() {
    logoutModal.style.display = 'flex';
}

/**
 * Logs the user out.
 * This is called when the user confirms the action in the modal.
 */
async function confirmLogout() {
    console.log("Logging out...");
    // Clear all intervals
    clearInterval(heartbeatInterval);
    clearInterval(callCheckInterval);
    clearInterval(messageCheckInterval);
    clearInterval(unreadCountInterval);
    stopAllSounds();

    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error("Logout failed on server:", error);
    } finally {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// --- Initialization ---

function initialize() {
    if (protectPage()) {
        // Try to unlock audio immediately when the page loads
        const unlockAudio = () => {
            const sounds = [voiceRingtone, videoRingtone, messageSound];
            sounds.forEach(sound => {
                if (sound) {
                    const promise = sound.play();
                    if (promise !== undefined) {
                        promise.then(() => {
                            sound.pause();
                            sound.currentTime = 0;
                            isAudioUnlocked = true;
                            console.log("Audio unlocked by user interaction.");
                        }).catch(() => {
                            isAudioUnlocked = false;
                        });
                    }
                }
            });
        };

        // Try to unlock audio on any user interaction
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('keydown', unlockAudio);

        // Run once immediately, then set intervals
        fetchAndDisplayOnlineUsers(); 
        sendHeartbeat();
        connectWebSocket();
        checkForNewMessages();

        setInterval(fetchAndDisplayOnlineUsers, 10000);
        heartbeatInterval = setInterval(sendHeartbeat, 30000);
        // Check for new messages every 2 seconds
        messageCheckInterval = setInterval(checkForNewMessages, 2000);
        unreadCountInterval = setInterval(updateUnreadCounts, 10000);

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