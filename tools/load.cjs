// Loads the browser game modules into Node (they attach to globalThis.DD).
const path = require('path');
const files = ['util.js', 'level.js', 'solver.js', 'generator.js', 'levels.js', 'i18n.js'];
module.exports = function load(opts) {
  opts = opts || {};
  for (const f of files) {
    const p = path.join(__dirname, '..', 'src', f);
    try { require.resolve(p); } catch (e) { continue; }
    if (!require('fs').existsSync(p)) continue;
    if (opts.skip && opts.skip.includes(f)) continue;
    require(p);
  }
  return globalThis.DD;
};
