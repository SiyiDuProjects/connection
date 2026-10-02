const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,out=path.join(root,'public');
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(root,'source-gallery.html'),'utf8');
const sourceData=JSON.parse(html.slice(html.indexOf('const all=')+10,html.indexOf(',q=s=>')));
html=html.replace('<title>Reachard · 96 个不同方向</title>','<title>Reachard · 帮我们选一个 Logo</title><meta name="description" content="浏览 96 个 Reachard Logo 方案，选出你喜欢的图形，把编号分享给我们。">');
html=html.replace('<h1>96 个不同构思。</h1>','<h1>你更喜欢哪个 Logo？</h1>');
html=html.replace('点击放大 · 选择对比 · 下载 SVG','96 个方案 · 选出你喜欢的，发回给朋友');
html=html.replace(/<p id="share-links"[\s\S]*?<\/p>/,'');
html=html.replace('<small>统一尺寸 · 原比例居中</small>','');
html=html.replace('清空对比','清空选择').replaceAll('加入对比','选为喜欢').replaceAll('移出对比','取消喜欢');
html=html.replace("?'已选':'对比'","?'已选':'喜欢'");
html=html.replace("'最多对比 6 个，请先移除一个。'","'最多选 6 个，请先取消一个。'");
html=html.replace('<p id="status"', '<section id="choice-panel" hidden><label for="choice-text">我的选择</label><textarea id="choice-text" rows="2" readonly></textarea><button id="copy-choice">复制编号和链接</button><span id="copy-result" role="status"></span></section><p id="status"');
html=html.replace('</style>',`#choice-panel{margin-top:18px;padding:16px;background:#f3f7fd;border-radius:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#choice-panel[hidden]{display:none}#choice-text{flex:1;min-width:180px;font:14px/1.5 inherit;border:0;resize:none;background:transparent;color:#252729}#copy-choice{background:#007aff;border-color:#007aff;color:white}#copy-result{font-size:14px;color:#505a67}#grid .meta span{font-size:14px}nav label{font-size:14px}.meta button{min-height:34px}a{color:#007aff}@media(max-width:600px){#choice-text{flex-basis:100%}#copy-choice{width:100%}} </style>`);
html=html.replace('let chosen=[],active=null;',`let chosen=[],active=null;
const ids=new Set(all.map(x=>x.id));
function validSelection(values){if(!Array.isArray(values)||values.length>6||values.some(x=>typeof x!=='string'||!ids.has(x))||new Set(values).size!==values.length)throw new Error('请选择最多六个有效且不重复的编号。');return [...values];}
try{const initial=new URLSearchParams(location.hash.slice(1)).get('pick');if(initial)chosen=validSelection(initial.split(','));}catch{}
function syncChoice(){const value=chosen.length?'pick='+chosen.join(','):'';history.replaceState(null,'',location.pathname+location.search+(value?'#'+value:''));q('#choice-panel').hidden=!chosen.length;q('#choice-text').value=chosen.length?'我喜欢的 Reachard Logo：'+chosen.join('、')+'。\\n'+location.href:'';q('#copy-result').textContent='';}
`);
html=html.replace("q('#status').textContent=items.length+' 个构思 · 已选 '+chosen.length+' / 6';}","q('#status').textContent=items.length+' 个方案 · 已选 '+chosen.length+' / 6';syncChoice();}");
html=html.replace('</script>',()=>`
q('#copy-choice').onclick=async()=>{try{await navigator.clipboard.writeText(q('#choice-text').value);q('#copy-result').textContent='已复制，发给朋友即可。';}catch{q('#choice-text').focus();q('#choice-text').select();q('#copy-result').textContent='请复制上方已选中的文字。';}};
const context=document.modelContext;
if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'choose_logos',title:'选择喜欢的 Logo',description:'Replace the current local selection with up to six logo IDs and update the visible feedback link. Does not send feedback to anyone.',inputSchema:{type:'object',properties:{ids:{type:'array',items:{type:'string',pattern:'^[0-9]{2}$'},maxItems:6,uniqueItems:true}},required:['ids'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){chosen=validSelection(input?.ids);render();return {selected:chosen,totalConcepts:all.length,feedback:q('#choice-text').value};}})).catch(()=>{});}catch{}}
</script>`);
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(js);
fs.writeFileSync(path.join(out,'index.html'),html);
fs.mkdirSync(path.join(out,'svg'),{recursive:true});
for(const x of sourceData)fs.writeFileSync(path.join(out,'svg',x.id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024" style="color:#252729" fill="currentColor">${x.body}</svg>`);
// Contract test the actual shipped script, including public URL selection and feedback.
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,{value:s==='#family'?'all':s==='#color'?'ink':'',innerHTML:'',textContent:'',hidden:false,style:{setProperty(){}},focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(s);};
const registered=[];const location={hash:'#pick=07,16',pathname:'/',search:'',href:'https://example.test/#pick=07,16'};
const sandbox={document:{querySelector:get,addEventListener(){},body:{style:{setProperty(){}}},modelContext:{registerTool(t){registered.push(t);}}},location,history:{replaceState(_,__,url){location.href='https://example.test'+url;location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}},URLSearchParams,URL,Blob,setTimeout,navigator:{clipboard:{async writeText(value){sandbox.copied=value;}}}};
vm.createContext(sandbox);vm.runInContext(js,sandbox);
if(vm.runInContext('all.length',sandbox)!==96||vm.runInContext('chosen.join(",")',sandbox)!=='07,16')throw Error('Initial selection failed');
if(registered.length!==1)throw Error('Selection tool did not register');
const selected=registered[0].execute({ids:['49','96']});if(selected.selected.join(',')!=='49,96'||!get('#choice-text').value.includes('#pick=49,96'))throw Error('Selection feedback failed');
let rejected=false;try{registered[0].execute({ids:['97']});}catch{rejected=true;}if(!rejected||vm.runInContext('chosen.join(",")',sandbox)!=='49,96')throw Error('Invalid selection damaged state');
Promise.resolve(get('#copy-choice').onclick()).then(()=>{if(!sandbox.copied.includes('49、96'))throw Error('Clipboard copy failed');fs.cpSync(out,path.join(root,'out'),{recursive:true});console.log('Built static site: 96 SVGs. Selection links, clipboard feedback, tool registration and invalid-input handling passed in isolated runtime.');}).catch(e=>{console.error(e);process.exitCode=1;});
