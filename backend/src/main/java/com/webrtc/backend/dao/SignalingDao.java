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
} 