import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import MeshGradient from "@/components/mesh-gradient"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "AI Ad Creator",
  description: "Create video ads in seconds",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <MeshGradient />
        {children}
      </body>
    </html>
  )
}
