const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// For Windows printing
let print = null
try {
  print = require('pdf-to-printer')
} catch (e) {
  console.log('pdf-to-printer not available, printing disabled')
}

// Keep a global reference of the window object
let mainWindow

// Production URL (change to your deployed URL)
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://workx-dashboard.vercel.app'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    autoHideMenuBar: true,
  })

  // Load the web app
  mainWindow.loadURL(WEBAPP_URL)

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers for printing

// Get available printers
ipcMain.handle('get-printers', async () => {
  try {
    if (print && print.getPrinters) {
      const printers = await print.getPrinters()
      return { success: true, printers }
    }
    // Fallback for systems without pdf-to-printer
    const printers = mainWindow.webContents.getPrintersAsync
      ? await mainWindow.webContents.getPrintersAsync()
      : mainWindow.webContents.getPrinters()
    return { success: true, printers }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Print a document
ipcMain.handle('print-document', async (event, options) => {
  const { documentUrl, printerName, tray, copies = 1 } = options

  try {
    // Extract base64 data if it's a data URL
    let pdfPath = documentUrl

    if (documentUrl.startsWith('data:application/pdf;base64,')) {
      // Save to temp file
      const base64Data = documentUrl.split(',')[1]
      const tempPath = path.join(app.getPath('temp'), `workx-print-${Date.now()}.pdf`)
      fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'))
      pdfPath = tempPath
    }

    if (print && print.print) {
      // Use pdf-to-printer for Windows
      const printOptions = {
        printer: printerName,
        copies: copies,
      }

      // Add tray selection if supported
      if (tray) {
        printOptions.paperSource = tray === 1 ? 'Auto' : tray === 2 ? 'Manual' : 'Auto'
        // Note: Tray names vary by printer. Common options:
        // "Auto", "Manual", "Tray 1", "Tray 2", "Cassette 1", "Cassette 2", etc.
        // You may need to configure this based on your specific printer
      }

      await print.print(pdfPath, printOptions)
      return { success: true }
    } else {
      // Fallback to Electron's built-in printing
      return new Promise((resolve) => {
        mainWindow.webContents.print(
          {
            silent: false,
            printBackground: true,
            deviceName: printerName,
            copies: copies,
          },
          (success, errorType) => {
            if (success) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: errorType })
            }
          }
        )
      })
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Print bundle with multiple jobs to different trays
ipcMain.handle('print-bundle', async (event, printData) => {
  const { printJobs, trayConfig } = printData

  try {
    const results = []

    for (const job of printJobs) {
      if (!job.documentUrl) continue

      // Show progress
      mainWindow.webContents.send('print-progress', {
        job: job.name,
        status: 'printing',
      })

      // Determine printer and tray settings
      // In production, you'd want to let users configure their printer/tray mapping
      const printerName = '' // Default printer
      const tray = job.tray || 1

      // Save PDF to temp file
      let pdfPath
      if (job.documentUrl.startsWith('data:')) {
        const base64Data = job.documentUrl.split(',')[1]
        pdfPath = path.join(app.getPath('temp'), `workx-print-${job.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
        fs.writeFileSync(pdfPath, Buffer.from(base64Data, 'base64'))
      }

      if (!pdfPath) {
        results.push({ job: job.name, success: false, error: 'No PDF data' })
        continue
      }

      // Show dialog to select printer/tray for each job type
      const trayInfo = trayConfig[tray]
      const dialogResult = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: `Printen: ${job.name}`,
        message: `Klaar om te printen naar ${trayInfo?.name || `Lade ${tray}`}`,
        detail: `${job.description}\n\nControleer dat de juiste printer en lade zijn geselecteerd.`,
        buttons: ['Printen', 'Overslaan', 'Annuleren alle'],
      })

      if (dialogResult.response === 2) {
        // Cancel all
        return { success: false, error: 'Geannuleerd door gebruiker' }
      }

      if (dialogResult.response === 1) {
        // Skip this job
        results.push({ job: job.name, success: true, skipped: true })
        continue
      }

      // Print the document
      if (print && print.print) {
        try {
          await print.print(pdfPath)
          results.push({ job: job.name, success: true })
        } catch (err) {
          results.push({ job: job.name, success: false, error: err.message })
        }
      }

      // Clean up temp file
      try {
        fs.unlinkSync(pdfPath)
      } catch (e) {}
    }

    return {
      success: results.every((r) => r.success || r.skipped),
      results,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Show printer selection dialog
ipcMain.handle('select-printer', async () => {
  try {
    const printers = mainWindow.webContents.getPrintersAsync
      ? await mainWindow.webContents.getPrintersAsync()
      : mainWindow.webContents.getPrinters()

    const printerNames = printers.map((p) => p.name)
    const defaultPrinter = printers.find((p) => p.isDefault)?.name || printerNames[0]

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Printer Selecteren',
      message: 'Kies een printer',
      detail: `Beschikbare printers:\n${printerNames.join('\n')}\n\nStandaard: ${defaultPrinter}`,
      buttons: ['OK'],
    })

    return { success: true, printer: defaultPrinter, printers: printerNames }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
