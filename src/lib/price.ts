import type { Ingredient } from '@/types'

// 歩留率を考慮した実質単価（仕入価格÷内容量 ÷ 歩留率）
export function effectiveUnitPrice(ing: Ingredient): number | null {
  const price = ing.latest_unit_price ?? (
    ing.purchase_price && ing.purchase_quantity ? ing.purchase_price / ing.purchase_quantity : null
  )
  if (!price) return null
  const yieldRate = ing.yield_rate ?? 100
  return yieldRate > 0 ? price / (yieldRate / 100) : price
}

// 内容量・仕入価格を「1単位（重量系はg基準で100g）あたりの単価」に正規化する。
// 食材マスタの基準価格はどの仕入れ方をしても比較しやすいよう、常に1単位/100gの単価で保持する。
export function toReferenceQuantity(unit: string, totalQuantity: number, totalPrice: number): { quantity: number; price: number } | null {
  if (!totalQuantity || totalQuantity <= 0) return null
  const unitPrice = totalPrice / totalQuantity
  const base = unit === 'g' ? 100 : 1
  return { quantity: base, price: unitPrice * base }
}

// 金額表示：小数第2位まで見せつつ、末尾の余分な0は省く（例: 35.00→35、5.83→5.83、0.06→0.06）
function fmtYen(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '')
}

// 表示用：重量系食材（g/kg）は100gあたりの単価に統一、それ以外は単位そのままの単価
export function formatUnitPrice(ing: Ingredient): string {
  const price = effectiveUnitPrice(ing)
  if (!price) return '-'
  if (ing.unit === 'g') return `¥${fmtYen(price * 100)}/100g`
  if (ing.unit === 'kg') return `¥${fmtYen(price / 10)}/100g`
  return `¥${fmtYen(price)}/${ing.unit}`
}
