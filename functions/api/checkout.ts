import { createClient } from '@supabase/supabase-js'

interface Env {
  POLAR_ACCESS_TOKEN: string
  VITE_SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
}

interface PolarCheckoutResponse {
  url?: string
  detail?: unknown
  error?: string
}

const POLAR_API_BASE = 'https://sandbox-api.polar.sh/v1'

const PRODUCT_IDS = {
  onetime: '480fc0fd-227e-4ea5-8e2d-7f001d563ab7',
  subscription: '53d81bbe-b957-4a20-a1a8-be03f18f2085',
} as const

type Plan = keyof typeof PRODUCT_IDS

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

  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: '서버에 Supabase 서비스 키가 설정되어 있지 않습니다.' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: '인증 정보가 필요합니다.' }), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: '유효하지 않은 인증 정보입니다.' }), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  let plan: Plan = 'onetime'
  try {
    const body = (await request.json()) as { plan?: string }
    if (body.plan === 'subscription') plan = 'subscription'
  } catch {
    // no body -> default to one-time plan
  }

  const origin = new URL(request.url).origin
  const successUrl = `${origin}/?checkout_id={CHECKOUT_ID}&plan=${plan}`
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
        products: [PRODUCT_IDS[plan]],
        success_url: successUrl,
        customer_ip_address: customerIp,
        external_customer_id: userData.user.id,
        customer_email: userData.user.email,
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
