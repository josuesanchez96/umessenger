const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { createClient } = require('redis');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize Redis client
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
redis.connect().catch(console.error);

// Map to store username -> socket.id mapping
const users = {};

// Helper to get a canonical chat key for two users
function getChatKey(user1, user2) {
  return [user1, user2].sort().join(':');
}

io.on('connection', async (socket) => {
    const username = socket.handshake.query.username;
    
    if (!username) {
        socket.disconnect();
        return;
    }

    console.log('User connected:', username);
    
    // Store the user's socket ID
    users[username] = socket.id;
    
    // Add user to active users set in Redis
    await redis.sAdd('active_users', username);
    
    // Broadcast user status to all clients
    io.emit('user_status', { username, status: 'online' });
    
    // Get all active users and send to the client
    const activeUsers = await redis.sMembers('active_users');
    const usersList = activeUsers.map(user => ({
        username: user,
        status: 'online'
    }));
    
    io.emit('users', usersList);

    // Handle messages
    socket.on('send_message', async (message) => {
        // Generate a unique ID for the message
        message.id = Date.now().toString();
        const chatKey = getChatKey(message.sender, message.recipient);
        // Store message in Redis using canonical key
        await redis.lPush(`messages:${chatKey}`, JSON.stringify(message));
        // Send message to recipient
        io.emit('message', message);
    });

    // Handle fetching message history
    socket.on('get_messages', async ({ user1, user2 }) => {
        const chatKey = getChatKey(user1, user2);
        const messages = await redis.lRange(`messages:${chatKey}`, 0, -1);
        const allMessages = messages
            .map(m => JSON.parse(m))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        socket.emit('messages', { chatKey: user2, messages: allMessages });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        console.log('User disconnected:', username);
        
        // Remove user from active users set in Redis
        await redis.sRem('active_users', username);
        
        // Remove user from mapping
        delete users[username];
        
        // Broadcast user status to all clients
        io.emit('user_status', { username, status: 'offline' });
        
        // Get all active users and send to the client
        const activeUsers = await redis.sMembers('active_users');
        const usersList = activeUsers.map(user => ({
            username: user,
            status: 'online'
        }));
        
        io.emit('users', usersList);
    });

    // List all conversations for a user
    socket.on('list_conversations', async (username) => {
        const keys = await redis.keys(`messages:*`);
        const userConvs = new Set();
        keys.forEach(key => {
            const parts = key.split(':').slice(1); // remove 'messages'
            if (parts.includes(username)) {
                const otherUser = parts[0] === username ? parts[1] : parts[0];
                if (otherUser !== username) userConvs.add(otherUser);
            }
        });
        console.log('list_conversations', { username, keys, userConvs: Array.from(userConvs) });
        socket.emit('conversations', Array.from(userConvs));
    });
});

app.get('/', (req, res) => {
  res.send('<h1>Chat Server Running</h1>');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});