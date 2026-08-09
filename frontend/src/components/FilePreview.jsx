import React, { useState } from 'react'
import { X, Download, Eye } from 'lucide-react'
import './FilePreview.css'

export function FilePreview({ file, onClose }) {
  const [autoPlay, setAutoPlay] = useState(false)

  const isImage = file.mimeType?.startsWith('image/')
  const isVideo = file.mimeType?.startsWith('video/')
  const isPDF = file.mimeType === 'application/pdf'

  if (!isImage && !isVideo && !isPDF) {
    return null
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = `http://localhost:8000${file.url}`
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="file-preview-modal" onClick={onClose}>
      <div className="file-preview-content" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <div className="file-preview-info">
            <span className="file-preview-name">{file.name}</span>
            <span className="file-preview-size">{file.size}</span>
          </div>
          <div className="file-preview-actions">
            <button
              className="preview-action-button"
              onClick={handleDownload}
              title="Télécharger"
            >
              <Download size={18} />
            </button>
            <button
              className="preview-action-button"
              onClick={onClose}
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="file-preview-body">
          {isImage && (
            <img
              src={`http://localhost:8000${file.url}`}
              alt={file.name}
              className="preview-image"
            />
          )}

          {isVideo && (
            <video
              src={`http://localhost:8000${file.url}`}
              controls
              autoPlay={autoPlay}
              className="preview-video"
            />
          )}

          {isPDF && (
            <iframe
              src={`http://localhost:8000${file.url}`}
              className="preview-pdf"
              title={file.name}
            />
          )}
        </div>

        <div className="file-preview-footer">
          <div className="file-meta">
            <span>Uploadé par: {file.uploadedBy}</span>
            <span className="file-date">
              {new Date(file.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FileListItem({ file, onPreview }) {
  const isImage = file.mimeType?.startsWith('image/')
  const isVideo = file.mimeType?.startsWith('video/')

  const getFileIcon = (mimeType, type) => {
    if (isImage) return '🖼️'
    if (isVideo) return '🎥'
    if (mimeType === 'application/pdf') return '📄'
    if (type === 'ZIP') return '📦'
    return '📎'
  }

  return (
    <div className="file-list-item">
      <div className="file-item-icon">
        {getFileIcon(file.mimeType, file.type)}
      </div>

      <div className="file-item-details">
        <div className="file-item-name">{file.name}</div>
        <div className="file-item-meta">
          <span>{file.size}</span>
          <span className="meta-separator">•</span>
          <span>{file.uploadedBy}</span>
          <span className="meta-separator">•</span>
          <span>
            {new Date(file.createdAt).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div className="file-item-actions">
        {(isImage || isVideo) && (
          <button
            className="file-action-button"
            onClick={() => onPreview(file)}
            title="Aperçu"
          >
            <Eye size={16} />
          </button>
        )}
        <a
          href={`http://localhost:8000${file.url}`}
          download={file.name}
          className="file-action-button"
          title="Télécharger"
        >
          <Download size={16} />
        </a>
      </div>
    </div>
  )
}
