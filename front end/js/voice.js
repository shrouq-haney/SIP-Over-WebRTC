import { API_BASE_URL } from './api.js';

// --- Global State & Configuration ---
const currentUserId = sessionStorage.getItem('userId');
const receiverId = sessionStorage.getItem('receiverId');
const receiverName = sessionStorage.getItem('receiverName');

let localStream;
let remoteAudio;
let peerConnection;
let signalingInterval;
let pendingCandidates = []; // Queue for candidates that arrive early
let websocket; // WebSocket for real-time notifications

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- DOM Elements ---
const userNameSpan = document.getElementById('userName');
const muteBtn = document.getElementById('muteBtn');
const avatarText = document.querySelector('.avatar-text');
const endCallBtn = document.getElementById('endCallBtn');
// Modal Elements
const endCallModal = document.getElementById('endCallModal');
const confirmEndCallBtn = document.getElementById('confirmEndCallBtn');
const cancelEndCallBtn = document.getElementById('cancelEndCallBtn');


// --- Functions ---

function protectPage() {
    if (!currentUserId || !receiverId) {
        alert('You must be logged in and select a user to call.');
        window.location.href = 'main.html';
        return false;
    }
    return true;
}

async function setupMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    } catch (error) {
        console.error('Error accessing media devices.', error);
        alert('Could not access your microphone.');
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(STUN_SERVERS);

    peerConnection.onicecandidate = handleIceCandidate;
    peerConnection.ontrack = handleTrack;

    // Add local tracks to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
}

function handleIceCandidate(event) {
    if (event.candidate) {
        fetch(`${API_BASE_URL}/signaling/send-candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUserId,
                receiverId: receiverId,
                candidate: JSON.stringify(event.candidate)
            })
        });
    }
}

function handleTrack(event) {
    if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = event.streams[0];
}

async function startSignaling() {
    signalingInterval = setInterval(async () => {
        // Check for an incoming offer or answer
        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        
        if (sdpResponse.status === 404) {
            return; // No new SDP, just continue
        }
        if (!sdpResponse.ok) {
            console.error('Error fetching SDP:', sdpResponse.statusText);
            return;
        }
        
        const sdpData = await sdpResponse.json();
        if (sdpData && sdpData.sdp && !peerConnection.currentRemoteDescription) {
            const sdp = { type: sdpData.type, sdp: sdpData.sdp };
            
            peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
                .then(() => {
                    console.log('Remote description set successfully.');

                    // Process bundled candidates that came with the SDP
                    if (sdpData.candidates && sdpData.candidates.length > 0) {
                        for (const candidate of sdpData.candidates) {
                            if (candidate.candidate) {
                                peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate.candidate)))
                                    .catch(e => console.error("Error adding bundled ICE candidate", e));
                            }
                        }
                    }

                    // If we received an offer, create and send an answer
                    if (sdp.type === 'offer') {
                        peerConnection.createAnswer()
                            .then(answer => peerConnection.setLocalDescription(answer))
                            .then(() => {
                                const localDesc = peerConnection.localDescription;
                                fetch(`${API_BASE_URL}/signaling/send-sdp`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        senderId: currentUserId,
                                        receiverId: sdpData.senderId,
                                        sdp: localDesc.sdp,
                                        type: localDesc.type
                                    })
                                });
                            })
                            .catch(e => console.error('Error creating answer:', e));
                    }
                })
                .catch(e => console.error('Error setting remote description:', e));
        }
    }, 2000);
}

async function initiateCall() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // --- Send the offer ---
    // The 'type' must be a top-level property
    await fetch(`${API_BASE_URL}/signaling/send-sdp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            senderId: currentUserId,
            receiverId: receiverId,
            sdp: offer.sdp, // Just the SDP string
            type: offer.type // 'type' as a top-level field
        })
    });
}

/**
 * Connects to the WebSocket server for real-time events like hangup.
 */
function connectWebSocket() {
    const wsUrl = `ws://localhost:8080/WebRTC_BackEnd/ws/chat/${currentUserId}`;
    websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // Listen for a hangup message from the other user
        if (message.type === 'hangup' && message.senderId.toString() === receiverId) {
            alert('The other user has ended the call.');
            cleanupCall();
            window.location.href = 'main.html';
        }
    };

    websocket.onclose = () => console.log('Notification WebSocket closed.');
    websocket.onerror = (error) => console.error('Notification WebSocket error:', error);
}

/**
 * Cleans up all call-related resources and notifies the backend.
 */
function cleanupCall() {
    if (websocket) {
        websocket.close();
    }
    // Notify the backend that the call has ended
    fetch(`${API_BASE_URL}/signaling/hangup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user1: currentUserId, 
            user2: receiverId 
        })
    }).catch(e => console.error("Failed to send hangup signal:", e));

    clearInterval(signalingInterval);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    if (remoteAudio) {
        remoteAudio.remove();
    }
    pendingCandidates = []; // Clear any pending candidates
}

function handleEndVoice() {
    // Show the custom modal instead of a browser confirm
    endCallModal.style.display = 'flex';
}

function confirmEndVoice() {
    cleanupCall();
    window.location.href = 'main.html';
}

async function handleLogout() {
    cleanupCall(); // End the call without confirmation
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error('Logout failed on server:', error);
    } finally {
        // Always clear session and redirect to login page
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

function toggleMute() {
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        muteBtn.textContent = track.enabled ? '🎤' : '🔇';
    });
}

// --- Initialization ---
async function initialize() {
    if (protectPage()) {
        userNameSpan.textContent = receiverName || 'User';
        if (avatarText && receiverName) {
            avatarText.textContent = receiverName[0].toUpperCase();
        }
        
        await setupMedia();
        createPeerConnection();
        startSignaling();
        connectWebSocket(); // Connect to WebSocket for notifications
        
        if (parseInt(currentUserId) < parseInt(receiverId)) {
            initiateCall();
        }

        muteBtn.addEventListener('click', toggleMute);
        endCallBtn.addEventListener('click', handleEndVoice); // Show modal
        
        // Modal button listeners
        confirmEndCallBtn.addEventListener('click', confirmEndVoice);
        cancelEndCallBtn.addEventListener('click', () => {
            endCallModal.style.display = 'none';
        });

        window.handleLogout = handleLogout;
    }
}

document.addEventListener('DOMContentLoaded', initialize); 