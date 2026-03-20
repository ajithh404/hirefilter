import { useState, useRef } from 'react'

// InputPanel — paste text OR upload files for the JD and resumes.
// When files are uploaded, we store the raw File objects and let the
// parent decide whether to read them as text (paste flow) or send
// them directly to the /analyze-files endpoint (upload flow).
export default function InputPanel({
  id,
  pasteLabel   = 'Paste text',
  uploadLabel  = 'Upload file',
  placeholder  = '',
  value,
  onChange,
  onFilesChange,   // called with File[] when files are added/removed
  multiple = false,
}) {
  const [mode,     setMode]     = useState('paste')
  const [files,    setFiles]    = useState([])   // File objects
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const ACCEPTED = multiple
    ? '.pdf,.docx,.txt,.md'
    : '.pdf,.docx,.txt,.md'

  const handleFiles = (incoming) => {
    const list = Array.from(incoming).slice(0, multiple ? 10 : 1)
    setFiles(list)
    if (onFilesChange) onFilesChange(list)
  }

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    if (onFilesChange) onFilesChange(updated)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="input-panel">
      {/* ── Tab bar ── */}
      <div className="panel-tabs">
        {[
          { key: 'paste',  label: pasteLabel  },
          { key: 'upload', label: uploadLabel },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`panel-tab${mode === tab.key ? ' active' : ''}`}
            onClick={() => setMode(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {/* ── Paste mode ── */}
        {mode === 'paste' && (
          <>
            <textarea
              id={id}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={8}
            />
            {multiple && (
              <div className="paste-note">
                Separate candidates with a line containing <strong>---</strong> (three dashes)
              </div>
            )}
          </>
        )}

        {/* ── Upload mode ── */}
        {mode === 'upload' && (
          <>
            <div
              className={`file-drop${dragging ? ' dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true)  }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                handleFiles(e.dataTransfer.files)
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                multiple={multiple}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <span className="file-drop-icon">📄</span>
              <p>
                <strong>Click to upload</strong> or drag &amp; drop
              </p>
              <p>
                {multiple
                  ? 'PDF, DOCX, or TXT — one file per candidate, up to 10'
                  : 'PDF, DOCX, or TXT — max 10 MB'}
              </p>
            </div>

            {files.length > 0 && (
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span>{f.name}</span>
                    <button
                      className="file-chip-remove"
                      onClick={() => removeFile(i)}
                      title="Remove"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
