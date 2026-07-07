// あいまい検索用：カタカナ→ひらがな、全角→半角、大文字→小文字に正規化
export function normalizeForSearch(s: string): string {
  return s
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/\s+/g, '')
}
