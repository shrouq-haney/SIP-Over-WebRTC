package com.webrtc.backend.model;

import java.sql.Timestamp;
import java.util.List;

public class SdpExchange {
    private int id;
    private int senderId;
    private int receiverId;
    private SdpType type;
    private String sdp;
    private CallStatus status;
    private Timestamp createdAt;
    private List<IceCandidate> candidates;

    // Getters and Setters
    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getSenderId() {
        return senderId;
    }

    public void setSenderId(int senderId) {
        this.senderId = senderId;
    }

    public int getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(int receiverId) {
        this.receiverId = receiverId;
    }

    public SdpType getType() {
        return type;
    }

    public void setType(SdpType type) {
        this.type = type;
    }

    public String getSdp() {
        return sdp;
    }

    public void setSdp(String sdp) {
        this.sdp = sdp;
    }

    public CallStatus getStatus() {
        return status;
    }

    public void setStatus(CallStatus status) {
        this.status = status;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public List<IceCandidate> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<IceCandidate> candidates) {
        this.candidates = candidates;
    }
} 