'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface PDFFile {
  file_id: string
  filename: string
  chunks: number
  uploading?: boolean
  progress?: number
}

interface Source {
  filename: string
  chunk: string
}

interface Message {
  role: 'user' | 'ai'
  text: string
  sources?: Source[]
}

export default function Home() {
  const [pdfs, setPdfs] = useState<PDFFile[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [showSources, setShowSources] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadPdfs() {
      const res = await fetch('/api/pdfs')
      const data = await res.json()
      if (data.files) setPdfs(data.files)
    }
    loadPdfs()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleUpload(uploadFile: File) {
    if (!uploadFile) return
    const tempId = `uploading-${Date.now()}`
    setPdfs(prev => [...prev, {
      file_id: tempId,
      filename: uploadFile.name,
      chunks: 0,
      uploading: true,
      progress: 0
    }])

    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress > 90) progress = 90
      setPdfs(prev => prev.map(p =>
        p.file_id === tempId ? { ...p, progress: Math.round(progress) } : p
      ))
    }, 300)

    const formData = new FormData()
    formData.append('file', uploadFile)

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      const data = await res.json()
      clearInterval(interval)

      if (data.success) {
        setPdfs(prev => prev.map(p =>
          p.file_id === tempId
            ? { file_id: data.file_id, filename: data.filename, chunks: data.stored, uploading: false, progress: 100 }
            : p
        ))
        setTimeout(() => {
          setPdfs(prev => prev.map(p =>
            p.file_id === data.file_id ? { ...p, progress: undefined } : p
          ))
        }, 1000)
        setMessages(prev => [...prev, {
          role: 'ai',
          text: `**${data.filename}** uploaded successfully! ${data.stored} chunks indexed. You can now ask questions about it.`
        }])
      } else {
        setPdfs(prev => prev.filter(p => p.file_id !== tempId))
        alert('Upload failed: ' + data.error)
      }
    } catch (err) {
      clearInterval(interval)
      setPdfs(prev => prev.filter(p => p.file_id !== tempId))
      console.error(err)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(file_id: string, filename: string) {
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id })
      })
      const data = await res.json()
      if (data.success) {
        setPdfs(prev => prev.filter(p => p.file_id !== file_id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleAsk() {
    if (!question.trim() || asking) return
    const userQuestion = question.trim()
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: userQuestion }])
    setAsking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.answer || data.error || 'Something went wrong.',
        sources: data.sources || []
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to get answer.' }])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#212121', fontFamily: "'Söhne', 'ui-sans-serif', 'system-ui', sans-serif",
      color: '#ececec'
    }}>

      {/* Sidebar */}
      <aside style={{
        width: '260px', flexShrink: 0,
        background: '#171717',
        display: 'flex', flexDirection: 'column',
        padding: '8px 0'
      }}>

        {/* New chat style header */}
        <div style={{ padding: '8px 12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#ececec' }}>PDF Chat</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8e8ea0', padding: '4px', borderRadius: '6px',
              fontSize: '18px', display: 'flex', alignItems: 'center',
              transition: 'color 0.15s'
            }}
            title="Upload PDF"
            onMouseEnter={e => (e.currentTarget.style.color = '#ececec')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8e8ea0')}
          >
            ✏️
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f)
            }}
          />
        </div>

        {/* Upload button */}
        <div style={{ padding: '0 12px 8px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const dropped = e.dataTransfer.files[0]
              if (dropped?.type === 'application/pdf') handleUpload(dropped)
            }}
            style={{
              width: '100%', background: dragOver ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px',
              padding: '10px', cursor: 'pointer', color: '#8e8ea0',
              fontSize: '12px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '6px', transition: 'all 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <span>+</span> Upload PDF
          </button>
        </div>

        {/* PDF section label */}
        {pdfs.length > 0 && (
          <div style={{ padding: '8px 16px 4px' }}>
            <span style={{ fontSize: '11px', color: '#8e8ea0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Documents
            </span>
          </div>
        )}

        {/* PDF list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {pdfs.map(pdf => (
            <div
              key={pdf.file_id}
              style={{
                padding: '8px 10px', borderRadius: '8px', marginBottom: '1px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '10px', transition: 'background 0.15s', position: 'relative'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              className="pdf-row"
            >
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ flexShrink: 0 }}>
  <path d="M2 0h8l6 6v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
  <path d="M9 0l6 6H11a2 2 0 01-2-2V0z" fill="rgba(255,255,255,0.15)"/>
  <path d="M4 10h8M4 13h6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
</svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px', color: '#ececec',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {pdf.filename}
                </div>
                {!pdf.uploading && (
                  <div style={{ fontSize: '11px', color: '#8e8ea0', marginTop: '1px' }}>
                    {pdf.chunks} chunks
                  </div>
                )}
                {pdf.uploading && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: '#19c37d',
                        borderRadius: '1px', width: `${pdf.progress || 0}%`,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#19c37d', marginTop: '2px' }}>
                      {pdf.progress || 0}%
                    </div>
                  </div>
                )}
              </div>
              {!pdf.uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(pdf.file_id, pdf.filename) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'transparent', fontSize: '12px', padding: '2px 4px',
                    borderRadius: '4px', transition: 'all 0.15s', flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#ff4444'
                    e.currentTarget.style.background = 'rgba(255,68,68,0.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'transparent'
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Bottom user area */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#19c37d', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '13px', fontWeight: 600,
            color: '#fff', flexShrink: 0
          }}>
            S
          </div>
          <span style={{ fontSize: '13px', color: '#ececec' }}>Shubham Shah</span>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

        {/* Header */}
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <span style={{ fontSize: '14px', color: '#8e8ea0' }}>
            {pdfs.filter(p => !p.uploading).length > 0
              ? `PDF Chat · ${pdfs.filter(p => !p.uploading).length} document${pdfs.filter(p => !p.uploading).length !== 1 ? 's' : ''}`
              : 'PDF Chat'
            }
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {messages.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              padding: '40px'
            }}>
              <svg width="48" height="60" viewBox="0 0 16 20" fill="none" style={{ marginBottom: '16px', opacity: 0.3 }}>
  <path d="M2 0h8l6 6v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
  <path d="M9 0l6 6H11a2 2 0 01-2-2V0z" fill="rgba(255,255,255,0.2)"/>
  <path d="M4 10h8M4 13h6" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round"/>
</svg>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#ececec', marginBottom: '8px' }}>
                What can I help you find?
              </h1>
              <p style={{ fontSize: '14px', color: '#8e8ea0', maxWidth: '400px', lineHeight: '1.6' }}>
                Upload a PDF from the sidebar and ask anything about its contents
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 24px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '24px' }}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        background: '#2f2f2f', color: '#ececec',
                        padding: '12px 18px', borderRadius: '18px 18px 4px 18px',
                        fontSize: '14px', lineHeight: '1.6', maxWidth: '70%'
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: '#19c37d', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '13px', flexShrink: 0, marginTop: '2px'
                      }}>
                        ✦
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#ececec', lineHeight: '1.8' }}>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setShowSources(showSources === i ? null : i)}
                              style={{
                                fontSize: '12px', color: '#8e8ea0',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '4px 12px', borderRadius: '20px',
                                cursor: 'pointer', transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ececec')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#8e8ea0')}
                            >
                              {showSources === i ? '− Hide sources' : `+ ${msg.sources.length} sources`}
                            </button>
                            <button
                              onClick={() => handleCopy(msg.text, i)}
                              style={{
                                fontSize: '12px', color: '#8e8ea0',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '4px 12px', borderRadius: '20px',
                                cursor: 'pointer', transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ececec')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#8e8ea0')}
                            >
                              {copied === i ? '✓ Copied' : '⎘ Copy'}
                            </button>
                          </div>
                        )}
                        {showSources === i && msg.sources && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {msg.sources.map((src, j) => (
                              <div key={j} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px', padding: '10px 14px'
                              }}>
                                <div style={{ fontSize: '11px', color: '#19c37d', marginBottom: '4px', fontWeight: 500 }}>
                                  📄 {src.filename}
                                </div>
                                <div style={{ fontSize: '12px', color: '#8e8ea0', lineHeight: '1.6', fontStyle: 'italic' }}>
                                  {src.chunk}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {asking && (
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: '#19c37d', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '13px', flexShrink: 0
                  }}>✦</div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', paddingTop: '8px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#8e8ea0',
                        animation: `bounce 1.2s infinite ${i * 0.2}s`
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area — exactly like ChatGPT */}
        <div style={{ padding: '16px 24px 24px', background: '#212121' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative' }}>
            <div style={{
              background: '#2f2f2f', borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 16px'
            }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  borderRadius: '8px', width: '32px', height: '32px',
                  cursor: 'pointer', color: '#8e8ea0', fontSize: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ececec')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8e8ea0')}
                title="Upload PDF"
              >
                +
              </button>
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
                placeholder="Ask anything..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: '15px', color: '#ececec', lineHeight: '1.5',
                  fontFamily: 'inherit', resize: 'none', padding: '0'
                }}
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || asking}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: question.trim() && !asking ? '#ececec' : 'rgba(255,255,255,0.15)',
                  border: 'none', cursor: question.trim() && !asking ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                  color: question.trim() && !asking ? '#212121' : '#8e8ea0',
                  fontSize: '16px'
                }}
              >
                ↑
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                PDF Chat can make mistakes. Verify important information.
              </span>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        input::placeholder { color: #8e8ea0 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .pdf-row:hover button { color: #8e8ea0 !important; }
      `}</style>
    </div>
  )
}