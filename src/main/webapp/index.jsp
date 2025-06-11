<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WebRTC SIP Client</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/chat.css">
</head>
<body>
    <div class="container">
        <div class="video-container">
            <video id="localVideo" autoplay playsinline></video>
            <video id="remoteVideo" autoplay playsinline></video>
            <div class="call-controls">
                <button id="callButton" class="control-button">Call</button>
                <button id="hangupButton" class="control-button" disabled>Hang Up</button>
            </div>
        </div>
        
        <div class="chat-container">
            <div class="user-list-container">
                <div id="user-list" class="user-list"></div>
            </div>
            <div class="chat-content">
                <div id="message-container" class="message-container"></div>
                <div class="message-input-container">
                    <textarea id="message-input" class="message-input" placeholder="Type a message..."></textarea>
                    <button id="send-button" class="send-button">Send</button>
                </div>
            </div>
        </div>
    </div>

    <input type="hidden" id="current-user-id" value="${sessionScope.userId}">
    
    <script src="js/webrtc.js"></script>
    <script src="js/chat.js"></script>
</body>
</html>
