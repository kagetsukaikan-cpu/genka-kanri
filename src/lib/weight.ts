// 重量系の単位（kg/g）をグラムに正規化する。メニューの食材使用量はグラム単位が基本のため、
// 仕入や食材マスタ登録時に kg を使わずグラムへ統一する。
export function toGrams(unit: string, quantity: number): number | null {
  if (unit === 'kg') return quantity * 1000
  if (unit === 'g') return quantity
  return null
}

// 商品名に重量表記（例: "国産豚肉500g"「米5kg」）が含まれる場合、1個あたりのグラム数を読み取る。
// 単位列・入数列だけでは重量が分からない商品（個/パック単位だが内容量が商品名にしか書かれていない等）の救済用。
export function extractGramsFromName(name: string): number | null {
  const kgMatch = name.match(/(\d+(?:\.\d+)?)\s*[kKｋＫ][gGｇＧ]/)
  if (kgMatch) return parseFloat(kgMatch[1]) * 1000
  const gMatch = name.match(/(\d+(?:\.\d+)?)\s*[gGｇＧ](?![a-zA-Zａ-ｚＡ-Ｚ])/)
  if (gMatch) return parseFloat(gMatch[1])
  return null
}
