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
        // --- 1. Get remote ICE candidates ---
        const candidatesResponse = await fetch(`${API_BASE_URL}/signaling/get-candidates?userId=${currentUserId}`);
        if (candidatesResponse.ok) {
            const candidates = await candidatesResponse.json();
            for (const c of candidates) {
                if (c.candidate) {
                    const iceCandidate = new RTCIceCandidate(JSON.parse(c.candidate));
                    // If we already have a remote description, add the candidate immediately.
                    // Otherwise, queue it for later.
                    if (peerConnection.remoteDescription) {
                        await peerConnection.addIceCandidate(iceCandidate).catch(e => console.error("Error adding ICE candidate", e));
                    } else {
                        pendingCandidates.push(iceCandidate);
                    }
                }
            }
        }

        // --- 2. Check for an incoming offer or answer ---
        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        
        // Handle 404 quietly - it's expected when there's no call
        if (sdpResponse.status === 404) {
            return; // No new SDP, just continue
        }
        if (!sdpResponse.ok) {
            console.error('Error fetching SDP:', sdpResponse.statusText);
            return;
        }
        
        const sdpData = await sdpResponse.json();
        if (sdpData && sdpData.sdp && !peerConnection.currentRemoteDescription) {
            const sdp = JSON.parse(sdpData.sdp);

            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            
            // Now that the remote description is set, process any queued candidates
            for (const candidate of pendingCandidates) {
                await peerConnection.addIceCandidate(candidate).catch(e => console.error("Error adding queued ICE candidate", e));
            }
            pendingCandidates = []; // Clear the queue

            // If we received an offer, we must create and send an answer
            if (sdp.type === 'offer') {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                await fetch(`${API_BASE_URL}/signaling/send-sdp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        senderId: currentUserId,
                        receiverId: sdpData.senderId,
                        sdp: JSON.stringify(answer)
                    })
                });
            }
        }
    }, 2000);
}

async function initiateCall() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await fetch(`${API_BASE_URL}/signaling/send-sdp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            senderId: currentUserId,
            receiverId: receiverId,
            sdp: JSON.stringify(offer)
        })
    });
}

/**
 * Cleans up all call-related resources.
 */
function cleanupCall() {
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