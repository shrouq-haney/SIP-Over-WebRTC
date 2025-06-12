import { API_BASE_URL } from './api.js';

// --- Global State & Configuration ---
const currentUserId = sessionStorage.getItem('userId');
const receiverId = sessionStorage.getItem('receiverId');
const receiverName = sessionStorage.getItem('receiverName');

let localStream;
let remoteStream;
let peerConnection;
let signalingInterval;

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
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Error accessing media devices.', error);
        alert('Could not access your camera and microphone.');
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
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
}

async function startSignaling() {
    // This interval will handle all signaling: offers, answers, and candidates
    signalingInterval = setInterval(async () => {
        // 1. Get remote ICE candidates
        const candidatesResponse = await fetch(`${API_BASE_URL}/signaling/get-candidates?userId=${currentUserId}`);
        if (candidatesResponse.ok) {
            const candidates = await candidatesResponse.json();
            candidates.forEach(c => {
                if (c.candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(c.candidate)))
                        .catch(e => console.error("Error adding received ICE candidate", e));
                }
            });
        }

        // 2. Check for an incoming offer or answer
        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        if (sdpResponse.ok) {
            const sdpData = await sdpResponse.json();
            if (sdpData && sdpData.sdp) {
                const sdp = JSON.parse(sdpData.sdp);
                if (sdp.type === 'offer') {
                    // This user is the callee
                    if (!peerConnection.currentRemoteDescription) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
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
                } else if (sdp.type === 'answer') {
                    // This user is the caller
                    if (!peerConnection.currentRemoteDescription) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                    }
                }
            }
        }
    }, 2000); // Poll every 2 seconds
}

// Caller initiates the call
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

function handleEndVideo() {
    if (confirm('Are you sure you want to end this video call?')) {
        clearInterval(signalingInterval);
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection) {
            peerConnection.close();
        }
        window.location.href = 'main.html';
    }
}

async function handleLogout() {
    handleEndVideo(); // a full cleanup
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
        startSignaling();
        
        // A simple way to decide who makes the offer: the one with the lower ID.
        // This is a naive approach but avoids both users making an offer simultaneously.
        // A more robust solution might use a dedicated "call" signal.
        if (parseInt(currentUserId) < parseInt(receiverId)) {
            initiateCall();
        }

        // Add event listeners
        muteBtn.addEventListener('click', toggleMute);
        videoBtn.addEventListener('click', toggleVideo);

        // Make functions globally available
        window.handleEndVideo = handleEndVideo;
        window.handleLogout = handleLogout;
    }
}

document.addEventListener('DOMContentLoaded', initialize); 