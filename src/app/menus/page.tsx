'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import type { Menu } from '@/types'

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await fetch('/api/menus').then(r => r.json())
    setMenus(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">読み込み中...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">メニュー原価計算</h2>
        <Link href="/menus/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} /> メニューを追加
        </Link>
      </div>

      {menus.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">メニューが登録されていません</p>
          <Link href="/menus/new" className="text-blue-600 text-sm hover:underline">最初のメニューを追加する</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menus.map(menu => {
            const costRate = menu.cost_rate ?? 0
            const totalCost = menu.total_cost ?? 0
            const ok = costRate <= menu.target_cost_rate
            return (
              <Link key={menu.id} href={`/menus/${menu.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{menu.name}</h3>
                    {menu.category && <span className="text-xs text-gray-400">{menu.category}</span>}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {ok ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {costRate.toFixed(1)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">売価</span>
                    <span className="font-medium text-gray-900">¥{menu.selling_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">原価</span>
                    <span className="font-medium text-gray-900">¥{totalCost.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">粗利益</span>
                    <span className="font-medium text-gray-900">¥{(menu.selling_price - totalCost).toFixed(0)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>原価率</span>
                    <span>目標: {menu.target_cost_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ok ? 'bg-green-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(costRate, 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
