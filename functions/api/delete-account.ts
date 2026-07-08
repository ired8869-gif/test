import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
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

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: '유효하지 않은 인증 정보입니다.' }), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
  if (deleteError) {
    return new Response(JSON.stringify({ error: '회원 탈퇴 처리 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders })
}
