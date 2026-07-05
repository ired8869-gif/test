import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'

const UNLOCK_KEY = 'styler-ai:unlocked'

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

function App() {
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
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get('checkout_id')
    if (!checkoutId) return

    window.history.replaceState({}, '', window.location.pathname)
    setIsVerifying(true)
    verifyCheckout(checkoutId)
      .then((success) => {
        if (success) {
          localStorage.setItem(UNLOCK_KEY, 'true')
          setIsUnlocked(true)
        } else {
          setPurchaseError('결제 확인에 실패했습니다. 다시 시도해주세요.')
        }
      })
      .finally(() => setIsVerifying(false))
  }, [])

  const handlePurchase = async () => {
    setIsPurchasing(true)
    setPurchaseError(null)

    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
      const data: { url?: string; error?: string } = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? '결제 페이지를 여는 데 실패했습니다.')
      window.location.href = data.url
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : '결제 페이지를 여는 데 실패했습니다.')
      setIsPurchasing(false)
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
      </header>

      <main className="content">
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

        {isVerifying ? (
          <section className="panel purchase-panel">
            <span className="material-symbols-outlined icon">hourglass_top</span>
            <span className="eyebrow">결제 확인 중...</span>
          </section>
        ) : !isUnlocked ? (
          <section className="panel purchase-panel">
            <span className="material-symbols-outlined icon">lock</span>
            <span className="eyebrow">PREMIUM STYLE CONSULTING</span>
            <h2>이용권을 구매하고 시작하세요</h2>
            <p className="purchase-desc">
              결제 후 사진과 신체 정보를 기반으로 한 맞춤 스타일 컨설팅 리포트를 받아보실 수
              있습니다.
            </p>
            <button type="button" className="analyze" disabled={isPurchasing} onClick={handlePurchase}>
              {isPurchasing ? '결제 페이지로 이동 중...' : '구매하고 시작하기'}
            </button>

            {purchaseError && (
              <p className="error-message">
                <span className="material-symbols-outlined">error</span>
                {purchaseError}
              </p>
            )}
          </section>
        ) : (
          <>
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
      </main>

      <footer className="site-footer">
        <span className="label-sm">© 2026 STYLER AI. ALL RIGHTS RESERVED.</span>
      </footer>
    </div>
  )
}

export default App
