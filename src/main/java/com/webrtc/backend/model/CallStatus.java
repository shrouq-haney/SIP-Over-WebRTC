package com.webrtc.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum CallStatus {
    PENDING("pending"),
    ACCEPTED("accepted"),
    REJECTED("rejected"),
    TIMEOUT("timeout");

    private final String status;

    CallStatus(String status) {
        this.status = status;
    }

    @JsonValue
    public String getStatus() {
        return status;
    }

    @JsonCreator
    public static CallStatus fromString(String status) {
        for (CallStatus s : CallStatus.values()) {
            if (s.status.equalsIgnoreCase(status)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Invalid status: " + status);
    }
} 