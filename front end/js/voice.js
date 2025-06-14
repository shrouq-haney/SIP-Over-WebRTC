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
    if (event.candidate && websocket && websocket.readyState === WebSocket.OPEN) {
        const message = {
            payload: {
                type: 'candidate',
                senderId: currentUserId,
                receiverId: receiverId,
                candidate: JSON.stringify(event.candidate)
            }
        };
        websocket.send(JSON.stringify(message));
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

function connectWebSocket() {
    const wsUrl = `ws://localhost:8080/WebRTC_BackEnd/signaling/${currentUserId}`;
    websocket = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
        websocket.onopen = () => {
            console.log('Signaling WebSocket connected');
            resolve();
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const payload = message.payload;
            
            if (payload) {
                switch (payload.type) {
                    case 'offer':
                        handleRemoteOffer(payload);
                        break;
                    case 'answer':
                        handleRemoteAnswer(payload);
                        break;
                    case 'candidate':
                        handleRemoteCandidate(payload);
                        break;
                    case 'hangup':
                        if (payload.senderId.toString() === receiverId) {
                            console.log("Received hangup via WebSocket. Cleaning up.");
                            alert('The other user has ended the call.');
                            hangupCallLocally();
                            window.location.href = 'main.html';
                        }
                        break;
                }
            }
        };

        websocket.onclose = () => {
            console.log('Signaling WebSocket closed.');
            reject(new Error('WebSocket connection closed'));
        };
        
        websocket.onerror = (error) => {
            console.error('Signaling WebSocket error:', error);
            reject(error);
        };
    });
}

async function handleRemoteOffer(payload) {
    if (!peerConnection.currentRemoteDescription) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'offer',
                sdp: payload.sdp
            }));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            // Send answer through WebSocket
            const message = {
                payload: {
                    type: 'answer',
                    senderId: currentUserId,
                    receiverId: payload.senderId,
                    sdp: answer.sdp
                }
            };
            websocket.send(JSON.stringify(message));
        } catch (e) {
            console.error('Error handling remote offer:', e);
        }
    }
}

async function handleRemoteAnswer(payload) {
    if (!peerConnection.currentRemoteDescription) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: payload.sdp
            }));
        } catch (e) {
            console.error('Error handling remote answer:', e);
        }
    }
}

async function handleRemoteCandidate(payload) {
    try {
        const candidate = JSON.parse(payload.candidate);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding ICE candidate:', e);
    }
}

async function initiateCall() {
    try {
        console.log("This client is the caller. Creating an offer...");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Wait for WebSocket to be ready
        if (websocket.readyState !== WebSocket.OPEN) {
            console.log("Waiting for WebSocket connection...");
            await connectWebSocket();
        }

        // Send offer through WebSocket
        const message = {
            payload: {
                type: 'offer',
                senderId: currentUserId,
                receiverId: receiverId,
                sdp: offer.sdp
            }
        };
        websocket.send(JSON.stringify(message));
    } catch (error) {
        console.error('Error initiating call:', error);
        alert('Failed to initiate call. Please try again.');
    }
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
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        const message = {
            payload: {
                type: 'hangup',
                senderId: currentUserId,
                receiverId: receiverId
            }
        };
        websocket.send(JSON.stringify(message));
    }
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
        
        try {
            await setupMedia();
            createPeerConnection();
            await connectWebSocket(); // Wait for WebSocket connection
            
            const urlParams = new URLSearchParams(window.location.search);
            const isCaller = urlParams.get('isCaller') === 'true';

            if (isCaller) {
                await initiateCall();
            } else {
                handleIncomingOffer();
            }

            muteBtn.addEventListener('click', toggleMute);
            endCallBtn.addEventListener('click', handleEndVoice);
            
            // Modal button listeners
            confirmEndCallBtn.addEventListener('click', confirmEndVoice);
            cancelEndCallBtn.addEventListener('click', () => {
                endCallModal.style.display = 'none';
            });

            window.handleLogout = handleLogout;
        } catch (error) {
            console.error('Error during initialization:', error);
            alert('Failed to initialize call. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize); 