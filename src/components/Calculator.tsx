'use client'

import { useState } from 'react'
import { Calculator as CalculatorIcon, X } from 'lucide-react'

const KEYS = [
  ['C', '%', '⌫', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
]

export default function Calculator() {
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('')

  const press = (key: string) => {
    if (key === 'C') {
      setExpr('')
      setResult('')
      return
    }
    if (key === '⌫') {
      setExpr(e => e.slice(0, -1))
      return
    }
    if (key === '=') {
      if (!expr) return
      try {
        const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
        if (!/^[0-9+\-*/.%() ]+$/.test(sanitized)) throw new Error('invalid')
        // eslint-disable-next-line no-new-func
        const value = Function(`"use strict"; return (${sanitized})`)()
        setResult(Number.isFinite(value) ? String(value) : 'エラー')
      } catch {
        setResult('エラー')
      }
      return
    }
    setExpr(e => e + key)
  }

  // 表示中の数値を取得（売価×原価率＝原価、原価÷原価率＝売価の計算に使う）
  const currentValue = () => {
    const n = parseFloat(result || expr)
    return Number.isFinite(n) ? n : null
  }

  const applyCostFromRate = (rate: number) => {
    const v = currentValue()
    if (v == null) return
    setExpr('')
    setResult(String(Math.round(v * rate)))
  }

  const applyPriceFromRate = (rate: number) => {
    const v = currentValue()
    if (v == null || rate === 0) return
    setExpr('')
    setResult(String(Math.round(v / rate)))
  }

  return (
    <div className="fixed bottom-4 right-4 z-30">
      {open && (
        <div className="mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">電卓</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-2 mb-2 text-right">
            <div className="text-xs text-gray-400 truncate h-4">{expr || ' '}</div>
            <div className="text-lg font-semibold text-gray-900 truncate">{result || expr || '0'}</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <button onClick={() => applyCostFromRate(0.3)}
              className="py-1.5 rounded-lg text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100">
              売価→原価(30%)
            </button>
            <button onClick={() => applyCostFromRate(0.35)}
              className="py-1.5 rounded-lg text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100">
              売価→原価(35%)
            </button>
            <button onClick={() => applyPriceFromRate(0.3)}
              className="py-1.5 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">
              原価→売価(30%)
            </button>
            <button onClick={() => applyPriceFromRate(0.35)}
              className="py-1.5 rounded-lg text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">
              原価→売価(35%)
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.flat().map(key => (
              <button
                key={key}
                onClick={() => press(key)}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  key === '=' ? 'col-span-2 bg-blue-600 text-white hover:bg-blue-700' :
                  ['÷', '×', '−', '+', '%'].includes(key) ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' :
                  'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-11 h-11 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
      >
        <CalculatorIcon size={18} />
      </button>
    </div>
  )
}
