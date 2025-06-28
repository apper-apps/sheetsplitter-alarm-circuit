import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import fileProcessingService from "@/services/api/fileProcessingService";
import ApperIcon from "@/components/ApperIcon";
import FileUploadZone from "@/components/molecules/FileUploadZone";
import WorksheetCard from "@/components/molecules/WorksheetCard";
import ProcessingStatus from "@/components/molecules/ProcessingStatus";
import FileIcon from "@/components/atoms/FileIcon";
import Button from "@/components/atoms/Button";

const FileProcessor = () => {
const [file, setFile] = useState(null)
  const [worksheets, setWorksheets] = useState([])
  const [workbook, setWorkbook] = useState(null)
  const [selectedWorksheets, setSelectedWorksheets] = useState([])
  const [stage, setStage] = useState('idle') // idle, upload, analyze, process, download, complete
  const [progress, setProgress] = useState(0)
  const [currentWorksheet, setCurrentWorksheet] = useState('')
  const [downloadReady, setDownloadReady] = useState(null)
  const [error, setError] = useState(null)
const resetState = () => {
    setFile(null)
    setWorksheets([])
    setWorkbook(null)
    setSelectedWorksheets([])
    setStage('idle')
    setProgress(0)
    setCurrentWorksheet('')
    setDownloadReady(null)
    setError(null)
  }

  const handleFileSelect = async (selectedFile) => {
    try {
      setError(null)
      setStage('upload')
      setProgress(0)

      // Validate file
      await fileProcessingService.validateFile(selectedFile)
      setProgress(50)

      setStage('analyze')
      setProgress(0)

      // Analyze workbook
      const result = await fileProcessingService.analyzeWorkbook(selectedFile)
      
setFile(result.file)
      setWorksheets(result.worksheets)
      setWorkbook(result.workbook)
      setSelectedWorksheets(result.worksheets.map(ws => ws.index))
      setStage('idle')
      setProgress(100)

      toast.success(`Found ${result.worksheets.length} worksheets in your file`)
    } catch (err) {
      setError(err.message)
      setStage('idle')
      toast.error(err.message)
    }
  }

const handleProcessFile = async () => {
    if (!workbook || !worksheets.length || !selectedWorksheets.length) return

    try {
      setError(null)
      setStage('process')
      setProgress(0)

      // Filter selected worksheets
      const selectedWorksheetObjects = worksheets.filter(ws => selectedWorksheets.includes(ws.index))

      // Process worksheets
      const zip = await fileProcessingService.processWorksheets(
        workbook, 
        selectedWorksheetObjects,
(progressValue) => {
          setProgress(progressValue)
          if (progressValue < 100) {
            const currentIndex = Math.floor((progressValue / 100) * selectedWorksheetObjects.length)
            if (selectedWorksheetObjects[currentIndex]) {
              setCurrentWorksheet(selectedWorksheetObjects[currentIndex].name)
            }
          }
        }
      )

      setStage('download')
      setProgress(0)

      // Generate download
      const download = await fileProcessingService.generateDownload(zip, file.name)
      
      setDownloadReady(download)
setStage('complete')
      setProgress(100)

      toast.success(`${selectedWorksheetObjects.length} worksheets processed successfully! Ready for download.`)
    } catch (err) {
      setError(err.message)
      setStage('idle')
      toast.error('Failed to process worksheets')
    }
  }

  const handleDownload = () => {
    if (downloadReady) {
      fileProcessingService.downloadFile(downloadReady.blob, downloadReady.fileName)
      toast.success('Download started!')
    }
  }

  const formatFileSize = (bytes) => {
    const mb = bytes / (1024 * 1024)
    return mb < 1 ? `${(bytes / 1024).toFixed(0)}KB` : `${mb.toFixed(1)}MB`
}

  const handleWorksheetSelection = (worksheetIndex, selected) => {
    setSelectedWorksheets(prev => {
      if (selected) {
        return [...prev, worksheetIndex]
      } else {
        return prev.filter(index => index !== worksheetIndex)
      }
    })
  }

  const handleSelectAll = () => {
    setSelectedWorksheets(worksheets.map(ws => ws.index))
    toast.success('All worksheets selected')
  }

  const handleSelectNone = () => {
    setSelectedWorksheets([])
    toast.info('All worksheets deselected')
  }

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <AnimatePresence mode="wait">
        {stage === 'idle' && !file && (
          <motion.div
            key="upload-zone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FileUploadZone 
              onFileSelect={handleFileSelect}
              disabled={stage !== 'idle'}
            />
          </motion.div>
        )}

        {(stage === 'upload' || stage === 'analyze' || stage === 'process' || stage === 'download') && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProcessingStatus
              stage={stage}
              progress={progress}
              worksheetCount={worksheets.length}
              currentWorksheet={currentWorksheet}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-start space-x-3">
            <ApperIcon name="AlertCircle" size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Error Processing File</h4>
              <p className="text-red-700 mt-1">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-red-700 hover:bg-red-100"
                onClick={resetState}
              >
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* File Info & Worksheets */}
      {file && worksheets.length > 0 && stage !== 'process' && stage !== 'download' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* File Info */}
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <div className="flex items-center space-x-4">
              <FileIcon type="excel" size="lg" animated />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-surface-900 truncate">
                  {file.name}
                </h3>
<div className="flex items-center space-x-4 mt-1 text-sm text-surface-600">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{worksheets.length} worksheets</span>
                  {file.totalTables > 0 && (
                    <>
                      <span>•</span>
                      <span>{file.totalTables} Excel tables</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{selectedWorksheets.length} selected</span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                icon="X"
                onClick={resetState}
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Worksheets List */}
<div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-surface-900">
                Worksheets Found ({worksheets.length})
              </h3>
              
              {stage === 'complete' && downloadReady ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-x-3"
                >
                  <Button
                    variant="success"
                    icon="Download"
                    onClick={handleDownload}
                    className="animate-pulse-success"
                  >
                    Download ZIP ({formatFileSize(downloadReady.size)})
                  </Button>
                  <Button
                    variant="ghost"
                    icon="RotateCcw"
                    onClick={resetState}
                  >
                    Process Another File
                  </Button>
                </motion.div>
              ) : (
                <Button
                  variant="primary"
                  icon="Play"
                  onClick={handleProcessFile}
                  disabled={stage !== 'idle' || selectedWorksheets.length === 0}
                >
                  Split Selected Worksheets ({selectedWorksheets.length})
                </Button>
              )}
            </div>

            {/* Selection Controls */}
            {stage !== 'complete' && (
              <div className="flex items-center justify-between bg-surface-50 rounded-lg p-3">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-surface-600">
                    {selectedWorksheets.length} of {worksheets.length} worksheets selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedWorksheets.length === worksheets.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectNone}
                    disabled={selectedWorksheets.length === 0}
                  >
                    Select None
                  </Button>
                </div>
              </div>
            )}
            
<div className="grid gap-3">
              {worksheets.map((worksheet, index) => (
                <WorksheetCard
                  key={`${worksheet.name}-${index}`}
                  worksheet={worksheet}
                  index={index}
                  selected={selectedWorksheets.includes(worksheet.index)}
                  onSelectionChange={(selected) => handleWorksheetSelection(worksheet.index, selected)}
                  disabled={stage !== 'idle'}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Success State */}
      {stage === 'complete' && downloadReady && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <motion.div
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <ApperIcon name="Check" size={32} className="text-green-600" />
            </motion.div>
          </motion.div>
          
          <h3 className="text-lg font-medium text-green-800 mb-2">
            Processing Complete!
          </h3>
<p className="text-green-700 mb-4">
            Your {selectedWorksheets.length} selected worksheets have been split into separate files with all Excel tables, formatting, and data preserved. Files are packaged in a ZIP archive.
          </p>
          
          <div className="flex justify-center space-x-3">
            <Button
              variant="success"
              icon="Download"
              onClick={handleDownload}
              size="lg"
            >
              Download ZIP ({formatFileSize(downloadReady.size)})
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default FileProcessor