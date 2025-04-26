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
  url: process.env.REDIS_URL
});

// Connect to Redis
redis.connect().catch(console.error);

// Map to store username -> socket.id mapping
const users = {};

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
        
        // Store message in Redis
        await redis.lPush(`messages:${message.sender}:${message.recipient}`, JSON.stringify(message));
        await redis.lPush(`messages:${message.recipient}:${message.sender}`, JSON.stringify(message));
        
        // Send message to recipient
        io.emit('message', message);
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
});

app.get('/', (req, res) => {
  res.send('<h1>Chat Server Running</h1>');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});