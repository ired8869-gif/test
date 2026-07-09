import { createClient } from '@supabase/supabase-js'

interface Env {
  POLAR_ACCESS_TOKEN: string
  VITE_SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
}

interface PolarSubscription {
  status?: string
  product_id?: string
  trial_end?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
}

interface PolarCustomerState {
  active_subscriptions?: PolarSubscription[]
}

const POLAR_API_BASE = 'https://sandbox-api.polar.sh/v1'
const SUBSCRIPTION_PRODUCT_ID = '53d81bbe-b957-4a20-a1a8-be03f18f2085'

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  if (!env.POLAR_ACCESS_TOKEN || !env.VITE_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정이 완료되지 않았습니다.' }), {
      status: 500,
      headers: jsonHeaders,
    })
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

  let polarRes: Response
  try {
    polarRes = await fetch(
      `${POLAR_API_BASE}/customers/external/${encodeURIComponent(userData.user.id)}/state`,
      { headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}` } },
    )
  } catch {
    return new Response(JSON.stringify({ error: '구독 상태 확인 중 오류가 발생했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  if (polarRes.status === 404) {
    return new Response(JSON.stringify({ subscribed: false }), { status: 200, headers: jsonHeaders })
  }

  if (!polarRes.ok) {
    return new Response(JSON.stringify({ error: '구독 상태를 확인하지 못했습니다.' }), {
      status: 502,
      headers: jsonHeaders,
    })
  }

  const state = (await polarRes.json()) as PolarCustomerState
  const subscription = state.active_subscriptions?.find((sub) => sub.product_id === SUBSCRIPTION_PRODUCT_ID)

  if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
    return new Response(JSON.stringify({ subscribed: false }), { status: 200, headers: jsonHeaders })
  }

  return new Response(
    JSON.stringify({
      subscribed: true,
      status: subscription.status,
      trialEnd: subscription.trial_end ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    }),
    { status: 200, headers: jsonHeaders },
  )
}
