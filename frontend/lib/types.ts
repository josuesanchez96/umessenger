export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  recipientId: string
  content: string
  timestamp: string
  type: "text" | "image"
  isEncrypted: boolean
}

export interface Conversation {
  userId: string
  username: string
  lastMessage: string
  unreadCount: number
  isArchived: boolean
  isBlocked: boolean
}

export interface User {
  id: string
  username: string
  isOnline: boolean
  lastSeen?: string
}

