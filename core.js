export const KEY = 'lift-notes-v1';
export const MODES = {
  total: {label:'总重量 / 器械标重',short:'总重量',weight:'重量 kg',reps:'次数',factor:1,help:'杠铃含杆总重，或器械上标示的重量。'},
  pair: {label:'哑铃 · 双手同时',short:'单只重量 · 双手同时',weight:'单只 kg',reps:'次数',factor:2,help:'输入一只哑铃的重量；两只一起做一次，记为1次。容量自动乘2。'},
  unilateral: {label:'哑铃 · 左右分别 / 交替',short:'单只重量 · 每侧次数',weight:'单只 kg',reps:'每侧次数',factor:2,help:'输入单只重量和每侧次数。仅适用于两侧重量、次数相同；容量自动乘2。'},
  single: {label:'单侧记录 / 单个负重',short:'单侧 / 单个负重',weight:'重量 kg',reps:'次数',factor:1,help:'仅统计这一侧或这一个负重。左右不同时，分别建“左侧”和“右侧”动作。'}
};
export function uid(){return globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);}
export function systemShortcut(settings,seconds){return settings.shortcutMode==='mapped'?(settings.shortcuts?.[seconds]||null):(settings.shortcutReady?settings.shortcut:null);}
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function fresh(){return {schemaVersion:1,exercises:[],sessions:[],activeSessionId:null,settings:{rest:90,shortcut:'健身休息',shortcutReady:false,shortcutMode:'mapped',shortcuts:{},timerMode:'system'},timer:null};}
export function validSet(s){return s.weight!=='' && s.reps!=='' && Number.isFinite(Number(s.weight)) && Number(s.weight)>=0 && Number(s.weight)<=2000 && Number.isInteger(Number(s.reps)) && Number(s.reps)>0 && Number(s.reps)<=999;}
export function volume(entry){return entry.sets.reduce((v,s)=>v+(s.done&&validSet(s)?Number(s.weight)*Number(s.reps)*MODES[entry.mode].factor:0),0);}
export function doneSets(entry){return entry.sets.filter(s=>s.done&&validSet(s));}
export function previousEntry(state,session,entry){
  const earlier=state.sessions.filter(s=>s.id!==session.id && (s.date<session.date || (s.date===session.date&&s.createdAt<session.createdAt))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  for(const s of earlier){const e=s.entries.find(e=>e.exerciseId===entry.exerciseId && e.mode===entry.mode && doneSets(e).length);if(e)return {session:s,entry:e};}return null;
}
export function series(state,exerciseId){return state.sessions.flatMap(s=>s.entries.filter(e=>e.exerciseId===exerciseId&&doneSets(e).length).map(e=>({session:s,entry:e,value:volume(e)}))).sort((a,b)=>a.session.date.localeCompare(b.session.date)||a.session.createdAt-b.session.createdAt);}
export function makeSet(weight='',reps=''){return {id:uid(),weight:String(weight),reps:String(reps),done:false};}
export function makeSession(date= today(),title=''){return {id:uid(),date,title,status:'active',createdAt:Date.now(),entries:[]};}
export function cloneSession(s,date=today()){return {...makeSession(date,s.title),entries:s.entries.map(e=>({...e,id:uid(),sets:e.sets.map(s=>makeSet(s.weight,''))}))};}
export function validateState(d){
  const fail=()=>{throw new Error('备份内容或格式不正确，原有记录未被修改。');};
  const str=(v,n=160)=>typeof v==='string'&&v.length<=n;
  const safeId=(v)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v);
  if(!d||d.schemaVersion!==1||!Array.isArray(d.exercises)||!Array.isArray(d.sessions)||d.exercises.length>2000||d.sessions.length>10000)fail();
  const ids=new Set();for(const e of d.exercises){if(!e||!safeId(e.id)||ids.has(e.id)||!str(e.name,80)||!e.name.trim()||!Object.hasOwn(MODES,e.mode))fail();ids.add(e.id);}
  const ss=new Set();for(const s of d.sessions){
    if(!s||!safeId(s.id)||ss.has(s.id)||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||Number.isNaN(Date.parse(s.date+'T12:00:00'))||new Date(s.date+'T12:00:00Z').toISOString().slice(0,10)!==s.date||!str(s.title,80)||!Number.isFinite(s.createdAt)||!['active','finished'].includes(s.status)||!Array.isArray(s.entries)||s.entries.length>100)fail();ss.add(s.id);
    const es=new Set();for(const e of s.entries){if(!e||!safeId(e.id)||es.has(e.id)||!ids.has(e.exerciseId)||!Object.hasOwn(MODES,e.mode)||d.exercises.find(x=>x.id===e.exerciseId).mode!==e.mode||!Array.isArray(e.sets)||e.sets.length>100||!Number.isInteger(e.rest)||e.rest<10||e.rest>3600||!str(e.note||'',500))fail();es.add(e.id);
      const sets=new Set();for(const st of e.sets){if(!st||!safeId(st.id)||sets.has(st.id)||typeof st.done!=='boolean'||!str(st.weight,30)||!str(st.reps,8)|| (st.weight!==''&&(!Number.isFinite(Number(st.weight))||Number(st.weight)<0||Number(st.weight)>2000)) ||(st.reps!==''&&(!Number.isInteger(Number(st.reps))||Number(st.reps)<1||Number(st.reps)>999)) ||(st.done&&!validSet(st)))fail();sets.add(st.id);}
    }
  }
  const settings={...fresh().settings,...d.settings};
  if(d.settings?.shortcutMode===undefined && d.settings?.shortcutReady)settings.shortcutMode='dynamic';
  if(!str(settings.shortcut,60)||!settings.shortcut.trim()||!Number.isInteger(settings.rest)||settings.rest<10||settings.rest>3600||!['system','local'].includes(settings.timerMode)||typeof settings.shortcutReady!=='boolean'||!['mapped','dynamic'].includes(settings.shortcutMode)||!settings.shortcuts||typeof settings.shortcuts!=='object'||Array.isArray(settings.shortcuts))fail();
  const shortcuts={};for(const [seconds,name] of Object.entries(settings.shortcuts)){if(!/^(?:[1-9]\d{1,3})$/.test(seconds)||Number(seconds)>3600||!str(name,60))fail();if(name.trim())shortcuts[seconds]=name.trim();}settings.shortcuts=shortcuts;
  return {schemaVersion:1,exercises:d.exercises.map(e=>({id:e.id,name:e.name,mode:e.mode})),sessions:d.sessions.map(s=>({...s,entries:s.entries.map(e=>({...e,note:e.note||''}))})),activeSessionId:ss.has(d.activeSessionId)?d.activeSessionId:null,settings,timer:d.timer&&Number.isFinite(d.timer.end)&&Number.isFinite(d.timer.duration)&&d.timer.duration>=10&&d.timer.duration<=3600?{end:d.timer.end,duration:d.timer.duration}:null};
}
export function demoState(){
 const d=fresh();d.exercises=[{id:'pull',name:'高位下拉',mode:'total'},{id:'curl',name:'哑铃交替弯举',mode:'unilateral'}];
 const prior={...makeSession('2026-11-12','背 + 二头'),status:'finished',createdAt:1,entries:[{id:uid(),exerciseId:'pull',mode:'total',rest:90,note:'',sets:[10,10,8].map(r=>({...makeSet(40,r),done:true}))}]};
 const curr={...makeSession('2026-11-17','背 + 二头'),createdAt:2,entries:[{id:uid(),exerciseId:'pull',mode:'total',rest:90,note:'',sets:[12,10,9].map(r=>({...makeSet(40,r),done:true})).concat(makeSet(40))},{id:uid(),exerciseId:'curl',mode:'unilateral',rest:90,note:'',sets:[makeSet(10)]}]};d.sessions=[prior,curr];d.activeSessionId=curr.id;return d;
}
