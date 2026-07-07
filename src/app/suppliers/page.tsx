'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Supplier } from '@/types'

const emptyForm = {
  name: '',
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const data = await fetch('/api/suppliers').then(r => r.json())
    setSuppliers(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (s: Supplier) => {
    setEditTarget(s)
    setForm({ name: s.name })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この仕入先を削除しますか？')) return
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    load()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name }
    const url = editTarget ? `/api/suppliers/${editTarget.id}` : '/api/suppliers'
    const method = editTarget ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    setShowForm(false)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">仕入先マスタ</h2>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} /> 仕入先を追加
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">仕入先名</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {suppliers.length === 0 ? (
              <tr><td colSpan={2} className="text-center py-8 text-gray-400">仕入先が登録されていません</td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTarget ? '仕入先を編集' : '仕入先を追加'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">仕入先名 *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
