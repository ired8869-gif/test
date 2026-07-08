import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'

interface ResetPasswordFormProps {
  onDone: () => void
}

function ResetPasswordForm({ onDone }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setIsSubmitting(false)
    } else {
      setIsDone(true)
      setIsSubmitting(false)
    }
  }

  if (isDone) {
    return (
      <section className="panel auth-panel">
        <span className="material-symbols-outlined icon">check_circle</span>
        <span className="eyebrow">PASSWORD UPDATED</span>
        <h2>비밀번호가 변경되었습니다</h2>
        <p className="auth-message">새 비밀번호로 다시 로그인할 수 있습니다.</p>
        <button type="button" className="analyze" onClick={onDone}>
          계속하기
        </button>
      </section>
    )
  }

  return (
    <section className="panel auth-panel">
      <span className="material-symbols-outlined icon">lock_reset</span>
      <span className="eyebrow">RESET PASSWORD</span>
      <h2>새 비밀번호 설정</h2>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-password-input">새 비밀번호</label>
          <input
            id="new-password-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="6자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password-input">비밀번호 확인</label>
          <input
            id="confirm-password-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="비밀번호 재입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="analyze" disabled={isSubmitting}>
          {isSubmitting ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>

      {error && (
        <p className="error-message">
          <span className="material-symbols-outlined">error</span>
          {error}
        </p>
      )}
    </section>
  )
}

export default ResetPasswordForm
