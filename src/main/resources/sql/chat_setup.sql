-- Table: chat_messages
-- Stores chat messages between users.
CREATE TABLE IF NOT EXISTS chat_messages (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    sender_id     INT NOT NULL,
    receiver_id   INT NOT NULL,
    content       TEXT NOT NULL,
    `read`        BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- Create an index for faster queries when retrieving messages between two users
CREATE INDEX IF NOT EXISTS idx_chat_sender_receiver ON chat_messages(sender_id, receiver_id);

-- Create an index for faster queries when retrieving unread messages for a user
CREATE INDEX IF NOT EXISTS idx_chat_receiver_read ON chat_messages(receiver_id, `read`);

-- Insert some sample messages for testing
INSERT INTO chat_messages (sender_id, receiver_id, content, `read`) VALUES
(1, 2, 'Hello Bob, how are you?', TRUE),
(2, 1, 'Hi Alice, I am good. How about you?', TRUE),
(1, 2, 'I am fine too. Do you want to have a video call?', FALSE),
(3, 1, 'Hey Alice, are you available for a chat?', FALSE);

COMMIT; 