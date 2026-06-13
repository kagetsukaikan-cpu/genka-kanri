'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, UtensilsCrossed, ShoppingBasket, Truck, ClipboardList } from 'lucide-react'

interface DashboardStats {
  menuCount: number
  ingredientCount: number
  supplierCount: number
  purchaseThisMonth: number
  menus: Array<{
    id: string
    name: string
    selling_price: number
    target_cost_rate: number
    total_cost: number
    cost_rate: number
  }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">ダッシュボード</h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        <SummaryCard
          label="メニュー数"
          value={`${stats?.menuCount ?? 0}品`}
          icon={<UtensilsCrossed size={18} className="text-blue-500" />}
          href="/menus"
        />
        <SummaryCard
          label="食材登録数"
          value={`${stats?.ingredientCount ?? 0}品目`}
          icon={<ShoppingBasket size={18} className="text-green-500" />}
          href="/ingredients"
        />
        <SummaryCard
          label="仕入先数"
          value={`${stats?.supplierCount ?? 0}社`}
          icon={<Truck size={18} className="text-orange-500" />}
          href="/suppliers"
        />
        <SummaryCard
          label="今月仕入額"
          value={`¥${(stats?.purchaseThisMonth ?? 0).toLocaleString()}`}
          icon={<ClipboardList size={18} className="text-purple-500" />}
          href="/purchases"
        />
      </div>

      {/* メニュー原価率一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">メニュー原価率一覧</h3>
          <Link href="/menus" className="text-xs text-blue-600 hover:underline">すべて見る</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {!stats?.menus?.length ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              メニューが登録されていません
              <Link href="/menus/new" className="block mt-2 text-blue-600 hover:underline">メニューを追加する</Link>
            </div>
          ) : (
            stats.menus.map(menu => {
              const diff = menu.cost_rate - menu.target_cost_rate
              const ok = diff <= 0
              return (
                <div key={menu.id} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/menus/${menu.id}`} className="font-medium text-sm text-gray-900 hover:text-blue-700 truncate block">
                      {menu.name}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      売価 ¥{menu.selling_price.toLocaleString()} / 原価 ¥{menu.total_cost.toFixed(0)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>
                      {menu.cost_rate.toFixed(1)}%
                    </div>
                    <div className={`flex items-center justify-end gap-0.5 text-xs ${ok ? 'text-green-500' : 'text-red-400'}`}>
                      {diff === 0 ? <Minus size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                      目標{menu.target_cost_rate}%
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(menu.cost_rate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon, href }: { label: string; value: string; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 px-4 py-4 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </Link>
  )
}
