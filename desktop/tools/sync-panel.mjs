// 把面板的 index.html 复制进桌面壳的 frontendDist 目录，并记录 sha256。
// 仓库里的 index.html 仍是唯一代码来源；桌面壳不复制一份逻辑，只内嵌它。
//   node desktop/tools/sync-panel.mjs          写入
//   node desktop/tools/sync-panel.mjs --check  校验（CI 用）
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DESKTOP = path.resolve(HERE, '..')
const REPO = path.resolve(DESKTOP, '..')
const SRC = path.join(REPO, 'index.html')
const DIST = path.join(DESKTOP, 'dist')
const OUT = path.join(DIST, 'index.html')
const MANIFEST = path.join(DIST, 'panel.sha256')

const bytes = readFileSync(SRC)
// 跨平台比对：先归一化行尾（Windows 检出会把 LF 变 CRLF），再算 sha
const norm = (b) => Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
const sha = createHash('sha256').update(norm(bytes)).digest('hex')
const manifest = `index.html ${sha}\nsource ../../index.html\nnote 行尾归一化（CRLF→LF）后再算 sha，保证跨平台一致\n`

if (process.argv.includes('--check')) {
  const have = existsSync(OUT) ? createHash('sha256').update(norm(readFileSync(OUT))).digest('hex') : '(missing)'
  if (have !== sha) {
    console.error(`桌面壳内嵌的面板不是最新的：dist=${have.slice(0, 16)}… 源=${sha.slice(0, 16)}…`)
    console.error('运行：node desktop/tools/sync-panel.mjs')
    process.exit(1)
  }
  console.log(`桌面壳内嵌面板与源一致（sha256 ${sha.slice(0, 16)}…，行尾归一化后比对）`)
} else {
  mkdirSync(DIST, { recursive: true })
  writeFileSync(OUT, bytes)
  writeFileSync(MANIFEST, manifest)
  console.log(`已同步 index.html -> desktop/dist/（${bytes.length} bytes，sha256 ${sha.slice(0, 16)}…）`)
}
