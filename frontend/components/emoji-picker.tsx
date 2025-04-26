"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

// A simple emoji picker with common emojis
const EMOJI_CATEGORIES = {
  smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘"],
  gestures: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋"],
  animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧"],
  food: ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑"],
  activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅"],
  travel: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🚚", "🚛", "🚜", "🛴", "🚲", "🛵", "🏍️"],
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("smileys")

  return (
    <div className="border rounded-md bg-white p-2 shadow-md">
      <Tabs defaultValue="smileys" onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-6 mb-2">
          <TabsTrigger value="smileys">😀</TabsTrigger>
          <TabsTrigger value="gestures">👍</TabsTrigger>
          <TabsTrigger value="animals">🐶</TabsTrigger>
          <TabsTrigger value="food">🍎</TabsTrigger>
          <TabsTrigger value="activities">⚽</TabsTrigger>
          <TabsTrigger value="travel">🚗</TabsTrigger>
        </TabsList>

        {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
          <TabsContent key={category} value={category} className="mt-0">
            <ScrollArea className="h-32">
              <div className="grid grid-cols-8 gap-1">
                {emojis.map((emoji, index) => (
                  <Button key={index} variant="ghost" className="h-8 w-8 p-0" onClick={() => onEmojiSelect(emoji)}>
                    {emoji}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

