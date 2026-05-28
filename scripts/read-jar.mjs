import mammoth from 'mammoth'
import path from 'path'
import os from 'os'

const file = path.join(os.homedir(), 'Downloads', 'JAR Rooster 2026 (1).docx')
const result = await mammoth.extractRawText({ path: file })
console.log(result.value)
