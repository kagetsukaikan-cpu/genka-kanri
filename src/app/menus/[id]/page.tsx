'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import type { Menu, Ingredient, IngredientCategory, Supplier } from '@/types'
import { effectiveUnitPrice } from '@/lib/price'
import IngredientCombobox from '@/components/IngredientCombobox'

interface MenuIngredientRow {
  id?: string
  ingredient_id: string
  ingredient_name: string
  quantity: number
  unit: string
  unit_price: number | null
  cost: number | null
  sort_order: number
}

export default function MenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const isNew = id === 'new'

  const [menu, setMenu] = useState<Partial<Menu>>({
    name: '',
    category: '',
    selling_price: 0,
    target_cost_rate: 30,
    notes: '',
  })
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rows, setRows] = useState<MenuIngredientRow[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [ings, cats, sups] = await Promise.all([
      fetch('/api/ingredients').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
    ])
    setIngredients(Array.isArray(ings) ? ings : [])
    setCategories(Array.isArray(cats) ? cats : [])
    setSuppliers(Array.isArray(sups) ? sups : [])

    if (!isNew) {
      const data = await fetch(`/api/menus/${id}`).then(r => r.json())
      setMenu(data)
      setRows((data.menu_ingredients ?? []).map((mi: MenuIngredientRow) => ({
        id: mi.id,
        ingredient_id: mi.ingredient_id ?? '',
        ingredient_name: mi.ingredient_name,
        quantity: mi.quantity,
        unit: mi.unit,
        unit_price: mi.unit_price,
        cost: mi.cost,
        sort_order: mi.sort_order,
      })))
    }
  }, [id, isNew])

  useEffect(() => { load() }, [load])

  const addRow = () => {
    setRows(r => [...r, {
      ingredient_id: '',
      ingredient_name: '',
      quantity: 0,
      unit: 'g',
      unit_price: null,
      cost: null,
      sort_order: r.length,
    }])
  }

  const updateRow = (idx: number, field: keyof MenuIngredientRow, value: string | number | null) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const updated = { ...row, [field]: value }

      if (field === 'ingredient_id' && typeof value === 'string') {
        const ing = ingredients.find(ig => ig.id === value)
        if (ing) {
          updated.ingredient_name = ing.name
          updated.unit = ing.unit
          const up = effectiveUnitPrice(ing)
          updated.unit_price = up
          updated.cost = up ? up * updated.quantity : null
        }
      }

      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (value as number) : updated.quantity
        const up = field === 'unit_price' ? (value as number | null) : updated.unit_price
        updated.cost = up && qty ? up * qty : null
      }

      return updated
    }))
  }

  const removeRow = (idx: number) => setRows(r => r.filter((_, i) => i !== idx))

  const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const costRate = (menu.selling_price ?? 0) > 0 ? (totalCost / (menu.selling_price ?? 1)) * 100 : 0

  const handleSave = async () => {
    if (!menu.name || !menu.selling_price) return alert('メニュー名と売価は必須です')
    setSaving(true)
    const payload = {
      name: menu.name,
      category: menu.category || null,
      selling_price: menu.selling_price,
      target_cost_rate: menu.target_cost_rate ?? 30,
      notes: menu.notes || null,
      image_url: menu.image_url ?? null,
      menu_ingredients: rows.map((r, idx) => ({ ...r, sort_order: idx })),
    }
    const url = isNew ? '/api/menus' : `/api/menus/${id}`
    const method = isNew ? 'POST' : 'PUT'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (isNew) router.push('/menus')
    else load()
  }

  const handleDelete = async () => {
    if (!confirm('このメニューを削除しますか？')) return
    await fetch(`/api/menus/${id}`, { method: 'DELETE' })
    router.push('/menus')
  }

  const ok = costRate <= (menu.target_cost_rate ?? 30)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/menus" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-900">{isNew ? 'メニューを追加' : menu.name || 'メニュー詳細'}</h2>
      </div>

      <div className="space-y-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-medium text-gray-900 text-sm">基本情報</h3>
          {menu.image_url && (
            <img src={menu.image_url} alt={menu.name} className="w-full max-w-xs rounded-lg border border-gray-200" />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">メニュー名 *</label>
              <input value={menu.name ?? ''} onChange={e => setMenu(m => ({ ...m, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
              <input value={menu.category ?? ''} onChange={e => setMenu(m => ({ ...m, category: e.target.value }))}
                placeholder="前菜・主菜・デザートなど"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">目標原価率 (%)</label>
              <input type="number" min="0" max="100" value={menu.target_cost_rate ?? 30}
                onChange={e => setMenu(m => ({ ...m, target_cost_rate: parseFloat(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">売価（円） *</label>
              <input type="number" min="0" value={menu.selling_price ?? ''}
                onChange={e => setMenu(m => ({ ...m, selling_price: parseFloat(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* 食材構成 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 text-sm">食材構成</h3>
            <button onClick={addRow} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus size={13} /> 食材を追加
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-400">
                食材を追加してください
              </div>
            )}
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center border border-gray-100 rounded-lg p-2 sm:border-0 sm:p-0">
                <div className="col-span-2 sm:col-span-4">
                  <IngredientCombobox
                    ingredients={ingredients}
                    categories={categories}
                    suppliers={suppliers}
                    value={row.ingredient_id}
                    onSelect={id => updateRow(idx, 'ingredient_id', id)}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <input type="number" min="0" step="0.001" placeholder="数量" value={row.quantity || ''}
                    onChange={e => updateRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 sm:col-span-1">
                  {row.ingredient_id ? (
                    // 食材を選んだら単位は食材マスタのものに自動固定（打ち間違い防止）
                    <div className="px-2 py-1.5 text-xs text-gray-500 text-center bg-gray-50 rounded-lg border border-transparent">{row.unit}</div>
                  ) : (
                    <input value={row.unit} onChange={e => updateRow(idx, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <input type="number" min="0" step="0.0001" placeholder="単価" value={row.unit_price ?? ''}
                    onChange={e => updateRow(idx, 'unit_price', parseFloat(e.target.value) || null)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 sm:col-span-2 text-right text-xs font-medium text-gray-700 pr-1">
                  ¥{(row.cost ?? 0).toFixed(0)}
                </div>
                <div className="col-span-1 sm:col-span-1 flex justify-end sm:justify-center">
                  <button onClick={() => removeRow(idx)} className="p-1 text-gray-300 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="text-xs text-gray-400 mt-2 ml-1 hidden sm:grid grid-cols-12 gap-2">
              <span className="col-span-4">食材名</span>
              <span className="col-span-2">数量</span>
              <span className="col-span-1">単位</span>
              <span className="col-span-2">使うときの単価</span>
              <span className="col-span-2 text-right">原価</span>
            </div>
          )}
        </div>

        {/* 集計 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 text-sm mb-4">原価集計</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">合計原価</div>
              <div className="text-lg font-bold text-gray-900">¥{totalCost.toFixed(0)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">原価率</div>
              <div className={`text-lg font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>
                {costRate.toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">粗利益</div>
              <div className="text-lg font-bold text-gray-900">
                ¥{((menu.selling_price ?? 0) - totalCost).toFixed(0)}
              </div>
            </div>
          </div>
          {/* 儲け判定を一言で（パソコンが苦手でも一目で分かるように） */}
          {(menu.selling_price ?? 0) > 0 && rows.length > 0 && (
            ok ? (
              <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-700 font-medium">
                ✓ 目標より低めで良好 — この一品で <span className="font-bold">¥{((menu.selling_price ?? 0) - totalCost).toFixed(0)}</span> の利益
              </div>
            ) : (
              <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-600 font-medium">
                ⚠ 目標原価率（{menu.target_cost_rate}%）より高めです — 売価や食材の量を見直しましょう
              </div>
            )
          )}
        </div>

        {/* アクション */}
        <div className="flex gap-3">
          {!isNew && (
            <button onClick={handleDelete} className="px-4 py-2 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors">
              削除
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Save size={15} />
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}
