package com.webrtc.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum SdpType {
    OFFER("offer"),
    ANSWER("answer");

    private final String type;

    SdpType(String type) {
        this.type = type;
    }

    @JsonValue
    public String getType() {
        return type;
    }

    @JsonCreator
    public static SdpType fromString(String type) {
        for (SdpType t : SdpType.values()) {
            if (t.type.equalsIgnoreCase(type)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Invalid SDP type: " + type);
    }
} 