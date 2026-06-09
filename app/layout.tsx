import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TalenTrack — Smarter Candidate Management',
  description:
    'Track candidates, import Excel data, and get AI-powered recruiting insights with TalenTrack.',
  keywords: ['candidates', 'recruitment', 'HR', 'ATS', 'talent tracking', 'AI insights'],
  authors: [{ name: 'TalenTrack' }],
  robots: 'noindex, nofollow',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} dark`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
