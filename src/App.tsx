import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'

function App() {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canAnalyze = photoPreview !== null && height !== '' && weight !== ''

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

  const handleAnalyze = () => {
    if (!canAnalyze) return
    console.log('분석 요청', { height, weight })
  }

  return (
    <section id="stylist">
      <div className="intro">
        <h1>AI 퍼스널 스타일리스트</h1>
        <p>사진과 키, 몸무게를 입력하면 어울리는 스타일을 분석해드려요</p>
      </div>

      <div className="card">
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
              <svg className="icon" role="presentation" aria-hidden="true" viewBox="0 0 24 24">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.379a1 1 0 0 0 .707-.293l1.128-1.128A2 2 0 0 1 11.128 4h1.744a2 2 0 0 1 1.414.586l1.128 1.128A1 1 0 0 0 16.12 6H17.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
                />
                <circle cx="12" cy="12.5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>클릭하거나 파일을 끌어다 놓으세요</span>
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

        <button
          type="button"
          className="analyze"
          disabled={!canAnalyze}
          onClick={handleAnalyze}
        >
          분석하기
        </button>
      </div>
    </section>
  )
}

export default App
