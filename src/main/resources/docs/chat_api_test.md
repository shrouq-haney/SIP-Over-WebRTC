# Chat API Testing Guide

This document provides examples for testing the chat API endpoints using cURL commands. The test data includes conversations between users Alice (ID: 1), Bob (ID: 2), Charlie (ID: 3), David (ID: 4), and Eve (ID: 5).

## REST API Endpoints

### 1. Get Chat History Between Two Users

Retrieve chat history between Alice (ID: 1) and Bob (ID: 2):

```bash
curl -X GET "http://localhost:8080/WebRTC_BackEnd/api/chat/messages?userId1=1&userId2=2"
```

Expected response:
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
    {
        "id": 2,
        "senderId": 2,
        "receiverId": 1,
        "content": "Sure Alice! Give me 5 minutes to set up my camera.",
        "read": true,
        "createdAt": "2024-03-XX XX:XX:XX"
    }
    // ... more messages
]
```

### 2. Get Unread Messages for a User

Retrieve unread messages for Charlie (ID: 3):

```bash
curl -X GET "http://localhost:8080/WebRTC_BackEnd/api/chat/unread?userId=3"
```

Expected response:
```json
[
    {
        "id": 15,
        "senderId": 5,
        "receiverId": 3,
        "content": "Yes, I'll review it today.",
        "read": false,
        "createdAt": "2024-03-XX XX:XX:XX"
    },
    {
        "id": 16,
        "senderId": 3,
        "receiverId": 5,
        "content": "Thanks! Let me know if you need any clarification.",
        "read": false,
        "createdAt": "2024-03-XX XX:XX:XX"
    }
]
```

## WebSocket Testing

### 1. Connect to WebSocket

Connect to the WebSocket endpoint for Alice (ID: 1):

```javascript
// Using JavaScript WebSocket API
const ws = new WebSocket('ws://localhost:8080/WebRTC_BackEnd/ws/chat/1');

ws.onopen = () => {
    console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
    console.log('Received message:', JSON.parse(event.data));
};
```

### 2. Send a Message

Send a message from Alice (ID: 1) to Bob (ID: 2):

```javascript
// Using JavaScript WebSocket API
ws.send(JSON.stringify({
    "receiverId": 2,
    "content": "Hi Bob, are you ready for our meeting?"
}));
```

Expected response (received by Bob's WebSocket connection):
```json
{
    "id": 17,
    "senderId": 1,
    "receiverId": 2,
    "content": "Hi Bob, are you ready for our meeting?",
    "read": false,
    "createdAt": "2024-03-XX XX:XX:XX"
}
```

## Test Scenarios

1. **Online Message Delivery**:
   - Connect WebSocket for both Alice and Bob
   - Send message from Alice to Bob
   - Verify immediate delivery and read status update

2. **Offline Message Storage**:
   - Disconnect Bob's WebSocket
   - Send message from Alice to Bob
   - Verify message is stored with read=false
   - Connect Bob's WebSocket
   - Verify Bob receives unread messages

3. **Chat History**:
   - Get chat history between Alice and Bob
   - Verify messages are in chronological order
   - Verify read status is correct

4. **Multiple Conversations**:
   - Get chat history between different user pairs
   - Verify messages don't mix between conversations

## Test Data Summary

The test database contains:
- 4 messages between Alice and Bob (all read)
- 3 messages between Alice and Charlie (mixed read status)
- 4 messages between Bob and David (last message unread)
- 3 messages between Charlie and Eve (last two unread)

Total messages: 14
Total unread messages: 6 