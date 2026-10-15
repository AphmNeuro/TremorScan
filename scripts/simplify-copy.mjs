// Apply the requested presentation-only changes to either release's HTML.
import {readFile,writeFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path)throw Error('Provide the HTML file path');
const source=await readFile(path,'utf8');
const html=source
  .replace(/<a\b[^>]*href="\.\/docs\/methodologie\.html"[^>]*>[\s\S]*?<\/a\s*>/g,'')
  .replace(/<h1>Un mouvement\.[\s\S]*?<\/h1>/,'<h1 class="sr">TremorScan</h1>')
  .replace(/<section class="privacy">[\s\S]*?<\/section>/,'')
  // Preserve the existing header's last-child CSS after removing its link.
  .replace(/(?:<span hidden aria-hidden="true" id="header-end"><\/span>)?\s*<\/header>/,
    '<span hidden aria-hidden="true" id="header-end"></span></header>');
await writeFile(path,html);
