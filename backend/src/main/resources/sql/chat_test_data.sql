-- Test data for chat system
USE webrtc_db;

-- Insert more test messages between users
INSERT INTO chat_messages (sender_id, receiver_id, content, `read`, created_at) VALUES
-- Conversation between Alice (1) and Bob (2)
(1, 2, 'Hey Bob, would you like to have a video call?', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 1, 'Sure Alice! Give me 5 minutes to set up my camera.', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR + 55 MINUTE)),
(1, 2, 'No problem, take your time!', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR + 54 MINUTE)),
(2, 1, 'Ready now! Let''s start the call.', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR + 50 MINUTE)),

-- Conversation between Alice (1) and Charlie (3)
(1, 3, 'Hi Charlie, are you available for a quick chat?', FALSE, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(3, 1, 'Hey Alice, I''m a bit busy right now.', TRUE, DATE_SUB(NOW(), INTERVAL 55 MINUTE)),
(1, 3, 'No worries, we can talk later!', FALSE, DATE_SUB(NOW(), INTERVAL 54 MINUTE)),

-- Conversation between Bob (2) and David (4)
(2, 4, 'David, can you help me with the project?', TRUE, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(4, 2, 'Of course! What do you need help with?', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR + 55 MINUTE)),
(2, 4, 'I''m having trouble with the WebRTC setup.', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR + 50 MINUTE)),
(4, 2, 'Let''s schedule a call to discuss it.', FALSE, DATE_SUB(NOW(), INTERVAL 2 HOUR + 45 MINUTE)),

-- Conversation between Charlie (3) and Eve (5)
(3, 5, 'Eve, did you receive my presentation?', TRUE, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(5, 3, 'Yes, I''ll review it today.', FALSE, DATE_SUB(NOW(), INTERVAL 3 HOUR + 55 MINUTE)),
(3, 5, 'Thanks! Let me know if you need any clarification.', FALSE, DATE_SUB(NOW(), INTERVAL 3 HOUR + 50 MINUTE));

COMMIT; 