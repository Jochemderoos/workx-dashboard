import mammoth from 'mammoth'
import path from 'path'
import os from 'os'
const file = path.join(os.homedir(), 'Downloads', 'Sollicitatiebeleid Workx – Selectieprocedure in Drie Gespreksrondes.docx')
const result = await mammoth.extractRawText({ path: file })
console.log(result.value)
