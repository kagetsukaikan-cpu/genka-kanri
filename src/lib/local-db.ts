/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readTable(table: string): any[] {
  ensureDir()
  const file = path.join(DATA_DIR, `${table}.json`)
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

function writeTable(table: string, data: any[]) {
  ensureDir()
  fs.writeFileSync(path.join(DATA_DIR, `${table}.json`), JSON.stringify(data, null, 2), 'utf-8')
}

// ingredient_latest_price ビュー
function latestPriceView(): any[] {
  const purchases = readTable('purchase_history')
  const byIngredient = new Map<string, any>()
  const sorted = [...purchases].sort((a, b) =>
    (b.purchase_date + b.created_at) > (a.purchase_date + a.created_at) ? 1 : -1
  )
  for (const p of sorted) {
    if (p.ingredient_id && p.unit_price != null && !byIngredient.has(p.ingredient_id)) {
      byIngredient.set(p.ingredient_id, {
        ingredient_id: p.ingredient_id,
        unit_price: p.unit_price,
        price: p.price,
        quantity: p.quantity,
        purchase_date: p.purchase_date,
      })
    }
  }
  return Array.from(byIngredient.values())
}

const VIEWS: Record<string, () => any[]> = {
  ingredient_latest_price: latestPriceView,
}

// Awaitable query chain
class Chain {
  private rows: any[]
  private _filters: Array<(row: any) => boolean> = []
  private _orderCol: string | null = null
  private _orderAsc = true
  private _limitN: number | null = null
  private _isSingle = false
  private _isHead = false
  private _count: number | null = null
  private _table: string
  private _isView: boolean
  private _pendingInsert: any[] | null = null
  private _pendingUpdate: any | null = null
  private _pendingDelete = false

  constructor(table: string) {
    this._table = table
    this._isView = !!VIEWS[table]
    this.rows = []
  }

  // -- SELECT path --
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this._isHead = true
    return this
  }

  eq(col: string, val: any) { this._filters.push(r => r[col] === val); return this }
  gte(col: string, val: any) { this._filters.push(r => String(r[col] ?? '') >= String(val)); return this }
  lte(col: string, val: any) { this._filters.push(r => String(r[col] ?? '') <= String(val)); return this }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col
    this._orderAsc = opts?.ascending !== false
    return this
  }

  limit(n: number) { this._limitN = n; return this }
  single() { this._isSingle = true; return this }

  // -- WRITE paths --
  insert(payload: any) {
    this._pendingInsert = Array.isArray(payload) ? payload : [payload]
    return this
  }

  update(updates: any) { this._pendingUpdate = updates; return this }
  delete() { this._pendingDelete = true; return this }

  then(resolve: (r: { data: any; error: any; count?: number | null }) => void) {
    // INSERT
    if (this._pendingInsert) {
      const all = readTable(this._table)
      const now = new Date().toISOString()
      const inserted = this._pendingInsert.map(item => ({ id: randomUUID(), created_at: now, updated_at: now, ...item }))
      writeTable(this._table, [...all, ...inserted])
      return resolve({ data: this._isSingle ? (inserted[0] ?? null) : inserted, error: null })
    }

    // UPDATE
    if (this._pendingUpdate) {
      const all = readTable(this._table)
      let updated: any = null
      const next = all.map(row => {
        if (this._filters.every(f => f(row))) {
          const u = { ...row, ...this._pendingUpdate, updated_at: new Date().toISOString() }
          updated = u
          return u
        }
        return row
      })
      writeTable(this._table, next)
      return resolve({ data: updated, error: null })
    }

    // DELETE
    if (this._pendingDelete) {
      const all = readTable(this._table)
      writeTable(this._table, all.filter(row => !this._filters.every(f => f(row))))
      return resolve({ data: null, error: null })
    }

    // SELECT (view or table)
    let rows = this._isView ? VIEWS[this._table]() : readTable(this._table)
    rows = rows.filter(row => this._filters.every(f => f(row)))

    if (this._orderCol) {
      const col = this._orderCol
      const asc = this._orderAsc
      rows = rows.sort((a: any, b: any) => {
        const va = String(a[col] ?? '')
        const vb = String(b[col] ?? '')
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      })
    }

    this._count = rows.length
    if (this._limitN) rows = rows.slice(0, this._limitN)

    if (this._isHead) return resolve({ data: null, error: null, count: this._count })

    if (this._isSingle) {
      const row = rows[0] ?? null
      if (!row) return resolve({ data: null, error: { message: 'Row not found' } })
      return resolve({ data: row, error: null })
    }

    resolve({ data: rows, error: null, count: this._count })
  }
}

export const localDb = {
  from(table: string): Chain {
    return new Chain(table)
  },
}
