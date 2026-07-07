'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import type { Ingredient, IngredientCategory, Supplier } from '@/types'
import { effectiveUnitPrice } from '@/lib/price'
import IngredientCombobox from '@/components/IngredientCombobox'

interface Row {
  ingredient_id: string
  ingredient_name: string
  quantity: number
  unit: string
  unit_price: number | null
  cost: number | null
}

export default function NewMenuPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [sellingPrice, setSellingPrice] = useState<number | ''>('')
  const [targetCostRate, setTargetCostRate] = useState(30)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/ingredients').then(r => r.json()).then(d => setIngredients(Array.isArray(d) ? d : []))
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []))
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []))
  }, [])

  const addRow = () => setRows(r => [...r, { ingredient_id: '', ingredient_name: '', quantity: 0, unit: 'g', unit_price: null, cost: null }])

  const updateRow = (idx: number, field: keyof Row, value: string | number | null) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const updated = { ...row, [field]: value }
      if (field === 'ingredient_id' && typeof value === 'string') {
        const ing = ingredients.find(ig => ig.id === value)
        if (ing) {
          updated.ingredient_name = ing.name
          updated.unit = ing.unit
          updated.unit_price = effectiveUnitPrice(ing)
          updated.cost = updated.unit_price ? updated.unit_price * updated.quantity : null
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

  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  const costRate = sellingPrice && sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0
  const ok = costRate <= targetCostRate

  const handleSave = async () => {
    if (!name || !sellingPrice) return alert('メニュー名と売価は必須です')
    setSaving(true)
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, category: category || null, selling_price: sellingPrice, target_cost_rate: targetCostRate,
        menu_ingredients: rows.map((r, idx) => ({ ...r, sort_order: idx })),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }))
      alert(error ?? 'メニューの保存に失敗しました。')
      return
    }
    router.push('/menus')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/menus" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-900">メニューを追加</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-medium text-gray-900 text-sm">基本情報</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">メニュー名 *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="前菜・主菜など"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">目標原価率 (%)</label>
              <input type="number" min="0" max="100" value={targetCostRate} onChange={e => setTargetCostRate(parseFloat(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">売価（円） *</label>
              <input type="number" min="0" value={sellingPrice} onChange={e => setSellingPrice(parseFloat(e.target.value) || '')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 text-sm">食材構成</h3>
            <button onClick={addRow} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <Plus size={13} /> 食材を追加
            </button>
          </div>
          <div className="space-y-2">
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
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                  )}
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <input type="number" min="0" step="0.0001" placeholder="単価" value={row.unit_price ?? ''}
                    onChange={e => updateRow(idx, 'unit_price', parseFloat(e.target.value) || null)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 sm:col-span-2 text-right text-xs font-medium text-gray-700 pr-1">¥{(row.cost ?? 0).toFixed(0)}</div>
                <div className="col-span-1 sm:col-span-1 flex justify-end sm:justify-center">
                  <button onClick={() => setRows(r => r.filter((_, i) => i !== idx))} className="p-1 text-gray-300 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-center py-6 text-sm text-gray-400">食材を追加してください</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">合計原価</div>
              <div className="text-lg font-bold text-gray-900">¥{totalCost.toFixed(0)}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">原価率</div>
              <div className={`text-lg font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>{costRate.toFixed(1)}%</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">粗利益</div>
              <div className="text-lg font-bold text-gray-900">¥{((sellingPrice || 0) - totalCost).toFixed(0)}</div>
            </div>
          </div>
          {/* 儲け判定を一言で（パソコンが苦手でも一目で分かるように） */}
          {sellingPrice && sellingPrice > 0 && rows.length > 0 && (
            ok ? (
              <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-700 font-medium">
                ✓ 目標より低めで良好 — この一品で <span className="font-bold">¥{((sellingPrice || 0) - totalCost).toFixed(0)}</span> の利益
              </div>
            ) : (
              <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-600 font-medium">
                ⚠ 目標原価率（{targetCostRate}%）より高めです — 売価や食材の量を見直しましょう
              </div>
            )
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Save size={15} /> {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
