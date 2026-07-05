interface Env {
  POLAR_ACCESS_TOKEN: string
}

interface PolarCheckoutResponse {
  url?: string
  detail?: unknown
  error?: string
}

const POLAR_API_BASE = 'https://sandbox-api.polar.sh/v1'
const PRODUCT_ID = '480fc0fd-227e-4ea5-8e2d-7f001d563ab7'

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  if (!env.POLAR_ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: '서버에 Polar 액세스 토큰이 설정되어 있지 않습니다.' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  const origin = new URL(request.url).origin
  const successUrl = `${origin}/?checkout_id={CHECKOUT_ID}`
  const customerIp = request.headers.get('CF-Connecting-IP') ?? undefined

  let polarRes: Response
  try {
    polarRes = await fetch(`${POLAR_API_BASE}/checkouts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        products: [PRODUCT_ID],
        success_url: successUrl,
        customer_ip_address: customerIp,
      }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Polar 결제 세션 생성 중 오류가 발생했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  const data = (await polarRes.json()) as PolarCheckoutResponse

  if (!polarRes.ok || !data.url) {
    return new Response(
      JSON.stringify({ error: data.error ?? '결제 세션을 생성하지 못했습니다.' }),
      { status: 502, headers: jsonHeaders },
    )
  }

  return new Response(JSON.stringify({ url: data.url }), { status: 200, headers: jsonHeaders })
}
