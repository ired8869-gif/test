interface Env {
  POLAR_ACCESS_TOKEN: string
}

interface PolarCheckoutStatusResponse {
  status?: string
  error?: string
}

const POLAR_API_BASE = 'https://sandbox-api.polar.sh/v1'

export const onRequestGet = async ({
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

  const checkoutId = new URL(request.url).searchParams.get('checkout_id')
  if (!checkoutId) {
    return new Response(JSON.stringify({ error: 'checkout_id가 필요합니다.' }), {
      status: 400,
      headers: jsonHeaders,
    })
  }

  let polarRes: Response
  try {
    polarRes = await fetch(`${POLAR_API_BASE}/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` },
    })
  } catch {
    return new Response(JSON.stringify({ error: '결제 상태 확인 중 오류가 발생했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  const data = (await polarRes.json()) as PolarCheckoutStatusResponse

  if (!polarRes.ok || !data.status) {
    return new Response(
      JSON.stringify({ error: data.error ?? '결제 상태를 확인하지 못했습니다.' }),
      { status: 502, headers: jsonHeaders },
    )
  }

  return new Response(JSON.stringify({ status: data.status }), {
    status: 200,
    headers: jsonHeaders,
  })
}
