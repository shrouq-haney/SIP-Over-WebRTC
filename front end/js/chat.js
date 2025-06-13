import { API_BASE_URL } from './api.js';

// --- Global State & Configuration ---
const currentUserId = sessionStorage.getItem('userId');
const receiverId = sessionStorage.getItem('receiverId');
const receiverName = sessionStorage.getItem('receiverName');
let websocket;
const WEBSOCKET_URL = `ws://localhost:8080/WebRTC_BackEnd/ws/chat/${currentUserId}`;

// --- DOM Elements ---
const chatMessagesContainer = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const userNameSpan = document.getElementById('userName');
const endChatBtn = document.getElementById('endChatBtn');
const logoutBtn = document.getElementById('logoutBtn');
// Modals
const endChatModal = document.getElementById('endChatModal');
const confirmEndChatBtn = document.getElementById('confirmEndChatBtn');
const cancelEndChatBtn = document.getElementById('cancelEndChatBtn');
const logoutModal = document.getElementById('logoutModal');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');

// --- Functions ---

/**
 * Checks if a user is logged in and a receiver is selected.
 */
function protectPage() {
    if (!currentUserId || !receiverId) {
        alert('You must be logged in and have selected a user to chat with.');
        window.location.href = 'main.html';
        return false;
    }
    return true;
}

/**
 * Connects to the WebSocket server.
 */
function connectWebSocket() {
    websocket = new WebSocket(WEBSOCKET_URL);

    websocket.onopen = () => {
        console.log('WebSocket connection established.');
        // Fetch history once connected
        fetchChatHistory();
    };

    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    websocket.onclose = () => {
        console.log('WebSocket connection closed.');
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('A connection error occurred. Please try again.');
    };
}

/**
 * Fetches the chat history between the two users.
 */
async function fetchChatHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/messages?userId1=${currentUserId}&userId2=${receiverId}`);
        if (!response.ok) throw new Error('Failed to fetch chat history.');

        const messages = await response.json();
        chatMessagesContainer.innerHTML = ''; // Clear container
        messages.forEach(displayMessage);
    } catch (error) {
        console.error(error);
    }
}

/**
 * Displays a single message in the chat window.
 * @param {object} msg - The message object.
 */
function displayMessage(msg) {
    const messageDiv = document.createElement('div');
    const isSent = msg.senderId.toString() === currentUserId;
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    // Format the timestamp to include date and time
    const time = new Date(msg.timestamp).toLocaleString([], { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        <div class="message-content">
            ${msg.content}
            <span class="message-time">${time}</span>
        </div>
    `;
    chatMessagesContainer.appendChild(messageDiv);
    // Scroll to the latest message
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

/**
 * Sends a message through the WebSocket.
 */
function sendMessage() {
    const content = messageInput.value.trim();
    if (content && websocket.readyState === WebSocket.OPEN) {
        const message = {
            receiverId: receiverId,
            content: content
        };
        websocket.send(JSON.stringify(message));
        
        // Optimistically display the sent message right away
        const optimisticMessage = {
            senderId: currentUserId,
            receiverId: receiverId,
            content: content,
            timestamp: new Date().toISOString()
        }
        displayMessage(optimisticMessage);
        
        messageInput.value = ''; // Clear input
    } else if (websocket.readyState !== WebSocket.OPEN) {
        alert('Connection is not open. Please wait or refresh.');
    }
}

/**
 * Closes the chat and returns to the main page.
 */
function handleEndChat() {
    endChatModal.style.display = 'flex';
}

function confirmEndChat() {
    if (websocket) {
        websocket.close();
    }
    window.location.href = 'main.html';
}

/**
 * Logs the user out.
 */
async function handleLogout() {
    logoutModal.style.display = 'flex';
}

async function confirmLogout() {
    if (websocket) {
        websocket.close();
    }
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
        userNameSpan.textContent = receiverName || 'User';
        connectWebSocket();

        const sendButton = document.querySelector('.send-btn');
        if(sendButton) {
            sendButton.onclick = sendMessage;
        }

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Event Listeners for buttons and modals
        endChatBtn.addEventListener('click', handleEndChat);
        logoutBtn.addEventListener('click', handleLogout);

        confirmEndChatBtn.addEventListener('click', confirmEndChat);
        cancelEndChatBtn.addEventListener('click', () => {
            endChatModal.style.display = 'none';
        });

        confirmLogoutBtn.addEventListener('click', confirmLogout);
        cancelLogoutBtn.addEventListener('click', () => {
            logoutModal.style.display = 'none';
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize); 