import React, { useState, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle2, Loader } from 'lucide-react'
import { api, getStoredSession, assetUrl } from '../services/api'
import './FileUpload.css'

export function FileUpload({ 
  channelId, 
  onUploadSuccess, 
  canUpload,
  uploadMessage
}) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [errors, setErrors] = useState({})
  const fileInputRef = useRef(null)

  const getFileIcon = (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return '🖼️'
    }
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      return '🎥'
    }
    if (['pdf'].includes(ext)) {
      return '📄'
    }
    if (['zip', 'rar', '7z'].includes(ext)) {
      return '📦'
    }
    return '📎'
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
    setErrors({})
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    const fileId = `file-${index}`
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileId]
      return newProgress
    })
  }

  const uploadFiles = async () => {
    if (files.length === 0) return
    if (!canUpload) {
      setErrors({ upload: uploadMessage || 'Vous n\'avez pas la permission d\'envoyer des fichiers' })
      return
    }

    setUploading(true)
    setErrors({})
    const newErrors = {}
    const session = getStoredSession()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileId = `file-${i}`
      
      try {
        const formData = new FormData()
        formData.append('file', file)

        // Simulated progress tracking
        const xhr = new XMLHttpRequest()
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: percentComplete
            }))
          }
        })

        // Upload file using proper API URL from api.js
        const response = await api.uploadFile(channelId, file)
        
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: 100
        }))
        
        // Call callback after successful upload
        if (onUploadSuccess) {
          onUploadSuccess(response.file)
        }
      } catch (error) {
        newErrors[fileId] = error.message || 'Erreur lors de l\'upload'
      }
    }

    if (Object.keys(newErrors).length === 0) {
      setFiles([])
      setUploadProgress({})
    }
    
    setErrors(newErrors)
    setUploading(false)
  }

  const isUploading = Object.keys(uploadProgress).length > 0 && uploading

  return (
    <div className="file-upload-container">
      <div className="file-upload-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="file-input"
          disabled={uploading}
        />
        
        <button
          className="file-upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={20} />
          <span>Choisir des fichiers</span>
        </button>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h4 className="file-list-title">Fichiers sélectionnés ({files.length})</h4>
          
          {files.map((file, index) => {
            const fileId = `file-${index}`
            const progress = uploadProgress[fileId]
            const error = errors[fileId]
            const isComplete = progress === 100

            return (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="file-icon">{getFileIcon(file)}</span>
                  <div className="file-details">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatFileSize(file.size)}</div>
                  </div>
                </div>

                <div className="file-status">
                  {progress !== undefined && (
                    <div className="file-progress">
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill ${isComplete ? 'complete' : ''}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="progress-text">
                        {isComplete ? '✓ Complété' : `${progress}%`}
                      </span>
                    </div>
                  )}
                  
                  {error && (
                    <div className="file-error">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}
                  
                  {!progress && !error && (
                    <button
                      className="file-remove"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {Object.keys(errors).length === 0 && files.length > 0 && (
            <button
              className="upload-submit-button"
              onClick={uploadFiles}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Upload en cours...</span>
                </>
              ) : (
                <span>Upload ({files.length} fichier{files.length > 1 ? 's' : ''})</span>
              )}
            </button>
          )}
        </div>
      )}

      {errors.upload && (
        <div className="upload-error-message">
          <AlertCircle size={16} />
          <span>{errors.upload}</span>
        </div>
      )}
    </div>
  )
}
              onClick={uploadFiles}
              disabled={uploading || !canUpload}
            >
              {uploading ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Upload en cours...</span>
                </>
              ) : (
                <>
                  <Upload size={18} />
                  <span>Envoyer les fichiers</span>
                </>
              )}
            </button>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="upload-error-summary">
              <AlertCircle size={16} />
              <span>{Object.keys(errors).length} fichier(s) n\'a pu être envoyé(s)</span>
            </div>
          )}
        </div>
      )}

      {errors.upload && (
        <div className="upload-error-banner">
          <AlertCircle size={16} />
          <span>{errors.upload}</span>
        </div>
      )}
    </div>
  )
}
