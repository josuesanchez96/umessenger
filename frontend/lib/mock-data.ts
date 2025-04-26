import type { User, ChatMessage } from "./types"

// Mock users
export const mockUsers: User[] = [
  {
    id: "user1",
    username: "Alice",
    isOnline: true,
  },
  {
    id: "user2",
    username: "Bob",
    isOnline: true,
  },
  {
    id: "user3",
    username: "Charlie",
    isOnline: false,
    lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: "user4",
    username: "Diana",
    isOnline: true,
  },
  {
    id: "user5",
    username: "Ethan",
    isOnline: false,
    lastSeen: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
  },
  {
    id: "user6",
    username: "Fiona",
    isOnline: true,
  },
]

// Mock messages
export const mockMessages: ChatMessage[] = [
  {
    id: "m1",
    senderId: "user1",
    senderName: "Alice",
    recipientId: "current-user",
    content: "Hey there! How are you doing today?",
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    type: "text",
    isEncrypted: false,
  },
  {
    id: "m2",
    senderId: "current-user",
    senderName: "",
    recipientId: "user1",
    content: "I'm doing great! Just working on a new project.",
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    type: "text",
    isEncrypted: false,
  },
  {
    id: "m3",
    senderId: "user1",
    senderName: "Alice",
    recipientId: "current-user",
    content: "That sounds interesting! What kind of project?",
    timestamp: new Date(Date.now() - 3400000).toISOString(),
    type: "text",
    isEncrypted: false,
  },
  {
    id: "m4",
    senderId: "user2",
    senderName: "Bob",
    recipientId: "current-user",
    content: "Did you see the game last night?",
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
    type: "text",
    isEncrypted: false,
  },
  {
    id: "m5",
    senderId: "user3",
    senderName: "Charlie",
    recipientId: "current-user",
    content: "Hey, can you help me with something?",
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 48 hours ago
    type: "text",
    isEncrypted: false,
  },
]

