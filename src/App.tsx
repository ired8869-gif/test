import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthForm from './AuthForm'
import MyPage from './MyPage'
import ResetPasswordForm from './ResetPasswordForm'
import './App.css'

const UNLOCK_KEY = 'styler-ai:unlocked'

type Plan = 'onetime' | 'subscription'

interface SubscriptionInfo {
  status: 'active' | 'trialing'
  trialEnd: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function verifyCheckout(checkoutId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const res = await fetch(`/api/checkout-status?checkout_id=${encodeURIComponent(checkoutId)}`)
      const data: { status?: string } = await res.json()
      if (res.ok) {
        if (data.status === 'succeeded' || data.status === 'confirmed') return true
        if (data.status === 'failed' || data.status === 'expired') return false
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
  return false
}

async function fetchSubscriptionStatus(accessToken: string): Promise<SubscriptionInfo | null> {
  try {
    const res = await fetch('/api/subscription-status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data: {
      subscribed?: boolean
      status?: 'active' | 'trialing'
      trialEnd?: string | null
      currentPeriodEnd?: string | null
      cancelAtPeriodEnd?: boolean
    } = await res.json()

    if (!res.ok || !data.subscribed || !data.status) return null

    return {
      status: data.status,
      trialEnd: data.trialEnd ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    }
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [view, setView] = useState<'main' | 'mypage'>('main')
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUnlocked, setIsUnlocked] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(UNLOCK_KEY) === 'true',
  )
  const [isVerifying, setIsVerifying] = useState(false)
  const [purchasingPlan, setPurchasingPlan] = useState<Plan | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false)
  const hasAccess = isUnlocked || subscriptionInfo !== null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoadingSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setView('main')
      if (event === 'PASSWORD_RECOVERY') {
        window.history.replaceState({}, '', window.location.pathname)
        setIsPasswordRecovery(true)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setSubscriptionInfo(null)
      return
    }

    setIsCheckingSubscription(true)
    fetchSubscriptionStatus(session.access_token)
      .then(setSubscriptionInfo)
      .finally(() => setIsCheckingSubscription(false))
  }, [session])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(UNLOCK_KEY)
    setIsUnlocked(false)
    setView('main')
  }

  const handleAccountDeleted = () => {
    localStorage.removeItem(UNLOCK_KEY)
    setIsUnlocked(false)
    setView('main')
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkoutId = params.get('checkout_id')
    if (!checkoutId) return
    const plan: Plan = params.get('plan') === 'subscription' ? 'subscription' : 'onetime'

    window.history.replaceState({}, '', window.location.pathname)
    setIsVerifying(true)
    verifyCheckout(checkoutId)
      .then(async (success) => {
        if (!success) {
          setPurchaseError('결제 확인에 실패했습니다. 다시 시도해주세요.')
          return
        }

        if (plan === 'onetime') {
          localStorage.setItem(UNLOCK_KEY, 'true')
          setIsUnlocked(true)
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data.session) setSubscriptionInfo(await fetchSubscriptionStatus(data.session.access_token))
      })
      .finally(() => setIsVerifying(false))
  }, [])

  const handlePurchase = async (plan: Plan) => {
    if (!session) return

    setPurchasingPlan(plan)
    setPurchaseError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      })
      const data: { url?: string; error?: string } = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? '결제 페이지를 여는 데 실패했습니다.')
      window.location.href = data.url
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : '결제 페이지를 여는 데 실패했습니다.')
      setPurchasingPlan(null)
    }
  }

  const canAnalyze = photoPreview !== null && height !== '' && weight !== '' && !isAnalyzing

  const loadPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadPhoto(file)
  }

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadPhoto(file)
  }

  const handleAnalyze = async () => {
    if (!canAnalyze || !photoPreview) return

    const [meta, base64] = photoPreview.split(',')
    const mimeType = meta.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg'

    setIsAnalyzing(true)
    setError(null)
    setReport(null)

    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType, height, weight }),
      })

      let data: { report?: string; error?: string } = {}
      try {
        data = await res.json()
      } catch {
        throw new Error('서버 응답을 처리하지 못했습니다.')
      }

      if (!res.ok) throw new Error(data.error ?? '분석에 실패했습니다.')
      setReport(data.report ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석에 실패했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="page">
      <header className="site-header">
        <span className="brand">STYLER AI</span>
        {session && (
          <div className="user-bar">
            <span className="label-sm">{session.user.email}</span>
            <button type="button" className="my-page-link" onClick={() => setView('mypage')}>
              마이페이지
            </button>
            <button type="button" className="sign-out" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {isPasswordRecovery ? (
          <ResetPasswordForm onDone={() => setIsPasswordRecovery(false)} />
        ) : session && view === 'mypage' ? (
          <MyPage session={session} onBack={() => setView('main')} onAccountDeleted={handleAccountDeleted} />
        ) : (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">AI STYLE CONSULTING</span>
                <h1>AI 퍼스널 스타일리스트</h1>
              </div>
              <p className="hero-desc">
                사진 한 장과 키, 몸무게만 입력하면 AI가 당신의 체형과 분위기를 분석해 어울리는 스타일을
                큐레이션합니다.
              </p>
            </section>

            {isLoadingSession ? null : !session ? (
              <AuthForm />
            ) : isVerifying || (isCheckingSubscription && !hasAccess) ? (
              <section className="panel purchase-panel">
                <span className="material-symbols-outlined icon">hourglass_top</span>
                <span className="eyebrow">{isVerifying ? '결제 확인 중...' : '확인 중...'}</span>
              </section>
            ) : !hasAccess ? (
              <section className="panel purchase-panel">
                <span className="material-symbols-outlined icon">lock</span>
                <span className="eyebrow">PREMIUM STYLE CONSULTING</span>
                <h2>이용권을 구매하고 시작하세요</h2>
                <p className="purchase-desc">
                  결제 후 사진과 신체 정보를 기반으로 한 맞춤 스타일 컨설팅 리포트를 받아보실 수
                  있습니다.
                </p>

                <div className="plan-grid">
                  <div className="plan-card">
                    <span className="plan-name">1회 이용권</span>
                    <p className="plan-detail">한 번 결제하면 계속 이용할 수 있어요.</p>
                    <button
                      type="button"
                      className="analyze"
                      disabled={purchasingPlan !== null}
                      onClick={() => handlePurchase('onetime')}
                    >
                      {purchasingPlan === 'onetime' ? '이동 중...' : '구매하고 시작하기'}
                    </button>
                  </div>

                  <div className="plan-card featured">
                    <span className="plan-badge">7일 무료 체험</span>
                    <span className="plan-name">월 구독</span>
                    <p className="plan-detail">
                      7일간 무료로 체험하고, 이후 매달 자동 결제됩니다. 체험 중 해지하면 요금이
                      청구되지 않아요.
                    </p>
                    <button
                      type="button"
                      className="analyze"
                      disabled={purchasingPlan !== null}
                      onClick={() => handlePurchase('subscription')}
                    >
                      {purchasingPlan === 'subscription' ? '이동 중...' : '무료로 체험 시작하기'}
                    </button>
                  </div>
                </div>

                {purchaseError && (
                  <p className="error-message">
                    <span className="material-symbols-outlined">error</span>
                    {purchaseError}
                  </p>
                )}
              </section>
            ) : (
              <>
                {subscriptionInfo?.status === 'trialing' && subscriptionInfo.trialEnd && (
                  <div className="trial-banner">
                    <span className="material-symbols-outlined">redeem</span>
                    무료 체험 중 · {formatDate(subscriptionInfo.trialEnd)}부터 정기 결제가 시작됩니다.
                  </div>
                )}

                <section className="panel">
                  <label
                    className={`photo-upload${isDragging ? ' dragging' : ''}`}
                    htmlFor="photo-input"
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="업로드한 사진 미리보기" className="preview" />
                    ) : (
                      <div className="placeholder">
                        <span className="material-symbols-outlined icon">add_a_photo</span>
                        <span className="eyebrow">클릭하거나 파일을 끌어다 놓으세요</span>
                      </div>
                    )}
                    <input
                      id="photo-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      hidden
                    />
                  </label>

                  <div className="fields">
                    <div className="field">
                      <label htmlFor="height-input">키 (cm)</label>
                      <input
                        id="height-input"
                        type="number"
                        inputMode="decimal"
                        min={100}
                        max={250}
                        placeholder="예: 170"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="weight-input">몸무게 (kg)</label>
                      <input
                        id="weight-input"
                        type="number"
                        inputMode="decimal"
                        min={30}
                        max={200}
                        placeholder="예: 60"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="button" className="analyze" disabled={!canAnalyze} onClick={handleAnalyze}>
                    {isAnalyzing ? '분석 중...' : '분석하기'}
                  </button>

                  {error && (
                    <p className="error-message">
                      <span className="material-symbols-outlined">error</span>
                      {error}
                    </p>
                  )}
                </section>

                {report && (
                  <section className="report">
                    <span className="material-symbols-outlined quote-icon">format_quote</span>
                    <span className="eyebrow">STYLE CONSULTING REPORT</span>
                    <h2>당신을 위한 스타일 제안</h2>
                    <p>{report}</p>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <span className="label-sm">© 2026 STYLER AI. ALL RIGHTS RESERVED.</span>
      </footer>
    </div>
  )
}

export default App
