import { API_BASE_URL } from './api.js';

// --- Global State & Configuration ---
const currentUserId = sessionStorage.getItem('userId');
const receiverId = sessionStorage.getItem('receiverId');
const receiverName = sessionStorage.getItem('receiverName');

let localStream;
let remoteStream;
let peerConnection;
let signalingInterval;
let pendingCandidates = []; // Queue for candidates that arrive early
let websocket; // WebSocket for real-time notifications
let isSignalingInProgress = false; // Lock to prevent signaling race conditions
let callTimer;

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- DOM Elements ---
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const userNameSpan = document.getElementById('userName');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
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
    console.log("Requesting user media (video and audio)...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("%cSuccessfully obtained local media stream.", 'color: green; font-weight: bold;');

        // --- Detailed Track Logging ---
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        console.log(`Stream has ${videoTracks.length} video track(s) and ${audioTracks.length} audio track(s).`);
        if (videoTracks.length > 0) {
            console.log(`Video track ready state: ${videoTracks[0].readyState}, enabled: ${videoTracks[0].enabled}`);
        }
        if (audioTracks.length > 0) {
            console.log(`Audio track ready state: ${audioTracks[0].readyState}, enabled: ${audioTracks[0].enabled}`);
        }
        // -------------------------

    } catch (error) {
        console.error('CRITICAL: Error accessing media devices.', error);
        alert('Could not access your camera and microphone. Please check browser permissions and ensure no other application is using the camera.');
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
    console.log("Adding local stream tracks to the peer connection...");
    localStream.getTracks().forEach(track => {
        console.log(`Adding track: ${track.kind}, state: ${track.readyState}, enabled: ${track.enabled}`);
        peerConnection.addTrack(track, localStream);
    });
}

function handleIceCandidate(event) {
    if (event.candidate) {
        if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            // If we have a remote description, send the candidate immediately
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                console.log('Sending ICE candidate immediately:', event.candidate.candidate);
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
        } else {
            // If we don't have a remote description yet, queue the candidate
            console.log('Queueing ICE candidate - waiting for remote description:', event.candidate.candidate);
            pendingCandidates.push(event.candidate);
        }
    }
}

function handleTrack(event) {
    console.log("%cRemote track received. Attaching to video element.", 'font-weight: bold; color: green;');
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;

    // The signaling and connection are perfect. If the video is black, it's a
    // device/browser rendering issue. This CSS forces it to be visible.
    remoteVideo.style.display = 'block';
    remoteVideo.style.width = '100%';
    remoteVideo.style.height = '100%';
    remoteVideo.style.backgroundColor = 'black';
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
    
    // IMPORTANT: Clean up immediately after reading to prevent re-processing on refresh.
    sessionStorage.removeItem('incomingSdpOffer');

    try {
        // Get local media stream first
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        // Create peer connection
        createPeerConnection();
        
        // Set remote description from the offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpPayload.sdp }));
        
        // Process any pending ICE candidates
        processPendingIceCandidates();
        
        // Create and set local description (answer)
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send the answer back to the caller
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
    } catch (error) {
        console.error('Error handling incoming offer:', error);
        resetCallState();
    }
}

function processPendingIceCandidates() {
    if (pendingCandidates.length > 0 && peerConnection && peerConnection.remoteDescription) {
        console.log(`Processing ${pendingCandidates.length} pending ICE candidates...`);
        const candidates = [...pendingCandidates];
        pendingCandidates = []; // Clear the array before processing
        
        candidates.forEach(async (candidate) => {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Pending ICE candidate added successfully:', candidate.candidate);
            } catch (error) {
                console.error('Error adding pending ICE candidate:', error);
                // If we fail to add a candidate, put it back in the queue
                pendingCandidates.push(candidate);
            }
        });
    } else {
        console.log('No pending candidates to process or peer connection not ready');
    }
}

function resetCallState() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    pendingCandidates = [];
    window.location.href = 'main.html';
}

function connectWebSocket() {
    const wsUrl = `ws://localhost:8080/WebRTC_BackEnd/signaling/${currentUserId}`;
    websocket = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
        websocket.onopen = () => {
            console.log('Signaling WebSocket connected');
            resolve();
        };

        websocket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            const payload = message.payload;
            
            if (payload) {
                switch (payload.type) {
                    case 'offer':
                        // Handle offer immediately
                        await handleRemoteOffer(payload);
                        break;
                    case 'answer':
                        await handleRemoteAnswer(payload);
                        break;
                    case 'candidate':
                        await handleRemoteCandidate(payload);
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
            console.log('Setting remote description from offer...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'offer',
                sdp: payload.sdp
            }));
            console.log('Remote description set successfully');
            
            processPendingIceCandidates();
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            const message = {
                payload: {
                    type: 'answer',
                    senderId: currentUserId,
                    receiverId: payload.senderId,
                    sdp: answer.sdp
                }
            };
            websocket.send(JSON.stringify(message));
            console.log('Answer sent through WebSocket');
            
            if (!callTimer) {
                startCallTimer();
            }
        } catch (e) {
            console.error('Error handling remote offer:', e);
        }
    }
}

async function handleRemoteAnswer(payload) {
    if (!peerConnection.currentRemoteDescription) {
        try {
            console.log('Setting remote description from answer...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: payload.sdp
            }));
            console.log('Remote description set successfully');
            
            processPendingIceCandidates();
            
            if (!callTimer) {
                startCallTimer();
            }
        } catch (e) {
            console.error('Error handling remote answer:', e);
        }
    }
}

async function handleRemoteCandidate(payload) {
    try {
        const candidate = JSON.parse(payload.candidate);
        if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            console.log('Adding remote ICE candidate immediately:', candidate.candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Remote ICE candidate added successfully');
        } else {
            console.log('Queueing remote ICE candidate - waiting for remote description:', candidate.candidate);
            pendingCandidates.push(candidate);
        }
    } catch (e) {
        console.error('Error handling ICE candidate:', e);
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

function handleEndVideo() {
    // Instead of confirming, just show the modal
    endCallModal.style.display = 'flex';
}

function confirmEndVideo() {
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

function toggleVideo() {
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        videoBtn.textContent = track.enabled ? '📹' : '📸';
    });
}


// --- Initialization ---
async function initialize() {
    if (protectPage()) {
        userNameSpan.textContent = receiverName || 'User';
        
        try {
            await setupMedia();
            createPeerConnection();
            await connectWebSocket();
            
            const urlParams = new URLSearchParams(window.location.search);
            const isCaller = urlParams.get('isCaller') === 'true';
            const incomingOffer = sessionStorage.getItem('incomingSdpOffer');

            if (isCaller) {
                await initiateCall();
            } else if (incomingOffer) {
                // If we have an incoming offer, handle it immediately
                const offerData = JSON.parse(incomingOffer);
                await handleRemoteOffer(offerData);
                sessionStorage.removeItem('incomingSdpOffer');
            }

            // Add event listeners
            muteBtn.addEventListener('click', toggleMute);
            videoBtn.addEventListener('click', toggleVideo);
            endCallBtn.addEventListener('click', handleEndVideo);
            
            // Modal button listeners
            confirmEndCallBtn.addEventListener('click', confirmEndVideo);
            cancelEndCallBtn.addEventListener('click', () => {
                endCallModal.style.display = 'none';
            });

            // Make functions globally available
            window.handleLogout = handleLogout;
        } catch (error) {
            console.error('Error during initialization:', error);
            alert('Failed to initialize call. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize); 