import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

export async function POST(request: Request) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== "string") {
      return NextResponse.json({ message: "Invalid username" }, { status: 400 })
    }

    // Check if username is already taken
    const exists = await redis.sismember("active_users", username)

    if (exists) {
      return NextResponse.json({ message: "Username is already taken" }, { status: 409 })
    }

    // Username is available
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error validating username:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

