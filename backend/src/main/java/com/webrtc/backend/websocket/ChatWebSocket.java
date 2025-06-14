package com.webrtc.backend.websocket;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.ChatDao;
import com.webrtc.backend.model.ChatMessage;

@ServerEndpoint("/ws/chat/{userId}")
public class ChatWebSocket {

    private static final Map<Integer, Session> activeSessions = new ConcurrentHashMap<>();
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final ChatDao chatDao = new ChatDao();

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") int userId) {
        activeSessions.put(userId, session);
        System.out.println("WebSocket connection opened for user: " + userId);
    }

    @OnClose
    public void onClose(@PathParam("userId") int userId) {
        activeSessions.remove(userId);
        System.out.println("WebSocket connection closed for user: " + userId);
    }

    @OnMessage
    public void onMessage(String messageJson, @PathParam("userId") int senderId) {
        try {
            // Parse the incoming message
            ChatMessage message = objectMapper.readValue(messageJson, ChatMessage.class);
            message.setSenderId(senderId);
            message.setRead(false);
            
            // Save the message to the database
            chatDao.saveMessage(message);
            
            // Try to deliver the message to the receiver if they're online
            Session receiverSession = activeSessions.get(message.getReceiverId());
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.getBasicRemote().sendText(objectMapper.writeValueAsString(message));
                // Mark the message as read since it was delivered
                chatDao.markAsRead(message.getId());
                message.setRead(true);
                
                // Send delivery confirmation back to the sender
                Session senderSession = activeSessions.get(senderId);
                if (senderSession != null && senderSession.isOpen()) {
                    senderSession.getBasicRemote().sendText(objectMapper.writeValueAsString(message));
                }
            }
        } catch (IOException | SQLException e) {
            e.printStackTrace();
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("Error in WebSocket session: " + session.getId());
        throwable.printStackTrace();
    }

    /**
     * Utility method to send a raw JSON string to a specific user.
     * Can be used for notifications like 'hangup'.
     */
    public static void notifyUser(int userId, String jsonMessage) {
        try {
            Session session = activeSessions.get(userId);
            if (session != null && session.isOpen()) {
                session.getBasicRemote().sendText(jsonMessage);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Utility method to send a message to a specific user
     */
    public static void sendMessage(int userId, ChatMessage message) {
        try {
            Session session = activeSessions.get(userId);
            if (session != null && session.isOpen()) {
                session.getBasicRemote().sendText(objectMapper.writeValueAsString(message));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Check if a user is currently connected
     */
    public static boolean isUserConnected(int userId) {
        Session session = activeSessions.get(userId);
        return session != null && session.isOpen();
    }
} 