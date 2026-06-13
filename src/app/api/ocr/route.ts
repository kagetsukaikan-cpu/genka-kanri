import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic APIキーが設定されていません' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = file.type.startsWith('image/') ? file.type : 'image/jpeg'

  const prompt = `この画像は日本の納品書または請求書です。
画像から以下の情報を読み取り、JSON形式のみで返してください。

{
  "supplier": "仕入れ先・取引先・会社名（不明はnull）",
  "date": "納品書の日付（YYYY-MM-DD形式、不明はnull）",
  "items": [
    {
      "name": "品名",
      "quantity": 数量,
      "unit": "単位",
      "price": 金額,
      "category": "分類（魚介類/肉類/野菜・キノコ/米・麺・パン/調味料・油/乳製品・卵/仕込み品/その他 から選ぶ）"
    }
  ]
}

ルール：
- supplierは納品書の発行元（会社名・店舗名・農家名など）
- dateは納品日または発行日（例: 2026-06-13）
- 品目行のみ抽出（ヘッダー・合計・税額行は除外）
- quantityは数字のみ
- unitは単位（個/kg/g/本/尾/枚/袋/パック/束/缶/瓶/箱/ケース など）
- priceは単価または金額（円単位の整数）
- categoryは必ず上記8種類のいずれかを選ぶ
- JSONのみ返す。説明文不要。`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Claude API エラー: ${err}` }, { status: 502 })
  }

  const result = await res.json()
  const text: string = result.content?.[0]?.text ?? ''

  let items: Array<{ name: string; quantity: number; unit: string; price: number; category?: string }> = []
  let supplier: string | null = null
  let date: string | null = null
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      items = parsed.items ?? []
      supplier = parsed.supplier ?? null
      date = parsed.date ?? null
    } else {
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      if (arrayMatch) items = JSON.parse(arrayMatch[0])
    }
  } catch {
    items = []
  }

  return NextResponse.json({ raw_text: text, items, supplier, date })
}
