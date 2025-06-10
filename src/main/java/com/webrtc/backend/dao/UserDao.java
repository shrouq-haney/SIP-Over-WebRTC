package com.webrtc.backend.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import com.webrtc.backend.model.User;
import com.webrtc.backend.util.DatabaseUtil;
import com.webrtc.backend.util.PasswordUtil;

public class UserDao {

    public void createUser(User user) throws SQLException {
        String hashedPassword = PasswordUtil.hashPassword(user.getPassword());
        String sql = "INSERT INTO users (username, password_hash, msisdn) VALUES (?, ?, ?)";
        
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, user.getUsername());
            stmt.setString(2, hashedPassword);
            stmt.setString(3, user.getMsisdn());
            stmt.executeUpdate();
        }
    }

    public User getUserByUsername(String username) throws SQLException {
        String sql = "SELECT * FROM users WHERE username = ?";
        User user = null;

        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, username);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    user = new User();
                    user.setId(rs.getInt("id"));
                    user.setUsername(rs.getString("username"));
                    user.setPasswordHash(rs.getString("password_hash"));
                    user.setMsisdn(rs.getString("msisdn"));
                    user.setOnline(rs.getBoolean("online"));
                    user.setLastUpdate(rs.getTimestamp("last_update"));
                    user.setCreatedAt(rs.getTimestamp("created_at"));
                }
            }
        }
        return user;
    }

    public java.util.List<User> getOnlineUsers() throws SQLException {
        String sql = "SELECT id, username FROM users WHERE online = TRUE";
        java.util.List<User> onlineUsers = new java.util.ArrayList<>();

        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                User user = new User();
                user.setId(rs.getInt("id"));
                user.setUsername(rs.getString("username"));
                onlineUsers.add(user);
            }
        }
        return onlineUsers;
    }

    public void updateOfflineUsers(int timeoutInMinutes) throws SQLException {
        // This query updates users to 'offline' if their last_update timestamp is older than the specified timeout.
        String sql = "UPDATE users SET online = FALSE WHERE online = TRUE AND last_update < NOW() - INTERVAL ? MINUTE";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, timeoutInMinutes);
            int affectedRows = stmt.executeUpdate();
            if (affectedRows > 0) {
                System.out.println("Set " + affectedRows + " user(s) to offline.");
            }
        }
    }

    public void updateUserHeartbeat(int userId) throws SQLException {
        // This query updates the user's online status to TRUE, which also implicitly
        // updates the last_update timestamp due to the table's ON UPDATE CURRENT_TIMESTAMP definition.
        String sql = "UPDATE users SET online = TRUE WHERE id = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.executeUpdate();
        }
    }

    public void setUserOffline(int userId) throws SQLException {
        String sql = "UPDATE users SET online = FALSE WHERE id = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.executeUpdate();
        }
    }
} 