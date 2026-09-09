import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {access} from 'node:fs/promises';
import {load} from 'cheerio';
const output=new URL('../dist/client/',import.meta.url);
const pages=(await readdir(output)).filter(f=>f.endsWith('.html')&&!['index.html','404.html'].includes(f));
for(const page of pages){const dir=new URL(page.slice(0,-5)+'/',output);await mkdir(dir,{recursive:true});await copyFile(new URL(page,output),new URL('index.html',dir));}
await writeFile(new URL('.nojekyll',output),'');
const expected=['index.html','calendar/index.html','subjects/index.html','ee/index.html','tok/index.html','cas/index.html','study-tips/index.html','resources/index.html','forum/index.html','submit/index.html','account/index.html','admin/index.html','privacy/index.html'];
for(const p of expected){
 const html=await readFile(new URL(p,output),'utf8');
 if(!html.includes('IB Info')||!html.includes('<main'))throw new Error('Page did not render: '+p);
 const $=load(html);
 for(const node of $('a[href],script[src],link[href]').toArray()){
  const path=$(node).attr('src')||$(node).attr('href');
  if(!path.startsWith('/')||path.startsWith('//'))continue;
  const clean=path.split(/[?#]/)[0];
  await access(new URL(clean.slice(1)+(clean.endsWith('/')?'index.html':''),output));
 }
}
console.log('GitHub Pages output ready: '+expected.length+' working pages.');
