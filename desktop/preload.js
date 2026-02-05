const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if we're in Electron
  isElectron: true,

  // Get available printers
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // Print a single document
  printDocument: (options) => ipcRenderer.invoke('print-document', options),

  // Print a full bundle with multiple jobs
  printBundle: (printData) => ipcRenderer.invoke('print-bundle', printData),

  // Select printer
  selectPrinter: () => ipcRenderer.invoke('select-printer'),

  // Listen for print progress updates
  onPrintProgress: (callback) => {
    ipcRenderer.on('print-progress', (event, data) => callback(data))
  },

  // Platform info
  platform: process.platform,
})
