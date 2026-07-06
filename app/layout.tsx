import type React from "react"
import type { Metadata } from "next"
import { JetBrains_Mono, Instrument_Serif } from "next/font/google"
import "./globals.css"

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
})

export const metadata: Metadata = {
  title: "Anh vs Em",
  description: "Kho lưu trữ những khoảnh khắc yêu thương và kỷ niệm đẹp đẽ",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>❤️</text></svg>",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${jetBrainsMono.variable} ${instrumentSerif.variable} antialiased font-mono`}>{children}</body>
    </html>
  )
}
