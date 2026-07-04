import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'

function App() {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      </main>

      <footer className="site-footer">
        <span className="label-sm">© 2026 STYLER AI. ALL RIGHTS RESERVED.</span>
      </footer>
    </div>
  )
}

export default App
