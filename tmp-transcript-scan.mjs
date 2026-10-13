import { readFileSync, statSync } from 'node:fs'

const files = [
  'C:/Users/19123/.cursor/projects/c-project-eat-eat/agent-transcripts/7884888d-cad6-481e-a080-6a87e02a0f9a/7884888d-cad6-481e-a080-6a87e02a0f9a.jsonl',
  'C:/Users/19123/.cursor/projects/c-project-eat-eat/agent-transcripts/0b150f48-e320-46b2-9054-e2ad00d6e421/0b150f48-e320-46b2-9054-e2ad00d6e421.jsonl',
]

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\n/).filter(Boolean)
  const id = f.split('/').at(-2)
  console.log(`\n==== ${id} lines ${lines.length} mtime ${statSync(f).mtime.toISOString()}`)
  let n = 0
  for (const line of lines) {
    let obj
    try {
      obj = JSON.parse(line)
    }
    catch {
      continue
    }
    const role = obj.role || obj.message?.role || ''
    if (role !== 'user')
      continue
    const content = obj.message?.content ?? obj.content
    let t = ''
    if (typeof content === 'string')
      t = content
    else if (Array.isArray(content))
      t = content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    const start = t.indexOf('<user_query>')
    const end = t.indexOf('</user_query>')
    const body = (start >= 0 && end > start ? t.slice(start + 12, end) : t).trim().slice(0, 500)
    if (!body)
      continue
    n++
    console.log(`--- user ${n}`)
    console.log(body.replace(/\s+/g, ' '))
  }
}
