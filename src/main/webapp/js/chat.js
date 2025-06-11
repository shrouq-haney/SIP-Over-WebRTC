class ChatManager {
    constructor(userId) {
        this.userId = userId;
        this.ws = null;
        this.messageCallbacks = [];
    }

    connect() {
        this.ws = new WebSocket(`ws://${window.location.host}/ws/chat/${this.userId}`);
        
        this.ws.onopen = () => {
            console.log('Chat WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.messageCallbacks.forEach(callback => callback(message));
        };

        this.ws.onclose = () => {
            console.log('Chat WebSocket disconnected');
            // Try to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('Chat WebSocket error:', error);
        };
    }

    sendMessage(receiverId, content) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                receiverId: receiverId,
                content: content,
                read: false
            };
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    onMessage(callback) {
        this.messageCallbacks.push(callback);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

class ChatUI {
    constructor(chatManager, currentUserId) {
        this.chatManager = chatManager;
        this.currentUserId = currentUserId;
        this.selectedUserId = null;
        this.messageContainer = document.getElementById('message-container');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.userList = document.getElementById('user-list');

        this.setupEventListeners();
        this.loadUsers();
        this.setupChatManager();
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    setupChatManager() {
        this.chatManager.onMessage(message => {
            if (message.senderId === this.selectedUserId) {
                this.appendMessage(message);
            }
            // Update unread count for user in list
            this.updateUnreadCount(message.senderId);
        });
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users');
            const users = await response.json();
            
            this.userList.innerHTML = '';
            users.forEach(user => {
                if (user.id !== this.currentUserId) {
                    const userElement = document.createElement('div');
                    userElement.className = 'user-item';
                    userElement.innerHTML = `
                        <span class="username">${user.username}</span>
                        <span class="unread-count" id="unread-${user.id}"></span>
                    `;
                    userElement.addEventListener('click', () => this.selectUser(user.id));
                    this.userList.appendChild(userElement);
                }
            });

            // Load unread counts
            this.loadUnreadCounts();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadUnreadCounts() {
        try {
            const response = await fetch(`/api/chat/unread?userId=${this.currentUserId}`);
            const unreadMessages = await response.json();
            
            // Group messages by sender
            const unreadCounts = {};
            unreadMessages.forEach(message => {
                unreadCounts[message.senderId] = (unreadCounts[message.senderId] || 0) + 1;
            });

            // Update UI
            Object.entries(unreadCounts).forEach(([senderId, count]) => {
                const countElement = document.getElementById(`unread-${senderId}`);
                if (countElement) {
                    countElement.textContent = count > 0 ? count : '';
                }
            });
        } catch (error) {
            console.error('Error loading unread counts:', error);
        }
    }

    async selectUser(userId) {
        this.selectedUserId = userId;
        this.messageContainer.innerHTML = '';
        
        try {
            const response = await fetch(`/api/chat/messages?userId1=${this.currentUserId}&userId2=${userId}`);
            const messages = await response.json();
            
            messages.forEach(message => this.appendMessage(message));
            
            // Clear unread count
            const countElement = document.getElementById(`unread-${userId}`);
            if (countElement) {
                countElement.textContent = '';
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (content && this.selectedUserId) {
            this.chatManager.sendMessage(this.selectedUserId, content);
            this.messageInput.value = '';
        }
    }

    appendMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === this.currentUserId ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            <div class="message-time">${new Date(message.createdAt).toLocaleTimeString()}</div>
        `;
        this.messageContainer.appendChild(messageElement);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    updateUnreadCount(senderId) {
        if (senderId !== this.selectedUserId) {
            const countElement = document.getElementById(`unread-${senderId}`);
            if (countElement) {
                const currentCount = parseInt(countElement.textContent) || 0;
                countElement.textContent = currentCount + 1;
            }
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize chat when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const currentUserId = parseInt(document.getElementById('current-user-id').value);
    const chatManager = new ChatManager(currentUserId);
    chatManager.connect();
    
    const chatUI = new ChatUI(chatManager, currentUserId);
}); 