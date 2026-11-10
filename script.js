const COLS={users:['id','name','email','password_hash','role','bio','created_at','updated_at'],links:['id','user_id','title','url','category','status','clicks','created_at','updated_at'],activity:['id','user_id','message','created_at','updated_at']};
const CATS=['Social','Portfolio','Shop','Content','Other'];
const SESSION_KEY='linknest_session';
const THEME_KEY='linknest_theme';
const $=id=>document.getElementById(id);
const state={user:null,users:[],links:[],activity:[],view:'dashboard',confirmCb:null};
const TITLES={dashboard:'Dashboard',links:'My Links',public:'Public Page',reports:'Reports',users:'Users',settings:'Settings'};
function uid(){return Date.now()*1000+Math.floor(Math.random()*1000);}
function now(){return new Date().toISOString();}
function esc(s){const d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML.split('"').join('&quot;');}
function fmt(d){const x=new Date(d);return isNaN(x)?'':x.toLocaleString();}
async function all(t){const r=await WebDB.select(t);return Array.isArray(r)?r:((r&&r.rows)||[]);}
async function save(t,rows){await WebDB._setRaw(t,{columns:COLS[t],rows:rows});}
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
let toastTimer=null;
function toast(m,err){const t=$('toast');t.textContent=m;t.className='toast show'+(err?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.className='toast';},2800);}
async function loadAll(){state.users=await all('users');state.links=await all('links');state.activity=await all('activity');}
async function log(msg){await WebDB.insert('activity',{id:uid(),user_id:state.user.id,message:msg,created_at:now(),updated_at:now()});state.activity=await all('activity');}
function isAdmin(){return state.user&&state.user.role==='admin';}
function mine(){return state.links.filter(l=>isAdmin()||l.user_id===state.user.id);}
function applyTheme(t){document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}
function setAuthTab(login){$('login-form').hidden=!login;$('register-form').hidden=login;$('tab-login').classList.toggle('active',login);$('tab-register').classList.toggle('active',!login);$('auth-msg').textContent='';}
function validEmail(e){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);}
async function register(e){e.preventDefault();const name=$('reg-name').value.trim(),email=$('reg-email').value.trim().toLowerCase(),pw=$('reg-password').value;const m=$('auth-msg');
 if(name.length<2){m.textContent='Please enter your name.';return;}
 if(!validEmail(email)){m.textContent='Please enter a valid email.';return;}
 if(pw.length<6){m.textContent='Password must be at least 6 characters.';return;}
 state.users=await all('users');
 if(state.users.some(u=>u.email===email)){m.textContent='That email is already registered.';return;}
 const u={id:uid(),name:name,email:email,password_hash:await hash(pw),role:state.users.length===0?'admin':'member',bio:'Welcome to my link page.',created_at:now(),updated_at:now()};
 await WebDB.insert('users',u);
 e.target.reset();await startSession(u.id);toast('Account created. Welcome!');}
async function login(e){e.preventDefault();const email=$('login-email').value.trim().toLowerCase(),pw=$('login-password').value;const m=$('auth-msg');
 if(!validEmail(email)||!pw){m.textContent='Enter your email and password.';return;}
 state.users=await all('users');const h=await hash(pw);
 const u=state.users.find(x=>x.email===email&&x.password_hash===h);
 if(!u){m.textContent='Incorrect email or password.';return;}
 e.target.reset();await startSession(u.id);toast('Logged in.');}
async function startSession(id){localStorage.setItem(SESSION_KEY,String(id));await loadAll();const u=state.users.find(x=>String(x.id)===String(id));if(!u){logout();return;}state.user=u;$('auth-screen').hidden=true;$('app').hidden=false;
 $('who').textContent=u.name+' ('+u.role+')';
 document.querySelectorAll('[data-role="admin"]').forEach(b=>{b.hidden=u.role!=='admin';});
 await log('Signed in');showView('dashboard');}
function logout(){localStorage.removeItem(SESSION_KEY);state.user=null;$('app').hidden=true;$('auth-screen').hidden=false;setAuthTab(true);}
function showView(v){if(v==='users'&&!isAdmin())v='dashboard';state.view=v;
 document.querySelectorAll('.view').forEach(x=>{x.hidden=x.id!=='view-'+v;});
 document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 $('view-title').textContent=TITLES[v];renderAll();}
function renderAll(){const v=state.view;if(v==='dashboard')renderDashboard();if(v==='links')renderLinks();if(v==='public')renderPublic();if(v==='reports')renderReports();if(v==='users')renderUsers();if(v==='settings')renderSettings();}
function renderDashboard(){const l=mine();const clicks=l.reduce((a,x)=>a+(Number(x.clicks)||0),0);
 $('m-total').textContent=l.length;$('m-active').textContent=l.filter(x=>x.status==='active').length;$('m-clicks').textContent=clicks;
 const top=l.slice().sort((a,b)=>b.clicks-a.clicks)[0];$('m-top').textContent=top&&top.clicks>0?top.title:'-';
 const acts=state.activity.filter(a=>isAdmin()||a.user_id===state.user.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,12);
 $('activity-list').innerHTML=acts.length?acts.map(a=>'<li>'+esc(a.message)+'<time>'+esc(fmt(a.created_at))+'</time></li>').join(''):'<li class="empty">No activity yet.</li>';
 const t=l.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,6);
 bars($('chart-clicks'),t.map(x=>x.title),t.map(x=>Number(x.clicks)||0));}
function bars(c,labels,vals){const dpr=window.devicePixelRatio||1;const w=c.parentElement.clientWidth-36||300,h=240;c.width=w*dpr;c.height=h*dpr;c.style.height=h+'px';const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
 const cs=getComputedStyle(document.documentElement);const txt=cs.getPropertyValue('--muted').trim()||'#666',pri=cs.getPropertyValue('--primary').trim()||'#4f46e5';
 x.font='12px system-ui';x.fillStyle=txt;
 if(!vals.length){x.fillText('No data yet. Add links to see this chart.',10,40);return;}
 const max=Math.max.apply(null,vals.concat([1]));const pad=28,bw=(w-pad*2)/vals.length;
 vals.forEach((v,i)=>{const bh=(h-70)*v/max;const bx=pad+i*bw+bw*0.15;x.fillStyle=pri;x.fillRect(bx,h-40-bh,bw*0.7,bh);x.fillStyle=txt;x.textAlign='center';x.fillText(String(v),bx+bw*0.35,h-44-bh);
 let lb=labels[i];if(lb.length>10)lb=lb.slice(0,9)+'...';x.fillText(lb,bx+bw*0.35,h-20);});x.textAlign='left';}
function fillCats(){const opts=CATS.map(c=>'<option value="'+c+'">'+c+'</option>').join('');$('link-category').innerHTML=opts;$('filter-category').innerHTML='<option value="">All categories</option>'+opts;}
function filtered(){const q=$('search').value.trim().toLowerCase(),c=$('filter-category').value,s=$('filter-status').value,o=$('sort').value;
 const l=mine().filter(x=>(!q||(x.title+' '+x.url).toLowerCase().includes(q))&&(!c||x.category===c)&&(!s||x.status===s));
 if(o==='title')l.sort((a,b)=>a.title.localeCompare(b.title));else if(o==='clicks')l.sort((a,b)=>b.clicks-a.clicks);else l.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));return l;}
function renderLinks(){const l=filtered();$('links-empty').hidden=l.length>0;
 $('links-body').innerHTML=l.map(x=>'<tr><td><strong>'+esc(x.title)+'</strong></td><td><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.url)+'</a></td><td>'+esc(x.category)+'</td><td><span class="badge '+esc(x.status)+'">'+esc(x.status)+'</span></td><td>'+(Number(x.clicks)||0)+'</td><td><button class="btn small" data-act="edit" data-id="'+x.id+'">Edit</button><button class="btn small" data-act="toggle" data-id="'+x.id+'">'+(x.status==='active'?'Hide':'Activate')+'</button><button class="btn small danger" data-act="delete" data-id="'+x.id+'">Delete</button></td></tr>').join('');}
function findLink(id){return state.links.find(x=>String(x.id)===String(id));}
function openModal(l){$('link-msg').textContent='';$('modal-title').textContent=l?'Edit link':'Add link';$('link-id').value=l?l.id:'';$('link-title').value=l?l.title:'';$('link-url').value=l?l.url:'';$('link-category').value=l?l.category:CATS[0];$('link-status').value=l?l.status:'active';$('link-modal').showModal();$('link-title').focus();}
async function saveLink(e){e.preventDefault();const id=$('link-id').value,title=$('link-title').value.trim(),url=$('link-url').value.trim(),m=$('link-msg');
 if(title.length<2){m.textContent='Title must be at least 2 characters.';return;}
 let ok=false;try{const u=new URL(url);ok=u.protocol==='http:'||u.protocol==='https:';}catch(x){ok=false;}
 if(!ok){m.textContent='Enter a valid URL starting with http:// or https://';return;}
 const category=$('link-category').value,status=$('link-status').value;
 if(id){const l=findLink(id);l.title=title;l.url=url;l.category=category;l.status=status;l.updated_at=now();await save('links',state.links);await log('Updated link: '+title);toast('Link updated.');}
 else{await WebDB.insert('links',{id:uid(),user_id:state.user.id,title:title,url:url,category:category,status:status,clicks:0,created_at:now(),updated_at:now()});state.links=await all('links');await log('Added link: '+title);toast('Link added.');}
 $('link-modal').close();state.links=await all('links');renderAll();}
function askConfirm(text,cb){$('confirm-text').textContent=text;state.confirmCb=cb;$('confirm-modal').showModal();}
async function linkAction(e){const b=e.target.closest('button[data-act]');if(!b)return;const l=findLink(b.dataset.id);if(!l)return;
 if(b.dataset.act==='edit')openModal(l);
 if(b.dataset.act==='toggle'){l.status=l.status==='active'?'hidden':'active';l.updated_at=now();await save('links',state.links);await log('Set '+l.title+' to '+l.status);toast('Status changed to '+l.status+'.');renderAll();}
 if(b.dataset.act==='delete')askConfirm('Delete "'+l.title+'"? This cannot be undone.',async()=>{state.links=state.links.filter(x=>x.id!==l.id);await save('links',state.links);await log('Deleted link: '+l.title);toast('Link deleted.');renderAll();});}
function renderPublic(){const u=state.user;$('public-name').textContent=u.name;$('public-bio').textContent=u.bio||'';$('public-avatar').textContent=u.name.charAt(0).toUpperCase();
 const l=state.links.filter(x=>x.user_id===u.id&&x.status==='active');
 $('public-list').innerHTML=l.length?l.map(x=>'<button class="public-link" type="button" data-id="'+x.id+'">'+esc(x.title)+'</button>').join(''):'<div class="empty">No active links to show yet.</div>';}
async function publicClick(e){const b=e.target.closest('button[data-id]');if(!b)return;const l=findLink(b.dataset.id);if(!l)return;l.clicks=(Number(l.clicks)||0)+1;l.updated_at=now();await save('links',state.links);await log('Click on '+l.title);window.open(l.url,'_blank','noopener');toast('Opened '+l.title);}
function renderReports(){const l=mine();const rows=CATS.map(c=>{const x=l.filter(i=>i.category===c);return{category:c,count:x.length,clicks:x.reduce((a,i)=>a+(Number(i.clicks)||0),0)};});
 $('report-body').innerHTML=rows.map(r=>'<tr><td>'+esc(r.category)+'</td><td>'+r.count+'</td><td>'+r.clicks+'</td></tr>').join('');
 bars($('chart-cat'),rows.map(r=>r.category),rows.map(r=>r.count));}
function exportCsv(){const l=mine();if(!l.length){toast('Nothing to export yet.',true);return;}
 const q=v=>'"'+String(v==null?'':v).split('"').join('""')+'"';
 const cols=['id','title','url','category','status','clicks','created_at'];
 const csv=[cols.join(',')].concat(l.map(x=>cols.map(c=>q(x[c])).join(','))).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='linknest-links.csv';document.body.appendChild(a);a.click();a.remove();toast('CSV downloaded.');}
function renderUsers(){$('users-body').innerHTML=state.users.map(u=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.email)+'</td><td><span class="badge">'+esc(u.role)+'</span></td><td>'+state.links.filter(l=>l.user_id===u.id).length+'</td><td>'+esc(fmt(u.created_at))+'</td><td>'+(u.id===state.user.id?'<span class="muted">You</span>':'<button class="btn small" data-uid="'+u.id+'">Make '+(u.role==='admin'?'member':'admin')+'</button>')+'</td></tr>').join('');}
async function userAction(e){const b=e.target.closest('button[data-uid]');if(!b)return;const u=state.users.find(x=>String(x.id)===b.dataset.uid);if(!u)return;u.role=u.role==='admin'?'member':'admin';u.updated_at=now();await save('users',state.users);await log('Changed role of '+u.name+' to '+u.role);toast('Role updated.');renderUsers();}
function renderSettings(){$('set-name').value=state.user.name;$('set-bio').value=state.user.bio||'';$('set-theme').value=localStorage.getItem(THEME_KEY)||'light';}
async function saveSettings(e){e.preventDefault();const n=$('set-name').value.trim();if(n.length<2){toast('Name must be at least 2 characters.',true);return;}
 const u=state.users.find(x=>x.id===state.user.id);u.name=n;u.bio=$('set-bio').value.trim();u.updated_at=now();await save('users',state.users);state.user=u;
 localStorage.setItem(THEME_KEY,$('set-theme').value);applyTheme($('set-theme').value);$('who').textContent=u.name+' ('+u.role+')';await log('Updated settings');toast('Settings saved.');}
async function copyAll(){const l=state.links.filter(x=>x.user_id===state.user.id&&x.status==='active');if(!l.length){toast('No active links to copy.',true);return;}
 const text=l.map(x=>x.title+': '+x.url).join('\n');try{await navigator.clipboard.writeText(text);toast('Links copied.');}catch(x){toast('Copy is not available in this browser.',true);}}
function wrap(fn){return function(e){fn(e).catch(x=>toast('Something went wrong: '+x.message,true));};}
async function boot(){applyTheme(localStorage.getItem(THEME_KEY)||'light');fillCats();
 $('tab-login').onclick=()=>setAuthTab(true);$('tab-register').onclick=()=>setAuthTab(false);
 $('login-form').addEventListener('submit',wrap(login));$('register-form').addEventListener('submit',wrap(register));
 $('logout-btn').onclick=logout;
 $('nav').addEventListener('click',e=>{const b=e.target.closest('.nav-btn');if(b)showView(b.dataset.view);});
 $('quick-add').onclick=()=>openModal(null);$('add-link-btn').onclick=()=>openModal(null);
 $('link-cancel').onclick=()=>$('link-modal').close();
 $('link-form').addEventListener('submit',wrap(saveLink));
 ['search','filter-category','filter-status','sort'].forEach(id=>{$(id).addEventListener('input',renderLinks);$(id).addEventListener('change',renderLinks);});
 $('links-body').addEventListener('click',wrap(linkAction));
 $('public-list').addEventListener('click',wrap(publicClick));
 $('copy-btn').onclick=wrap(copyAll);
 $('export-btn').onclick=exportCsv;$('report-export').onclick=exportCsv;
 $('users-body').addEventListener('click',wrap(userAction));
 $('settings-form').addEventListener('submit',wrap(saveSettings));
 $('confirm-no').onclick=()=>$('confirm-modal').close();
 $('confirm-yes').onclick=wrap(async()=>{$('confirm-modal').close();if(state.confirmCb)await state.confirmCb();state.confirmCb=null;});
 window.addEventListener('resize',()=>{if(state.user&&(state.view==='dashboard'||state.view==='reports'))renderAll();});
 const sid=localStorage.getItem(SESSION_KEY);
 if(sid){try{await startSession(sid);}catch(x){logout();}}
}
boot();