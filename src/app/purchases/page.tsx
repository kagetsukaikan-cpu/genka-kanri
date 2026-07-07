'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, X, AlertCircle, FileSpreadsheet, Search } from 'lucide-react'
import type { PurchaseHistory, Supplier, Ingredient, IngredientCategory } from '@/types'
import { normalizeForSearch } from '@/lib/search'
import { toGrams, extractGramsFromName } from '@/lib/weight'
import { toReferenceQuantity } from '@/lib/price'

const UNITS = ['g', 'kg', 'cc', 'ml', '個', '枚', '本', '袋', 'パック', '尾']

const emptyForm = {
  purchase_date: new Date().toISOString().split('T')[0],
  supplier_id: '',
  ingredient_id: '',
  ingredient_name: '',
  quantity: '',
  unit: 'g',
  price: '',
  notes: '',
}

// インフォマートCSVのパース
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && !inQuotes) { inQuotes = true }
    else if (c === '"' && inQuotes) {
      if (line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = false }
    } else if (c === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += c }
  }
  result.push(current)
  return result
}

// ヘッダーの前後の括弧（全角／半角）と引用符を取り除き、キーを統一する
function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, '').trim().replace(/^"|"$/g, '').replace(/^[［\[]|[］\]]$/g, '').trim()
}

function parseInfomartCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  // 先頭行は "H",日付 のヘッダー情報行なので、実際の列見出し行（商品名を含む行）を探す
  const headerIndex = lines.findIndex(l => l.includes('商品名'))
  if (headerIndex === -1) return []
  const headers = parseCSVLine(lines[headerIndex]).map(normalizeHeader)
  const dataIndex = headers.indexOf('データ区分')
  return lines.slice(headerIndex + 1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  }).filter(row => (dataIndex === -1 || row['データ区分'] === 'D') && row['商品名'] && row['商品名'].trim())
}

type CsvItem = {
  purchase_date: string
  supplier_name: string
  supplier_id: string
  ingredient_name: string
  ingredient_id: string
  category_name: string
  quantity: number
  unit: string
  unit_price: number
  price: number
  spec: string
  case_size: number
  case_unit: string
}

// 商品名からカテゴリを推測（食材マスタに未登録の場合のフォールバック）
function guessCategory(name: string): string {
  const rules: [string, string[]][] = [
    ['魚介類', ['魚', '鮮魚', '海老', 'えび', 'エビ', 'イカ', 'いか', 'タコ', 'たこ', 'カニ', 'かに', '貝', 'サーモン', 'マグロ', '鯛', '鰯', '鯖', 'さば', 'いくら', 'ウニ', 'うに', 'アジ', 'ぶり', 'カンパチ', 'ヒラメ', '牡蠣', 'かき', '海鮮', '鰻', 'うなぎ', '今津']],
    ['肉類', ['肉', '牛', '豚', '鶏', '鴨', 'ささみ', 'もも肉', 'バラ', 'ロース', 'ひき肉', 'ベーコン', 'ハム', 'ソーセージ']],
    ['野菜・キノコ', ['野菜', 'キノコ', 'きのこ', '大根', '人参', 'にんじん', 'キャベツ', '白菜', 'ねぎ', 'ネギ', '玉ねぎ', 'たまねぎ', 'じゃがいも', '芋', 'トマト', 'きゅうり', 'なす', 'しいたけ', 'しめじ', 'えのき', 'まいたけ', 'ごぼう', 'れんこん', 'ほうれん草', '小松菜', '枝豆', 'ピーマン', 'かぼちゃ']],
    ['米・麺・パン', ['米', 'こめ', '麺', 'そば', 'うどん', 'パスタ', 'パン', '餅', 'もち', 'ご飯']],
    ['調味料・油', ['醤油', 'しょうゆ', '味噌', 'みそ', '油', '塩', '砂糖', '酢', 'だし', 'ソース', 'みりん', '酒', '胡椒', 'こしょう', 'ドレッシング', 'たれ', 'タレ']],
    ['乳製品・卵', ['卵', 'たまご', '牛乳', 'チーズ', 'バター', '生クリーム', 'ヨーグルト']],
  ]
  for (const [category, keywords] of rules) {
    if (keywords.some(k => name.includes(k))) return category
  }
  return 'その他'
}

// 調理食材・調味料以外（消耗品・包材・備品など）は仕入CSV取込の対象外とする
const NON_FOOD_KEYWORDS = [
  '容器', 'ラップ', 'アルミホイル', '割り箸', '割箸', 'お箸', '爪楊枝', 'つまようじ',
  '手袋', '軍手', 'おしぼり', 'ナプキン', 'ペーパー', 'タオル', '紙コップ', '紙皿', '紙ナプキン',
  'ストロー', '洗剤', 'スポンジ', 'ゴミ袋', 'ごみ袋', '段ボール', 'ダンボール', 'シール', 'ラベル',
  '輪ゴム', '養生テープ', 'テープ', 'マスク', 'アルコール', '除菌', '消毒', '軍手',
  '名刺', '伝票', '請求書', '封筒', 'レジ袋', '買い物袋', '弁当箱', '使い捨て',
]
function isNonFoodItem(name: string): boolean {
  return NON_FOOD_KEYWORDS.some(k => name.includes(k))
}

// 食材を扱わない取引先（備品・印刷・ユニフォーム業者など）は仕入CSV取込の対象外とする
const NON_FOOD_SUPPLIER_KEYWORDS = ['吉竹商店', '大垣商事', 'うえ田', 'サニクリーン']
function isNonFoodSupplier(name: string): boolean {
  return NON_FOOD_SUPPLIER_KEYWORDS.some(k => name.includes(k))
}

// "2026/06/01" → "2026-06-01"（date input用）
function toIsoDate(s: string): string {
  return s.trim().replace(/\//g, '-')
}

function rowToCsvItem(row: Record<string, string>): CsvItem {
  const date = toIsoDate(row['納品日'] || row['伝票日付'] || row['発注日'] || '')
  const price = parseFloat((row['金額'] || '0').replace(/,/g, '')) || 0
  const unitPrice = parseFloat((row['単価'] || '0').replace(/,/g, '')) || 0
  const quantity = parseFloat((row['数量'] || '0').replace(/,/g, '')) || 0
  return {
    purchase_date: date,
    supplier_name: (row['取引先名'] || '').trim(),
    supplier_id: '',
    ingredient_name: (row['商品名'] || '').trim(),
    ingredient_id: '',
    category_name: '',
    quantity,
    unit: (row['単位'] || '個').trim(),
    unit_price: unitPrice,
    price,
    spec: (row['規格'] || '').trim(),
    case_size: parseFloat((row['入数'] || '0').replace(/,/g, '')) || 0,
    case_unit: (row['入数単位'] || '').trim(),
  }
}

// ケース（C/S）等で仕入れた場合、入数を使って「1単位あたりの単価」に正規化する（全カテゴリ対象）
// メニューでの使用量計算に使えるよう、kg/gは100g基準のグラムに、それ以外（個/本/枚など）は1単位あたりの単価にする
function normalizeToWeightUnit(item: CsvItem) {
  const caseSize = item.case_size > 0 ? item.case_size : 1
  const totalQuantity = item.quantity * caseSize

  // 入数単位（または単位）がkg/gならグラムに正規化
  let totalGrams = toGrams(item.case_unit || item.unit, totalQuantity)

  // 単位だけでは重量が分からない場合、商品名の重量表記（例:「豚肉500g」）から推定する
  if (totalGrams == null) {
    const gramsPerPiece = extractGramsFromName(item.ingredient_name)
    if (gramsPerPiece != null) totalGrams = item.quantity * caseSize * gramsPerPiece
  }

  if (totalGrams != null && totalGrams > 0) {
    item.quantity = totalGrams
    item.unit = 'g'
    item.unit_price = item.price / totalGrams
    return
  }

  if (item.case_size > 0 && item.case_unit && totalQuantity > 0) {
    item.quantity = totalQuantity
    item.unit = item.case_unit
    item.unit_price = item.price / totalQuantity
  }
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // インフォマートCSV関連
  const [showCsv, setShowCsv] = useState(false)
  const [csvStep, setCsvStep] = useState<'upload' | 'confirm'>('upload')
  const [csvItems, setCsvItems] = useState<CsvItem[]>([])
  const [csvError, setCsvError] = useState('')
  const [csvExcludedCount, setCsvExcludedCount] = useState(0)

  const load = useCallback(async () => {
    const [p, s, i, c] = await Promise.all([
      fetch('/api/purchases').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/ingredients').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ])
    setPurchases(Array.isArray(p) ? p : [])
    setSuppliers(Array.isArray(s) ? s : [])
    setIngredients(Array.isArray(i) ? i : [])
    setCategories(Array.isArray(c) ? c : [])
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('この仕入履歴を削除しますか？')) return
    await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
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
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`選択した${selectedIds.size}件の仕入履歴を削除しますか？`)) return
    await Promise.all([...selectedIds].map(id => fetch(`/api/purchases/${id}`, { method: 'DELETE' })))
    setSelectedIds(new Set())
    load()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ing = ingredients.find(i => i.id === form.ingredient_id)
    const payload = {
      purchase_date: form.purchase_date,
      supplier_id: form.supplier_id || null,
      ingredient_id: form.ingredient_id || null,
      ingredient_name: form.ingredient_name || ing?.name || '',
      quantity: parseFloat(form.quantity),
      unit: form.unit,
      price: parseFloat(form.price),
      notes: form.notes || null,
    }
    await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    setShowForm(false)
    load()
  }

  // インフォマートCSV処理
  const handleCsvFile = (file: File) => {
    setCsvError('')

    const applyRows = (rows: Record<string, string>[]) => {
      const foodRows = rows.filter(row =>
        !isNonFoodItem((row['商品名'] || '').trim()) &&
        !isNonFoodSupplier((row['取引先名'] || '').trim())
      )
      setCsvExcludedCount(rows.length - foodRows.length)
      const items = foodRows.map(row => {
        const item = rowToCsvItem(row)
        // 仕入先名で自動マッチング
        const matchedSupplier = suppliers.find(s =>
          s.name === item.supplier_name ||
          s.name.includes(item.supplier_name) ||
          item.supplier_name.includes(s.name)
        )
        item.supplier_id = matchedSupplier?.id ?? ''
        // 食材名で自動マッチング（既存食材ならそのカテゴリを採用、未登録なら推測）
        const matchedIngredient = ingredients.find(i =>
          i.name === item.ingredient_name ||
          i.name.includes(item.ingredient_name) ||
          item.ingredient_name.includes(i.name)
        )
        item.ingredient_id = matchedIngredient?.id ?? ''
        item.category_name = matchedIngredient?.category?.name ?? guessCategory(item.ingredient_name)
        normalizeToWeightUnit(item)
        return item
      })
      setCsvItems(items)
      setCsvStep('confirm')
    }

    const readWith = (encoding: string, onFail: () => void) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const rows = parseInfomartCSV(text)
          if (rows.length === 0) { onFail(); return }
          applyRows(rows)
        } catch {
          onFail()
        }
      }
      reader.onerror = onFail
      reader.readAsText(file, encoding)
    }

    // Shift-JIS（インフォマート標準）でまず試し、ダメならUTF-8で再試行
    readWith('Shift-JIS', () => {
      readWith('UTF-8', () => {
        setCsvError('インフォマート形式のデータが見つかりませんでした。ファイルを確認してください。')
      })
    })
  }

  const handleCsvSave = async () => {
    setSaving(true)

    // 仕入先名→ID のキャッシュ（同名の仕入先を重複作成しないため）
    const supplierCache = new Map<string, string>()

    // 同一食材が複数行ある場合、食材マスタの単価には最新納品日の行のみを反映する
    const latestByName = new Map<string, CsvItem>()
    for (const item of csvItems) {
      const prev = latestByName.get(item.ingredient_name)
      if (!prev || item.purchase_date > prev.purchase_date) {
        latestByName.set(item.ingredient_name, item)
      }
    }

    for (const item of csvItems) {
      // 1. 仕入先の確認・自動作成
      let supplierId = item.supplier_id
      if (!supplierId && item.supplier_name) {
        if (supplierCache.has(item.supplier_name)) {
          supplierId = supplierCache.get(item.supplier_name)!
        } else {
          const res = await fetch('/api/suppliers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: item.supplier_name }),
          })
          if (res.ok) {
            const s = await res.json()
            supplierId = s.id
            supplierCache.set(item.supplier_name, s.id)
          }
        }
      }

      // 2. 食材の確認・自動作成
      let ingredient = ingredients.find(i => i.id === item.ingredient_id)
        ?? ingredients.find(i => i.name === item.ingredient_name || i.name.includes(item.ingredient_name) || item.ingredient_name.includes(i.name))

      const unitPrice = item.unit_price > 0 ? item.unit_price : (item.quantity > 0 ? item.price / item.quantity : item.price)
      // 食材マスタの基準価格は常に1単位（重量系は100g）あたりの単価で保持する
      const ref = toReferenceQuantity(item.unit, item.quantity, item.price)

      if (!ingredient) {
        const cat = categories.find(c => c.name === item.category_name) ?? categories.find(c => c.name === 'その他')
        const res = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.ingredient_name,
            unit: item.unit,
            category_id: cat?.id ?? null,
            supplier_id: supplierId || null,
            purchase_price: ref ? ref.price : item.price,
            purchase_quantity: ref ? ref.quantity : item.quantity,
          }),
        })
        if (res.ok) {
          ingredient = await res.json()
          setIngredients(prev => [...prev, ingredient as Ingredient])
        }
      }

      // 3. 仕入履歴登録
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_date: item.purchase_date,
          supplier_id: supplierId || null,
          ingredient_id: ingredient?.id ?? null,
          ingredient_name: item.ingredient_name + (item.spec ? ` (${item.spec})` : ''),
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          unit_price: unitPrice,
          notes: item.spec || null,
        }),
      })

      // 4. 食材マスタの価格を最新に更新（同一食材の重複行は最新納品日のみ反映）
      if (ingredient?.id && latestByName.get(item.ingredient_name) === item) {
        await fetch(`/api/ingredients/${ingredient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchase_price: ref ? ref.price : item.price,
            purchase_quantity: ref ? ref.quantity : item.quantity,
            unit: item.unit,
            supplier_id: supplierId || ingredient.supplier_id || null,
          }),
        })
      }
    }
    setSaving(false)
    setShowCsv(false)
    setCsvStep('upload')
    setCsvItems([])
    load()
  }

  const onIngredientChange = (id: string) => {
    const ing = ingredients.find(i => i.id === id)
    setForm(f => ({
      ...f,
      ingredient_id: id,
      ingredient_name: ing?.name ?? '',
      unit: ing?.unit ?? f.unit,
    }))
  }

  const filtered = purchases.filter(p =>
    !search || normalizeForSearch(p.ingredient_name).includes(normalizeForSearch(search))
  )

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">仕入履歴・納品書</h2>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1.5 bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              <Trash2 size={15} /> 選択した{selectedIds.size}件を削除
            </button>
          )}
          <button onClick={() => { setShowCsv(true); setCsvStep('upload'); setCsvItems([]); setCsvError('') }}
            className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <FileSpreadsheet size={15} /> インフォマートCSV
          </button>
          <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={15} /> 手動入力
          </button>
        </div>
      </div>

      {/* 検索 */}
      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="商品名で検索"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 仕入履歴テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">仕入先</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">食材名</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">数量</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">単位単価</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">仕入履歴がありません</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </td>
                <td className="px-4 py-3 text-gray-700">{p.purchase_date}</td>
                <td className="px-4 py-3 text-gray-500">{p.supplier?.name ?? '-'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {p.ingredient_name}
                  {p.ocr_raw_text && <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">OCR</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{p.quantity}{p.unit}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">¥{p.price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {p.unit_price ? `¥${p.unit_price.toFixed(2)}/${p.unit}` : '-'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 手動入力モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">仕入履歴を追加</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">仕入日 *</label>
                  <input type="date" required value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">仕入先</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">未設定</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">食材</label>
                  <select value={form.ingredient_id} onChange={e => onIngredientChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">マスタから選択（または下に直接入力）</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">食材名（直接入力）</label>
                  <input value={form.ingredient_name} onChange={e => setForm(f => ({ ...f, ingredient_name: e.target.value }))}
                    placeholder="マスタ未登録の品目はここに入力"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">数量 *</label>
                  <input type="number" required min="0" step="0.001" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">単位</label>
                  <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">金額（円） *</label>
                  <input type="number" required min="0" step="1" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
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

      {/* インフォマートCSVモーダル */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">インフォマートCSVを取り込む</h3>
                {csvStep === 'confirm' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {csvItems.length}件を読み込みました。内容を確認して登録してください。
                    {csvExcludedCount > 0 && <span className="text-amber-600">（消耗品など{csvExcludedCount}件は対象外として除外しました）</span>}
                  </p>
                )}
              </div>
              <button onClick={() => { setShowCsv(false); setCsvStep('upload'); setCsvItems([]); setCsvExcludedCount(0) }}
                className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {csvStep === 'upload' ? (
              <div className="px-6 py-8 space-y-4">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 transition-colors"
                  onClick={() => document.getElementById('csv-file')?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) handleCsvFile(f)
                  }}
                >
                  <FileSpreadsheet size={28} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-600 font-medium">インフォマートからダウンロードしたCSVファイル</p>
                  <p className="text-xs text-gray-400 mt-1">ドラッグ＆ドロップ、またはクリックして選択</p>
                </div>
                <input id="csv-file" type="file" accept=".csv,text/csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f) }} />
                {csvError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{csvError}</p>
                  </div>
                )}
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-700">
                    インフォマートの「受発注履歴」→「CSVダウンロード」から取得できます。<br />
                    取込列：納品日・取引先名・商品名・規格・数量・単位・金額
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">納品日</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">取引先</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">商品名</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">規格</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">数量</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">単位</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">金額</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">仕入先</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">分類</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {csvItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <input type="date" value={item.purchase_date}
                            onChange={e => { const n = [...csvItems]; n[idx] = { ...n[idx], purchase_date: e.target.value }; setCsvItems(n) }}
                            className="border border-gray-200 rounded px-1.5 py-1 text-xs w-32" />
                        </td>
                        <td className="px-3 py-2 text-gray-500">{item.supplier_name}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.ingredient_name}</td>
                        <td className="px-3 py-2 text-gray-400">{item.spec}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min="0" step="0.001" value={item.quantity}
                            onChange={e => {
                              const quantity = parseFloat(e.target.value) || 0
                              const n = [...csvItems]
                              n[idx] = { ...n[idx], quantity, unit_price: quantity > 0 ? n[idx].price / quantity : 0 }
                              setCsvItems(n)
                            }}
                            className="border border-gray-200 rounded px-1.5 py-1 text-xs w-20 text-right" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={item.unit}
                            onChange={e => {
                              const n = [...csvItems]
                              n[idx] = { ...n[idx], unit: e.target.value }
                              setCsvItems(n)
                            }}
                            className="border border-gray-200 rounded px-1.5 py-1 text-xs">
                            {UNITS.includes(item.unit) ? null : <option value={item.unit}>{item.unit}</option>}
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">¥{item.price.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <select
                            value={item.supplier_id}
                            onChange={e => { const n = [...csvItems]; n[idx] = { ...n[idx], supplier_id: e.target.value }; setCsvItems(n) }}
                            className={`border rounded px-1.5 py-1 text-xs ${item.supplier_id ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}
                          >
                            <option value="">{item.supplier_name ? `新規作成: ${item.supplier_name}` : '未設定'}</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.category_name}
                            onChange={e => { const n = [...csvItems]; n[idx] = { ...n[idx], category_name: e.target.value }; setCsvItems(n) }}
                            className={`border rounded px-1.5 py-1 text-xs ${item.ingredient_id ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                          >
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                          {!item.ingredient_id && <p className="text-[10px] text-amber-600 mt-0.5">新規食材</p>}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => setCsvItems(csvItems.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-400"><X size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {csvStep === 'confirm' && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => { setCsvStep('upload'); setCsvItems([]) }}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
                  戻る
                </button>
                <button onClick={handleCsvSave} disabled={saving || csvItems.length === 0}
                  className="flex-1 bg-purple-600 text-white text-sm py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {saving ? '登録中...' : `${csvItems.length}件を仕入履歴に登録`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
