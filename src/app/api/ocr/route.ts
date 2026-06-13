import { NextRequest, NextResponse } from 'next/server'

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Vision APIキーが設定されていません' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
  }

  // ファイルをBase64に変換
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  // Google Vision API呼び出し
  const visionRes = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }),
  })

  if (!visionRes.ok) {
    const err = await visionRes.text()
    return NextResponse.json({ error: `Vision API エラー: ${err}` }, { status: 502 })
  }

  const visionData = await visionRes.json()
  const rawText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? ''

  if (!rawText) {
    return NextResponse.json({ raw_text: '', items: [] })
  }

  // テキストから品目・数量・単価を解析
  const items = parseInvoiceText(rawText)

  return NextResponse.json({ raw_text: rawText, items })
}

function parseInvoiceText(text: string) {
  const items: Array<{ name: string; quantity: number; unit: string; price: number }> = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // 数量・単位・金額のパターン
  // 例: "鮪　500g　3,250円" or "サーモン 1kg ¥2,800"
  const linePattern = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|cc|ml|個|枚|本|袋|パック|尾|冊)?\s*[×x]?\s*[\¥￥]?([\d,]+)/i

  for (const line of lines) {
    const m = line.match(linePattern)
    if (m) {
      const name = m[1].trim()
      const quantity = parseFloat(m[2])
      const unit = m[3] ?? '個'
      const price = parseInt(m[4].replace(/,/g, ''), 10)

      if (name.length >= 2 && !isNaN(quantity) && !isNaN(price) && price > 0) {
        items.push({ name, quantity, unit, price })
      }
    }
  }

  return items
}
