import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'

type Mode = 'login' | 'signup'

function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('가입을 완료하려면 이메일로 전송된 인증 링크를 확인해주세요.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="panel auth-panel">
      <span className="material-symbols-outlined icon">
        {mode === 'login' ? 'lock_open' : 'person_add'}
      </span>
      <span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</span>
      <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email-input">이메일</label>
          <input
            id="email-input"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password-input">비밀번호</label>
          <input
            id="password-input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            placeholder="6자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="analyze" disabled={isSubmitting}>
          {isSubmitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>

      {error && (
        <p className="error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </p>
      )}

      {message && <p className="auth-message">{message}</p>}

      <button type="button" className="auth-toggle" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </section>
  )
}

export default AuthForm
