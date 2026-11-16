import {readFile,writeFile} from 'node:fs/promises';
export async function addNav(path){
 let html=await readFile(path,'utf8');
 const face=path.replaceAll('\\','/').includes('/visage/'),base=face?'../':'./';
 if(face){
   // Remove the controls, rather than relying on CSS or a second initializer.
   html=html.replace(/<div class="mode-choice"[^>]*>[\s\S]*?<\/div>/,'');
   html=html.replace(/<script[^>]*src="[^\"]*face-route.js[^\"]*"[^>]*><\/script>/,'');
   const source=path.replace(/index\.html$/,'src/app.js');
   let app=await readFile(source,'utf8');
   const start=app.indexOf("for(const mode of ['hand','face'])");
   const end=app.indexOf('function resetResults',start);
   if(start<0||end<0)throw Error('Face initialization changed: review dedicated face build.');
   const init=`session.setMode('face');
 $('low').min='0.5';$('low').value='0.5';$('high').value='15';
 $('start-title').textContent='Commençons par un visage.';
 $('capture-hint').textContent='Filmez un seul visage de face pendant 10 à 20 secondes, sans parler.';
 $('lighting-title').textContent='Éclairez le visage';
 $('lighting-hint').textContent='Un seul visage de face, sans zone masquée.';
 $('tracking-hint').textContent='Les régions du visage sont suivies automatiquement, entre 0,5 et 15 Hz.';
 `;
   app=app.slice(0,start)+init+app.slice(end);
   app=app.replace(/"mode-hand",\s*"mode-face",/,'');
   await writeFile(path.replace(/index\.html$/,'src/face-app.js'),app);
   html=html.replace(/src="\.\/src\/app\.js[^\"]*"/,'src="./src/face-app.js?v=2"');
 }
 if(html.includes('aria-label="Type de mesure"')){await writeFile(path,html);return;}
 const nav=`<nav aria-label="Type de mesure" style="display:flex;gap:24px;flex-wrap:wrap;margin:20px 0"><a href="${base}"${face?'':' aria-current="page"'}>Main</a><a href="${base}visage/"${face?' aria-current="page"':''}>Visage</a><a href="${base}posture.html">Posture</a></nav>`;
 // External stylesheet required by the existing CSP; no inline styles.
 html=html.replace(/(<main[^>]*>)/,'$1'+nav.replace(' style="display:flex;gap:24px;flex-wrap:wrap;margin:20px 0"',' class="mode-navigation"'));
 html=html.replace('</head>','<link rel="stylesheet" href="'+base+'navigation.css?v=1"></head>');
 await writeFile(path,html);
}
for(const path of process.argv.slice(2))await addNav(path);
