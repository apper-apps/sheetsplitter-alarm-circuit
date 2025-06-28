import * as XLSX from 'xlsx'
import * as XLSXStyle from 'xlsx-js-style'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

class FileProcessingService {
  async validateFile(file) {
    await delay(200)
    
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    
    const validExtensions = ['.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      throw new Error('Please upload a valid Excel file (.xlsx or .xls)')
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('File size must be less than 50MB')
    }
    
    return true
  }

async analyzeWorkbook(file) {
    await delay(300)
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSXStyle.read(data, { 
            type: 'array',
            cellStyles: true,
            cellNF: true,
            cellHTML: false
          })
          
          // Count total tables across all worksheets
          let totalTables = 0
          
          const worksheets = workbook.SheetNames.map((name, index) => {
            const sheet = workbook.Sheets[name]
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
            
            // Count tables in this worksheet
            const sheetTables = sheet['!tables'] ? sheet['!tables'].length : 0
            totalTables += sheetTables
            
            return {
              name,
              index,
              rowCount: range.e.r + 1,
              columnCount: range.e.c + 1,
              hasData: !!sheet['!ref'],
              tableCount: sheetTables
            }
          })
          
          resolve({
            file: {
              Id: Date.now(),
              name: file.name,
              size: file.size,
              uploadTime: new Date().toISOString(),
              status: 'analyzed',
              totalTables
            },
            worksheets,
            workbook
          })
        } catch (error) {
          reject(new Error('Failed to read Excel file. Please ensure it is not corrupted.'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsArrayBuffer(file)
    })
  }

async processWorksheets(workbook, selectedWorksheets, onProgress) {
    await delay(500)
    
    const zip = new JSZip()
    const totalSheets = selectedWorksheets.length
    
    for (let i = 0; i < selectedWorksheets.length; i++) {
      const worksheet = selectedWorksheets[i]
      
      // Create new workbook with single sheet - preserve all formatting and tables
      const newWorkbook = XLSXStyle.utils.book_new()
      const sheet = workbook.Sheets[worksheet.name]
      
      // Deep copy the sheet to preserve all properties including tables
      const newSheet = JSON.parse(JSON.stringify(sheet))
      
      // Preserve Excel tables if they exist
      if (sheet['!tables']) {
        newSheet['!tables'] = JSON.parse(JSON.stringify(sheet['!tables']))
      }
      
      // Preserve other sheet properties
      if (sheet['!autofilter']) newSheet['!autofilter'] = sheet['!autofilter']
      if (sheet['!merges']) newSheet['!merges'] = sheet['!merges']
      if (sheet['!cols']) newSheet['!cols'] = sheet['!cols']
      if (sheet['!rows']) newSheet['!rows'] = sheet['!rows']
      if (sheet['!protect']) newSheet['!protect'] = sheet['!protect']
      if (sheet['!margins']) newSheet['!margins'] = sheet['!margins']
      
      XLSXStyle.utils.book_append_sheet(newWorkbook, newSheet, worksheet.name)
      
      // Preserve workbook-level properties for formatting consistency
      this.preserveWorkbookProperties(workbook, newWorkbook)
      
      // Generate Excel buffer with full styling preservation
      const excelBuffer = XLSXStyle.write(newWorkbook, {
        bookType: 'xlsx',
        type: 'array',
        cellStyles: true,
        cellNF: true
      })
      
      // Add to zip with clean filename
      const fileName = `${worksheet.name.replace(/[\/\\:*?"<>|]/g, '_')}.xlsx`
      zip.file(fileName, excelBuffer)
      
      // Update progress
      const progress = Math.round(((i + 1) / totalSheets) * 100)
      if (onProgress) {
        onProgress(progress)
      }
      
      await delay(100) // Small delay for progress visualization
    }
    
    return zip
  }

  preserveWorkbookProperties(sourceWorkbook, targetWorkbook) {
    // Copy workbook-level properties that affect formatting and functionality
    if (sourceWorkbook.Props) {
      targetWorkbook.Props = JSON.parse(JSON.stringify(sourceWorkbook.Props))
    }
    
    if (sourceWorkbook.Custprops) {
      targetWorkbook.Custprops = JSON.parse(JSON.stringify(sourceWorkbook.Custprops))
    }
    
    // Preserve workbook themes and styles
    if (sourceWorkbook.Themes) {
      targetWorkbook.Themes = sourceWorkbook.Themes
    }
    
    if (sourceWorkbook.SSF) {
      targetWorkbook.SSF = sourceWorkbook.SSF
    }
    
    // Preserve defined names (named ranges)
    if (sourceWorkbook.Workbook && sourceWorkbook.Workbook.Names) {
      if (!targetWorkbook.Workbook) targetWorkbook.Workbook = {}
      targetWorkbook.Workbook.Names = JSON.parse(JSON.stringify(sourceWorkbook.Workbook.Names))
    }
    
    // Preserve workbook views and calculation properties
    if (sourceWorkbook.Workbook && sourceWorkbook.Workbook.Views) {
      if (!targetWorkbook.Workbook) targetWorkbook.Workbook = {}
      targetWorkbook.Workbook.Views = JSON.parse(JSON.stringify(sourceWorkbook.Workbook.Views))
    }
  }

  async generateDownload(zip, originalFileName) {
    await delay(300)
    
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const baseName = originalFileName.replace(/\.[^/.]+$/, '')
    const zipFileName = `${baseName}_split_worksheets.zip`
    
    return {
      blob: zipBlob,
      fileName: zipFileName,
      size: zipBlob.size
    }
  }

  downloadFile(blob, fileName) {
    saveAs(blob, fileName)
  }
}

export default new FileProcessingService()