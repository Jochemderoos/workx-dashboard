const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const util = require('util')
const execFileAsync = util.promisify(execFile)

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
  tray1Name: 'Tray 1',  // Blanco — will be auto-detected
  tray2Name: 'Tray 2',  // Geel papier met logo
  tray3Name: 'Tray 3',  // Wit papier met logo
  tray4Name: 'Tray 4',  // Briefpapier met logo
  colorMode: 'color',    // 'color' or 'monochrome'
  duplex: false,         // double-sided printing
  processtukTray: 3,     // Wit papier met logo
  productiebladenTray: 2, // Geel papier met logo
  bijlagenTray: 1,       // Blanco
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

// Get available paper bins/trays for a printer via PowerShell + System.Drawing
ipcMain.handle('get-printer-bins', async (event, printerName) => {
  try {
    // Use System.Drawing to get paper sources — returns SourceName (used by SumatraPDF bin=)
    // and Kind (numeric ID for debugging)
    const psScript = `
      Add-Type -AssemblyName System.Drawing
      $ps = New-Object System.Drawing.Printing.PrinterSettings
      $ps.PrinterName = '${printerName.replace(/'/g, "''")}'
      if ($ps.IsValid) {
        $ps.PaperSources | ForEach-Object {
          "$($_.SourceName)|$($_.Kind)"
        }
      } else {
        Write-Error "Printer '${printerName.replace(/'/g, "''")}' not found"
      }
    `
    const { stdout } = await execFileAsync('Powershell.exe', ['-Command', psScript])
    const lines = stdout.trim().split(/\r?\n/).filter(b => b.trim())
    const bins = []
    const binsDetailed = []
    for (const line of lines) {
      const [name, kind] = line.split('|')
      if (name) {
        bins.push(name.trim())
        binsDetailed.push({ name: name.trim(), kind: kind ? kind.trim() : 'unknown' })
      }
    }
    console.log(`[print] Available bins for "${printerName}":`, JSON.stringify(binsDetailed))
    return { success: true, bins, binsDetailed }
  } catch (error) {
    console.error('[print] Failed to get printer bins:', error.message)
    return { success: false, error: error.message, bins: [] }
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
      // Use pdf-to-printer for Windows (SumatraPDF)
      const printOptions = {
        printer: printerName || settings.selectedPrinter || undefined,
        copies: copies,
      }

      // Add tray/bin selection (pdf-to-printer uses "bin", NOT "paperSource")
      if (tray) {
        const trayNames = { 1: settings.tray1Name, 2: settings.tray2Name, 3: settings.tray3Name, 4: settings.tray4Name }
        printOptions.bin = trayNames[tray] || settings.tray1Name
      }

      // Add color mode (pdf-to-printer passes "monochrome" to SumatraPDF)
      if (settings.colorMode === 'monochrome') {
        printOptions.monochrome = true
      }

      // Add duplex (pdf-to-printer uses "side", NOT "duplex")
      if (settings.duplex) {
        printOptions.side = 'duplexlong'
      }

      console.log(`[print] Options:`, JSON.stringify(printOptions, null, 2))
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
  const { printJobs } = printData
  const settings = loadSettings()

  const trayNames = { 1: settings.tray1Name, 2: settings.tray2Name, 3: settings.tray3Name, 4: settings.tray4Name }
  const trayDescriptions = { 1: 'Blanco', 2: 'Geel papier met logo', 3: 'Wit papier met logo', 4: 'Briefpapier met logo' }

  console.log(`[print-bundle] Starting bundle print with ${printJobs.length} jobs`)
  console.log(`[print-bundle] Settings:`, JSON.stringify({
    printer: settings.selectedPrinter,
    colorMode: settings.colorMode,
    duplex: settings.duplex,
    tray1: settings.tray1Name,
    tray2: settings.tray2Name,
    tray3: settings.tray3Name,
    tray4: settings.tray4Name,
  }, null, 2))

  // Filter jobs that have actual documents
  const validJobs = printJobs.filter(job => !!job.documentUrl)
  if (validJobs.length === 0) {
    return { success: false, error: 'Geen documenten om te printen' }
  }

  // Build a summary of all jobs for ONE confirmation dialog
  const jobSummary = validJobs.map(job => {
    const tray = job.tray || 1
    const binName = trayNames[tray] || settings.tray1Name
    const desc = trayDescriptions[tray] || `Lade ${tray}`
    return `  • ${job.name} → ${desc} (${binName})`
  }).join('\n')

  const colorText = settings.colorMode === 'monochrome' ? 'Zwart-wit' : 'Kleur'
  const duplexText = settings.duplex ? 'Dubbelzijdig' : 'Enkelzijdig'

  // Show ONE confirmation dialog for all jobs
  const dialogResult = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Printen bevestigen',
    message: `${validJobs.length} onderdelen printen?`,
    detail: `Printer: ${settings.selectedPrinter || 'Standaard'}\nKleur: ${colorText} | ${duplexText}\n\n${jobSummary}\n\nAlle onderdelen worden achter elkaar geprint.`,
    buttons: ['Alles printen', 'Annuleren'],
    defaultId: 0,
  })

  if (dialogResult.response === 1) {
    return { success: false, error: 'Geannuleerd door gebruiker' }
  }

  try {
    const results = []

    for (const job of validJobs) {
      // Show progress
      mainWindow.webContents.send('print-progress', {
        job: job.name,
        status: 'printing',
      })

      // Determine tray/bin
      const tray = job.tray || 1
      const trayName = trayNames[tray] || settings.tray1Name

      console.log(`[print-bundle] Job "${job.name}": tray=${tray}, bin="${trayName}"`)

      // Save PDF to temp file
      let pdfPath
      if (job.documentUrl.startsWith('data:')) {
        const base64Data = job.documentUrl.split(',')[1]
        pdfPath = path.join(app.getPath('temp'), `workx-print-${job.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
        fs.writeFileSync(pdfPath, Buffer.from(base64Data, 'base64'))
        console.log(`[print-bundle] Saved temp PDF: ${pdfPath} (${(base64Data.length * 0.75 / 1024).toFixed(0)} KB)`)
      }

      if (!pdfPath) {
        console.log(`[print-bundle] Skipping ${job.name}: documentUrl is not a data URL`)
        results.push({ job: job.name, success: false, error: 'No PDF data' })
        continue
      }

      // Print the document
      if (print && print.print) {
        try {
          const printOptions = {
            printer: settings.selectedPrinter || undefined,
            bin: trayName,
            copies: job.copies || 1,
          }

          if (settings.colorMode === 'monochrome') {
            printOptions.monochrome = true
          }

          if (settings.duplex) {
            printOptions.side = 'duplexlong'
          }

          console.log(`[print-bundle] Printing "${job.name}" with options:`, JSON.stringify(printOptions))
          await print.print(pdfPath, printOptions)
          console.log(`[print-bundle] OK "${job.name}" printed successfully`)
          results.push({ job: job.name, success: true })
        } catch (err) {
          console.error(`[print-bundle] FAIL pdf-to-printer failed for "${job.name}":`, err.message || err)
          results.push({ job: job.name, success: false, error: err.message || String(err) })
        }
      } else {
        // Fallback: use Electron's built-in print
        try {
          console.log(`[print-bundle] Fallback: printing "${job.name}" via Electron`)
          const printWin = new BrowserWindow({ show: false, width: 800, height: 600 })
          await printWin.loadURL(`file://${pdfPath}`)
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
                if (success) resolve()
                else reject(new Error(errorType || 'Print mislukt'))
              }
            )
          })
          results.push({ job: job.name, success: true })
        } catch (err) {
          console.error(`[print-bundle] Electron fallback failed for "${job.name}":`, err.message)
          results.push({ job: job.name, success: false, error: err.message })
        }
      }

      // Clean up temp file
      try { fs.unlinkSync(pdfPath) } catch (e) {}
    }

    console.log(`[print-bundle] Done. Results:`, JSON.stringify(results))
    return {
      success: results.every((r) => r.success),
      results,
    }
  } catch (error) {
    console.error('[print-bundle] Fatal error:', error.message)
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
