'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, Layers } from 'lucide-react'
import type { Ingredient, IngredientCategory, Supplier, IngredientComponent } from '@/types'
import { normalizeForSearch } from '@/lib/search'
import { shortSupplierName } from '@/lib/format'
import { toGrams } from '@/lib/weight'
import { effectiveUnitPrice, formatUnitPrice, toReferenceQuantity } from '@/lib/price'
import IngredientCombobox from '@/components/IngredientCombobox'

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

type ComponentRow = IngredientComponent

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
  const [isGroup, setIsGroup] = useState(false)
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([])

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
    setIsGroup(false)
    setComponentRows([])
    setShowForm(true)
  }

  const openEdit = async (ing: Ingredient) => {
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
    const detail = await fetch(`/api/ingredients/${ing.id}`).then(r => r.json())
    const rows: ComponentRow[] = detail.components ?? []
    setIsGroup(rows.length > 0)
    setComponentRows(rows)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この食材を削除しますか？')) return
    const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }))
      alert(error ?? 'この食材は他のメニューや食材で使われているため削除できません。先に使用箇所を解除してください。')
      return
    }
    load()
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`選択した${selectedIds.size}件の食材を削除しますか？`)) return
    const results = await Promise.all(
      [...selectedIds].map(id => fetch(`/api/ingredients/${id}`, { method: 'DELETE' }).then(res => ({ id, ok: res.ok })))
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      const names = ingredients.filter(i => failed.some(f => f.id === i.id)).map(i => i.name).join('、')
      alert(`${failed.length}件は他のメニューや食材で使われているため削除できませんでした。\n${names}`)
    }
    setSelectedIds(new Set())
    load()
  }

  const addComponentRow = () => {
    setComponentRows(r => [...r, {
      component_ingredient_id: '',
      component_name: '',
      quantity: 0,
      unit: 'g',
      unit_price: null,
      cost: null,
      sort_order: r.length,
    }])
  }

  const updateComponentRow = (idx: number, field: keyof ComponentRow, value: string | number | null) => {
    setComponentRows(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const updated = { ...row, [field]: value }

      if (field === 'component_ingredient_id' && typeof value === 'string') {
        const ing = ingredients.find(ig => ig.id === value)
        if (ing) {
          updated.component_name = ing.name
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

  const removeComponentRow = (idx: number) => setComponentRows(r => r.filter((_, i) => i !== idx))

  const componentTotalCost = componentRows.reduce((s, r) => s + (r.cost ?? 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // kgで登録された場合はグラムに正規化する（メニューでの使用量はグラム単位が基本のため）
    let unit = form.unit
    let purchase_quantity = form.purchase_quantity ? parseFloat(form.purchase_quantity) : null
    let purchase_price = isGroup ? componentTotalCost : (form.purchase_price ? parseFloat(form.purchase_price) : null)
    if (purchase_quantity != null) {
      const grams = toGrams(unit, purchase_quantity)
      if (grams != null) {
        unit = 'g'
        purchase_quantity = grams
      }
    }
    // 食材マスタの基準価格は常に1単位（重量系は100g）あたりの単価で保持する
    if (!isGroup && purchase_quantity != null && purchase_price != null) {
      const ref = toReferenceQuantity(unit, purchase_quantity, purchase_price)
      if (ref) {
        purchase_quantity = ref.quantity
        purchase_price = ref.price
      }
    }

    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      supplier_id: isGroup ? null : (form.supplier_id || null),
      unit,
      purchase_price,
      purchase_quantity,
      yield_rate: parseFloat(form.yield_rate) || 100,
      notes: form.notes || null,
      components: isGroup ? componentRows.map((r, idx) => ({ ...r, sort_order: idx })) : [],
    }
    const url = editTarget ? `/api/ingredients/${editTarget.id}` : '/api/ingredients'
    const method = editTarget ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }))
      alert(error ?? '食材の保存に失敗しました。')
      return
    }
    setShowForm(false)
    load()
  }

  const needsNormalization = ingredients.filter(i =>
    !i.is_group && i.purchase_quantity != null && i.purchase_price != null &&
    (i.unit === 'kg' || (i.unit === 'g' ? i.purchase_quantity !== 100 : i.purchase_quantity !== 1))
  )

  const handleNormalizeUnitPrices = async () => {
    if (!confirm(`${needsNormalization.length}件の食材を単位価格（重量系は100g・それ以外は1単位）に正規化しますか？`)) return
    setSaving(true)
    for (const ing of needsNormalization) {
      let unit = ing.unit
      let quantity = ing.purchase_quantity!
      const grams = toGrams(unit, quantity)
      if (grams != null) { unit = 'g'; quantity = grams }
      const ref = toReferenceQuantity(unit, quantity, ing.purchase_price!)
      if (!ref) continue
      await fetch(`/api/ingredients/${ing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit, purchase_quantity: ref.quantity, purchase_price: ref.price }),
      })
    }
    setSaving(false)
    load()
  }

  const filtered = ingredients.filter(ing => {
    if (!search) return true
    const q = normalizeForSearch(search)
    return (
      normalizeForSearch(ing.name).includes(q) ||
      (ing.supplier?.name && normalizeForSearch(ing.supplier.name).includes(q)) ||
      (ing.category?.name && normalizeForSearch(ing.category.name).includes(q))
    )
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">食材マスタ</h2>
        <div className="flex gap-2">
          {needsNormalization.length > 0 && (
            <button onClick={handleNormalizeUnitPrices} disabled={saving}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              単位価格に正規化（{needsNormalization.length}件）
            </button>
          )}
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1.5 bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              <Trash2 size={15} /> 選択した{selectedIds.size}件を削除
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={15} /> 食材を追加
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="食材名・分類・仕入先で検索"
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
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">食材名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">分類</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">仕入先</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">仕入価格</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">内容量</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">使える割合</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">使うときの単価</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">食材が登録されていません</td></tr>
            ) : filtered.map(ing => {
              return (
                <tr key={ing.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(ing.id)} onChange={() => toggleSelect(ing.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        {ing.name}
                        {ing.supplier?.name && (
                          <span className="text-xs text-gray-400 font-normal">（{shortSupplierName(ing.supplier.name)}）</span>
                        )}
                        {ing.is_group && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                            <Layers size={10} /> グループ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-normal">更新: {new Date(ing.updated_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </td>
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
                    {formatUnitPrice(ing)}
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
          <div className={`bg-white rounded-2xl shadow-xl w-full ${isGroup ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTarget ? '食材を編集' : '食材を追加'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">食材名 *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2 flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                  <input type="checkbox" id="isGroup" checked={isGroup}
                    onChange={e => { setIsGroup(e.target.checked); if (e.target.checked && componentRows.length === 0) addComponentRow() }}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <label htmlFor="isGroup" className="text-xs text-purple-700 font-medium">
                    グループ食材として複数食材から原価を計算する（例：酢飯＝米＋酢＋砂糖＋塩）
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">分類</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">未設定</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {!isGroup && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">仕入先</label>
                    <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">未設定</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">単位</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">仕入価格 (円){isGroup && '（材料費合計から自動計算）'}</label>
                  <input type="number" min="0" step="1"
                    value={isGroup ? componentTotalCost.toFixed(0) : form.purchase_price}
                    readOnly={isGroup}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isGroup ? 'bg-gray-50 border-gray-200 text-gray-500' : 'border-gray-200'}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isGroup ? `出来上がり量 (${form.unit})` : `内容量 (${form.unit})`}</label>
                  <input type="number" min="0" step="0.001" value={form.purchase_quantity}
                    onChange={e => setForm(f => ({ ...f, purchase_quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* よく使わない項目は折りたたむ（パソコンが苦手でも迷わないよう主要項目だけ表示） */}
                <details className="col-span-2">
                  <summary className="text-xs text-blue-600 cursor-pointer select-none py-1">詳しい設定（使える割合・メモ）</summary>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">使える割合 (%)</label>
                      <input type="number" min="1" max="100" step="0.1" value={form.yield_rate}
                        onChange={e => setForm(f => ({ ...f, yield_rate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <p className="text-[11px] text-gray-400 mt-1">皮・骨・ヘタなどを除いて実際に使える割合。丸ごと使うなら100%</p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                      <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </details>
              </div>

              {isGroup && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-gray-700">材料リスト</h4>
                    <button type="button" onClick={addComponentRow} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                      <Plus size={12} /> 材料を追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {componentRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <IngredientCombobox
                            ingredients={ingredients}
                            categories={categories}
                            suppliers={suppliers}
                            value={row.component_ingredient_id ?? ''}
                            onSelect={id => updateComponentRow(idx, 'component_ingredient_id', id)}
                            excludeId={editTarget?.id}
                          />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" step="0.001" placeholder="数量" value={row.quantity || ''}
                            onChange={e => updateComponentRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div className="col-span-1">
                          <input value={row.unit} onChange={e => updateComponentRow(idx, 'unit', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" step="0.0001" placeholder="単価" value={row.unit_price ?? ''}
                            onChange={e => updateComponentRow(idx, 'unit_price', parseFloat(e.target.value) || null)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div className="col-span-2 text-right text-xs font-medium text-gray-700 pr-1">
                          ¥{(row.cost ?? 0).toFixed(0)}
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button type="button" onClick={() => removeComponentRow(idx)} className="p-1 text-gray-300 hover:text-red-400">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">材料費合計</span>
                    <span className="text-sm font-semibold text-purple-700">¥{componentTotalCost.toFixed(0)}</span>
                  </div>
                </div>
              )}

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
