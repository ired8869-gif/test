import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

interface MyPageProps {
  session: Session
  onBack: () => void
  onAccountDeleted: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function MyPage({ session, onBack, onAccountDeleted }: MyPageProps) {
  const { user } = session
  const isGoogleUser = user.app_metadata.provider === 'google'

  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handlePasswordReset = async () => {
    if (!user.email) return
    setResetStatus('sending')
    setResetError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    })

    if (error) {
      setResetError(error.message)
      setResetStatus('idle')
    } else {
      setResetStatus('sent')
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        // no body
      }

      if (!res.ok) throw new Error(data.error ?? '회원 탈퇴에 실패했습니다.')

      await supabase.auth.signOut()
      onAccountDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '회원 탈퇴에 실패했습니다.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="mypage">
      <button type="button" className="back-link" onClick={onBack}>
        <span className="material-symbols-outlined">arrow_back</span>
        돌아가기
      </button>

      <section className="panel mypage-panel">
        <span className="eyebrow">MY ACCOUNT</span>
        <h2>내 정보</h2>

        <dl className="info-list">
          <div className="info-row">
            <dt>이메일</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="info-row">
            <dt>가입 방법</dt>
            <dd>{isGoogleUser ? '구글' : '이메일'}</dd>
          </div>
          <div className="info-row">
            <dt>가입일</dt>
            <dd>{formatDate(user.created_at)}</dd>
          </div>
        </dl>
      </section>

      {!isGoogleUser && (
        <section className="panel mypage-panel">
          <span className="eyebrow">SECURITY</span>
          <h2>비밀번호 재설정</h2>
          <p className="mypage-desc">가입하신 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>

          <button
            type="button"
            className="analyze"
            disabled={resetStatus === 'sending'}
            onClick={handlePasswordReset}
          >
            {resetStatus === 'sending' ? '전송 중...' : '재설정 링크 받기'}
          </button>

          {resetStatus === 'sent' && (
            <p className="auth-message">{user.email}로 재설정 링크를 보냈습니다.</p>
          )}

          {resetError && (
            <p className="error-message">
              <span className="material-symbols-outlined">error</span>
              {resetError}
            </p>
          )}
        </section>
      )}

      <section className="panel mypage-panel danger-zone">
        <span className="eyebrow">DANGER ZONE</span>
        <h2>회원 탈퇴</h2>
        <p className="mypage-desc">
          탈퇴 시 계정과 저장된 사용자 데이터가 모두 삭제되며 되돌릴 수 없습니다.
        </p>

        {!showDeleteConfirm ? (
          <button type="button" className="danger-button" onClick={() => setShowDeleteConfirm(true)}>
            회원 탈퇴
          </button>
        ) : (
          <div className="confirm-box">
            <p>정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="auth-toggle"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </button>
              <button type="button" className="danger-button" disabled={isDeleting} onClick={handleDeleteAccount}>
                {isDeleting ? '삭제 중...' : '탈퇴 확정'}
              </button>
            </div>
          </div>
        )}

        {deleteError && (
          <p className="error-message">
            <span className="material-symbols-outlined">error</span>
            {deleteError}
          </p>
        )}
      </section>
    </div>
  )
}

export default MyPage
