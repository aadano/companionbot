// Persistent config store — reads/writes to userData/teto-config.json
// Takes precedence over .env so packaged app doesn't need a .env file

const { app } = require('electron')
const fs       = require('fs')
const path     = require('path')

const CONFIG_FILENAME = 'teto-config.json'

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME)
}

/**
 * Load stored config. Returns {} if file doesn't exist or is corrupt.
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Merge updates into the stored config and persist.
 * @param {Record<string, string>} updates
 */
function saveConfig(updates) {
  const current = loadConfig()
  const next = { ...current, ...updates }
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
}

module.exports = { loadConfig, saveConfig }
