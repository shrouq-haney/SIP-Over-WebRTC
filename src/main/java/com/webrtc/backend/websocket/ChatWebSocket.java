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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.ChatDao;
import com.webrtc.backend.model.ChatMessage;

@ServerEndpoint("/ws/chat/{userId}")
public class ChatWebSocket {
    private static final Map<Integer, Session> sessions = new ConcurrentHashMap<>();
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final ChatDao chatDao = new ChatDao();

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") int userId) {
        sessions.put(userId, session);
    }

    @OnClose
    public void onClose(@PathParam("userId") int userId) {
        sessions.remove(userId);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        throwable.printStackTrace();
    }

    @OnMessage
    public void onMessage(String message, Session session, @PathParam("userId") int senderId) {
        try {
            ChatMessage chatMessage = objectMapper.readValue(message, ChatMessage.class);
            chatMessage.setSenderId(senderId);
            
            // Save message to database
            chatDao.saveMessage(chatMessage);

            // Send message to receiver if online
            Session receiverSession = sessions.get(chatMessage.getReceiverId());
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.getBasicRemote().sendText(objectMapper.writeValueAsString(chatMessage));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static void sendMessage(int userId, String message) {
        Session session = sessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                session.getBasicRemote().sendText(message);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
} 