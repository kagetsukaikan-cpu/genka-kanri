'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import type { Ingredient, IngredientCategory, Supplier } from '@/types'

const UNITS = ['g', 'kg', 'cc', 'ml', '個', '枚', '本', '袋', 'パック', '尾']

const emptyForm = {
  name: '',
  category_id: '',
  supplier_id: '',
  unit: 'g',
  purchase_price: '',
  purchase_quantity: '',
  yield_rate: '100',
  notes: '',
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory) params.set('category', filterCategory)
    const [ing, cat, sup] = await Promise.all([
      fetch(`/api/ingredients?${params}`).then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
    ])
    setIngredients(Array.isArray(ing) ? ing : [])
    setCategories(Array.isArray(cat) ? cat : [])
    setSuppliers(Array.isArray(sup) ? sup : [])
  }, [filterCategory])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (ing: Ingredient) => {
    setEditTarget(ing)
    setForm({
      name: ing.name,
      category_id: ing.category_id ?? '',
      supplier_id: ing.supplier_id ?? '',
      unit: ing.unit,
      purchase_price: ing.purchase_price?.toString() ?? '',
      purchase_quantity: ing.purchase_quantity?.toString() ?? '',
      yield_rate: ing.yield_rate?.toString() ?? '100',
      notes: ing.notes ?? '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この食材を削除しますか？')) return
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' })
    load()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      unit: form.unit,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      purchase_quantity: form.purchase_quantity ? parseFloat(form.purchase_quantity) : null,
      yield_rate: parseFloat(form.yield_rate) || 100,
      notes: form.notes || null,
    }
    const url = editTarget ? `/api/ingredients/${editTarget.id}` : '/api/ingredients'
    const method = editTarget ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    setShowForm(false)
    load()
  }

  // 実質単価計算
  const effectiveUnitPrice = (ing: Ingredient) => {
    const price = ing.latest_unit_price ?? (
      ing.purchase_price && ing.purchase_quantity ? ing.purchase_price / ing.purchase_quantity : null
    )
    if (!price) return null
    const yieldRate = ing.yield_rate ?? 100
    return yieldRate > 0 ? price / (yieldRate / 100) : price
  }

  const filtered = ingredients.filter(ing =>
    !search || ing.name.includes(search)
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">食材マスタ</h2>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} /> 食材を追加
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="食材名で検索"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全分類</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">食材名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">分類</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">仕入先</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">仕入価格</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">内容量</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">歩留率</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">実質単価</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">食材が登録されていません</td></tr>
            ) : filtered.map(ing => {
              const unitPrice = effectiveUnitPrice(ing)
              return (
                <tr key={ing.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ing.name}</td>
                  <td className="px-4 py-3 text-gray-500">{ing.category?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{ing.supplier?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {ing.latest_unit_price
                      ? <span className="text-blue-600 font-medium">¥{(ing.latest_unit_price * (ing.purchase_quantity ?? 1)).toLocaleString()}<span className="text-xs text-gray-400 ml-1">（仕入）</span></span>
                      : ing.purchase_price ? `¥${ing.purchase_price.toLocaleString()}` : '-'
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {ing.purchase_quantity ? `${ing.purchase_quantity}${ing.unit}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{ing.yield_rate ?? 100}%</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {unitPrice ? `¥${unitPrice.toFixed(2)}/${ing.unit}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(ing)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(ing.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 食材登録/編集フォーム モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTarget ? '食材を編集' : '食材を追加'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">食材名 *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">分類</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">未設定</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">仕入先</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">未設定</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">単位</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">歩留率 (%)</label>
                  <input type="number" min="1" max="100" step="0.1" value={form.yield_rate}
                    onChange={e => setForm(f => ({ ...f, yield_rate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">仕入価格 (円)</label>
                  <input type="number" min="0" step="1" value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">内容量 ({form.unit})</label>
                  <input type="number" min="0" step="0.001" value={form.purchase_quantity}
                    onChange={e => setForm(f => ({ ...f, purchase_quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
                  キャンセル
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
