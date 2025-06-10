-- Drop the database if it exists to start from scratch
DROP DATABASE IF EXISTS webrtc_db;

-- Create the database
CREATE DATABASE webrtc_db;

-- Use the newly created database
USE webrtc_db;

-- Table: users
-- Stores user account information.
CREATE TABLE users (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    username        VARCHAR(50) UNIQUE NOT NULL,
    msisdn          VARCHAR(15) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    online          BOOLEAN DEFAULT FALSE,
    last_update     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: sdp_exchange
-- Stores SDP (Session Description Protocol) offers and answers for WebRTC signaling.
CREATE TABLE sdp_exchange (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    sender_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    type          VARCHAR(10) NOT NULL CHECK (type IN ('offer', 'answer')),
    sdp           TEXT NOT NULL,
    status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'timeout')),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);


-- Table: ice_candidates
-- Stores ICE (Interactive Connectivity Establishment) candidates for WebRTC signaling.
CREATE TABLE ice_candidates (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    sender_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    candidate     TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- Table: call_logs (optional)
-- Stores a history of calls made between users.
CREATE TABLE call_logs (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    caller_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    start_time    TIMESTAMP NULL,
    end_time      TIMESTAMP NULL,
    status        VARCHAR(20), -- e.g., 'completed', 'missed'
    FOREIGN KEY (caller_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- Table: chat_messages
-- Stores chat messages between users.
CREATE TABLE chat_messages (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    sender_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    content       TEXT NOT NULL,
    `read`        BOOLEAN NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- --- Test Data ---

-- Insert sample users for testing.
-- The password for all users is 'password'.
-- The hash was generated using jBCrypt.
INSERT INTO users (username, msisdn, password_hash, online) VALUES
('alice', '1111111111', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE),
('bob', '2222222222', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE),
('charlie', '3333333333', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', FALSE),
('david', '4444444444', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE),
('eve', '5555555555', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', FALSE);

-- Insert a sample SDP offer from Alice (user 1) to Bob (user 2)
INSERT INTO sdp_exchange (sender_id, receiver_id, type, sdp) VALUES
(1, 2, 'offer', '{"type":"offer","sdp":"v=0\\r\\no=- 45969578..."}');

-- Insert sample ICE candidates from Alice (user 1) to Bob (user 2)
INSERT INTO ice_candidates (sender_id, receiver_id, candidate) VALUES
(1, 2, '{"candidate":"candidate:1234...","sdpMid":"0","sdpMLineIndex":0}'),
(1, 2, '{"candidate":"candidate:5678...","sdpMid":"0","sdpMLineIndex":0}');

-- Insert test chat messages between users
INSERT INTO chat_messages (sender_id, receiver_id, content, `read`, created_at) VALUES
-- Conversation between Alice (1) and Bob (2)
(1, 2, 'Hey Bob, would you like to have a video call?', TRUE, NOW() - INTERVAL 2 HOUR),
(2, 1, 'Sure Alice! Give me 5 minutes to set up my camera.', TRUE, NOW() - INTERVAL 115 MINUTE),
(1, 2, 'No problem, take your time!', TRUE, NOW() - INTERVAL 114 MINUTE),
(2, 1, 'Ready now! Let''s start the call.', TRUE, NOW() - INTERVAL 110 MINUTE),

-- Conversation between Alice (1) and Charlie (3)
(1, 3, 'Hi Charlie, are you available for a quick chat?', FALSE, NOW() - INTERVAL 60 MINUTE),
(3, 1, 'Hey Alice, I''m a bit busy right now.', TRUE, NOW() - INTERVAL 55 MINUTE),
(1, 3, 'No worries, we can talk later!', FALSE, NOW() - INTERVAL 54 MINUTE),

-- Conversation between Bob (2) and David (4)
(2, 4, 'David, can you help me with the project?', TRUE, NOW() - INTERVAL 180 MINUTE),
(4, 2, 'Of course! What do you need help with?', TRUE, NOW() - INTERVAL 175 MINUTE),
(2, 4, 'I''m having trouble with the WebRTC setup.', TRUE, NOW() - INTERVAL 170 MINUTE),
(4, 2, 'Let''s schedule a call to discuss it.', FALSE, NOW() - INTERVAL 165 MINUTE),

-- Conversation between Charlie (3) and Eve (5)
(3, 5, 'Eve, did you receive my presentation?', TRUE, NOW() - INTERVAL 240 MINUTE),
(5, 3, 'Yes, I''ll review it today.', FALSE, NOW() - INTERVAL 235 MINUTE),
(3, 5, 'Thanks! Let me know if you need any clarification.', FALSE, NOW() - INTERVAL 230 MINUTE);

COMMIT; 