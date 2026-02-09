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

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'printer-settings.json')

// Default settings
const defaultSettings = {
  selectedPrinter: '',
  tray1Name: 'Lade 1', // Blanco
  tray2Name: 'Lade 2', // Geel papier met logo
  tray3Name: 'Lade 3', // Wit papier met logo
  tray4Name: 'Lade 4', // Briefpapier met logo
  colorMode: 'color', // 'color' or 'monochrome'
  duplex: false, // double-sided printing
  processtukTray: 4, // Briefpapier met logo
  productiebladenTray: 2, // Geel papier met logo
  bijlagenTray: 1, // Blanco
}

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      return { ...defaultSettings, ...JSON.parse(data) }
    }
  } catch (e) {
    console.error('Error loading settings:', e)
  }
  return defaultSettings
}

// Save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    return true
  } catch (e) {
    console.error('Error saving settings:', e)
    return false
  }
}

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

// IPC Handlers

// Get printer settings
ipcMain.handle('get-printer-settings', async () => {
  return loadSettings()
})

// Save printer settings
ipcMain.handle('save-printer-settings', async (event, settings) => {
  const success = saveSettings(settings)
  return { success }
})

// Get available printers with details
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
  const settings = loadSettings()

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
        printer: printerName || settings.selectedPrinter || undefined,
        copies: copies,
      }

      // Add tray selection based on settings
      if (tray) {
        const trayNames = { 1: settings.tray1Name, 2: settings.tray2Name, 3: settings.tray3Name, 4: settings.tray4Name }
        printOptions.paperSource = trayNames[tray] || settings.tray1Name
      }

      // Add color mode (monochrome = black/white)
      if (settings.colorMode === 'monochrome') {
        printOptions.monochrome = true
      }

      // Add duplex (double-sided) printing
      if (settings.duplex) {
        printOptions.duplex = 'longEdge' // or 'shortEdge' for flip on short edge
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
            deviceName: printerName || settings.selectedPrinter || undefined,
            copies: copies,
            color: settings.colorMode !== 'monochrome',
            duplexMode: settings.duplex ? 'longEdge' : 'simplex',
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
  const settings = loadSettings()

  try {
    const results = []

    for (const job of printJobs) {
      if (!job.documentUrl) continue

      // Show progress
      mainWindow.webContents.send('print-progress', {
        job: job.name,
        status: 'printing',
      })

      // Determine tray based on job type
      const tray = job.tray || 1
      const trayNames = { 1: settings.tray1Name, 2: settings.tray2Name, 3: settings.tray3Name, 4: settings.tray4Name }
      const trayDescriptions = { 1: 'Blanco', 2: 'Geel papier met logo', 3: 'Wit papier met logo', 4: 'Briefpapier met logo' }
      const trayName = trayNames[tray] || settings.tray1Name
      const trayDescription = trayDescriptions[tray] || `Lade ${tray}`

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

      // Show dialog to confirm print
      const dialogResult = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: `Printen: ${job.name}`,
        message: `Klaar om te printen naar ${trayDescription}`,
        detail: `${job.description}\n\nPrinter: ${settings.selectedPrinter || 'Standaard'}\nLade: ${trayName}\n\nControleer dat de juiste printer en lade zijn geselecteerd.`,
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
          const printOptions = {
            printer: settings.selectedPrinter || undefined,
            paperSource: trayName,
          }

          // Add color mode (monochrome = black/white)
          if (settings.colorMode === 'monochrome') {
            printOptions.monochrome = true
          }

          // Add duplex (double-sided) printing
          if (settings.duplex) {
            printOptions.duplex = 'longEdge'
          }

          console.log(`[print] Printing ${job.name} to ${settings.selectedPrinter || 'default'}, tray: ${trayName}`)
          await print.print(pdfPath, printOptions)
          results.push({ job: job.name, success: true })
        } catch (err) {
          console.error(`[print] pdf-to-printer failed for ${job.name}:`, err.message)
          results.push({ job: job.name, success: false, error: err.message })
        }
      } else {
        // Fallback: use Electron's built-in webContents.print with the PDF loaded in a hidden window
        try {
          console.log(`[print] Fallback: printing ${job.name} via Electron print dialog`)
          const printWin = new BrowserWindow({ show: false, width: 800, height: 600 })
          await printWin.loadFile(pdfPath)
          await new Promise((resolve, reject) => {
            printWin.webContents.print(
              {
                silent: false,
                printBackground: true,
                deviceName: settings.selectedPrinter || undefined,
                copies: job.copies || 1,
                color: settings.colorMode !== 'monochrome',
                duplexMode: settings.duplex ? 'longEdge' : 'simplex',
              },
              (success, errorType) => {
                printWin.close()
                if (success) {
                  resolve()
                } else {
                  reject(new Error(errorType || 'Print mislukt'))
                }
              }
            )
          })
          results.push({ job: job.name, success: true })
        } catch (err) {
          console.error(`[print] Electron fallback failed for ${job.name}:`, err.message)
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
