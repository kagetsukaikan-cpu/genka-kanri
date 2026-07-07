import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Layout from '@/components/Layout'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '原価率管理システム',
  description: '料理メニューの原価率計算・仕入管理システム',
}

// スマホで正しく拡大縮小されるように
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${geist.className} h-full`}>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
