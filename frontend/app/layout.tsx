import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'uMessenger',
  description: 'uMessenger is a simple and secure messaging app built with Next.js and Socket.io.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
