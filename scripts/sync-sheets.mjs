import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(configSource, sandbox, { filename: 'config.js' });
const config = sandbox.window.RD_CONFIG;

function parseCsv(input) {
  const rows = []; let row = []; let cell = ''; let quote = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') { if (quote && input[i + 1] === '"') { cell += '"'; i += 1; } else quote = !quote; }
    else if (char === ',' && !quote) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quote) { if (char === '\r' && input[i + 1] === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const headings = (rows.shift() || []).map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return rows.map(values => Object.fromEntries(headings.map((heading, index) => [heading, values[index] || ''])));
}

const data = {};
for (const [tab, url] of Object.entries(config.sources)) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${tab}: ${response.status} ${response.statusText}`);
  const text = await response.text();
  if (!text.includes(',') && !text.includes('\n')) throw Error(`${tab}: Google did not return CSV data.`);
  data[tab] = parseCsv(text);
  console.log(`${tab}: ${data[tab].length} record(s)`);
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/sheets.json', import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
