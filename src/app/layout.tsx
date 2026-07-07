import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Layout from '@/components/Layout'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '原価率管理システム',
  description: '料理メニューの原価率計算・仕入管理システム',
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
