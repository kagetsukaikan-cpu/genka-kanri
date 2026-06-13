'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Upload, Trash2, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import type { PurchaseHistory, Supplier, Ingredient, OcrItem, IngredientCategory } from '@/types'

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

function parseInfomartCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"?\[(.+?)\]"?$/, '[$1]').trim())
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  }).filter(row => row['［商品名］'] && row['［商品名］'].trim())
}

type CsvItem = {
  purchase_date: string
  supplier_name: string
  supplier_id: string
  ingredient_name: string
  quantity: number
  unit: string
  unit_price: number
  price: number
  spec: string
}

function rowToCsvItem(row: Record<string, string>): CsvItem {
  const date = (row['［納品日］'] || row['［伝票日付］'] || row['［発注日］'] || '').trim()
  const price = parseFloat((row['［金額］'] || '0').replace(/,/g, '')) || 0
  const unitPrice = parseFloat((row['［単価］'] || '0').replace(/,/g, '')) || 0
  const quantity = parseFloat((row['［数量］'] || '0').replace(/,/g, '')) || 0
  return {
    purchase_date: date,
    supplier_name: (row['［取引先名］'] || '').trim(),
    supplier_id: '',
    ingredient_name: (row['［商品名］'] || '').trim(),
    quantity,
    unit: (row['［単位］'] || '個').trim(),
    unit_price: unitPrice,
    price,
    spec: (row['［規格］'] || '').trim(),
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

  // OCR関連
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrLoadingMsg, setOcrLoadingMsg] = useState('AI読み取り中...')
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([])
  const [ocrRaw, setOcrRaw] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [ocrSupplier, setOcrSupplier] = useState('')
  const [ocrSupplierName, setOcrSupplierName] = useState('')
  const [ocrDate, setOcrDate] = useState(new Date().toISOString().split('T')[0])
  const [ocrStep, setOcrStep] = useState<'upload' | 'confirm'>('upload')
  const [showOcr, setShowOcr] = useState(false)

  // インフォマートCSV関連
  const [showCsv, setShowCsv] = useState(false)
  const [csvStep, setCsvStep] = useState<'upload' | 'confirm'>('upload')
  const [csvItems, setCsvItems] = useState<CsvItem[]>([])
  const [csvError, setCsvError] = useState('')

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

  // OCR処理
  const handleOcrUpload = async () => {
    if (!ocrFile) return
    setOcrLoading(true)
    setOcrError('')

    try {
      const isPdf = ocrFile.type === 'application/pdf' || ocrFile.name.toLowerCase().endsWith('.pdf')
      let combinedRaw = ''
      const allItems: OcrItem[] = []

      if (isPdf) {
        setOcrLoadingMsg('PDFを読み込み中...')
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        const arrayBuffer = await ocrFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const numPages = Math.min(pdf.numPages, 5)

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          setOcrLoadingMsg(`AI読み取り中... (${pageNum}/${numPages}ページ)`)
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise

          const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.95))
          const fd = new FormData()
          fd.append('file', new File([blob], `page-${pageNum}.jpg`, { type: 'image/jpeg' }))
          const res = await fetch('/api/ocr', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.error) { setOcrError(data.error); setOcrStep('confirm'); setOcrLoading(false); return }
          combinedRaw += (data.raw_text ?? '') + '\n'
          allItems.push(...(data.items ?? []))
          if (data.supplier) {
            setOcrSupplierName(data.supplier)
            const matched = suppliers.find(s => s.name.includes(data.supplier) || data.supplier.includes(s.name))
            if (matched) setOcrSupplier(matched.id)
          }
          if (data.date) setOcrDate(data.date)
        }
      } else {
        setOcrLoadingMsg('AI読み取り中...')
        const fd = new FormData()
        fd.append('file', ocrFile)
        const res = await fetch('/api/ocr', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.error) { setOcrError(data.error); setOcrStep('confirm'); setOcrLoading(false); return }
        combinedRaw = data.raw_text ?? ''
        allItems.push(...(data.items ?? []))
        if (data.supplier) {
          setOcrSupplierName(data.supplier)
          const matched = suppliers.find(s => s.name.includes(data.supplier) || data.supplier.includes(s.name))
          if (matched) setOcrSupplier(matched.id)
        }
        if (data.date) setOcrDate(data.date)
      }

      setOcrRaw(combinedRaw.trim())
      setOcrItems(allItems.map(item => ({
        ...item,
        ingredient_id: ingredients.find(i => i.name.includes(item.name) || item.name.includes(i.name))?.id ?? '',
      })))
    } catch (e) {
      setOcrError(`読み取りに失敗しました: ${String(e)}`)
    }

    setOcrStep('confirm')
    setOcrLoading(false)
  }

  function parseInvoiceText(text: string): OcrItem[] {
    const items: OcrItem[] = []
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const skipWords = ['品名', '商品名', '数量', '単位', '単価', '金額', '合計', '小計', '税', '備考', '納品書', '請求書', '御中', '様']
    const unitPattern = /kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース/

    for (const line of lines) {
      if (skipWords.some(w => line.includes(w) && line.length < 15)) continue
      if (!/[぀-ヿ一-鿿]/.test(line)) continue
      if (!/\d/.test(line)) continue

      const p1 = line.match(/^([぀-ヿ一-鿿\w・＆&\s]+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース)?\s/)
      if (p1) {
        const name = p1[1].trim()
        const quantity = parseFloat(p1[2])
        const unit = p1[3] ?? '個'
        const allNums = line.match(/[\d,]+/g) ?? []
        const price = allNums.length > 0 ? parseInt(allNums[allNums.length - 1].replace(/,/g, ''), 10) : 0
        if (name.length >= 2 && !isNaN(quantity) && price >= 100) {
          items.push({ name, quantity, unit, price })
          continue
        }
      }

      const p2 = line.match(/^([぀-ヿ一-鿿\w・＆&\s]+?)\s+[\¥￥]?([\d,]+)円?/)
      if (p2) {
        const name = p2[1].trim()
        const price = parseInt(p2[2].replace(/,/g, ''), 10)
        const unitMatch = line.match(unitPattern)
        const quantityMatch = line.match(/(\d+(?:\.\d+)?)\s*(kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース)/)
        if (name.length >= 2 && price >= 100) {
          items.push({
            name,
            quantity: quantityMatch ? parseFloat(quantityMatch[1]) : 1,
            unit: unitMatch ? unitMatch[0] : '個',
            price,
          })
        }
      }
    }
    return items
  }

  const handleOcrSave = async () => {
    setSaving(true)

    // 1. 仕入先の確認・自動作成
    let supplierId = ocrSupplier
    if (!supplierId && ocrSupplierName) {
      const matched = suppliers.find(s => s.name.includes(ocrSupplierName) || ocrSupplierName.includes(s.name))
      if (matched) {
        supplierId = matched.id
      } else {
        const res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ocrSupplierName }),
        })
        if (res.ok) { const s = await res.json(); supplierId = s.id }
      }
    }

    // 2. 各品目：食材の確認・自動作成→仕入履歴登録→価格更新
    for (const item of ocrItems) {
      // 食材マスタで検索
      let ingredient = ingredients.find(i => i.id === item.ingredient_id)
        ?? ingredients.find(i => i.name === item.name || i.name.includes(item.name) || item.name.includes(i.name))

      if (!ingredient) {
        // カテゴリID取得
        const cat = categories.find(c => c.name === (item.category ?? 'その他')) ?? categories.find(c => c.name === 'その他')
        const res = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            unit: item.unit,
            category_id: cat?.id ?? null,
            supplier_id: supplierId || null,
            purchase_price: item.price,
            purchase_quantity: item.quantity,
          }),
        })
        if (res.ok) ingredient = await res.json()
      }

      const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price

      // 仕入履歴登録
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_date: ocrDate,
          supplier_id: supplierId || null,
          ingredient_id: ingredient?.id ?? null,
          ingredient_name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          unit_price: unitPrice,
          ocr_raw_text: ocrRaw,
        }),
      })

      // 食材マスタの価格を最新に更新
      if (ingredient?.id) {
        await fetch(`/api/ingredients/${ingredient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchase_price: item.price,
            purchase_quantity: item.quantity,
            supplier_id: supplierId || ingredient.supplier_id || null,
          }),
        })
      }
    }

    setSaving(false)
    setShowOcr(false)
    setOcrStep('upload')
    setOcrFile(null)
    setOcrItems([])
    setOcrSupplierName('')
    load()
  }

  // インフォマートCSV処理
  const handleCsvFile = (file: File) => {
    setCsvError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseInfomartCSV(text)
        if (rows.length === 0) {
          setCsvError('インフォマート形式のデータが見つかりませんでした。ファイルを確認してください。')
          return
        }
        const items = rows.map(row => {
          const item = rowToCsvItem(row)
          // 仕入先名で自動マッチング
          const matched = suppliers.find(s =>
            s.name === item.supplier_name ||
            s.name.includes(item.supplier_name) ||
            item.supplier_name.includes(s.name)
          )
          item.supplier_id = matched?.id ?? ''
          return item
        })
        setCsvItems(items)
        setCsvStep('confirm')
      } catch {
        setCsvError('CSVの読み込みに失敗しました。')
      }
    }
    // Shift-JIS対応
    reader.readAsText(file, 'Shift-JIS')
  }

  const handleCsvSave = async () => {
    setSaving(true)
    for (const item of csvItems) {
      const ing = ingredients.find(i =>
        i.name === item.ingredient_name || item.ingredient_name.includes(i.name)
      )
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_date: item.purchase_date,
          supplier_id: item.supplier_id || null,
          ingredient_id: ing?.id ?? null,
          ingredient_name: item.ingredient_name + (item.spec ? ` (${item.spec})` : ''),
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          notes: item.spec || null,
        }),
      })
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">仕入履歴・納品書</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowCsv(true); setCsvStep('upload'); setCsvItems([]); setCsvError('') }}
            className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <FileSpreadsheet size={15} /> インフォマートCSV
          </button>
          <button onClick={() => { setShowOcr(true); setOcrStep('upload') }}
            className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Upload size={15} /> 納品書を読み取る
          </button>
          <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={15} /> 手動入力
          </button>
        </div>
      </div>

      {/* 仕入履歴テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
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
            {purchases.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">仕入履歴がありません</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50">
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

      {/* OCRモーダル */}
      {showOcr && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {ocrStep === 'upload' ? '納品書を読み取る' : '読み取り結果を確認・登録'}
              </h3>
              <button onClick={() => { setShowOcr(false); setOcrStep('upload'); setOcrFile(null); setOcrItems([]) }}
                className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {ocrStep === 'upload' ? (
              <div className="px-6 py-6 space-y-4">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => document.getElementById('ocr-file')?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setOcrFile(f) }}
                >
                  <Upload size={24} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">納品書の写真またはPDFをドラッグ＆ドロップ</p>
                  <p className="text-xs text-gray-400 mt-1">または クリックしてファイルを選択</p>
                  {ocrFile && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-green-600">
                      <CheckCircle size={16} />
                      {ocrFile.name}
                    </div>
                  )}
                </div>
                <input id="ocr-file" type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => setOcrFile(e.target.files?.[0] ?? null)} />
                <button disabled={!ocrFile || ocrLoading} onClick={handleOcrUpload}
                  className="w-full bg-green-600 text-white text-sm py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {ocrLoading ? ocrLoadingMsg : '読み取り開始'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">仕入日</label>
                    <input type="date" value={ocrDate} onChange={e => setOcrDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">仕入先</label>
                    <select value={ocrSupplier} onChange={e => setOcrSupplier(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">未設定</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-600 mb-2">読み取り品目（修正可）</div>
                <div className="space-y-2">
                  {ocrItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                      <input value={item.name} onChange={e => {
                        const next = [...ocrItems]; next[idx] = { ...next[idx], name: e.target.value }; setOcrItems(next)
                      }} className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs" />
                      <input type="number" value={item.quantity} onChange={e => {
                        const next = [...ocrItems]; next[idx] = { ...next[idx], quantity: parseFloat(e.target.value) }; setOcrItems(next)
                      }} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                      <input value={item.unit} onChange={e => {
                        const next = [...ocrItems]; next[idx] = { ...next[idx], unit: e.target.value }; setOcrItems(next)
                      }} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">¥</span>
                        <input type="number" value={item.price} onChange={e => {
                          const next = [...ocrItems]; next[idx] = { ...next[idx], price: parseFloat(e.target.value) }; setOcrItems(next)
                        }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                        <button onClick={() => setOcrItems(ocrItems.filter((_, i) => i !== idx))}
                          className="text-gray-300 hover:text-red-400"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {ocrItems.length === 0 && (
                  <div className="py-4 space-y-3">
                    {ocrError && (
                      <div className="text-center text-xs text-red-500 p-3 bg-red-50 rounded">{ocrError}</div>
                    )}
                    {!ocrError && (
                      <div className="text-center text-sm text-gray-400">品目が自動で読み取れませんでした。</div>
                    )}
                    {ocrRaw && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-500 text-center">OCR読み取りテキストを確認する</summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded text-gray-600 whitespace-pre-wrap break-all max-h-48 overflow-auto">{ocrRaw}</pre>
                      </details>
                    )}
                    {!ocrRaw && !ocrError && (
                      <div className="text-center text-xs text-red-400">テキストが読み取れませんでした。PDFの画質を確認してください。</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {ocrStep === 'confirm' && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setOcrStep('upload')} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">
                  戻る
                </button>
                <button onClick={handleOcrSave} disabled={saving || ocrItems.length === 0}
                  className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '登録中...' : `${ocrItems.length}件を仕入履歴に登録`}
                </button>
              </div>
            )}
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
                  <p className="text-xs text-gray-500 mt-0.5">{csvItems.length}件を読み込みました。内容を確認して登録してください。</p>
                )}
              </div>
              <button onClick={() => { setShowCsv(false); setCsvStep('upload'); setCsvItems([]) }}
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
                      <th className="text-left px-3 py-2 font-medium text-gray-600">仕入先マッチ</th>
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
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-medium">¥{item.price.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <select
                            value={item.supplier_id}
                            onChange={e => { const n = [...csvItems]; n[idx] = { ...n[idx], supplier_id: e.target.value }; setCsvItems(n) }}
                            className={`border rounded px-1.5 py-1 text-xs ${item.supplier_id ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                          >
                            <option value="">未設定</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
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
