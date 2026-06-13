import { NextRequest, NextResponse } from 'next/server'

const VISION_IMAGES_URL = 'https://vision.googleapis.com/v1/images:annotate'
const VISION_FILES_URL = 'https://vision.googleapis.com/v1/files:annotate'

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

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  let rawText = ''

  if (isPdf) {
    // PDF用エンドポイント（files:annotate）
    const visionRes = await fetch(`${VISION_FILES_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          inputConfig: {
            content: base64,
            mimeType: 'application/pdf',
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages: [1, 2, 3, 4, 5],
        }],
      }),
    })

    if (!visionRes.ok) {
      const err = await visionRes.text()
      return NextResponse.json({ error: `Vision API エラー: ${err}` }, { status: 502 })
    }

    const visionData = await visionRes.json()
    // PDFのレスポンス構造: responses[0].responses[].fullTextAnnotation.text
    const pageResponses = visionData.responses?.[0]?.responses ?? []
    rawText = pageResponses
      .map((r: { fullTextAnnotation?: { text?: string } }) => r.fullTextAnnotation?.text ?? '')
      .join('\n')
  } else {
    // 画像用エンドポイント（images:annotate）
    const visionRes = await fetch(`${VISION_IMAGES_URL}?key=${apiKey}`, {
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
    rawText = visionData.responses?.[0]?.fullTextAnnotation?.text ?? ''
  }

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

  const skipWords = ['品名', '商品名', '数量', '単位', '単価', '金額', '合計', '小計', '税', '備考', '納品書', '請求書', '御中', '様']
  const unitPattern = /kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース/

  for (const line of lines) {
    // ヘッダー行・日本語のない行・数字のない行はスキップ
    if (skipWords.some(w => line.includes(w) && line.length < 15)) continue
    if (!/[぀-ヿ一-鿿]/.test(line)) continue
    if (!/\d/.test(line)) continue

    // パターン1: 品名 数量 単位 単価 金額（テーブル形式）
    const p1 = line.match(/^([぀-ヿ一-鿿\w・＆&\s]+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース)?\s/)
    if (p1) {
      const name = p1[1].trim()
      const quantity = parseFloat(p1[2])
      const unit = p1[3] ?? '個'
      // 行の最後の数字を金額として取得
      const allNums = line.match(/[\d,]+/g) ?? []
      const price = allNums.length > 0 ? parseInt(allNums[allNums.length - 1].replace(/,/g, ''), 10) : 0

      if (name.length >= 2 && !isNaN(quantity) && price >= 100) {
        items.push({ name, quantity, unit, price })
        continue
      }
    }

    // パターン2: 品名 ¥金額 or 品名 金額円
    const p2 = line.match(/^([぀-ヿ一-鿿\w・＆&\s]+?)\s+[\¥￥]?([\d,]+)円?/)
    if (p2) {
      const name = p2[1].trim()
      const price = parseInt(p2[2].replace(/,/g, ''), 10)
      const unitMatch = line.match(unitPattern)
      const quantityMatch = line.match(/(\d+(?:\.\d+)?)\s*(kg|g|cc|ml|個|枚|本|袋|パック|尾|冊|束|串|缶|瓶|箱|ケース)/)

      if (name.length >= 2 && price >= 100) {
        items.push({
          name,
          quantity: quantityMatch ? parseFloat(quantityMatch[1]) : 1,
          unit: unitMatch ? unitMatch[0] : '個',
          price,
        })
      }
    }
  }

  return items
}
