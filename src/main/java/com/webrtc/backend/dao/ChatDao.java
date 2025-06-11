package com.webrtc.backend.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import com.webrtc.backend.model.ChatMessage;
import com.webrtc.backend.util.DatabaseUtil;

public class ChatDao {
    
    public void saveMessage(ChatMessage message) {
        String sql = "INSERT INTO chat_messages (sender_id, receiver_id, content, read) VALUES (?, ?, ?, ?)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, message.getSenderId());
            stmt.setInt(2, message.getReceiverId());
            stmt.setString(3, message.getContent());
            stmt.setBoolean(4, message.isRead());
            stmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public List<ChatMessage> getMessages(int userId1, int userId2) {
        String sql = "SELECT * FROM chat_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC";
        List<ChatMessage> messages = new ArrayList<>();
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId1);
            stmt.setInt(2, userId2);
            stmt.setInt(3, userId2);
            stmt.setInt(4, userId1);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                ChatMessage message = new ChatMessage();
                message.setId(rs.getInt("id"));
                message.setSenderId(rs.getInt("sender_id"));
                message.setReceiverId(rs.getInt("receiver_id"));
                message.setContent(rs.getString("content"));
                message.setRead(rs.getBoolean("read"));
                message.setCreatedAt(rs.getTimestamp("created_at"));
                messages.add(message);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return messages;
    }

    public List<ChatMessage> getUnreadMessages(int receiverId) {
        String sql = "SELECT * FROM chat_messages WHERE receiver_id = ? AND read = false ORDER BY created_at ASC";
        List<ChatMessage> messages = new ArrayList<>();
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, receiverId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                ChatMessage message = new ChatMessage();
                message.setId(rs.getInt("id"));
                message.setSenderId(rs.getInt("sender_id"));
                message.setReceiverId(rs.getInt("receiver_id"));
                message.setContent(rs.getString("content"));
                message.setRead(rs.getBoolean("read"));
                message.setCreatedAt(rs.getTimestamp("created_at"));
                messages.add(message);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return messages;
    }

    public void markAsRead(int messageId) {
        String sql = "UPDATE chat_messages SET read = true WHERE id = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, messageId);
            stmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public void markAllAsRead(int senderId, int receiverId) {
        String sql = "UPDATE chat_messages SET read = true WHERE sender_id = ? AND receiver_id = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, senderId);
            stmt.setInt(2, receiverId);
            stmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
} 