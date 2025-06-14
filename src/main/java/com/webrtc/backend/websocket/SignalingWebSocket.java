package com.webrtc.backend.websocket;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;

import org.json.JSONObject;

@ServerEndpoint("/signaling/{userId}")
public class SignalingWebSocket {

    private static final Map<String, Session> userSessions = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") String userId) {
        System.out.println("Signaling WebSocket opened for user: " + userId);
        userSessions.put(userId, session);
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        System.out.println("Signaling message received: " + message);
        try {
            JSONObject jsonMessage = new JSONObject(message);
            // The data is inside the 'payload' object
            JSONObject payload = jsonMessage.optJSONObject("payload");

            if (payload != null) {
                // Get the receiverId from the payload more robustly
                if (payload.has("receiverId")) {
                    String receiverId = payload.get("receiverId").toString();
                    Session receiverSession = userSessions.get(receiverId);

                    if (receiverSession != null && receiverSession.isOpen()) {
                        // Relay the original message to the receiver
                        receiverSession.getBasicRemote().sendText(message);
                        System.out.println("Signaling message relayed to: " + receiverId);
                    } else {
                        System.out.println("Receiver " + receiverId + " not connected or session is closed.");
                    }
                } else {
                    System.out.println("Message payload does not contain a 'receiverId'.");
                }
            } else {
                System.out.println("Message does not contain a 'payload' object.");
            }
        } catch (Exception e) {
            System.err.println("Error processing signaling message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @OnClose
    public void onClose(Session session) {
        String userId = getUserIdFromSession(session);
        if (userId != null) {
            userSessions.remove(userId);
            System.out.println("Signaling WebSocket closed for user: " + userId);
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        String userId = getUserIdFromSession(session);
        if (userId != null) {
            userSessions.remove(userId);
            System.err.println("Error in signaling for user " + userId + ": " + throwable.getMessage());
        }
        throwable.printStackTrace();
    }

    private String getUserIdFromSession(Session session) {
        for (Map.Entry<String, Session> entry : userSessions.entrySet()) {
            if (entry.getValue().equals(session)) {
                return entry.getKey();
            }
        }
        return null;
    }
}
