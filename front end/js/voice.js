import { API_BASE_URL } from './api.js';

// --- Global State & Configuration ---
const currentUserId = sessionStorage.getItem('userId');
const receiverId = sessionStorage.getItem('receiverId');
const receiverName = sessionStorage.getItem('receiverName');

let localStream;
let remoteAudio;
let peerConnection;
let signalingInterval;

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

        const sdpResponse = await fetch(`${API_BASE_URL}/signaling/get-sdp?userId=${currentUserId}`);
        if (sdpResponse.ok) {
            const sdpData = await sdpResponse.json();
            if (sdpData && sdpData.sdp) {
                const sdp = JSON.parse(sdpData.sdp);
                if (sdp.type === 'offer') {
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
                    if (!peerConnection.currentRemoteDescription) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                    }
                }
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

function handleEndVoice() {
    if (confirm('Are you sure you want to end this voice call?')) {
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
        window.location.href = 'main.html';
    }
}

async function handleLogout() {
    handleEndVoice();
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

        window.handleEndVoice = handleEndVoice;
        window.handleLogout = handleLogout;
    }
}

document.addEventListener('DOMContentLoaded', initialize); 