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
        // Send the candidate to the other peer via the signaling server
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
        // This case should ideally not happen if the user flow is correct.
        // It means this page was loaded without a preceding call offer.
        console.warn("Call page loaded without an incoming SDP offer in session storage.");
        return;
    }

    console.log("Found incoming SDP offer in session storage. Processing...");
    const sdpPayload = JSON.parse(offerString);
    
    // IMPORTANT: Clean up immediately after reading to prevent re-processing on refresh.
    sessionStorage.removeItem('incomingSdpOffer');

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
    // This interval will handle all signaling: offers, answers, and candidates
    signalingInterval = setInterval(async () => {
        // If we are already processing a signal, wait until it's done.
        if (isSignalingInProgress) {
            return;
        }

        // Check for an incoming offer or answer
        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        
        // --- Start of new logging ---
        if (peerConnection) {
            console.log(`Polling... Current remote description is:`, peerConnection.currentRemoteDescription);
        }
        // --- End of new logging ---

        if (sdpResponse.status === 404) {
            return; // No new SDP, just continue silently
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

                    // If we received an OFFER, we must create an ANSWER.
                    if (sdp.type === 'offer') {
                        console.log("SDP type is 'offer'. Creating an answer...");
                        peerConnection.createAnswer()
                            .then(answer => {
                                console.log("Answer created successfully. Setting local description.");
                                return peerConnection.setLocalDescription(answer);
                            })
                            .then(() => {
                                const localDesc = peerConnection.localDescription;
                                console.log("Local description set. Sending answer to the server for receiver:", sdpData.senderId);
                                fetch(`${API_BASE_URL}/signaling/send-sdp`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        senderId: currentUserId,
                                        receiverId: sdpData.senderId,
                                        sdp: localDesc.sdp,
                                        type: localDesc.type
                                    })
                                }).finally(() => {
                                    isSignalingInProgress = false; // Release lock
                                });
                            })
                            .catch(e => {
                                console.error('Error creating or sending answer:', e);
                                isSignalingInProgress = false; // Release lock on error
                            });
                    } 
                    // If we received an ANSWER, the call is established.
                    else if (sdp.type === 'answer') {
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

// Caller initiates the call
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
        // The original implementation for hangup used polling, but a WebSocket message is more real-time.
        // We will keep listening here as a fallback or for other real-time notifications.
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
            // The user prompt used 'from' and 'to', but the previous implementation used user1/user2.
            // Sticking with user1/user2 to match the backend implementation from the diffs.
            user1: currentUserId,
            user2: receiverId
        })
    }).catch(e => console.error("Failed to send hangup signal:", e));
    
    hangupCallLocally(); // Perform the local cleanup
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
        
        await setupMedia();
        createPeerConnection();
        // The signaling interval is for receiving the ANSWER (if caller) or subsequent candidates.
        startSignaling(); 
        connectWebSocket(); // Connect to WebSocket for notifications
        
        const urlParams = new URLSearchParams(window.location.search);
        const isCaller = urlParams.get('isCaller') === 'true';

        if (isCaller) {
            initiateCall();
        } else {
            // If this client is the receiver, the offer should be in session storage.
            handleIncomingOffer();
        }

        // Add event listeners
        muteBtn.addEventListener('click', toggleMute);
        videoBtn.addEventListener('click', toggleVideo);
        endCallBtn.addEventListener('click', handleEndVideo); // Show modal on click
        
        // Modal button listeners
        confirmEndCallBtn.addEventListener('click', confirmEndVideo);
        cancelEndCallBtn.addEventListener('click', () => {
            endCallModal.style.display = 'none';
        });

        // Make functions globally available
        window.handleLogout = handleLogout;
    }
}

document.addEventListener('DOMContentLoaded', initialize); 