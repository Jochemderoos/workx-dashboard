# Workx Desktop App

Electron wrapper voor het Workx Dashboard met native print ondersteuning.

## Features

- **Native Printing**: Print direct naar specifieke printer-lades
- **Lade 1 (Normaal papier)**: Voor dagvaardingen en bijlagen (briefpapier met logo)
- **Lade 2 (Geel papier)**: Voor productiebladen (geel papier met logo)

## Installatie voor Development

```bash
cd desktop
npm install
```

## Starten

```bash
# Development (gebruikt productie URL)
npm start

# Met lokale development server
WEBAPP_URL=http://localhost:3000 npm start
```

## Bouwen

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Beide
npm run build
```

## Configuratie

### Webapp URL

Standaard laadt de app de productie URL. Voor lokaal testen:

```bash
# Windows PowerShell
$env:WEBAPP_URL="http://localhost:3000"; npm start

# macOS/Linux
WEBAPP_URL=http://localhost:3000 npm start
```

### Printer Configuratie

De app detecteert automatisch beschikbare printers. Voor specifieke lade-selectie moet je mogelijk de printer-specifieke lade-namen configureren in `main.js`.

Veel voorkomende lade-namen:
- "Auto" - Automatische selectie
- "Manual" - Handmatige invoer
- "Tray 1", "Tray 2" - Standaard lade-namen
- "Cassette 1", "Cassette 2" - Canon printers
- "Drawer 1", "Drawer 2" - Sommige printers

## Architectuur

```
desktop/
├── main.js          # Electron main process
├── preload.js       # IPC bridge naar renderer
├── package.json     # Dependencies & build config
└── assets/          # App icons
    ├── icon.png
    ├── icon.ico     # Windows
    └── icon.icns    # macOS
```

## Print Flow

1. Gebruiker klikt "Printen" in Workxflow
2. Web app stuurt print data via IPC naar Electron
3. Electron toont dialoog per print-job (dagvaarding, productiebladen, bijlagen)
4. Gebruiker bevestigt of slaat over
5. Electron print naar geselecteerde printer/lade
6. Status wordt teruggestuurd naar web app

## Troubleshooting

### Printer niet gevonden
- Controleer of de printer is geïnstalleerd in Windows/macOS
- Controleer of de printer online is

### Verkeerde lade
- Configureer de lade-namen in `main.js` voor je specifieke printer
- Test met "Auto" om te beginnen

### PDF niet geprint
- Controleer of het document correct is gegenereerd
- Bekijk de console voor error messages
