"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { MoreHorizontal, Send, Image, Smile, Archive, UserX, UserCheck, AlertCircle, Loader2 } from "lucide-react"
import EmojiPicker from "@/components/emoji-picker"
import io from "socket.io-client"
import type { Conversation } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Update ChatMessage type to match backend implementation
interface ChatMessage {
  id: string
  sender: string
  recipient: string
  content: string
  timestamp: string
  type?: "text" | "image"
}

// Socket.IO server URL (Express backend)
const SOCKET_URL = "http://localhost:3001"

export default function ChatPage() {
  const [username, setUsername] = useState<string>("")
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([])
  const [currentChat, setCurrentChat] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [newMessage, setNewMessage] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [systemMessages, setSystemMessages] = useState<string[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Initialize socket connection
  useEffect(() => {
    const storedUsername = localStorage.getItem("chat-username")
    if (!storedUsername) {
      router.push("/")
      return
    }

    setUsername(storedUsername)
    setConnectionStatus("connecting")
    setConnectionError(null)

    // Connect to socket server with username
    const socketInstance = io(SOCKET_URL, {
      query: { username: storedUsername },
      transports: ["websocket", "polling"]
    })

    // Connection events
    socketInstance.on("connect", () => {
      console.log("Connected to socket server")
      setConnectionStatus("connected")
      setConnectionError(null)
      toast({
        title: "Connected",
        description: "You are now connected to the chat server",
      })
    })

    socketInstance.on("connect_error", (error: Error) => {
      console.error("Connection error:", error)
      setConnectionStatus("disconnected")
      setConnectionError(`Connection error: ${error.message}`)
      toast({
        title: "Connection Error",
        description: "Could not connect to the chat server. Please check your network connection.",
        variant: "destructive",
      })
    })

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from socket server")
      setConnectionStatus("disconnected")
      toast({
        title: "Disconnected",
        description: "You have been disconnected from the chat server",
        variant: "destructive",
      })
    })

    // Chat events
    socketInstance.on("users", (users: { username: string; status: string }[]) => {
      console.log("Online users:", users)
      setOnlineUsers(users.map(u => u.username))

      // Update conversations
      const existingUsernames = [
        ...conversations.map((c: Conversation) => c.username),
        ...archivedConversations.map((c: Conversation) => c.username),
      ]

      const newConversations = users
        .filter((user) => user.username !== storedUsername && existingUsernames.includes(user.username))
        .map((user) => {
          const existingConv = conversations.find((c: Conversation) => c.username === user.username)
          const archivedConv = archivedConversations.find((c: Conversation) => c.username === user.username)

          if (existingConv) return existingConv
          if (archivedConv) return { ...archivedConv, isArchived: true }

          return {
            userId: user.username,
            username: user.username,
            lastMessage: "",
            unreadCount: 0,
            isArchived: false,
            isBlocked: false,
          }
        })

      if (newConversations.length > 0) {
        setConversations((prev) => {
          const updatedConvs = [...prev]
          newConversations.forEach((newConv) => {
            const index = updatedConvs.findIndex((c) => c.username === newConv.username)
            if (index >= 0) {
              updatedConvs[index] = newConv
            } else if (!newConv.isArchived) {
              updatedConvs.push(newConv)
            }
          })
          return updatedConvs
        })
      }
    })

    socketInstance.on("user_status", ({ username: targetUser, status }: { username: string; status: string }) => {
      if (status === "offline") {
        setOnlineUsers((prev) => prev.filter((user) => user !== targetUser))
      } else {
        setOnlineUsers((prev) => [...prev, targetUser])
      }
    })

    socketInstance.on("message", (message: ChatMessage) => {
      setMessages((prev) => {
        const chatKey = message.sender === username ? message.recipient : message.sender
        const existingMessages = prev[chatKey] || []
        return {
          ...prev,
          [chatKey]: [...existingMessages, message],
        }
      })

      // Update conversation's last message
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.username === message.sender || conv.username === message.recipient) {
            return {
              ...conv,
              lastMessage: message.content,
              unreadCount: conv.username === message.sender ? conv.unreadCount + 1 : conv.unreadCount,
            }
          }
          return conv
        }),
      )
    })

    setSocket(socketInstance)

    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [])

  // On socket connect, list all conversations
  useEffect(() => {
    if (!socket || !username) return;
    socket.emit('list_conversations', username);
  }, [socket, username]);

  // Listen for 'conversations' event and fetch last message for each
  useEffect(() => {
    if (!socket) return;
    const handleConversations = (userList: string[]) => {
      console.log('Received conversations:', userList);
      userList.forEach(user => {
        socket.emit('get_messages', { user1: username, user2: user });
      });
    };
    socket.on('conversations', handleConversations);
    return () => {
      socket.off('conversations', handleConversations);
    };
  }, [socket, username]);

  const handleSendMessage = () => {
    if (!socket || !currentChat || !newMessage.trim()) return

    const message = {
      sender: username,
      recipient: currentChat,
      content: newMessage,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(), // Add a temporary ID for optimistic update
    }

    // Optimistically add the message to the UI
    setMessages((prev) => {
      const chatKey = message.recipient
      const existingMessages = prev[chatKey] || []
      return {
        ...prev,
        [chatKey]: [...existingMessages, message],
      }
    })

    socket.emit("send_message", message)
    setNewMessage("")
  }

  const handleSelectChat = (userId: string) => {
    setCurrentChat(userId)
    // Reset unread count for this conversation
    setConversations((prev) =>
      prev.map((conv) => (conv.username === userId ? { ...conv, unreadCount: 0 } : conv)),
    )
    // Fetch previous messages from the server
    if (socket) {
      socket.emit('get_messages', { user1: username, user2: userId })
    }
  }

  // Listen for the 'messages' event from the server
  useEffect(() => {
    if (!socket) return
    const handleMessages = ({ chatKey, messages: msgs }: { chatKey: string, messages: ChatMessage[] }) => {
      setMessages((prev) => ({
        ...prev,
        [chatKey]: msgs,
      }))
      if (msgs.length > 0) {
        setConversations(prev => {
          const existing = prev.find(c => c.username === chatKey);
          const lastMsg = msgs[msgs.length - 1];
          if (existing) {
            // Update last message
            return prev.map(c =>
              c.username === chatKey
                ? { ...c, lastMessage: lastMsg.content }
                : c
            );
          } else {
            // Add new conversation
            return [
              ...prev,
              {
                userId: chatKey,
                username: chatKey,
                lastMessage: lastMsg.content,
                unreadCount: 0,
                isArchived: false,
                isBlocked: false,
              }
            ];
          }
        });
      }
    }
    socket.on('messages', handleMessages)
    return () => {
      socket.off('messages', handleMessages)
    }
  }, [socket, conversations])

  const handleArchiveConversation = (userId: string) => {
    const conversation = conversations.find((c) => c.username === userId)
    if (conversation) {
      setArchivedConversations((prev) => [...prev, { ...conversation, isArchived: true }])
      setConversations((prev) => prev.filter((c) => c.username !== userId))
      if (currentChat === userId) setCurrentChat(null)
    }
  }

  const handleUnarchiveConversation = (userId: string) => {
    const conversation = archivedConversations.find((c) => c.username === userId)
    if (conversation) {
      setConversations((prev) => [...prev, { ...conversation, isArchived: false }])
      setArchivedConversations((prev) => prev.filter((c) => c.username !== userId))
    }
  }

  const handleBlockUser = (userId: string) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.username === userId ? { ...conv, isBlocked: true } : conv)),
    )
  }

  const handleUnblockUser = (userId: string) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.username === userId ? { ...conv, isBlocked: false } : conv)),
    )
  }

  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji)
  }

  // Helper function to determine if a string is a base64 image
  const isBase64Image = (str: string) => {
    return str.startsWith("data:image")
  }

  const handleReconnect = () => {
    if (socket) {
      socket.disconnect()
      socket.connect()
      setConnectionStatus("connecting")
      setConnectionError(null)
    }
  }

  // Add a function to manually reconnect with different transport options
  // Add this function after the existing handleReconnect function:

  const handleReconnectWithFallback = () => {
    if (socket) {
      socket.disconnect()
    }

    setConnectionStatus("connecting")
    setConnectionError(null)

    // Try to connect with WebSocket only first
    const newSocket = io(SOCKET_URL, {
      query: { username },
      transports: ["websocket"],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,
    })

    // If WebSocket fails, try polling
    newSocket.on("connect_error", () => {
      console.log("WebSocket connection failed, trying polling...")
      newSocket.io.opts.transports = ["polling"]
      newSocket.connect()
    })

    setSocket(newSocket)

    toast({
      title: "Reconnecting",
      description: "Trying alternative connection methods...",
    })
  }

  // Add a direct connection option that bypasses Socket.IO for testing
  // Add this function after the handleReconnectWithFallback function:

  const testDirectConnection = async () => {
    try {
      setConnectionStatus("connecting")
      setConnectionError("Testing direct connection to server...")

      // Try a direct fetch to the server to test connectivity
      const response = await fetch(SOCKET_URL.replace("socket.io", ""), {
        method: "GET",
        mode: "cors",
        credentials: "include",
      })

      if (response.ok) {
        setConnectionError(`Server is reachable, but Socket.IO connection failed. Status: ${response.status}`)
      } else {
        setConnectionError(`Server returned error: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setConnectionError(`Cannot reach server directly: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setConnectionStatus("disconnected")
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentChat])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !socket || !currentChat) return

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Files must be less than 2MB",
        variant: "destructive",
      })
      return
    }

    // Convert file to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string

      // Send message with image
      const message = {
        sender: username,
        recipient: currentChat,
        content: base64,
        timestamp: new Date().toISOString(),
        type: "image" as const
      }

      socket.emit("send_message", message)

      // Update last message in conversation
      setConversations((prev) =>
        prev.map((conv) => (conv.username === currentChat ? { ...conv, lastMessage: "Sent an image" } : conv)),
      )
    }

    reader.readAsDataURL(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Messenger</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Logged in as {username}</p>
            <div className="flex items-center">
              {connectionStatus === "connected" && (
                <span className="flex items-center text-xs text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                  Connected
                </span>
              )}
              {connectionStatus === "connecting" && (
                <span className="flex items-center text-xs text-amber-600">
                  <Loader2 className="h-2 w-2 animate-spin mr-1" />
                  Connecting...
                </span>
              )}
              {connectionStatus === "disconnected" && (
                <span className="flex items-center text-xs text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
                  Disconnected
                </span>
              )}
            </div>
          </div>
        </div>

        {connectionError && (
          <Alert variant="destructive" className="m-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription className="text-xs">
              {connectionError}
              <div className="flex space-x-2 mt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleReconnectWithFallback}>
                  Try Alternative Connection
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={testDirectConnection}>
                  Test Server
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Online Users Section - Always visible */}
        <div className="border-b">
          <div className="p-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">Online Users</h3>
          </div>
          <ScrollArea className="h-[200px]">
            {connectionStatus === "connected" ? (
              <>
                {onlineUsers
                  .filter((user) => user !== username)
                  .map((user) => {
                    const hasConversation = conversations.some((conv) => conv.username === user)
                    const isArchived = archivedConversations.some((conv) => conv.username === user)

                    return (
                      <div
                        key={user}
                        className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${currentChat === user ? "bg-gray-100" : ""}`}
                        onClick={() => handleSelectChat(user)}
                      >
                        <Avatar className="h-8 w-8 mr-3">
                          <AvatarFallback>{user.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="font-medium truncate">{user}</p>
                            {hasConversation && (
                              <Badge variant="outline" className="ml-2">
                                Chat
                              </Badge>
                            )}
                            {isArchived && (
                              <Badge variant="secondary" className="ml-2">
                                Archived
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center">
                            <div className="h-2 w-2 rounded-full mr-2 bg-green-500" />
                            <p className="text-sm text-gray-500">Online</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {onlineUsers.filter((user) => user !== username).length === 0 && (
                  <div className="p-4 text-center text-gray-500">No other users online</div>
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">
                  {connectionStatus === "connecting"
                    ? "Connecting to server..."
                    : "Disconnected. Please reconnect to see online users."}
                </p>
                {connectionStatus === "disconnected" && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={handleReconnectWithFallback}>
                    Reconnect
                  </Button>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chats and Archived Tabs */}
        <Tabs defaultValue="chats" className="flex-1">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value="chats" className="m-0 flex-1">
            <ScrollArea className="h-[calc(100vh-450px)]">
              {conversations
                .filter((conv) => !conv.isArchived)
                .map((conversation) => {
                  const isOnline = onlineUsers.includes(conversation.username)

                  return (
                    <div
                      key={conversation.username}
                      className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${currentChat === conversation.username ? "bg-gray-100" : ""}`}
                      onClick={() => handleSelectChat(conversation.username)}
                    >
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback>{conversation.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-medium truncate">{conversation.username}</p>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="default" className="ml-2">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center">
                          <div className={`h-2 w-2 rounded-full mr-2 ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage || "No messages yet"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchiveConversation(conversation.username)
                            }}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          {conversation.isBlocked ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnblockUser(conversation.username)
                              }}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Unblock
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBlockUser(conversation.username)
                              }}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Block
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}

              {conversations.filter((c) => !c.isArchived).length === 0 && (
                <div className="p-4 text-center text-gray-500">No conversations yet</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="m-0">
            <ScrollArea className="h-[calc(100vh-450px)]">
              {archivedConversations.map((conversation) => {
                const isOnline = onlineUsers.includes(conversation.username)

                return (
                  <div key={conversation.username} className="flex items-center p-3 hover:bg-gray-100">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback>{conversation.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conversation.username}</p>
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-2 ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                        <p className="text-sm text-gray-500 truncate">{isOnline ? "Online" : "Offline"}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnarchiveConversation(conversation.username)}
                    >
                      Unarchive
                    </Button>
                  </div>
                )
              })}
              {archivedConversations.length === 0 && (
                <div className="p-4 text-center text-gray-500">No archived conversations</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white flex items-center">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback>{currentChat.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-medium">{currentChat}</h3>
                <p className="text-xs text-gray-500">{onlineUsers.includes(currentChat) ? "Online" : "Offline"}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {(messages[currentChat] || []).map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === username ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender === username ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {isBase64Image(message.content) ? (
                        <img
                          src={message.content || "/placeholder.svg"}
                          alt="Shared image"
                          className="max-w-full rounded"
                        />
                      ) : (
                        <p>{message.content}</p>
                      )}
                      <p className="text-xs opacity-70 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              {showEmojiPicker && (
                <div className="mb-2">
                  <EmojiPicker onEmojiSelect={addEmoji} />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile className="h-5 w-5" />
                </Button>

                <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Image className="h-5 w-5" />
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </Button>

                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={connectionStatus === "connected" ? "Type a message..." : "Reconnect to send messages"}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={
                    connectionStatus !== "connected" || conversations.find((c) => c.username === currentChat)?.isBlocked
                  }
                />

                <Button
                  type="button"
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={
                    !newMessage.trim() ||
                    connectionStatus !== "connected" ||
                    conversations.find((c) => c.username === currentChat)?.isBlocked
                  }
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>

              {conversations.find((c) => c.username === currentChat)?.isBlocked && (
                <p className="text-center text-sm text-red-500 mt-2">
                  You have blocked this user. Unblock to send messages.
                </p>
              )}

              {connectionStatus !== "connected" && (
                <p className="text-center text-sm text-amber-500 mt-2">
                  You are currently {connectionStatus}.
                  {connectionStatus === "disconnected" ? (
                    <Button variant="link" className="p-0 h-auto text-sm" onClick={handleReconnectWithFallback}>
                      Click here to try alternative connection
                    </Button>
                  ) : (
                    "Connecting to server..."
                  )}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* System Messages */}
            <div className="flex-1 p-4 flex flex-col justify-center items-center">
              <div className="w-full max-w-md">
                <h3 className="text-lg font-medium mb-4 text-center">Welcome to Messenger</h3>

                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">System Messages</h4>
                    <div className="flex items-center">
                      {connectionStatus === "connected" && (
                        <span className="flex items-center text-xs text-green-600">
                          <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                          Connected
                        </span>
                      )}
                      {connectionStatus === "connecting" && (
                        <span className="flex items-center text-xs text-amber-600">
                          <Loader2 className="h-2 w-2 animate-spin mr-1" />
                          Connecting...
                        </span>
                      )}
                      {connectionStatus === "disconnected" && (
                        <span className="flex items-center text-xs text-red-600">
                          <span className="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
                          Disconnected
                        </span>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-48">
                    {systemMessages.map((msg, index) => (
                      <div key={index} className="text-sm py-1 border-b border-gray-100 last:border-0">
                        {msg}
                      </div>
                    ))}
                    {systemMessages.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        {connectionStatus === "connected"
                          ? "No system messages yet"
                          : "Connect to the server to see messages"}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <p className="text-center text-gray-500">
                  {connectionStatus === "connected"
                    ? "Select a conversation from the sidebar to start chatting"
                    : "Please wait while connecting to the server..."}
                </p>

                {connectionStatus === "disconnected" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 mx-auto block"
                    onClick={handleReconnectWithFallback}
                  >
                    Reconnect with Alternative Method
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

