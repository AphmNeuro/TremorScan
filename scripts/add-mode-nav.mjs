import {readFile,writeFile} from 'node:fs/promises';
export async function addNav(path){
 let html=await readFile(path,'utf8');
 const face=path.replaceAll('\\','/').includes('/visage/'),base=face?'../':'./';
 if(face&&!html.includes('face-route.js')){
   html=html.replace('<body>','<body class="face-only">');
   html=html.replace('</body>','<script type="module" src="../src/face-route.js?v=1"></script></body>');
 }
 if(html.includes('aria-label="Type de mesure"')){await writeFile(path,html);return;}
 const nav=`<nav aria-label="Type de mesure" style="display:flex;gap:24px;flex-wrap:wrap;margin:20px 0"><a href="${base}"${face?'':' aria-current="page"'}>Main</a><a href="${base}visage/"${face?' aria-current="page"':''}>Visage</a><a href="${base}posture.html">Posture</a></nav>`;
 // External stylesheet required by the existing CSP; no inline styles.
 html=html.replace(/(<main[^>]*>)/,'$1'+nav.replace(' style="display:flex;gap:24px;flex-wrap:wrap;margin:20px 0"',' class="mode-navigation"'));
 html=html.replace('</head>','<link rel="stylesheet" href="'+base+'posture.css"></head>');
 await writeFile(path,html);
}
for(const path of process.argv.slice(2))await addNav(path);
