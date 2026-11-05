#!/usr/bin/env node
/* Bundles the game into single HTML files in dist/:
 *   dist/daedalus-dream.html  — a complete standalone page (open it directly or host it anywhere)
 *   dist/artifact.html        — the same page body without <html>/<head>, for hosts that add their own skeleton
 * The PWA files (manifest, service worker, icons) are only used by the regular multi-file build in the repo root.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const app = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->')).trim();
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const fonts = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/)[1];
const css = read('style.css');
let js = scripts.map((s) => `/* ---- ${s} ---- */\n` + read(s)).join('\n');
if (/<\/script/i.test(js)) js = js.replace(/<\/script/gi, '<\\/script');
const version = (read('src/util.js').match(/DD\.VERSION = '([^']+)'/) || [])[1] || '';

const head = `<title>Daedalus Dream</title>
<meta name="description" content="A little girl keeps dreaming of a bright yellow jungle-gym maze. There is a way in, and no way out.">
<meta name="theme-color" content="#0b0818">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>`;
const body = `${app}
<script>
/* Daedalus Dream v${version} — single-file build */
globalThis.DD = { SINGLE_FILE: true };
${js}
</script>`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), head + '\n' + body + '\n');
fs.writeFileSync(path.join(root, 'dist', 'daedalus-dream.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="dark">
${head}
</head>
<body>
${body}
</body>
</html>
`);
const kb = (f) => (fs.statSync(path.join(root, 'dist', f)).size / 1024).toFixed(0) + ' KB';
console.log('dist/daedalus-dream.html', kb('daedalus-dream.html'));
console.log('dist/artifact.html', kb('artifact.html'));
