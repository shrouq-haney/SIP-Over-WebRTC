package com.webrtc.backend.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import com.webrtc.backend.model.CallStatus;
import com.webrtc.backend.model.IceCandidate;
import com.webrtc.backend.model.SdpExchange;
import com.webrtc.backend.model.SdpType;
import com.webrtc.backend.util.DatabaseUtil;

public class SignalingDao {

    public void saveSdp(SdpExchange sdp) throws SQLException {
        String sql = "INSERT INTO sdp_exchange (sender_id, receiver_id, type, sdp) VALUES (?, ?, ?, ?)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, sdp.getSenderId());
            stmt.setInt(2, sdp.getReceiverId());
            stmt.setString(3, sdp.getType().getType());
            stmt.setString(4, sdp.getSdp());
            stmt.executeUpdate();
        }
    }

    public SdpExchange getSdp(int receiverId) throws SQLException {
        String sql = "SELECT * FROM sdp_exchange WHERE receiver_id = ? ORDER BY created_at DESC LIMIT 1";
        SdpExchange sdp = null;
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, receiverId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                sdp = new SdpExchange();
                sdp.setId(rs.getInt("id"));
                sdp.setSenderId(rs.getInt("sender_id"));
                sdp.setReceiverId(rs.getInt("receiver_id"));
                sdp.setType(SdpType.fromString(rs.getString("type")));
                sdp.setSdp(rs.getString("sdp"));
                sdp.setStatus(CallStatus.fromString(rs.getString("status")));
                sdp.setCreatedAt(rs.getTimestamp("created_at"));
            }
        }
        return sdp;
    }

    public void updateSdpStatus(int senderId, int receiverId, CallStatus status) throws SQLException {
        String sql = "UPDATE sdp_exchange SET status = ? WHERE id = (" +
                "SELECT id FROM (SELECT id FROM sdp_exchange " +
                "WHERE sender_id = ? AND receiver_id = ? " +
                "ORDER BY created_at DESC LIMIT 1) AS subquery)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, status.getStatus());
            stmt.setInt(2, senderId);
            stmt.setInt(3, receiverId);
            stmt.executeUpdate();
        }
    }

    public SdpExchange getCallStatus(int senderId, int receiverId) throws SQLException {
        String sql = "SELECT * FROM sdp_exchange WHERE sender_id = ? AND receiver_id = ? ORDER BY created_at DESC LIMIT 1";
        SdpExchange sdp = null;
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, senderId);
            stmt.setInt(2, receiverId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                sdp = new SdpExchange();
                sdp.setId(rs.getInt("id"));
                sdp.setSenderId(rs.getInt("sender_id"));
                sdp.setReceiverId(rs.getInt("receiver_id"));
                sdp.setType(SdpType.fromString(rs.getString("type")));
                sdp.setSdp(rs.getString("sdp"));
                sdp.setStatus(CallStatus.fromString(rs.getString("status")));
                sdp.setCreatedAt(rs.getTimestamp("created_at"));
            }
        }
        return sdp;
    }

    public void saveIceCandidate(IceCandidate candidate) throws SQLException {
        String sql = "INSERT INTO ice_candidates (sender_id, receiver_id, candidate) VALUES (?, ?, ?)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, candidate.getSenderId());
            stmt.setInt(2, candidate.getReceiverId());
            stmt.setString(3, candidate.getCandidate());
            stmt.executeUpdate();
        }
    }

    public List<IceCandidate> getIceCandidates(int receiverId) throws SQLException {
        String sql = "SELECT * FROM ice_candidates WHERE receiver_id = ?";
        List<IceCandidate> candidates = new ArrayList<>();
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, receiverId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                IceCandidate candidate = new IceCandidate();
                candidate.setId(rs.getInt("id"));
                candidate.setSenderId(rs.getInt("sender_id"));
                candidate.setReceiverId(rs.getInt("receiver_id"));
                candidate.setCandidate(rs.getString("candidate"));
                candidate.setCreatedAt(rs.getTimestamp("created_at"));
                candidates.add(candidate);
            }
        }
        return candidates;
    }

    public void deleteIceCandidates(int receiverId) throws SQLException {
        String sql = "DELETE FROM ice_candidates WHERE receiver_id = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, receiverId);
            stmt.executeUpdate();
        }
    }

    /**
     * Atomically retrieves and deletes the latest SDP message (offer or answer) for a user.
     * This prevents the same signaling message from being processed multiple times.
     * @param userId The ID of the user receiving the message.
     * @return The SdpExchange object if found, otherwise null.
     */
    public SdpExchange consumeSdpForUser(int userId) {
        SdpExchange sdpData = null;
        String selectSql = "SELECT * FROM sdp_exchange WHERE receiver_id = ? ORDER BY created_at DESC LIMIT 1";
        String deleteSql = "DELETE FROM sdp_exchange WHERE id = ?";
        Connection conn = null;

        try {
            conn = DatabaseUtil.getConnection();
            // Start a transaction to ensure the SELECT and DELETE happen together
            conn.setAutoCommit(false);

            // Step 1: Find the latest message for the user
            try (PreparedStatement selectPs = conn.prepareStatement(selectSql)) {
                selectPs.setInt(1, userId);
                try (ResultSet rs = selectPs.executeQuery()) {
                    if (rs.next()) {
                        sdpData = new SdpExchange();
                        // Map all columns from your table here
                        sdpData.setId(rs.getInt("id"));
                        sdpData.setSenderId(rs.getInt("sender_id"));
                        sdpData.setReceiverId(rs.getInt("receiver_id"));
                        sdpData.setSdp(rs.getString("sdp"));
                        sdpData.setType(SdpType.fromString(rs.getString("type")));
                        sdpData.setCreatedAt(rs.getTimestamp("created_at"));
                    }
                }
            }

            // Step 2: If we found a message, delete it so it's not processed again
            if (sdpData != null) {
                try (PreparedStatement deletePs = conn.prepareStatement(deleteSql)) {
                    deletePs.setInt(1, sdpData.getId());
                    deletePs.executeUpdate();
                }
            }
            
            // Finalize the transaction
            conn.commit();

        } catch (SQLException e) {
            if (conn != null) {
                try {
                    conn.rollback(); // Undo changes if anything went wrong
                } catch (SQLException ex) {
                    ex.printStackTrace();
                }
            }
            e.printStackTrace();
            return null;
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                    conn.close();
                } catch (SQLException e) {
                    e.printStackTrace();
                }
            }
        }
        
        return sdpData;
    }
} 