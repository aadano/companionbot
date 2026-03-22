// Strips ELECTRON_RUN_AS_NODE before spawning Electron so Electron APIs work
// (Claude Code sets ELECTRON_RUN_AS_NODE=1 in its shell environment)
const { spawn } = require('child_process')
const electronPath = require('electron')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proc = spawn(electronPath, ['.'], { stdio: 'inherit', env })
proc.on('close', (code) => process.exit(code ?? 0))
