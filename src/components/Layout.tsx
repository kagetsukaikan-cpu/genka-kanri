'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBasket,
  Truck,
  ClipboardList,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  X,
} from 'lucide-react'
import Calculator from '@/components/Calculator'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/menus', label: 'メニュー原価計算', icon: UtensilsCrossed },
  { href: '/ingredients', label: '食材マスタ', icon: ShoppingBasket },
  { href: '/suppliers', label: '仕入先マスタ', icon: Truck },
  { href: '/purchases', label: '仕入履歴・納品書', icon: ClipboardList },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  // ページ移動したらスマホメニューを閉じる
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  if (pathname === '/login') return <>{children}</>

  const navLinks = (
    <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            {active && <ChevronRight size={14} className="text-blue-400" />}
          </Link>
        )
      })}
    </nav>
  )

  const logoutBtn = (
    <div className="px-2 py-3 border-t border-gray-200">
      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors w-full"
      >
        <LogOut size={16} />
        <span>ログアウト</span>
      </button>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* デスクトップ用サイドバー */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900">原価率管理システム</h1>
          <p className="text-xs text-gray-500 mt-0.5">料亭かぶと</p>
        </div>
        {navLinks}
        {logoutBtn}
      </aside>

      {/* スマホ用ドロワー */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 max-w-[80%] bg-white flex flex-col shadow-xl">
            <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold text-gray-900">原価率管理システム</h1>
                <p className="text-xs text-gray-500 mt-0.5">料亭かぶと</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            {navLinks}
            {logoutBtn}
          </aside>
        </div>
      )}

      {/* 本体 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* スマホ用トップバー */}
        <header className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1 text-gray-600 hover:text-gray-900" aria-label="メニュー">
            <MenuIcon size={22} />
          </button>
          <span className="font-bold text-gray-900 text-sm">原価率管理システム</span>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <Calculator />
    </div>
  )
}
