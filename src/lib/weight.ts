// 重量系の単位（kg/g）をグラムに正規化する。メニューの食材使用量はグラム単位が基本のため、
// 仕入や食材マスタ登録時に kg を使わずグラムへ統一する。
export function toGrams(unit: string, quantity: number): number | null {
  if (unit === 'kg') return quantity * 1000
  if (unit === 'g') return quantity
  return null
}

// 商品名に重量表記（例: "国産豚肉500g"「米5kg」「南高梅 大粒800ｇ」「○○ １ｋｇ」）が含まれる場合、
// 1個あたりのグラム数を読み取る。単位列・入数列だけでは重量が分からない商品
// （個/パック/PC単位だが内容量が商品名にしか書かれていない等）の救済用。
// 全角数字・全角英字（１ｋｇ／８００ｇ）も半角へ正規化してから判定する。
export function extractGramsFromName(name: string): number | null {
  // 全角の英数字を半角へ（１→1, ｋ→k, ｇ→g, Ｇ→G など）＋全角ピリオドを半角へ
  const s = name
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/．/g, '.')
  // 「kg」表記を優先（例: 5kg, 1.5kg, １ｋｇ）
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/i)
  if (kgMatch) return parseFloat(kgMatch[1]) * 1000
  // 「g」表記（後ろに英字が続くもの＝gram等は除外）。例: 500g, 800ｇ, 25g20個 → 25
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g(?![a-z])/i)
  if (gMatch) return parseFloat(gMatch[1])
  return null
}
