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
let isSignalingInProgress = false; // Lock to prevent signaling race conditions

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

    // Monitor the connection state
    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection) {
            console.log(`ICE Connection State: %c${peerConnection.iceConnectionState}`, 'font-weight: bold; color: blue;');
        }
    };

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
    console.log("%cRemote track received. Attaching to audio element.", 'font-weight: bold; color: green;');
    if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = event.streams[0];

    // For debugging, ensure the audio element is not accidentally hidden or muted by CSS/attributes
    remoteAudio.volume = 1.0;
    remoteAudio.muted = false;
}

/**
 * Handles the initial offer passed from the main page via session storage.
 */
async function handleIncomingOffer() {
    const offerString = sessionStorage.getItem('incomingSdpOffer');
    if (!offerString) {
        console.warn("Call page loaded without an incoming SDP offer in session storage.");
        return;
    }

    console.log("Found incoming SDP offer in session storage. Processing...");
    const sdpPayload = JSON.parse(offerString);
    
    sessionStorage.removeItem('incomingSdpOffer'); // Clean up

    await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpPayload.sdp }));
    
    console.log("Remote description (offer) set successfully. Creating answer...");
    const answer = await peerConnection.createAnswer();
    
    console.log("Answer created. Setting local description...");
    await peerConnection.setLocalDescription(answer);

    console.log("Local description (answer) set. Sending answer to server...");
    await fetch(`${API_BASE_URL}/signaling/send-sdp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            senderId: currentUserId,
            receiverId: sdpPayload.senderId,
            sdp: answer.sdp,
            type: answer.type
        })
    });
    console.log("Answer sent to signaling server.");
}

async function startSignaling() {
    // This interval now only needs to handle receiving the ANSWER for the original caller.
    signalingInterval = setInterval(async () => {
        // If we are already processing a signal, wait until it's done.
        if (isSignalingInProgress) {
            return;
        }

        // Check for an incoming offer or answer
        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        
        if (peerConnection) {
            console.log(`Polling... Current remote description is:`, peerConnection.currentRemoteDescription);
        }
        
        if (sdpResponse.status === 404) {
            return; // No new SDP, just continue
        }
        if (!sdpResponse.ok) {
            console.error('Error fetching SDP:', sdpResponse.statusText);
            return;
        }
        
        const sdpData = await sdpResponse.json();

        // Check for a hangup or rejection signal from the other user
        if (sdpData.status === 'hangup' || sdpData.status === 'rejected') {
            console.log("Received hangup/reject signal from other user.");
            alert('The other user has ended the call.');
            hangupCallLocally(); // Clean up without sending another hangup signal
            window.location.href = 'main.html';
            return;
        }
        
        if (sdpData && sdpData.sdp && !peerConnection.currentRemoteDescription) {
            isSignalingInProgress = true; // Acquire lock
            const sdp = { type: sdpData.type, sdp: sdpData.sdp };

            console.log(`Received SDP of type '${sdp.type}'. Processing...`);

            peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
                .then(() => {
                    console.log('Remote description set successfully.');

                    // The receiver now handles the offer from session storage.
                    // This logic is now only for the CALLER receiving the ANSWER.
                    if (sdp.type === 'answer') {
                        console.log("SDP type is 'answer'. Call should be established.");
                        isSignalingInProgress = false; // Release lock
                    }
                })
                .catch(e => {
                    console.error('CRITICAL: Error setting remote description.', e);
                    console.error('SDP that caused the error:', sdp);
                    isSignalingInProgress = false; // Release lock on critical error
                });
        }
    }, 2000);
}

async function initiateCall() {
    console.log("This client is the caller. Creating an offer...");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // --- Send the offer ---
    // The 'type' must be a top-level property
    console.log("Offer created and local description set. Sending offer to server for receiver:", receiverId);
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
            console.log("Received hangup via WebSocket. Cleaning up.");
            alert('The other user has ended the call.');
            hangupCallLocally();
            window.location.href = 'main.html';
        }
    };

    websocket.onclose = () => console.log('Notification WebSocket closed.');
    websocket.onerror = (error) => console.error('Notification WebSocket error:', error);
}

/**
 * Cleans up local call resources (streams, connections) without notifying the server.
 */
function hangupCallLocally() {
    if (websocket) {
        websocket.close();
    }
    clearInterval(signalingInterval);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    pendingCandidates = [];
}

/**
 * Notifies the backend that the call has ended and cleans up local resources.
 */
function hangupCall() {
    // Notify the backend that the call has ended
    fetch(`${API_BASE_URL}/signaling/hangup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user1: currentUserId,
            user2: receiverId
        })
    }).catch(e => console.error("Failed to send hangup signal:", e));

    hangupCallLocally();
}

function handleEndVoice() {
    // Show the custom modal instead of a browser confirm
    endCallModal.style.display = 'flex';
}

function confirmEndVoice() {
    hangupCall();
    window.location.href = 'main.html';
}

async function handleLogout() {
    hangupCall(); // End the call without confirmation
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
        
        const urlParams = new URLSearchParams(window.location.search);
        const isCaller = urlParams.get('isCaller') === 'true';

        if (isCaller) {
            initiateCall();
        } else {
            handleIncomingOffer();
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