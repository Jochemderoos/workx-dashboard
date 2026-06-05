// Genereert een sample-PDF zodat we visueel kunnen checken hoe de
// downloadPDF output eruit ziet zonder browser.

import fs from 'fs'
import path from 'path'

async function main() {
  // jsPDF in Node — geen window
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  // Logo als data URL inlezen
  const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'workx-logo.png'))
  const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`

  // Sample data
  const form = {
    employerName: 'EQT',
    employeeName: 'J. de Jong',
    startDate: '2020-06-11',
    endDate: '2026-12-01',
    salary: '6000',
    vacationMoney: true,
    vacationPercent: '8',
    thirteenthMonth: false,
    bonusType: 'fixed',
    bonusFixed: '500',
    bonusYear1: '',
    bonusYear2: '',
    bonusYear3: '',
    bonusOther: '',
    overtime: '',
    other: '',
    isPensionAge: false,
    pensionDate: '',
    notes: '',
    clientParty: 'werknemer',
  }
  const result = {
    years: 6,
    months: 5,
    days: 0,
    totalMonths: 77,
    amount: 15058.43,
    amountBeforeMax: 15058.43,
    totalSalary: 6980,
    yearlySalary: 83760,
    bonusPerMonth: 500,
    maxApplied: false,
    maxUsed: 102000,
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
  const formatDate = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const { renderTransitiePdf } = await import('../src/lib/transitie-pdf')
  renderTransitiePdf(doc, {
    mode: 'single',
    isEN: false,
    form,
    result,
    logoDataUrl,
    formatDate,
    formatCurrency,
  })

  const outPath = path.join('C:/Users/quiri/workx-dashboard', 'tmp-pdf-sample.pdf')
  const arrayBuffer = doc.output('arraybuffer')
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer))
  console.log(`Sample PDF: ${outPath}`)

  // Ook een vergelijking sample
  const doc2 = new jsPDF()
  renderTransitiePdf(doc2, {
    mode: 'compare',
    isEN: false,
    form,
    result,
    liveResult: result,
    whatIfMultiplier: 1.8,
    whatIfEndDate: '2026-12-01',
    logoDataUrl,
    formatDate,
    formatCurrency,
  })
  const outPath2 = path.join('C:/Users/quiri/workx-dashboard', 'tmp-pdf-sample-compare.pdf')
  fs.writeFileSync(outPath2, Buffer.from(doc2.output('arraybuffer')))
  console.log(`Compare PDF: ${outPath2}`)
}

main().catch(err => { console.error(err); process.exit(1) })
