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

// 表示用：重量系食材（g/kg）は100gあたりの単価に統一、それ以外は単位そのままの単価
export function formatUnitPrice(ing: Ingredient): string {
  const price = effectiveUnitPrice(ing)
  if (!price) return '-'
  if (ing.unit === 'g') return `¥${(price * 100).toFixed(1)}/100g`
  if (ing.unit === 'kg') return `¥${(price / 10).toFixed(1)}/100g`
  return `¥${price.toFixed(2)}/${ing.unit}`
}
