interface Env {
  Gemini_API_KEY: string
}

interface ConsultRequestBody {
  image?: string
  mimeType?: string
  height?: string
  weight?: string
  city?: string
}

interface GeminiPart {
  text?: string
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
  error?: { message?: string }
}

const GEMINI_MODEL = 'gemini-2.5-flash'

function buildPrompt(height: string, weight: string, city?: string) {
  return `당신은 전문 퍼스널 스타일리스트입니다. 첨부된 사진과 아래 신체 정보를 참고하여 스타일 컨설팅 보고서를 작성해주세요.

- 키: ${height}cm
- 몸무게: ${weight}kg${city ? `\n- 활동 지역: ${city}` : ''}

보고서에는 다음 항목을 포함해주세요:
1. 체형 분석
2. 어울리는 스타일과 색상
3. 추천 코디 (상의/하의/아우터)
4. 피하면 좋을 스타일${city ? `\n5. ${city}의 최근 날씨와 계절감을 고려한 코디 팁` : ''}
${city ? '6' : '5'}. 마무리 조언

친절한 어투의 한국어로, 구체적이고 실용적으로 작성해주세요.`
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  let body: ConsultRequestBody
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식이 올바르지 않습니다.' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }

  const { image, mimeType, height, weight, city } = body
  if (!image || !mimeType || !height || !weight) {
    return new Response(JSON.stringify({ error: '사진, 키, 몸무게를 모두 입력해주세요.' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }
  if (!mimeType.startsWith('image/')) {
    return new Response(JSON.stringify({ error: '올바른 이미지 파일이 아닙니다.' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }

  if (!env.Gemini_API_KEY) {
    return new Response(
      JSON.stringify({ error: '서버에 Gemini API 키가 설정되어 있지 않습니다.' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  let geminiRes: Response
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.Gemini_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: buildPrompt(height, weight, city) },
                { inline_data: { mime_type: mimeType, data: image } },
              ],
            },
          ],
        }),
      },
    )
  } catch {
    return new Response(JSON.stringify({ error: 'Gemini API 호출 중 오류가 발생했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  const data = (await geminiRes.json()) as GeminiResponse

  if (!geminiRes.ok) {
    return new Response(
      JSON.stringify({ error: data.error?.message ?? 'Gemini API 요청에 실패했습니다.' }),
      { status: 502, headers: jsonHeaders },
    )
  }

  const report = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!report) {
    return new Response(JSON.stringify({ error: '분석 결과를 받아오지 못했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  return new Response(JSON.stringify({ report }), { status: 200, headers: jsonHeaders })
}
