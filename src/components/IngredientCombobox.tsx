'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { Ingredient, IngredientCategory, Supplier } from '@/types'
import { normalizeForSearch } from '@/lib/search'
import { shortSupplierName } from '@/lib/format'
import { formatUnitPrice } from '@/lib/price'

// あいまい検索・分類・取引先で絞り込める食材選択コンボボックス
export default function IngredientCombobox({ ingredients, categories, suppliers, value, onSelect, excludeId }: {
  ingredients: Ingredient[]
  categories: IngredientCategory[]
  suppliers: Supplier[]
  value: string
  onSelect: (id: string) => void
  excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = ingredients.find(i => i.id === value)

  const filtered = ingredients.filter(i => {
    if (excludeId && i.id === excludeId) return false
    if (categoryFilter && i.category_id !== categoryFilter) return false
    if (supplierFilter && i.supplier_id !== supplierFilter) return false
    if (query && !normalizeForSearch(i.name).includes(normalizeForSearch(query))) return false
    return true
  })

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-left bg-white truncate focus:outline-none focus:ring-2 focus:ring-blue-500">
        {selected
          ? <>{selected.name}{selected.supplier?.name ? `（${shortSupplierName(selected.supplier.name)}）` : ''}
              <span className="text-gray-400 ml-1">{formatUnitPrice(selected)}</span></>
          : <span className="text-gray-400">選択してください</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <div className="relative mb-1.5">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="食材名で検索"
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1.5 mb-1.5">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">全分類</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">全取引先</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{shortSupplierName(s.name)}</option>)}
            </select>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">見つかりません</div>
            ) : filtered.map(i => (
              <button type="button" key={i.id}
                onClick={() => { onSelect(i.id); setOpen(false); setQuery('') }}
                className="w-full text-left px-1.5 py-1.5 text-xs hover:bg-blue-50 rounded">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-gray-900 truncate">{i.name}</div>
                  <div className="text-blue-600 font-medium shrink-0">{formatUnitPrice(i)}</div>
                </div>
                <div className="text-gray-400">
                  {i.category?.name ?? '-'}
                  {i.supplier?.name ? ` ・ ${shortSupplierName(i.supplier.name)}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
