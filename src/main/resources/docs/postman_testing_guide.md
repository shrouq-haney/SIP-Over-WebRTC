# Postman Testing Guide for WebRTC Chat API

## Setup Instructions

1. Import the Collection:
   - Open Postman
   - Click "Import" button
   - Select the file `WebRTC_Chat_API.postman_collection.json`
   - The collection "WebRTC Chat API" will appear in your collections list

2. Set Environment Variable:
   - The collection uses the variable `{{baseUrl}}` which is set to `localhost:8080/WebRTC_BackEnd`
   - You can modify this in the collection variables if your server runs on a different port

## Available Test Users

The test database includes these users:
- Alice (ID: 1)
- Bob (ID: 2)
- Charlie (ID: 3)
- David (ID: 4)
- Eve (ID: 5)

## Testing REST Endpoints

### 1. Get Chat History

Test getting chat history between Alice and Bob:

1. Open the "Get Chat History" request
2. Parameters are pre-set to:
   - userId1 = 1 (Alice)
   - userId2 = 2 (Bob)
3. Click "Send"
4. Expected response (200 OK):
```json
[
    {
        "id": 1,
        "senderId": 1,
        "receiverId": 2,
        "content": "Hey Bob, would you like to have a video call?",
        "read": true,
        "createdAt": "2024-03-XX XX:XX:XX"
    },
    // ... more messages
]
```

Try different combinations:
- Alice & Charlie (userId1=1, userId2=3)
- Bob & David (userId1=2, userId2=4)
- Charlie & Eve (userId1=3, userId2=5)

### 2. Get Unread Messages

Test getting Charlie's unread messages:

1. Open the "Get Unread Messages" request
2. Parameter is pre-set to:
   - userId = 3 (Charlie)
3. Click "Send"
4. Expected response (200 OK):
```json
[
    {
        "id": 15,
        "senderId": 5,
        "receiverId": 3,
        "content": "Yes, I'll review it today.",
        "read": false,
        "createdAt": "2024-03-XX XX:XX:XX"
    }
    // ... more unread messages
]
```

Try for other users:
- David (userId=4) - should have 1 unread message
- Eve (userId=5) - should have no unread messages

## Testing WebSocket Connection

Postman supports WebSocket testing through the WebSocket requests:

### 1. Connect as Alice

1. Open the "WebSocket Connection (Alice)" request
2. Click "Connect" to establish WebSocket connection
3. Once connected, you can send messages in this format:
```json
{
    "receiverId": 2,
    "content": "Hi Bob, are you ready for our meeting?"
}
```

### 2. Connect as Bob

1. Open a new tab with "WebSocket Connection (Bob)" request
2. Click "Connect" to establish WebSocket connection
3. You should receive messages sent to Bob in real-time

## Test Scenarios

### Scenario 1: Real-time Chat

1. Connect two WebSocket tabs (Alice and Bob)
2. Send message from Alice to Bob
3. Verify Bob's connection receives the message
4. Send message from Bob to Alice
5. Verify Alice's connection receives the message

### Scenario 2: Offline Message Storage

1. Close Bob's WebSocket connection
2. Send message from Alice to Bob
3. Use "Get Unread Messages" request for Bob (userId=2)
4. Verify the message appears in Bob's unread messages

### Scenario 3: Message History

1. Use "Get Chat History" between Alice and Bob
2. Verify all messages appear in chronological order
3. Verify read status is correct for each message

### Scenario 4: Multiple Conversations

1. Get chat history for different user pairs
2. Verify messages don't mix between conversations
3. Check that each conversation shows correct participants

## Troubleshooting

If you encounter issues:

1. Verify the server is running
2. Check the baseUrl variable is correct
3. Ensure the database is populated with test data
4. Check server logs for any error messages

## Response Status Codes

- 200 OK: Successful request
- 400 Bad Request: Invalid parameters
- 404 Not Found: Endpoint not found
- 500 Internal Server Error: Server-side error

## Notes

- WebSocket connections may timeout after inactivity
- Messages are stored even if recipient is offline
- Read status updates automatically when messages are retrieved
- All timestamps are in server's timezone 