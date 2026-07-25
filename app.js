/* ================= DATA ================= */
/* ====== KONFIGURASI SUPABASE — GANTI DUA NILAI DI BAWAH ====== */
const SUPABASE_URL='https://pmnfsvkthvlvlidhlmes.supabase.co';        /* cth: https://abcdefgh.supabase.co */
const SUPABASE_ANON_KEY='sb_publishable_MrR16vXo0iwYPS6evo_FzA_-H-26aLK';
/* ============================================================== */
const CONFIGURED = typeof window.supabase!=='undefined' && !SUPABASE_URL.includes('GANTI');
const sb = CONFIGURED? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const ADMIN_EMAIL='arifhr24@gmail.com';
let USER=null;
let KEY='amplop_local';
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

const seed={
  wallets:[
    {id:'w1', name:'Bank Utama', type:'Bank', open:0},
    {id:'w2', name:'Tunai', type:'Tunai', open:0},
    {id:'w3', name:'E-Wallet', type:'E-Wallet', open:0}
  ],
  envelopes:[
    {id:'e1', em:'🍚', name:'Makan'},
    {id:'e2', em:'🏠', name:'Rumah & Tagihan'},
    {id:'e3', em:'🚌', name:'Transportasi'},
    {id:'e4', em:'🛒', name:'Belanja'},
    {id:'e5', em:'🎮', name:'Hiburan'},
    {id:'e6', em:'💊', name:'Kesehatan'},
    {id:'e7', em:'💝', name:'Sosial & Hadiah'},
    {id:'e8', em:'🐖', name:'Tabungan'}
  ],
  allocations:{},   /* {periodKey: {envId: amount}} — periodKey="2026-07" (kalender) atau "2026-06-25" (siklus custom) */
  txns:[],          /* {id, type:'in'|'out'|'tf', date, desc, amount, walletId, toWalletId, envId} */
  bills:[],         /* {id, name, amount, dueDay, envId, walletId, lastPaid:"2026-07"} */
  settings:{cycleStartDay:1},  /* 1 = ikut bulan kalender (default/perilaku lama) */
  debts:[]          /* {id, name, provider, installmentAmount, totalInstallments, paidInstallments,
                        dueDay, walletId, createdAt, done, lastPaid:"2026-07"} */
};

let DB, localT=0;
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    const p= raw? JSON.parse(raw) : null;
    if(p && p.wallets){ DB=p; localT=0; }        /* migrasi format lama */
    else if(p && p.v){ DB=p.v; localT=p.t||0; }
    else { DB=structuredClone(seed); localT=0; }
  }catch(e){ DB=structuredClone(seed); localT=0; }
}
function persistLocal(){ localT=Date.now(); localStorage.setItem(KEY, JSON.stringify({v:DB, t:localT})); }
function save(){
  try{ persistLocal(); }catch(e){ toast('Gagal menyimpan data'); }
  schedulePush();
}

function ensureSchema(){
  /* backward compat: user lama tidak punya field baru — jangan sampai crash */
  DB.settings ??= {};
  DB.settings.cycleStartDay = Math.min(28, Math.max(1, Number(DB.settings.cycleStartDay) || 1));
  DB.settings.dismissedSeasonal ??= {};
  DB.settings.hideBalance ??= false;
  DB.debts ??= [];
}

/* ================= FITUR: SIKLUS GAJIAN ================= */
const mkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const NOWKEY=()=>{ const n=new Date(); return mkey(new Date(n.getFullYear(), n.getMonth(), 1)); };

function cycleStartDay(){ return DB.settings?.cycleStartDay || 1; }
function periodStartFor(date, csd){
  if(csd===1) return new Date(date.getFullYear(), date.getMonth(), 1);
  if(date.getDate()>=csd) return new Date(date.getFullYear(), date.getMonth(), csd);
  return new Date(date.getFullYear(), date.getMonth()-1, csd);
}
/* getPeriod(offset=0): periode ke-N relatif dari periode berjalan (0=sekarang, -1=lalu, +1=depan)
   getPeriod(Date): periode yang memuat tanggal itu — keduanya balikin {start,end,key,label,shortLabel} */
function getPeriod(dateOrOffset){
  const csd=cycleStartDay();
  let start;
  if(dateOrOffset instanceof Date){
    start=periodStartFor(dateOrOffset, csd);
  } else {
    const offset=dateOrOffset||0;
    const base=periodStartFor(new Date(), csd);
    start=new Date(base.getFullYear(), base.getMonth()+offset, base.getDate());
  }
  const end=new Date(start.getFullYear(), start.getMonth()+1, csd-1);
  const key= csd===1 ? mkey(start) : ymd(start);
  const label= csd===1
    ? MONTHS[start.getMonth()]+' '+start.getFullYear()
    : start.getDate()+' '+MONTHS[start.getMonth()].slice(0,3)+' – '+end.getDate()+' '+MONTHS[end.getMonth()].slice(0,3);
  const shortLabel= csd===1 ? MONTHS[start.getMonth()].slice(0,3) : start.getDate()+' '+MONTHS[start.getMonth()].slice(0,3);
  return {start, end, key, label, shortLabel};
}
function periodOffsetForDate(dateStr){
  const csd=cycleStartDay();
  const d=new Date(dateStr+'T00:00');
  const target=periodStartFor(d, csd);
  const cur=periodStartFor(new Date(), csd);
  return (target.getFullYear()-cur.getFullYear())*12 + (target.getMonth()-cur.getMonth());
}

let periodOffset=0;
function shiftMonth(n){ periodOffset+=n; render(); }

function setCycleStartDay(day){
  day=Math.min(28, Math.max(1, Number(day)||1));
  DB.settings.cycleStartDay=day; periodOffset=0; save(); render();
}
function changeCycleFromSettings(day){
  day=Math.min(28, Math.max(1, Number(day)||1));
  const oldDay=cycleStartDay();
  if(day===oldDay){ renderSettings(); return; }
  if(!confirm('Ganti tanggal mulai periode ke tanggal '+day+'? Pengelompokan amplop, laporan, dan "aman dipakai per hari" akan mengikuti periode baru ini mulai sekarang (transaksi lama tidak berubah).')){
    renderSettings(); return;
  }
  setCycleStartDay(day);
  toast('Periode gajian diperbarui ✓');
}
function showCycleCustom(){
  document.getElementById('cycle-custom-wrap').style.display='block';
  document.getElementById('cycle-custom-input').focus();
}

/* ================= HELPERS ================= */
const rp=n=>'Rp'+Math.round(n||0).toLocaleString('id-ID');
const rpS=n=>(n<0?'−':'')+'Rp'+Math.abs(Math.round(n||0)).toLocaleString('id-ID');
function fmtInput(el){ const v=el.value.replace(/[^\d]/g,''); el.value=v?Number(v).toLocaleString('id-ID'):''; }
const parseAmt=s=>Number(String(s).replace(/[^\d]/g,''))||0;
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); }
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const envById=id=>DB.envelopes.find(e=>e.id===id);
const walletById=id=>DB.wallets.find(w=>w.id===id);
function allocOf(key){ if(!DB.allocations[key]) DB.allocations[key]={}; return DB.allocations[key]; }
const sum=o=>Object.values(o||{}).reduce((a,b)=>a+(Number(b)||0),0);
const txnsOf=period=>{ const s=ymd(period.start), e=ymd(period.end); return DB.txns.filter(t=>t.date && t.date>=s && t.date<=e); };

function walletBalance(id){
  const w=walletById(id); if(!w) return 0;
  let b=w.open||0;
  DB.txns.forEach(t=>{
    if(t.type==='in' && t.walletId===id) b+=t.amount;
    if(t.type==='out'&& t.walletId===id) b-=t.amount;
    if(t.type==='tf'){ if(t.walletId===id) b-=t.amount; if(t.toWalletId===id) b+=t.amount; }
  });
  return b;
}
function spentByEnv(period){ const m={}; txnsOf(period).forEach(t=>{ if(t.type==='out'&&t.envId) m[t.envId]=(m[t.envId]||0)+t.amount; }); return m; }
function totIn(period){ return txnsOf(period).filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0); }
function totOut(period){ return txnsOf(period).filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0); }

/* ================= NAV ================= */
function go(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.nav-item[data-page],.bnav-item[data-page]').forEach(x=>x.classList.toggle('active', x.dataset.page===p));
  const tp=document.getElementById('topbar-period');
  if(tp){
    tp.style.display=['home','txns','env','report'].includes(p)?'flex':'none';
    tp.classList.remove('open');
    const pcb=document.getElementById('period-compact-btn'); if(pcb) pcb.setAttribute('aria-expanded','false');
  }
  window.scrollTo({top:0}); render();
}
function setTopbarPeriod(period){
  document.getElementById('topbar-period-label').textContent=period.label;
  document.getElementById('topbar-period-compact').textContent=period.shortLabel;
}
function togglePeriodPopover(){
  const tp=document.getElementById('topbar-period');
  const willOpen=!tp.classList.contains('open');
  tp.classList.toggle('open', willOpen);
  document.getElementById('period-compact-btn').setAttribute('aria-expanded', String(willOpen));
}
document.addEventListener('click', e=>{
  const tp=document.getElementById('topbar-period');
  if(tp && tp.classList.contains('open') && !tp.contains(e.target)){
    tp.classList.remove('open');
    const btn=document.getElementById('period-compact-btn'); if(btn) btn.setAttribute('aria-expanded','false');
  }
});

/* ================= HOME ================= */
function toggleBalanceHide(){
  DB.settings.hideBalance=!DB.settings.hideBalance;
  save(); render();
}
function renderHome(){
  const period=getPeriod(periodOffset), key=period.key, isCur=periodOffset===0;
  setTopbarPeriod(period);
  const total=DB.wallets.reduce((s,w)=>s+walletBalance(w.id),0);
  document.getElementById('h-balance').textContent= DB.settings.hideBalance? MASK_AMT : rpS(total);
  document.getElementById('balance-hide-btn').innerHTML= DB.settings.hideBalance? EYE_OFF_SVG : EYE_OPEN_SVG;
  document.getElementById('h-in').textContent= DB.settings.hideBalance? MASK_AMT : rp(totIn(period));
  document.getElementById('h-out').textContent= DB.settings.hideBalance? MASK_AMT : rp(totOut(period));

  /* sisa amplop & aman dipakai per hari (khusus periode berjalan) */
  const alloc=allocOf(key), spent=spentByEnv(period);
  let left=0;
  DB.envelopes.forEach(e=>{ const l=(alloc[e.id]||0)-(spent[e.id]||0); if(l>0) left+=l; });
  const now=new Date();
  const today=new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(isCur){
    const daysLeft=Math.round((period.end-today)/86400000)+1;
    document.getElementById('h-safe').textContent='Aman dipakai '+rp(left/daysLeft)+' /hari';
    document.getElementById('h-days').textContent=daysLeft+' hari tersisa periode ini';
    document.getElementById('h-recap-card').style.display= daysLeft<=3? 'block':'none';
  } else {
    document.getElementById('h-safe').textContent='Sisa amplop '+rp(left);
    document.getElementById('h-days').textContent= period.end<today? 'Periode sudah berlalu':'Periode mendatang';
    document.getElementById('h-recap-card').style.display='none';
  }

  /* saran amplop musiman (berdasar tanggal sungguhan hari ini, bukan periode yang lagi dilihat) */
  const seasonal=getSeasonalSuggestions();
  const seasonalCard=document.getElementById('h-seasonal-card');
  if(seasonal.length){
    seasonalCard.style.display='block';
    document.getElementById('h-seasonal-list').innerHTML=seasonal.map(s=>`
      <div class="strip">
        <span class="ic">${s.em}</span>
        <span class="txt">${esc(s.name)}<small>Tambahkan amplop musiman ini satu-tap</small></span>
        <button class="btn ghost sm" onclick="addSeasonalEnvelope('${s.key}','${s.em}','${esc(s.name)}')">Tambah</button>
        <button class="btn ghost sm" onclick="dismissSeasonal('${s.key}')" aria-label="Tutup">✕</button>
      </div>`).join('');
  } else {
    seasonalCard.style.display='none';
  }

  /* bills + cicilan mendesak: satu sistem pengingat, hanya relevan untuk periode berjalan */
  document.getElementById('h-bills-card').style.display= isCur? 'block':'none';
  const bl=document.getElementById('h-bills');
  const todayNum=now.getDate();
  const billItems=DB.bills.map(b=>{
    const paid=b.lastPaid===NOWKEY();
    const late=!paid && b.dueDay<todayNum;
    return {kind:'bill', b, paid, late, order: paid? 1000+b.dueDay : b.dueDay};
  });
  const debtItems=DB.debts.filter(d=>!d.done).map(d=>{
    const paid=d.lastPaid===NOWKEY();
    const late=!paid && d.dueDay<todayNum;
    const dueSoon=!paid && !late && (d.dueDay-todayNum)<=3 && (d.dueDay-todayNum)>=0;
    return {kind:'debt', d, paid, late, dueSoon, order: paid? 1000+d.dueDay : d.dueDay};
  }).filter(x=>x.late||x.dueSoon); /* beda dari tagihan: cicilan cuma tampil kalau H-3/telat, bukan semua */
  const items=[...billItems, ...debtItems].sort((a,z)=>a.order-z.order);
  if(!items.length){
    bl.innerHTML='<div class="empty"><b>Belum ada tagihan atau cicilan mendesak</b>Tambahkan tagihan rutin lewat ⚙️ Pengaturan, atau cicilan lewat tab 💳 Cicilan.</div>';
  } else {
    bl.innerHTML=items.map(item=>{
      if(item.kind==='bill'){
        const {b,paid,late}=item;
        return `<div class="bill-row ${paid?'paid':''} ${late?'late':''}">
          <div class="date-badge"><b class="num">${b.dueDay}</b><span>${late?'lewat':'tgl'}</span></div>
          <div class="bill-info"><b>${esc(b.name)}</b>
          <div class="sub">${rp(b.amount)} · ${esc(envById(b.envId)?.name||'-')} · ${esc(walletById(b.walletId)?.name||'-')}</div></div>
          ${paid? '<span class="tag paid">✓ Lunas</span>'
                : `<button class="btn ok sm" onclick="payBill('${b.id}')">Bayar</button>`}
        </div>`;
      }
      const {d,late}=item;
      return `<div class="bill-row ${late?'late':''}">
        <div class="date-badge"><b class="num">${d.dueDay}</b><span>${late?'lewat':'tgl'}</span></div>
        <div class="bill-info"><b>💳 ${esc(d.name)}</b>
        <div class="sub">${rp(d.installmentAmount)} · ${esc(d.provider)} · cicilan ke-${d.paidInstallments+1}/${d.totalInstallments}</div></div>
        <button class="btn ok sm" onclick="payDebt('${d.id}')">Bayar</button>
      </div>`;
    }).join('');
  }

  /* envelopes grid mengikuti bulan yang dilihat */
  const withData=DB.envelopes.filter(e=>(alloc[e.id]||0)>0 || (spent[e.id]||0)>0);
  const list=withData.length? withData : DB.envelopes;
  document.getElementById('h-env-sub').textContent=period.shortLabel;
  document.getElementById('h-envs').innerHTML=list.map(e=>{
    const a=alloc[e.id]||0, s=spent[e.id]||0, l=a-s;
    const over=l<0, habis=!over && a>0 && s>=a;
    const pct=a>0? Math.min(Math.round(s/a*100),100) : (s>0?100:0);
    const meterClass= over? 'full' : (pct<40? 'low':'');
    const footLeft= over? 'melebihi jatah' : ('terpakai '+pct+'%');
    const footRight= over? 'over' : habis? 'habis' : ('sisa '+(100-pct)+'%');
    return `<div class="env-card ${over?'over':''}" onclick="openEnvTxModal('${e.id}')">
      <div class="env-flap"></div><div class="env-seal">${esc(e.em)}</div>
      <div class="env-name">${esc(e.name)}</div>
      <div class="env-left num ${over?'neg':''}">${rpS(l)}</div>
      <div class="env-of">dari ${rp(a)}${a===0? ' · tidak dianggarkan':''}</div>
      <div class="meter"><i class="${meterClass}" style="width:${pct}%"></i></div>
      <div class="env-foot"><span>${footLeft}</span><span class="pct">${footRight}</span></div>
    </div>`;
  }).join('');
}
function payBill(id){
  const b=DB.bills.find(x=>x.id===id); if(!b) return;
  if(!confirm('Catat pembayaran "'+b.name+'" sebesar '+rp(b.amount)+'?')) return;
  const now=new Date();
  DB.txns.push({id:uid(), type:'out', date:now.toISOString().slice(0,10),
    desc:b.name, amount:b.amount, walletId:b.walletId, envId:b.envId});
  b.lastPaid=NOWKEY();
  save(); render(); toast('Tagihan dicatat lunas ✓');
}

/* ================= FITUR: CICILAN & PAYLATER ================= */
function ensureCicilanEnvelope(){
  let e=DB.envelopes.find(x=>x.name.toLowerCase()==='cicilan');
  if(!e){ e={id:uid(), em:'💳', name:'Cicilan'}; DB.envelopes.push(e); }
  return e;
}
function renderDebts(){
  const active=DB.debts.filter(d=>!d.done);
  const done=DB.debts.filter(d=>d.done);
  const totalBeban=active.reduce((s,d)=>s+d.installmentAmount,0);
  const income=totIn(getPeriod(0));
  const pct=income>0? Math.round(totalBeban/income*100) : 0;
  document.getElementById('debt-total').textContent=rp(totalBeban);
  const pctEl=document.getElementById('debt-pct');
  if(pctEl){
    pctEl.innerHTML = active.length
      ? (income>0? pct+'% dari pemasukan periode ini':'')
        + (pct>30? '<br><span style="color:var(--clay)">⚠️ Rasio cicilanmu cukup tinggi — coba jaga di bawah 30% dari pemasukan.</span>':'')
      : 'Belum ada cicilan aktif.';
  }
  const list=document.getElementById('debt-list');
  if(!list) return;
  if(!active.length && !done.length){
    list.innerHTML='<div class="card"><div class="empty"><b>Belum ada cicilan tercatat</b>Tambahkan SPayLater, Kredivo, atau cicilan lain lewat tombol di atas.</div></div>';
    return;
  }
  const now=new Date(), todayNum=now.getDate();
  const activeCards=active.map(d=>{
    const pctBar=Math.min(d.paidInstallments/d.totalInstallments*100,100);
    const paid=d.lastPaid===NOWKEY();
    const late=!paid && d.dueDay<todayNum;
    const dueSoon=!paid && !late && (d.dueDay-todayNum)<=3 && (d.dueDay-todayNum)>=0;
    const tag= late? '<span class="tag late">Terlambat</span>'
      : dueSoon? '<span class="tag due">Segera jatuh tempo</span>'
      : paid? '<span class="tag paid">✓ Lunas bulan ini</span>' : '';
    const meterCls= late? 'full' : (pctBar<40? 'low':'');
    return `<div class="card loan-card" onclick="openDebtModal('${d.id}')">
      <div class="loan-head">
        <div><b>${esc(d.name)}</b><div class="sub">${esc(d.provider)} · ${esc(walletById(d.walletId)?.name||'-')}</div></div>
        <div style="display:flex; align-items:center; gap:6px">
          ${tag}
          <div class="mini-act"><button onclick="event.stopPropagation();quickDeleteDebt('${d.id}')" aria-label="Hapus cicilan" title="Hapus cicilan">${ICON_DELETE_SVG}</button></div>
        </div>
      </div>
      <div class="meter" style="margin-top:16px"><i class="${meterCls}" style="width:${pctBar}%"></i></div>
      <div class="loan-meta"><span>${d.paidInstallments}/${d.totalInstallments} terbayar · jatuh tempo tiap tgl ${d.dueDay}</span>
        <b>${rp(d.installmentAmount)} /bln</b></div>
      ${paid? '' : `<div style="margin-top:12px; text-align:right"><button class="btn ok sm" onclick="event.stopPropagation();payDebt('${d.id}')">Bayar</button></div>`}
    </div>`;
  }).join('');
  const activeHtml = active.length? `<div class="loan-grid">${activeCards}</div>` : '';
  const doneHtml = done.length? `<div class="card" style="margin-top:16px">
    <h2 style="font-size:14px">✅ Cicilan Selesai (${done.length})</h2>
    ${done.map(d=>`<div class="list-item" style="cursor:pointer" onclick="openDebtModal('${d.id}')">
      <div class="grow"><div class="t1">${esc(d.name)}</div><div class="t2">${esc(d.provider)} · lunas ${d.totalInstallments}x</div></div>
    </div>`).join('')}
  </div>` : '';
  list.innerHTML = activeHtml + doneHtml;
}
function openDebtModal(id=''){
  document.getElementById('db-edit-id').value=id;
  const d=id? DB.debts.find(x=>x.id===id) : {name:'',provider:'SPayLater',installmentAmount:'',totalInstallments:'',paidInstallments:0,dueDay:'',walletId:DB.wallets[0]?.id};
  document.getElementById('debt-modal-title').firstChild.textContent=id?'Edit Cicilan ':'Cicilan Baru ';
  document.getElementById('dbf-nm').value=d.name||'';
  document.getElementById('dbf-provider').value=d.provider||'SPayLater';
  document.getElementById('dbf-amt').value=d.installmentAmount? Number(d.installmentAmount).toLocaleString('id-ID'):'';
  document.getElementById('dbf-total').value=d.totalInstallments||'';
  document.getElementById('dbf-paid').value=d.paidInstallments||0;
  document.getElementById('dbf-due').value=d.dueDay||'';
  document.getElementById('dbf-wallet').innerHTML=DB.wallets.map(w=>`<option value="${w.id}" ${d.walletId===w.id?'selected':''}>${esc(w.name)}</option>`).join('');
  document.getElementById('dbf-del').style.display=id?'inline-flex':'none';
  document.getElementById('debt-modal').classList.add('open');
}
function saveDebt(){
  const name=document.getElementById('dbf-nm').value.trim();
  const provider=document.getElementById('dbf-provider').value;
  const installmentAmount=parseAmt(document.getElementById('dbf-amt').value);
  const totalInstallments=Number(document.getElementById('dbf-total').value)||0;
  const paidInstallments=Math.min(totalInstallments, Math.max(0, Number(document.getElementById('dbf-paid').value)||0));
  const dueDay=Math.min(28, Math.max(1, Number(document.getElementById('dbf-due').value)||0));
  const walletId=document.getElementById('dbf-wallet').value;
  if(!name||!installmentAmount||!totalInstallments||!dueDay){ toast('Nama, nominal, jumlah cicilan, dan tanggal wajib diisi'); return; }
  const id=document.getElementById('db-edit-id').value;
  const data={name, provider, installmentAmount, totalInstallments, paidInstallments, dueDay, walletId, done: paidInstallments>=totalInstallments};
  if(id){ Object.assign(DB.debts.find(x=>x.id===id), data); }
  else {
    ensureCicilanEnvelope();
    /* kalau saat dibuat sudah ada cicilan yang terbayar DAN tanggal jatuh
       tempo bulan ini sudah lewat, anggap pembayaran periode ini sudah
       termasuk yang disetel di "Sudah Terbayar" — supaya tidak perlu klik
       Bayar lagi (yang akan keliru menambah hitungan jadi dobel). */
    const alreadyPaidThisPeriod = paidInstallments>0 && dueDay<new Date().getDate();
    DB.debts.push({id:uid(), ...data, createdAt:new Date().toISOString(), lastPaid: alreadyPaidThisPeriod? NOWKEY() : ''});
  }
  save(); closeModal('debt-modal'); render(); toast('Cicilan disimpan ✓');
}
function removeDebt(id){
  DB.debts=DB.debts.filter(d=>d.id!==id);
  DB.txns=DB.txns.filter(t=>t.debtId!==id);
  save(); render(); toast('Cicilan & transaksi pembayarannya dihapus');
}
function deleteDebt(){
  const id=document.getElementById('db-edit-id').value;
  if(!id||!confirm('Hapus cicilan ini? Transaksi pembayaran yang sudah tercatat lewat cicilan ini akan ikut terhapus.')) return;
  closeModal('debt-modal'); removeDebt(id);
}
function quickDeleteDebt(id){
  if(!confirm('Hapus cicilan ini? Transaksi pembayaran yang sudah tercatat lewat cicilan ini akan ikut terhapus.')) return;
  removeDebt(id);
}
function payDebt(id){
  const d=DB.debts.find(x=>x.id===id); if(!d||d.done) return;
  if(!confirm('Catat pembayaran cicilan "'+d.name+'" sebesar '+rp(d.installmentAmount)+'?')) return;
  const now=new Date();
  const envId=ensureCicilanEnvelope().id;
  DB.txns.push({id:uid(), type:'out', date:now.toISOString().slice(0,10),
    desc:d.name, amount:d.installmentAmount, walletId:d.walletId, envId, debtId:id});
  d.paidInstallments++;
  d.lastPaid=NOWKEY();
  const justFinished = d.paidInstallments>=d.totalInstallments;
  if(justFinished) d.done=true;
  save(); render();
  toast(justFinished? '🎉 Cicilan lunas!' : 'Pembayaran cicilan dicatat ✓');
}

/* ================= TRANSAKSI ================= */
let txFilter='all';
function renderTxns(){
  const period=getPeriod(periodOffset);
  setTopbarPeriod(period);

  const dateFrom=document.getElementById('tx-date-from').value;
  const dateTo=document.getElementById('tx-date-to').value;
  const rangeActive=!!(dateFrom||dateTo);
  const txRangeLabel=document.getElementById('tx-range-label');
  if(txRangeLabel) txRangeLabel.textContent= dateFrom&&dateTo? fmtIdDate(dateFrom)+' – '+fmtIdDate(dateTo)
    : dateFrom? 'Sejak '+fmtIdDate(dateFrom) : dateTo? 'S.d. '+fmtIdDate(dateTo) : 'Semua Tanggal';

  const envSelect=document.getElementById('tx-env-filter');
  const prevEnvVal=envSelect.value;
  envSelect.innerHTML='<option value="">Semua Amplop</option>'
    + DB.envelopes.map(e=>`<option value="${e.id}">${esc(e.em)} ${esc(e.name)}</option>`).join('');
  envSelect.value= DB.envelopes.some(e=>e.id===prevEnvVal)? prevEnvVal : '';
  const envFilterId=envSelect.value;

  const F=[['all','Semua'],['out','Keluar'],['in','Masuk'],['tf','Transfer']];
  document.getElementById('tx-type-filters').innerHTML=F.map(([v,l])=>
    `<button class="filter ${txFilter===v?'active':''}" onclick="txFilter='${v}';renderTxns()">${l}</button>`).join('');

  let list= rangeActive
    ? DB.txns.filter(t=>t.date && (!dateFrom||t.date>=dateFrom) && (!dateTo||t.date<=dateTo))
    : txnsOf(period);
  list=list.sort((a,b)=>b.date.localeCompare(a.date));
  if(txFilter!=='all') list=list.filter(t=>t.type===txFilter);
  if(envFilterId) list=list.filter(t=>t.envId===envFilterId);
  const q=(document.getElementById('tx-search').value||'').toLowerCase().trim();
  if(q) list=list.filter(t=>
    (t.desc||'').toLowerCase().includes(q) ||
    (envById(t.envId)?.name||'').toLowerCase().includes(q) ||
    (walletById(t.walletId)?.name||'').toLowerCase().includes(q) ||
    (walletById(t.toWalletId)?.name||'').toLowerCase().includes(q));
  const el=document.getElementById('tx-list');
  if(!list.length){ el.innerHTML='<div class="card"><div class="empty"><b>'+(q?'Tidak ada hasil':'Belum ada transaksi')+'</b>'+(q?'Coba kata kunci lain.':'Tekan ＋ untuk mencatat.')+'</div></div>'; return; }
  const now=new Date(), todayStr=ymd(now), yestStr=ymd(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1));
  const groups=[];
  list.forEach(t=>{
    const last=groups[groups.length-1];
    if(last && last.date===t.date) last.items.push(t); else groups.push({date:t.date, items:[t]});
  });
  el.innerHTML=groups.map(g=>{
    const d=new Date(g.date+'T00:00'), dm=d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3);
    const label= g.date===todayStr? 'Hari ini · '+dm : g.date===yestStr? 'Kemarin · '+dm : dm;
    const rows=g.items.map(t=>{
      const ic=t.type==='in'?'💰':t.type==='tf'?'🔁':(envById(t.envId)?.em||'🧾');
      const sign=t.type==='in'?'+':t.type==='tf'?'':'−';
      let sub='';
      if(t.type==='out') sub=(envById(t.envId)?.name||'Tanpa amplop')+' · '+(walletById(t.walletId)?.name||'-');
      if(t.type==='in')  sub=(walletById(t.walletId)?.name||'-');
      if(t.type==='tf')  sub=(walletById(t.walletId)?.name||'-')+' → '+(walletById(t.toWalletId)?.name||'-');
      return `<div class="tx-row" style="cursor:pointer" onclick="openTxnModal('${t.id}')">
        <div class="tx-ico ${t.type==='in'?'in':''}">${ic}</div>
        <div class="tx-info"><b>${esc(t.desc||'(tanpa keterangan)')}</b><span>${esc(sub)}</span></div>
        <div class="tx-amt ${t.type==='in'?'in':'out'} num">${sign}${rp(t.amount)}</div>
        <button class="tx-del" onclick="event.stopPropagation();delTxn('${t.id}')" aria-label="Hapus">${ICON_DELETE_SVG}</button>
      </div>`;
    }).join('');
    return `<div class="tx-day">${esc(label)}</div><div class="card">${rows}</div>`;
  }).join('');
}
function delTxn(id){ if(!confirm('Hapus transaksi ini?')) return; DB.txns=DB.txns.filter(t=>t.id!==id); save(); render(); toast('Dihapus'); }

/* ================= AMPLOP ================= */
function renderEnv(){
  const period=getPeriod(periodOffset), key=period.key, alloc=allocOf(key), spent=spentByEnv(period);
  setTopbarPeriod(period);
  document.getElementById('ev-rows').innerHTML=DB.envelopes.map(e=>{
    const v=alloc[e.id]? Number(alloc[e.id]).toLocaleString('id-ID'):'';
    return `<div class="alloc-row">
      <div class="name"><i>${esc(e.em)}</i>${esc(e.name)}</div>
      <input inputmode="numeric" class="alloc-input num ${v?'':'zero'}" value="${v}" placeholder="0"
        oninput="fmtInput(this)" onchange="setAlloc('${e.id}',this.value)">
      <div class="mini-act">
        <button onclick="openEnvModal('${e.id}')" aria-label="Edit amplop">${ICON_EDIT_SVG}</button>
        <button onclick="quickDeleteEnv('${e.id}')" aria-label="Hapus amplop">${ICON_DELETE_SVG}</button>
      </div>
      </div>`;
  }).join('');
  const totalAlloc=sum(alloc), income=totIn(period), unalloc=income-totalAlloc;
  document.getElementById('ev-total').textContent=rp(totalAlloc);
  document.getElementById('ev-income').textContent=rp(income);
  document.getElementById('ev-unalloc').textContent=rpS(unalloc);
  document.getElementById('ev-unalloc-cell').className='cell'+(unalloc<0?' warn':unalloc>0?' ok':'');

  const rows=DB.envelopes.filter(e=>(alloc[e.id]||0)>0||(spent[e.id]||0)>0);
  const ul=document.getElementById('ev-usage');
  if(!rows.length){ ul.innerHTML='<div class="empty"><b>Amplop masih kosong</b>Isi nominal di atas, progres pemakaiannya muncul di sini.</div>'; }
  else ul.innerHTML=rows.map(e=>{
    const a=alloc[e.id]||0, s=spent[e.id]||0;
    const pct=a>0? Math.min(s/a*100,100):(s>0?100:0);
    const over=a>0&&s>a, habis=!over&&pct>=100;
    const cls=over?'over':(habis?'warn':'');
    return `<div class="env-usage-row"><div class="env-usage-head"><b>${esc(e.em)} ${esc(e.name)}</b>
      <span class="amt num ${over?'over':''}">${rp(s)} <small>/ ${rp(a)}</small></span></div>
      <div class="env-usage-bar"><i class="${cls}" style="width:${pct}%"></i></div></div>`;
  }).join('');
}
function setAlloc(id,val){ const a=allocOf(getPeriod(periodOffset).key); const n=parseAmt(val); if(n===0) delete a[id]; else a[id]=n; save(); renderEnv(); renderHome(); }
function copyPrevAlloc(){
  const curPeriod=getPeriod(periodOffset), prevPeriod=getPeriod(periodOffset-1);
  const pa=DB.allocations[prevPeriod.key];
  if(!pa||!sum(pa)){ toast('Tidak ada isi amplop periode lalu'); return; }
  if(!confirm('Salin isi amplop '+prevPeriod.label+'? Nilai periode ini akan ditimpa.')) return;
  DB.allocations[curPeriod.key]=structuredClone(pa); save(); render(); toast('Disalin ✓');
}
function openMoveModal(){
  if(DB.envelopes.length<2){ toast('Butuh minimal 2 amplop'); return; }
  const opts=DB.envelopes.map(e=>`<option value="${e.id}">${esc(e.em)} ${esc(e.name)}</option>`).join('');
  document.getElementById('mvf-from').innerHTML=opts;
  document.getElementById('mvf-to').innerHTML=opts;
  document.getElementById('mvf-to').selectedIndex=1;
  document.getElementById('mvf-amt').value='';
  document.getElementById('move-modal').classList.add('open');
}
function saveMove(){
  const from=document.getElementById('mvf-from').value;
  const to=document.getElementById('mvf-to').value;
  const amt=parseAmt(document.getElementById('mvf-amt').value);
  if(from===to){ toast('Amplop asal dan tujuan sama'); return; }
  if(!amt){ toast('Nominal wajib diisi'); return; }
  const a=allocOf(getPeriod(periodOffset).key);
  if((a[from]||0)<amt){ toast('Isi amplop asal tidak cukup ('+rp(a[from]||0)+')'); return; }
  a[from]-=amt; if(a[from]===0) delete a[from];
  a[to]=(a[to]||0)+amt;
  save(); closeModal('move-modal'); render(); toast('Dana dipindahkan ✓');
}
function openEnvModal(id=''){
  document.getElementById('ev-edit-id').value=id;
  const e=id? envById(id):{em:'',name:''};
  document.getElementById('env-modal-title').firstChild.textContent=id?'Edit Amplop ':'Amplop Baru ';
  document.getElementById('evf-em').value=e.em||'';
  document.getElementById('evf-nm').value=e.name||'';
  document.getElementById('evf-del').style.display=id?'inline-flex':'none';
  document.getElementById('env-modal').classList.add('open');
}
function saveEnv(){
  const name=document.getElementById('evf-nm').value.trim();
  if(!name){ toast('Nama amplop wajib diisi'); return; }
  const em=document.getElementById('evf-em').value.trim()||'✉️';
  const id=document.getElementById('ev-edit-id').value;
  if(id){ const e=envById(id); e.name=name; e.em=em; } else DB.envelopes.push({id:uid(), em, name});
  save(); closeModal('env-modal'); render(); toast('Amplop disimpan ✓');
}
function removeEnvelope(id){
  DB.envelopes=DB.envelopes.filter(e=>e.id!==id);
  Object.values(DB.allocations).forEach(a=>delete a[id]);
  save(); render(); toast('Amplop dihapus');
}
function deleteEnv(){
  const id=document.getElementById('ev-edit-id').value;
  if(!id||!confirm('Hapus amplop ini? Transaksi lama tetap tersimpan.')) return;
  closeModal('env-modal'); removeEnvelope(id);
}
function quickDeleteEnv(id){
  if(!confirm('Hapus amplop ini? Transaksi lama tetap tersimpan.')) return;
  removeEnvelope(id);
}

/* ================= LAPORAN ================= */
function renderReport(){
  const period=getPeriod(periodOffset), isCur=periodOffset===0;
  setTopbarPeriod(period);
  const hide=DB.settings.hideBalance;
  document.getElementById('report-hide-btn').innerHTML= hide? EYE_OFF_SVG : EYE_OPEN_SVG;
  const tin=totIn(period), tout=totOut(period), net=tin-tout;
  document.getElementById('rp-in').textContent= hide? MASK_AMT : rp(tin);
  document.getElementById('rp-out').textContent= hide? MASK_AMT : rp(tout);
  const netEl=document.getElementById('rp-net');
  netEl.textContent= hide? MASK_AMT : rpS(net); netEl.className='v num '+(net<0?'neg':'pos');
  const dim=Math.round((period.end-period.start)/86400000)+1;
  const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const div=isCur? Math.round((today-period.start)/86400000)+1 : dim;
  document.getElementById('rp-avg').textContent= hide? MASK_AMT : rp(tout/Math.max(div,1));

  const spent=spentByEnv(period);
  const rows=DB.envelopes.filter(e=>spent[e.id]>0).sort((a,b)=>spent[b.id]-spent[a.id]);
  const max=Math.max(...rows.map(e=>spent[e.id]),1);
  const el=document.getElementById('rp-envs');
  if(!rows.length){ el.innerHTML='<div class="empty"><b>Belum ada pengeluaran</b>Grafik muncul setelah ada transaksi keluar.</div>'; }
  else el.innerHTML=rows.map(e=>`<div class="env-usage-row" style="cursor:pointer" onclick="openEnvTxModal('${e.id}')"><div class="env-usage-head"><b>${esc(e.em)} ${esc(e.name)}</b>
    <span class="amt num">${rp(spent[e.id])}</span></div>
    <div class="env-usage-bar"><i style="width:${spent[e.id]/max*100}%"></i></div></div>`).join('');

  /* 6-periode trend */
  const cols=[];
  for(let i=5;i>=0;i--){
    const p=getPeriod(periodOffset-i);
    cols.push({m:p.shortLabel, in:totIn(p), out:totOut(p)});
  }
  const tmax=Math.max(...cols.flatMap(c=>[c.in,c.out]),1);
  document.getElementById('rp-trend').innerHTML=cols.map(c=>
    `<div class="cash-col"><div class="cash-bars">
      <i class="in" style="height:${Math.max(c.in/tmax*100,3)}%" title="${rp(c.in)}"></i>
      <i class="out" style="height:${Math.max(c.out/tmax*100,3)}%" title="${rp(c.out)}"></i></div>
      <span>${c.m}</span></div>`).join('');

  document.getElementById('rp-wallets').innerHTML=DB.wallets.map(w=>{
    const b=walletBalance(w.id);
    return `<div class="wallet-row"><div class="w"><b>${esc(w.name)}</b><span>${esc(w.type)}</span></div>
      <div class="amt num ${b===0?'zero':b<0?'neg':''}">${rpS(b)}</div></div>`;
  }).join('');
}
function openEnvTxModal(envId){
  const e=envById(envId); if(!e) return;
  const period=getPeriod(periodOffset);
  document.getElementById('envtx-modal-title').textContent=e.em+' '+e.name;
  const list=txnsOf(period).filter(t=>t.envId===envId && t.type==='out').sort((a,b)=>b.date.localeCompare(a.date));
  const el=document.getElementById('envtx-list');
  if(!list.length){
    el.innerHTML='<div class="empty"><b>Belum ada transaksi</b>Belum ada pengeluaran dari amplop ini periode ini.</div>';
  } else {
    const total=list.reduce((s,t)=>s+t.amount,0);
    const summary=`<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; padding:0 2px">
      <span style="font-size:12.5px; color:var(--muted); font-weight:600">${list.length} transaksi</span>
      <span class="num" style="font-weight:700; font-size:17px; color:var(--ink)">${rp(total)}</span>
    </div>`;
    el.innerHTML=summary+'<div class="card">'+list.map(t=>{
      const d=new Date(t.date+'T00:00'), dm=d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3);
      return `<div class="tx-row">
        <div class="tx-ico">${esc(e.em)}</div>
        <div class="tx-info"><b>${esc(t.desc||'(tanpa keterangan)')}</b><span>${dm} · ${esc(walletById(t.walletId)?.name||'-')}</span></div>
        <div class="tx-amt out num">−${rp(t.amount)}</div>
      </div>`;
    }).join('')+'</div>';
  }
  document.getElementById('envtx-modal').classList.add('open');
}

/* ================= FITUR: REKAP PERIODE SHAREABLE ================= */
const rpFmt=n=>'Rp'+Math.round(n||0).toLocaleString('id-ID');
const MASK_AMT='Rp *****';
let recapHidden=false;
function toggleRecapHide(){
  recapHidden=!recapHidden;
  document.getElementById('recap-hide-btn').innerHTML= recapHidden? EYE_OFF_SVG : EYE_OPEN_SVG;
  drawRecapCard();
}
function openRecapModal(){
  recapHidden=false;
  document.getElementById('recap-hide-btn').innerHTML=EYE_OPEN_SVG;
  const shareBtn=document.getElementById('recap-share-btn');
  shareBtn.style.display = (navigator.canShare && typeof File!=='undefined') ? 'inline-flex':'none';
  document.getElementById('recap-modal').classList.add('open');
  drawRecapCard();
}
async function drawRecapCard(){
  const canvas=document.getElementById('recap-canvas');
  const W=1080, H=1920;
  /* canvas fisik TETAP 1080x1920 (resolusi ekspor) — ditampilkan lebih kecil di
     modal lewat CSS, jadi selalu di-downscale (bukan di-upscale) sehingga tidak
     blur di layar apa pun, dan file yang diunduh tetap tajam 1080x1920 penuh. */
  canvas.width=W; canvas.height=H;
  const displayW=280, displayH=Math.round(displayW*H/W);
  canvas.style.width=displayW+'px'; canvas.style.height=displayH+'px';
  const ctx=canvas.getContext('2d');
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  paintRecap(ctx, W, H);
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function fitHeroText(ctx, text, cx, y, maxWidth){
  let size=128;
  ctx.font='800 '+size+'px "Poppins"';
  while(ctx.measureText(text).width>maxWidth && size>52){
    size-=6;
    ctx.font='800 '+size+'px "Poppins"';
  }
  ctx.textAlign='center';
  ctx.fillText(text, cx, y+size*0.35);
}
function drawStatBox(ctx,x,y,w,h,label,value,accent){
  roundRect(ctx,x,y,w,h,20); ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fill();
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.font='700 24px Poppins, sans-serif'; ctx.fillStyle='rgba(255,255,255,.65)';
  ctx.fillText(label, x+28, y+50);
  ctx.font='800 44px "Poppins"'; ctx.fillStyle=accent;
  ctx.fillText(value, x+28, y+112);
}
function paintRecap(ctx, W, H){
  const hide=recapHidden;
  const period=getPeriod(periodOffset);
  const tin=totIn(period), tout=totOut(period), net=tin-tout;
  const spent=spentByEnv(period);
  const top3=DB.envelopes.map(e=>({e, amt:spent[e.id]||0})).filter(x=>x.amt>0).sort((a,z)=>z.amt-a.amt).slice(0,3);
  const daysRecorded=new Set(txnsOf(period).map(t=>t.date)).size;

  /* background navy/kraft khas brand */
  const grad=ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#232F66'); grad.addColorStop(1,'#3A4FA0');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

  /* motif flap amplop di header, senada dengan .hero::after di app */
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.lineTo(W/2,230); ctx.closePath(); ctx.fill();

  /* logo */
  ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  ctx.font='800 52px "Poppins"';
  ctx.fillStyle='#fff';
  ctx.fillText('✉️ Amplop', 64, 130);
  ctx.fillStyle='#C9822E';
  ctx.fillText('.', 64+ctx.measureText('✉️ Amplop').width, 130);

  /* pill nama periode */
  ctx.font='700 30px Poppins, sans-serif';
  const label=period.label;
  const padX=28, pillW=ctx.measureText(label).width+padX*2, pillH=56, pillY=170;
  roundRect(ctx, 64, pillY, pillW, pillH, 28);
  ctx.fillStyle='#C9822E'; ctx.fill();
  ctx.fillStyle='#fff'; ctx.textBaseline='middle';
  ctx.fillText(label, 64+padX, pillY+pillH/2+2);
  ctx.textBaseline='alphabetic';

  /* angka hero: selisih (dihemat/defisit) */
  const heroLabel = net>=0 ? 'BERHASIL DIHEMAT PERIODE INI' : 'DEFISIT PERIODE INI';
  ctx.font='700 30px Poppins, sans-serif';
  ctx.fillStyle='rgba(255,255,255,.65)';
  ctx.textAlign='center';
  ctx.fillText(heroLabel, W/2, 380);
  const heroValue = hide? MASK_AMT : rpFmt(Math.abs(net));
  ctx.fillStyle= net>=0 ? '#ffffff' : '#FF9E95';
  fitHeroText(ctx, heroValue, W/2, 480, W-120);

  /* dua kotak stat: masuk & keluar */
  const statY=600, statH=170, gap=32, statW=(W-128-gap)/2;
  drawStatBox(ctx, 64, statY, statW, statH, 'MASUK', hide? MASK_AMT : rpFmt(tin), '#7FE0B4');
  drawStatBox(ctx, 64+statW+gap, statY, statW, statH, 'KELUAR', hide? MASK_AMT : rpFmt(tout), '#F6B99A');

  /* top 3 amplop pengeluaran */
  let y=statY+statH+70;
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.font='700 34px "Poppins"'; ctx.fillStyle='#fff';
  ctx.fillText('Top Amplop Pengeluaran', 64, y);
  y+=50;
  if(!top3.length){
    ctx.font='400 28px Poppins, sans-serif'; ctx.fillStyle='rgba(255,255,255,.6)';
    ctx.fillText('Belum ada pengeluaran periode ini', 64, y+20);
    y+=60;
  } else {
    const maxAmt=Math.max(...top3.map(x=>x.amt),1);
    const barMaxW=W-128;
    top3.forEach(({e,amt})=>{
      const barW=Math.max(24, amt/maxAmt*barMaxW);
      roundRect(ctx, 64, y, barMaxW, 64, 16); ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fill();
      roundRect(ctx, 64, y, barW, 64, 16); ctx.fillStyle='rgba(255,255,255,.22)'; ctx.fill();
      ctx.font='600 30px Poppins, sans-serif'; ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(e.em+' '+e.name, 84, y+32);
      const amtText= hide? MASK_AMT : rpFmt(amt);
      ctx.textAlign='right';
      ctx.fillText(amtText, W-84, y+32);
      ctx.textBaseline='alphabetic'; ctx.textAlign='left';
      y+=80;
    });
  }

  /* streak hari mencatat */
  y+=30;
  roundRect(ctx, 64, y, W-128, 100, 20); ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fill();
  ctx.font='700 32px "Poppins"'; ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('📆 '+daysRecorded+' hari mencatat transaksi', 84, y+50);
  ctx.textBaseline='alphabetic';

  /* watermark */
  ctx.font='600 26px Poppins, sans-serif';
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.textAlign='center';
  ctx.fillText('✉️ Amplop — atur uang dengan sistem amplop', W/2, H-70);
}
function downloadRecapPng(){
  const canvas=document.getElementById('recap-canvas');
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='amplop-rekap-'+getPeriod(periodOffset).key+'.png';
  a.click();
  toast('Rekap diunduh ✓');
}
function shareRecapImage(){
  const canvas=document.getElementById('recap-canvas');
  canvas.toBlob(async blob=>{
    if(!blob){ toast('Gagal membuat gambar'); return; }
    try{
      const file=new File([blob], 'amplop-rekap.png', {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:'Rekap Amplop', text:'Rekap keuangan periodeku dari Amplop ✉️'});
      } else {
        toast('Perangkat ini tidak mendukung Bagikan langsung — coba Unduh PNG');
      }
    }catch(e){ /* dibatalkan pengguna, abaikan */ }
  }, 'image/png');
}

/* ================= FITUR: PRESET KATEGORI & AMPLOP MUSIMAN ================= */
const ENVELOPE_PRESETS={
  'anak-kos':{label:'Anak Kos', items:[
    {em:'🍚',name:'Makan'},{em:'🏠',name:'Kos'},{em:'🚌',name:'Transport'},
    {em:'📶',name:'Kuota & Pulsa'},{em:'🍿',name:'Jajan & Nongkrong'},{em:'🚨',name:'Dana Darurat'}
  ]},
  'pekerja-kantoran':{label:'Pekerja Kantoran', items:[
    {em:'🍚',name:'Makan'},{em:'🚌',name:'Transport'},{em:'🧾',name:'Tagihan'},
    {em:'👨‍👩‍👧',name:'Kirim ke Orang Tua'},{em:'💳',name:'Cicilan'},{em:'🐖',name:'Tabungan'},
    {em:'🎮',name:'Hiburan'},{em:'🚨',name:'Dana Darurat'}
  ]},
  'keluarga-muda':{label:'Keluarga Muda', items:[
    {em:'🛒',name:'Dapur & Belanja'},{em:'🏠',name:'Tagihan Rumah'},{em:'🧒',name:'Anak & Sekolah'},
    {em:'🚌',name:'Transport'},{em:'💊',name:'Kesehatan'},{em:'🐖',name:'Tabungan'},{em:'🚨',name:'Dana Darurat'}
  ]}
};
function applyEnvelopePreset(key){
  const preset=ENVELOPE_PRESETS[key]; if(!preset) return;
  const existing=new Set(DB.envelopes.map(e=>e.name.toLowerCase()));
  let added=0;
  preset.items.forEach(item=>{
    if(existing.has(item.name.toLowerCase())) return;
    DB.envelopes.push({id:uid(), em:item.em, name:item.name});
    existing.add(item.name.toLowerCase());
    added++;
  });
  save(); render();
  toast(added>0? added+' amplop "'+preset.label+'" ditambahkan ✓' : 'Semua amplop preset ini sudah ada');
}

/* Tanggal Idulfitri (perkiraan, dipakai untuk saran musiman THR — tanpa library kalender Hijriah) */
const IDUL_FITRI_DATES={2024:'2024-04-10',2025:'2025-03-31',2026:'2026-03-20',2027:'2027-03-09',
  2028:'2028-02-26',2029:'2029-02-14',2030:'2030-02-04'};
function getSeasonalSuggestions(){
  const dismissed=DB.settings.dismissedSeasonal||{};
  const now=new Date();
  const list=[];
  if(!dismissed.thr){
    for(const yr of [now.getFullYear(), now.getFullYear()+1]){
      const dstr=IDUL_FITRI_DATES[yr]; if(!dstr) continue;
      const daysTo=Math.round((new Date(dstr+'T00:00')-now)/86400000);
      if(daysTo>=0 && daysTo<=60){ list.push({key:'thr', em:'🎉', name:'THR & Lebaran'}); break; }
    }
  }
  if(!dismissed.yearend){
    const m=now.getMonth();
    if(m===10||m===11) list.push({key:'yearend', em:'🎁', name:'Kado Akhir Tahun'});
  }
  return list;
}
function addSeasonalEnvelope(key, em, name){
  const exists=DB.envelopes.some(e=>e.name.toLowerCase()===name.toLowerCase());
  if(!exists) DB.envelopes.push({id:uid(), em, name});
  DB.settings.dismissedSeasonal[key]=true;
  save(); render();
  toast(exists? 'Amplop ini sudah ada' : 'Amplop '+name+' ditambahkan ✓');
}
function dismissSeasonal(key){
  DB.settings.dismissedSeasonal[key]=true;
  save(); render();
  toast('Saran ditutup');
}

/* ================= PENGATURAN ================= */
function renderSettings(){
  const csd=cycleStartDay();
  const isQuick=[1,25,27].includes(csd);
  document.querySelectorAll('#cycle-seg button').forEach(b=>{
    const d=b.dataset.d;
    b.classList.toggle('on', d==='custom'? !isQuick : Number(d)===csd);
  });
  document.getElementById('cycle-custom-wrap').style.display= isQuick? 'none':'block';
  document.getElementById('cycle-custom-input').value=csd;
  document.getElementById('cycle-current-label').innerHTML='Periode saat ini: <b style="color:var(--ink)">'+esc(getPeriod(0).label)+'</b>';

  document.getElementById('st-wallets').innerHTML=DB.wallets.map(w=>{
    const b=walletBalance(w.id);
    return `<div class="wallet-row" style="cursor:pointer" onclick="openWalletModal('${w.id}')">
      <div class="w"><b>${esc(w.name)}</b><span>${esc(w.type)} · saldo awal ${rp(w.open)}</span></div>
      <div class="amt num ${b===0?'zero':b<0?'neg':''}">${rpS(b)}</div></div>`;
  }).join('') || '<div class="empty"><b>Belum ada dompet</b></div>';
  document.getElementById('st-bills').innerHTML=DB.bills.map(b=>
    `<div class="bill-row" style="cursor:pointer" onclick="openBillModal('${b.id}')">
      <div class="date-badge"><b>${b.dueDay}</b><span>TGL</span></div>
      <div class="bill-info"><b>${esc(b.name)}</b><div class="sub">${rp(b.amount)} · ${esc(envById(b.envId)?.name||'-')}</div></div>
      <span style="color:var(--muted)">›</span></div>`).join('')
    || '<div class="empty"><b>Belum ada tagihan rutin</b>cth: listrik, internet, sewa, cicilan.</div>';

  ensureReportRangeDefaults();
  refreshReportRangeSummary();
}
function openWalletModal(id=''){
  document.getElementById('wl-edit-id').value=id;
  const w=id? walletById(id):{name:'',type:'Bank',open:''};
  document.getElementById('wallet-modal-title').firstChild.textContent=id?'Edit Dompet ':'Dompet Baru ';
  document.getElementById('wlf-nm').value=w.name||'';
  document.getElementById('wlf-type').value=w.type||'Bank';
  document.getElementById('wlf-open').value=w.open? Number(w.open).toLocaleString('id-ID'):'';
  document.getElementById('wlf-del').style.display=id?'inline-flex':'none';
  document.getElementById('wallet-modal').classList.add('open');
}
function saveWallet(){
  const name=document.getElementById('wlf-nm').value.trim();
  if(!name){ toast('Nama dompet wajib diisi'); return; }
  const id=document.getElementById('wl-edit-id').value;
  const data={name, type:document.getElementById('wlf-type').value, open:parseAmt(document.getElementById('wlf-open').value)};
  if(id){ Object.assign(walletById(id), data); } else DB.wallets.push({id:uid(), ...data});
  save(); closeModal('wallet-modal'); render(); toast('Dompet disimpan ✓');
}
function deleteWallet(){
  const id=document.getElementById('wl-edit-id').value;
  if(!id) return;
  if(DB.txns.some(t=>t.walletId===id||t.toWalletId===id)){ toast('Dompet dipakai transaksi — tidak bisa dihapus'); return; }
  if(!confirm('Hapus dompet ini?')) return;
  DB.wallets=DB.wallets.filter(w=>w.id!==id);
  save(); closeModal('wallet-modal'); render(); toast('Dompet dihapus');
}
function openBillModal(id=''){
  document.getElementById('bl-edit-id').value=id;
  const b=id? DB.bills.find(x=>x.id===id):{name:'',amount:'',dueDay:'',envId:DB.envelopes[0]?.id,walletId:DB.wallets[0]?.id};
  document.getElementById('bill-modal-title').firstChild.textContent=id?'Edit Tagihan ':'Tagihan Rutin Baru ';
  document.getElementById('blf-nm').value=b.name||'';
  document.getElementById('blf-amt').value=b.amount? Number(b.amount).toLocaleString('id-ID'):'';
  document.getElementById('blf-due').value=b.dueDay||'';
  document.getElementById('blf-env').innerHTML=DB.envelopes.map(e=>`<option value="${e.id}" ${b.envId===e.id?'selected':''}>${esc(e.em)} ${esc(e.name)}</option>`).join('');
  document.getElementById('blf-wallet').innerHTML=DB.wallets.map(w=>`<option value="${w.id}" ${b.walletId===w.id?'selected':''}>${esc(w.name)}</option>`).join('');
  document.getElementById('blf-del').style.display=id?'inline-flex':'none';
  document.getElementById('bill-modal').classList.add('open');
}
function saveBill(){
  const name=document.getElementById('blf-nm').value.trim();
  const amount=parseAmt(document.getElementById('blf-amt').value);
  const dueDay=Math.min(31,Math.max(1,Number(document.getElementById('blf-due').value)||0));
  if(!name||!amount||!dueDay){ toast('Nama, nominal, dan tanggal wajib diisi'); return; }
  const id=document.getElementById('bl-edit-id').value;
  const data={name, amount, dueDay, envId:document.getElementById('blf-env').value, walletId:document.getElementById('blf-wallet').value};
  if(id){ Object.assign(DB.bills.find(x=>x.id===id), data); } else DB.bills.push({id:uid(), ...data, lastPaid:''});
  save(); closeModal('bill-modal'); render(); toast('Tagihan disimpan ✓');
}
function deleteBill(){
  const id=document.getElementById('bl-edit-id').value;
  if(!id||!confirm('Hapus tagihan rutin ini?')) return;
  DB.bills=DB.bills.filter(b=>b.id!==id);
  save(); closeModal('bill-modal'); render(); toast('Tagihan dihapus');
}

/* ================= TXN MODAL ================= */
let txType='out';
function setTxType(t){
  txType=t;
  document.querySelectorAll('#tx-seg button').forEach(b=>b.classList.toggle('on', b.dataset.t===t));
  document.getElementById('txf-env-wrap').style.display= t==='out'?'block':'none';
  document.getElementById('txf-to-wrap').style.display= t==='tf'?'block':'none';
  document.getElementById('txf-wallet-label').textContent= t==='tf'?'Dari Dompet':(t==='in'?'Masuk ke Dompet':'Dompet');
}
function openTxnModal(editId=''){
  const t= editId? DB.txns.find(x=>x.id===editId) : null;
  document.getElementById('txf-edit-id').value= t? t.id : '';
  document.getElementById('txn-modal-title').firstChild.textContent= t? 'Edit Transaksi ' : 'Catat Transaksi ';
  document.getElementById('txf-del').style.display= t? 'inline-flex' : 'none';

  document.getElementById('txf-date').value= t? t.date : new Date().toISOString().slice(0,10);
  document.getElementById('txf-desc').value= t? (t.desc||'') : '';
  document.getElementById('txf-amt').value= t? Number(t.amount).toLocaleString('id-ID') : '';
  document.getElementById('txf-env').innerHTML=DB.envelopes.map(e=>`<option value="${e.id}">${esc(e.em)} ${esc(e.name)}</option>`).join('');
  const opts=DB.wallets.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('');
  document.getElementById('txf-wallet').innerHTML=opts;
  document.getElementById('txf-to').innerHTML=opts;
  setTxType(t? t.type : 'out');
  if(t){
    if(t.envId) document.getElementById('txf-env').value=t.envId;
    if(t.walletId) document.getElementById('txf-wallet').value=t.walletId;
    if(t.toWalletId) document.getElementById('txf-to').value=t.toWalletId;
  }
  document.getElementById('txn-modal').classList.add('open');
  if(!t) setTimeout(()=>document.getElementById('txf-desc').focus(),150);
}
function saveTxn(){
  const date=document.getElementById('txf-date').value;
  const amount=parseAmt(document.getElementById('txf-amt').value);
  if(!date){ toast('Tanggal wajib diisi'); return; }
  if(!amount){ toast('Nominal wajib diisi'); return; }
  const walletId=document.getElementById('txf-wallet').value;
  const editId=document.getElementById('txf-edit-id').value;
  const t={id: editId||uid(), type:txType, date, desc:document.getElementById('txf-desc').value.trim(), amount, walletId};
  if(txType==='out') t.envId=document.getElementById('txf-env').value;
  if(txType==='tf'){
    t.toWalletId=document.getElementById('txf-to').value;
    if(t.toWalletId===walletId){ toast('Dompet asal dan tujuan sama'); return; }
  }
  if(editId){
    const i=DB.txns.findIndex(x=>x.id===editId);
    if(i>=0) DB.txns[i]=t; else DB.txns.push(t);
  } else DB.txns.push(t);
  save(); closeModal('txn-modal');
  periodOffset=periodOffsetForDate(date);
  go('txns'); toast(editId? 'Perubahan disimpan ✓' : 'Transaksi tersimpan ✓');
}
function delTxnFromModal(){
  const id=document.getElementById('txf-edit-id').value;
  if(!id||!confirm('Hapus transaksi ini?')) return;
  DB.txns=DB.txns.filter(t=>t.id!==id);
  save(); closeModal('txn-modal'); render(); toast('Transaksi dihapus');
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-bg').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); }));

/* modal konfirmasi (pengganti confirm() bawaan browser, dipakai utamanya untuk aksi Reset) */
let confirmModalResolve=null;
function confirmModal(message, opts={}){
  return new Promise(resolve=>{
    confirmModalResolve=resolve;
    document.getElementById('confirm-modal-title').textContent=opts.title||'Konfirmasi';
    document.getElementById('confirm-modal-body').textContent=message;
    const okBtn=document.getElementById('confirm-modal-ok');
    okBtn.textContent=opts.okLabel||'Ya, Lanjutkan';
    okBtn.className='btn '+(opts.danger===false?'p':'dngr');
    document.getElementById('confirm-modal').classList.add('open');
  });
}
function resolveConfirmModal(result){
  document.getElementById('confirm-modal').classList.remove('open');
  if(confirmModalResolve){ const r=confirmModalResolve; confirmModalResolve=null; r(result); }
}
document.getElementById('confirm-modal').addEventListener('click', e=>{ if(e.target.id==='confirm-modal') resolveConfirmModal(false); });

/* ================= DATA ================= */
function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='amplop-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href); toast('Backup diunduh ✓');
}
function importData(input){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{
    const d=JSON.parse(r.result);
    if(!d.wallets||!d.envelopes){ toast('Format file tidak dikenali'); return; }
    if(!confirm('Impor akan menimpa semua data saat ini. Lanjutkan?')) return;
    DB=d; save(); render(); toast('Data berhasil diimpor ✓');
  }catch(e){ toast('File JSON tidak valid'); } };
  r.readAsText(f); input.value='';
}
async function resetData(){
  const ok=await confirmModal(
    'Hapus SEMUA data dan mulai dari awal? Tindakan ini tidak bisa dibatalkan — ekspor dulu jika ingin menyimpan cadangan.',
    {title:'Reset Semua Data', okLabel:'Ya, Hapus Semua'});
  if(!ok) return;
  DB=structuredClone(seed); save(); render(); toast('Data direset');
}

/* ================= FITUR: REPORT (EKSPOR & RESET RENTANG DATA) ================= */
function fmtIdDate(s){ if(!s) return ''; const d=new Date(s+'T00:00'); return d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3)+' '+d.getFullYear(); }

/* ---- komponen popover rentang tanggal, dipakai di Report & filter Transaksi ---- */
function rangePresetDates(type){
  const today=new Date();
  if(type==='period'){ const p=getPeriod(0); return {from:ymd(p.start), to:ymd(p.end)}; }
  if(type==='prevPeriod'){ const p=getPeriod(-1); return {from:ymd(p.start), to:ymd(p.end)}; }
  if(type==='7d'){ const f=new Date(today); f.setDate(f.getDate()-6); return {from:ymd(f), to:ymd(today)}; }
  if(type==='30d'){ const f=new Date(today); f.setDate(f.getDate()-29); return {from:ymd(f), to:ymd(today)}; }
  if(type==='month'){ const f=new Date(today.getFullYear(), today.getMonth(), 1), l=new Date(today.getFullYear(), today.getMonth()+1, 0); return {from:ymd(f), to:ymd(l)}; }
  if(type==='all'){ return {from:'2000-01-01', to:ymd(today)}; }
  return {from:'', to:''};
}
function positionRangePopover(wrap){
  const trigger=wrap.querySelector('.range-picker-trigger'), pop=wrap.querySelector('.range-popover');
  const r=trigger.getBoundingClientRect();
  const width=Math.min(280, window.innerWidth-24);
  let left=r.left;
  if(left+width>window.innerWidth-12) left=window.innerWidth-width-12;
  if(left<12) left=12;
  pop.style.width=width+'px';
  pop.style.top=(r.bottom+6)+'px';
  pop.style.left=left+'px';
}
function closeRangePopovers(){ document.querySelectorAll('.range-picker.open').forEach(p=>p.classList.remove('open')); }
function toggleRangePopover(id){
  const wrap=document.getElementById(id);
  const willOpen=!wrap.classList.contains('open');
  closeRangePopovers();
  if(willOpen){ wrap.classList.add('open'); positionRangePopover(wrap); }
}
function closeRangePopover(id){ const el=document.getElementById(id); if(el) el.classList.remove('open'); }
document.addEventListener('click', e=>{ if(!e.target.closest('.range-picker')) closeRangePopovers(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeRangePopovers(); });

/* ---- Report (Pengaturan) ---- */
function refreshReportRangeLabel(){
  const from=document.getElementById('exp-from').value, to=document.getElementById('exp-to').value;
  const label=document.getElementById('reportrange-label');
  if(label) label.textContent= from&&to? fmtIdDate(from)+' – '+fmtIdDate(to) : 'Pilih rentang tanggal…';
}
function ensureReportRangeDefaults(){
  const fromEl=document.getElementById('exp-from'), toEl=document.getElementById('exp-to');
  if(!fromEl || !toEl) return;
  if(!fromEl.value || !toEl.value){
    const period=getPeriod(0);
    fromEl.value=ymd(period.start); toEl.value=ymd(period.end);
  }
  refreshReportRangeLabel();
}
function setReportRangePreset(type){
  const {from,to}=rangePresetDates(type);
  document.getElementById('exp-from').value=from;
  document.getElementById('exp-to').value=to;
  refreshReportRangeLabel();
  refreshReportRangeSummary();
  closeRangePopover('report-range-picker');
}
function onReportRangeCustomChange(){
  refreshReportRangeLabel();
  refreshReportRangeSummary();
}

/* ---- filter tanggal Transaksi ---- */
function setTxRangePreset(type){
  const {from,to}= type==='clear'? {from:'',to:''} : rangePresetDates(type);
  document.getElementById('tx-date-from').value=from;
  document.getElementById('tx-date-to').value=to;
  closeRangePopover('tx-range-picker');
  renderTxns();
}
function exportRangeLabel(){
  return fmtIdDate(document.getElementById('exp-from').value)+' – '+fmtIdDate(document.getElementById('exp-to').value);
}
function reportRangeTxns(){
  const from=document.getElementById('exp-from').value, to=document.getElementById('exp-to').value;
  return DB.txns.filter(t=>t.date && (!from||t.date>=from) && (!to||t.date<=to));
}
function refreshReportRangeSummary(){
  const el=document.getElementById('report-range-summary'); if(!el) return;
  const txCount=reportRangeTxns().length;
  el.textContent= txCount? txCount+' transaksi pada rentang ini.' : 'Tidak ada transaksi tercatat pada rentang ini.';
}
function reportRangeAllocKeys(){
  const from=document.getElementById('exp-from').value, to=document.getElementById('exp-to').value;
  if(!from || !to) return [];
  const lo=Math.min(periodOffsetForDate(from), periodOffsetForDate(to))-1;
  const hi=Math.max(periodOffsetForDate(from), periodOffsetForDate(to))+1;
  const keys=[];
  for(let o=lo;o<=hi;o++){
    const p=getPeriod(o);
    if(ymd(p.start)>=from && ymd(p.end)<=to && DB.allocations[p.key]) keys.push(p.key);
  }
  return keys;
}
async function resetReportRange(){
  const txList=reportRangeTxns();
  const allocKeys=reportRangeAllocKeys();
  if(!txList.length && !allocKeys.length){ toast('Tidak ada data untuk dihapus pada rentang ini'); return; }
  const label=exportRangeLabel();
  const ok=await confirmModal(
    'Hapus '+txList.length+' transaksi'+(allocKeys.length?' dan alokasi amplop':'')+' pada rentang '+label+'? '
    +'Amplop, dompet, dan cicilan itu sendiri tidak ikut terhapus. Data yang sudah dihapus tidak bisa dikembalikan.',
    {title:'Reset Data Periode', okLabel:'Ya, Hapus'});
  if(!ok) return;
  const ids=new Set(txList.map(t=>t.id));
  DB.txns=DB.txns.filter(t=>!ids.has(t.id));
  allocKeys.forEach(k=>delete DB.allocations[k]);
  save(); render();
  toast('Data pada rentang '+label+' dihapus ✓');
}
function getExportRows(){
  return reportRangeTxns().slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{
    const jenis= t.type==='in'?'Masuk':t.type==='out'?'Keluar':'Transfer';
    const amplop= t.type==='out'? (envById(t.envId)?.name||'') : '';
    const dompet= walletById(t.walletId)?.name||'';
    let keterangan=t.desc||'';
    if(t.type==='tf') keterangan += (keterangan?' ':'')+'→ '+(walletById(t.toWalletId)?.name||'-');
    const nominal= t.type==='in'? t.amount : -t.amount; /* keluar & transfer sama-sama mengurangi dompet asal */
    return {tanggal:t.date, jenis, keterangan, amplop, dompet, nominal};
  });
}
let sheetJsLoading=null;
function loadSheetJs(){
  if(window.XLSX) return Promise.resolve();
  if(sheetJsLoading) return sheetJsLoading;
  sheetJsLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>{ sheetJsLoading=null; reject(new Error('sheetjs-load-failed')); };
    document.head.appendChild(s);
  });
  return sheetJsLoading;
}
async function exportXlsx(){
  toast('Menyiapkan laporan…');
  try{ await loadSheetJs(); }
  catch(e){ toast('Butuh koneksi internet untuk mengunduh laporan'); return; }
  const rows=getExportRows();
  const wsTxnData=[['Tanggal','Jenis','Keterangan','Amplop','Dompet','Nominal'],
    ...rows.map(r=>[r.tanggal,r.jenis,r.keterangan,r.amplop,r.dompet,r.nominal])];
  const wsTxn=XLSX.utils.aoa_to_sheet(wsTxnData);

  const tin=rows.filter(r=>r.jenis==='Masuk').reduce((s,r)=>s+r.nominal,0);
  const tout=rows.filter(r=>r.jenis==='Keluar').reduce((s,r)=>s+Math.abs(r.nominal),0);
  const spentByName={};
  rows.forEach(r=>{ if(r.jenis==='Keluar' && r.amplop) spentByName[r.amplop]=(spentByName[r.amplop]||0)+Math.abs(r.nominal); });
  const summaryData=[
    ['Ringkasan', exportRangeLabel()],
    [],
    ['Total Masuk', tin],
    ['Total Keluar', tout],
    ['Selisih', tin-tout],
    [],
    ['Amplop','Terpakai']
  ];
  Object.entries(spentByName).forEach(([name,amt])=>summaryData.push([name, amt]));
  const wsSummary=XLSX.utils.aoa_to_sheet(summaryData);

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTxn, 'Transaksi');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
  XLSX.writeFile(wb, 'amplop-report-'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('Laporan diunduh ✓');
}

/* ================= AUTH & SYNC ================= */
function agShow(step){
  ['login','register','register-otp','recovery','forgot'].forEach(s=>document.getElementById('ag-step-'+s).style.display= s===step?'block':'none');
  agErr(''); agInfo('');
}
function agErr(msg){
  const el=document.getElementById('ag-err');
  el.textContent=msg; el.classList.toggle('show', !!msg);
}
function agInfo(msg){
  const el=document.getElementById('ag-info');
  el.textContent=msg; el.classList.toggle('show', !!msg);
}
function agGate(open){ document.getElementById('auth-gate').classList.toggle('open', open); }
const EYE_OPEN_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.42012 12.7132C2.28394 12.4975 2.21584 12.3897 2.17772 12.2234C2.14909 12.0985 2.14909 11.9015 2.17772 11.7766C2.21584 11.6103 2.28394 11.5025 2.42012 11.2868C3.54553 9.50484 6.8954 5 12.0004 5C17.1054 5 20.4553 9.50484 21.5807 11.2868C21.7169 11.5025 21.785 11.6103 21.8231 11.7766C21.8517 11.9015 21.8517 12.0985 21.8231 12.2234C21.785 12.3897 21.7169 12.4975 21.5807 12.7132C20.4553 14.4952 17.1054 19 12.0004 19C6.8954 19 3.54553 14.4952 2.42012 12.7132Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.0004 15C13.6573 15 15.0004 13.6569 15.0004 12C15.0004 10.3431 13.6573 9 12.0004 9C10.3435 9 9.0004 10.3431 9.0004 12C9.0004 13.6569 10.3435 15 12.0004 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EYE_OFF_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.7429 5.09232C11.1494 5.03223 11.5686 5 12.0004 5C17.1054 5 20.4553 9.50484 21.5807 11.2868C21.7169 11.5025 21.785 11.6103 21.8231 11.7767C21.8518 11.9016 21.8517 12.0987 21.8231 12.2236C21.7849 12.3899 21.7164 12.4985 21.5792 12.7156C21.2793 13.1901 20.8222 13.8571 20.2165 14.5805M6.72432 6.71504C4.56225 8.1817 3.09445 10.2194 2.42111 11.2853C2.28428 11.5019 2.21587 11.6102 2.17774 11.7765C2.1491 11.9014 2.14909 12.0984 2.17771 12.2234C2.21583 12.3897 2.28393 12.4975 2.42013 12.7132C3.54554 14.4952 6.89541 19 12.0004 19C14.0588 19 15.8319 18.2676 17.2888 17.2766M3.00042 3L21.0004 21M9.8791 9.87868C9.3362 10.4216 9.00042 11.1716 9.00042 12C9.00042 13.6569 10.3436 15 12.0004 15C12.8288 15 13.5788 14.6642 14.1217 14.1213" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_EDIT_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.87601 18.1156C2.92195 17.7021 2.94493 17.4954 3.00748 17.3022C3.06298 17.1307 3.1414 16.9676 3.24061 16.8171C3.35242 16.6475 3.49952 16.5005 3.7937 16.2063L17 3C18.1046 1.89543 19.8954 1.89543 21 3C22.1046 4.10457 22.1046 5.89543 21 7L7.7937 20.2063C7.49951 20.5005 7.35242 20.6475 7.18286 20.7594C7.03242 20.8586 6.86926 20.937 6.69782 20.9925C6.50457 21.055 6.29783 21.078 5.88434 21.124L2.49997 21.5L2.87601 18.1156Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_DELETE_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_SETTING_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.7273 14.7273C18.6063 15.0015 18.5702 15.3056 18.6236 15.6005C18.6771 15.8954 18.8177 16.1676 19.0273 16.3818L19.0818 16.4364C19.2509 16.6052 19.385 16.8057 19.4765 17.0265C19.568 17.2472 19.6151 17.4838 19.6151 17.7227C19.6151 17.9617 19.568 18.1983 19.4765 18.419C19.385 18.6397 19.2509 18.8402 19.0818 19.0091C18.913 19.1781 18.7124 19.3122 18.4917 19.4037C18.271 19.4952 18.0344 19.5423 17.7955 19.5423C17.5565 19.5423 17.3199 19.4952 17.0992 19.4037C16.8785 19.3122 16.678 19.1781 16.5091 19.0091L16.4545 18.9545C16.2403 18.745 15.9682 18.6044 15.6733 18.5509C15.3784 18.4974 15.0742 18.5335 14.8 18.6545C14.5311 18.7698 14.3018 18.9611 14.1403 19.205C13.9788 19.4489 13.8921 19.7347 13.8909 20.0273V20.1818C13.8909 20.664 13.6994 21.1265 13.3584 21.4675C13.0174 21.8084 12.5549 22 12.0727 22C11.5905 22 11.1281 21.8084 10.7871 21.4675C10.4461 21.1265 10.2545 20.664 10.2545 20.1818V20.1C10.2475 19.7991 10.1501 19.5073 9.97501 19.2625C9.79991 19.0176 9.55521 18.8312 9.27273 18.7273C8.99853 18.6063 8.69437 18.5702 8.39947 18.6236C8.10456 18.6771 7.83244 18.8177 7.61818 19.0273L7.56364 19.0818C7.39478 19.2509 7.19425 19.385 6.97353 19.4765C6.7528 19.568 6.51621 19.6151 6.27727 19.6151C6.03834 19.6151 5.80174 19.568 5.58102 19.4765C5.36029 19.385 5.15977 19.2509 4.99091 19.0818C4.82186 18.913 4.68775 18.7124 4.59626 18.4917C4.50476 18.271 4.45766 18.0344 4.45766 17.7955C4.45766 17.5565 4.50476 17.3199 4.59626 17.0992C4.68775 16.8785 4.82186 16.678 4.99091 16.5091L5.04545 16.4545C5.25503 16.2403 5.39562 15.9682 5.4491 15.6733C5.50257 15.3784 5.46647 15.0742 5.34545 14.8C5.23022 14.5311 5.03887 14.3018 4.79497 14.1403C4.55107 13.9788 4.26526 13.8921 3.97273 13.8909H3.81818C3.33597 13.8909 2.87351 13.6994 2.53253 13.3584C2.19156 13.0174 2 12.5549 2 12.0727C2 11.5905 2.19156 11.1281 2.53253 10.7871C2.87351 10.4461 3.33597 10.2545 3.81818 10.2545H3.9C4.2009 10.2475 4.49273 10.1501 4.73754 9.97501C4.98236 9.79991 5.16883 9.55521 5.27273 9.27273C5.39374 8.99853 5.42984 8.69437 5.37637 8.39947C5.3229 8.10456 5.18231 7.83244 4.97273 7.61818L4.91818 7.56364C4.74913 7.39478 4.61503 7.19425 4.52353 6.97353C4.43203 6.7528 4.38493 6.51621 4.38493 6.27727C4.38493 6.03834 4.43203 5.80174 4.52353 5.58102C4.61503 5.36029 4.74913 5.15977 4.91818 4.99091C5.08704 4.82186 5.28757 4.68775 5.50829 4.59626C5.72901 4.50476 5.96561 4.45766 6.20455 4.45766C6.44348 4.45766 6.68008 4.50476 6.9008 4.59626C7.12152 4.68775 7.32205 4.82186 7.49091 4.99091L7.54545 5.04545C7.75971 5.25503 8.03183 5.39562 8.32674 5.4491C8.62164 5.50257 8.9258 5.46647 9.2 5.34545H9.27273C9.54161 5.23022 9.77093 5.03887 9.93245 4.79497C10.094 4.55107 10.1807 4.26526 10.1818 3.97273V3.81818C10.1818 3.33597 10.3734 2.87351 10.7144 2.53253C11.0553 2.19156 11.5178 2 12 2C12.4822 2 12.9447 2.19156 13.2856 2.53253C13.6266 2.87351 13.8182 3.33597 13.8182 3.81818V3.9C13.8193 4.19253 13.906 4.47834 14.0676 4.72224C14.2291 4.96614 14.4584 5.15749 14.7273 5.27273C15.0015 5.39374 15.3056 5.42984 15.6005 5.37637C15.8954 5.3229 16.1676 5.18231 16.3818 4.97273L16.4364 4.91818C16.6052 4.74913 16.8057 4.61503 17.0265 4.52353C17.2472 4.43203 17.4838 4.38493 17.7227 4.38493C17.9617 4.38493 18.1983 4.43203 18.419 4.52353C18.6397 4.61503 18.8402 4.74913 19.0091 4.91818C19.1781 5.08704 19.3122 5.28757 19.4037 5.50829C19.4952 5.72901 19.5423 5.96561 19.5423 6.20455C19.5423 6.44348 19.4952 6.68008 19.4037 6.9008C19.3122 7.12152 19.1781 7.32205 19.0091 7.49091L18.9545 7.54545C18.745 7.75971 18.6044 8.03183 18.5509 8.32674C18.4974 8.62164 18.5335 8.9258 18.6545 9.2V9.27273C18.7698 9.54161 18.9611 9.77093 19.205 9.93245C19.4489 10.094 19.7347 10.1807 20.0273 10.1818H20.1818C20.664 10.1818 21.1265 10.3734 21.4675 10.7144C21.8084 11.0553 22 11.5178 22 12C22 12.4822 21.8084 12.9447 21.4675 13.2856C21.1265 13.6266 20.664 13.8182 20.1818 13.8182H20.1C19.8075 13.8193 19.5217 13.906 19.2778 14.0676C19.0339 14.2291 18.8425 14.4584 18.7273 14.7273Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_ADMIN_SVG='<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 5C21 6.65685 16.9706 8 12 8C7.02944 8 3 6.65685 3 5M21 5C21 3.34315 16.9706 2 12 2C7.02944 2 3 3.34315 3 5M21 5V19C21 20.66 17 22 12 22C7 22 3 20.66 3 19V5M21 12C21 13.66 17 15 12 15C7 15 3 13.66 3 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function togglePw(id, btn){
  const el=document.getElementById(id);
  const nowVisible= el.type==='password';
  el.type= nowVisible?'text':'password';
  btn.innerHTML= nowVisible? EYE_OPEN_SVG : EYE_OFF_SVG; /* ikon merepresentasikan status saat ini */
}

function authErrorMessage(error){
  let m=error && error.message;
  if(typeof m!=='string' || !m.trim()) m=(error && (error.error_description||error.msg||error.error||error.name)) || '';
  if(typeof m!=='string') m='';
  m=m.trim();
  if(/^[{\[]/.test(m)) m=''; /* JSON/objek mentah bukan pesan yang bisa dibaca pengguna */
  if(/security purposes/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa detik lalu coba lagi.';
  if(/invalid login credentials/i.test(m)) return 'Email atau password salah.';
  if(/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek inbox untuk link konfirmasi (atau minta admin aktifkan Auto Confirm di Supabase).';
  if(/different from the old password/i.test(m)) return 'Password baru harus berbeda dari password lama.';
  if(/already registered|already.*exists|user.*exists/i.test(m)) return 'Email ini sudah terdaftar. Coba tab Masuk, atau pakai Lupa Password.';
  if(/password should be at least/i.test(m)) return 'Password terlalu pendek — minimal 6 karakter.';
  if(/expired|invalid.*otp|otp.*invalid|token.*(expired|invalid)/i.test(m)) return 'Kode sudah kedaluwarsa atau tidak valid. Klik "Kirim ulang kode" untuk kode baru.';
  if(/failed to fetch|network|load failed/i.test(m)) return 'Gagal terhubung ke server. Periksa koneksi internetmu lalu coba lagi.';
  return m || 'Terjadi kesalahan. Coba lagi.';
}
const RESEND_COOLDOWN_SEC=60;
let resendCooldownTimer=null;
function startResendCooldown(btnId, seconds=RESEND_COOLDOWN_SEC){
  const btn=document.getElementById(btnId);
  if(!btn) return;
  clearInterval(resendCooldownTimer);
  let remaining=seconds;
  const label=()=>btn.textContent='Kirim ulang kode ('+remaining+'s)';
  btn.disabled=true; label();
  resendCooldownTimer=setInterval(()=>{
    remaining--;
    if(remaining<=0){
      clearInterval(resendCooldownTimer);
      btn.disabled=false; btn.textContent='Kirim ulang kode';
    } else label();
  }, 1000);
}
async function doLogin(){
  const email=document.getElementById('ag-login-email').value.trim().toLowerCase();
  const pw=document.getElementById('ag-login-pw').value;
  if(!email.includes('@')){ agErr('Masukkan email yang valid.'); return; }
  if(!pw){ agErr('Masukkan password.'); return; }
  const btn=document.getElementById('ag-login-btn'); btn.disabled=true; btn.textContent='Memeriksa…';
  const {data, error}=await sb.auth.signInWithPassword({email, password:pw});
  btn.disabled=false; btn.textContent='Masuk';
  if(error){ agErr(authErrorMessage(error)); return; }
  await startApp(data.session);
}

let pendingRegisterEmail='';
let pendingRegisterOtpType='email';
const PENDING_REG_KEY='amplop_pending_register';
function savePendingRegister(email, type){
  try{ sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({email, type})); }catch(e){}
}
function loadPendingRegister(){
  try{ const raw=sessionStorage.getItem(PENDING_REG_KEY); return raw? JSON.parse(raw) : null; }catch(e){ return null; }
}
function clearPendingRegister(){ try{ sessionStorage.removeItem(PENDING_REG_KEY); }catch(e){} }

async function doRegister(){
  const email=document.getElementById('ag-reg-email').value.trim().toLowerCase();
  const pw=document.getElementById('ag-reg-pw').value;
  if(!email.includes('@')){ agErr('Masukkan email yang valid.'); return; }
  if(pw.length<6){ agErr('Password minimal 6 karakter.'); return; }
  const btn=document.getElementById('ag-reg-btn'); btn.disabled=true; btn.textContent='Memeriksa…';
  const {data, error}=await sb.auth.signUp({email, password:pw});
  if(error){ btn.disabled=false; btn.textContent='Daftar'; agErr(authErrorMessage(error)); return; }
  /* Supabase tidak mengirim error kalau emailnya sudah terdaftar (supaya orang
     luar tidak bisa mengecek email siapa saja sudah punya akun atau belum) —
     satu-satunya penanda adalah array identities kosong pada user yang
     dikembalikan meski status response-nya "berhasil". */
  if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0){
    btn.disabled=false; btn.textContent='Daftar';
    agErr('Email ini sudah terdaftar. Coba tab Masuk, atau pakai Lupa Password.');
    return;
  }
  if(data.session){
    /* Opsi "Confirm email" Supabase nonaktif: signUp() langsung memberi sesi
       aktif, TAPI belum boleh dipakai sebelum kode OTP diverifikasi — kalau
       tidak di-signOut, reload tab (mis. pindah ke app Email lalu balik lagi)
       akan menemukan sesi ini dan melewati verifikasi OTP sepenuhnya. */
    await sb.auth.signOut();
    const {error: otpErr} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:false}});
    btn.disabled=false; btn.textContent='Daftar';
    if(otpErr){ agErr(authErrorMessage(otpErr)); return; }
    pendingRegisterOtpType='email';
  } else {
    /* Opsi "Confirm email" aktif: Supabase SUDAH otomatis mengirim kode lewat
       template Confirm signup. Jangan kirim kode kedua (bisa kena rate limit). */
    btn.disabled=false; btn.textContent='Daftar';
    pendingRegisterOtpType='signup';
  }
  pendingRegisterEmail=email;
  savePendingRegister(email, pendingRegisterOtpType);
  document.getElementById('ag-reg-sent-to').textContent=email;
  document.getElementById('ag-reg-otp').value='';
  agShow('register-otp');
  startResendCooldown('ag-reg-resend-btn');
  setTimeout(()=>document.getElementById('ag-reg-otp').focus(),100);
}
async function verifyRegisterOtp(){
  const token=document.getElementById('ag-reg-otp').value.trim();
  if(token.length<6){ agErr('Kode harus 6 digit.'); return; }
  const btn=document.getElementById('ag-reg-otp-btn'); btn.disabled=true; btn.textContent='Memeriksa…';
  const {data, error}=await sb.auth.verifyOtp({email:pendingRegisterEmail, token, type:pendingRegisterOtpType});
  btn.disabled=false; btn.textContent='Konfirmasi & Masuk';
  if(error){ agErr(authErrorMessage(error)); return; }
  if(!data.session){ agErr('Kode salah atau kedaluwarsa. Coba kirim ulang.'); return; }
  clearPendingRegister();
  await startApp(data.session);
}
async function resendRegisterOtp(){
  if(!pendingRegisterEmail){ agShow('register'); return; }
  agErr('');
  const {error} = pendingRegisterOtpType==='signup'
    ? await sb.auth.resend({type:'signup', email:pendingRegisterEmail})
    : await sb.auth.signInWithOtp({email:pendingRegisterEmail, options:{shouldCreateUser:false}});
  if(error){ agErr(authErrorMessage(error)); return; }
  document.getElementById('ag-reg-otp').value='';
  startResendCooldown('ag-reg-resend-btn');
  agInfo('Kode baru sudah dikirim — kode lama sudah tidak berlaku ✓');
}
async function saveRecoveryPw(){
  const pw=document.getElementById('ag-rec-pw').value;
  if(pw.length<6){ agErr('Password minimal 6 karakter.'); return; }
  const btn=document.getElementById('ag-rec-btn'); btn.disabled=true; btn.textContent='Menyimpan…';
  const {data, error}=await sb.auth.updateUser({password:pw});
  btn.disabled=false; btn.textContent='Simpan Password Baru';
  if(error){ agErr(authErrorMessage(error)); return; }
  history.replaceState(null, '', location.pathname);
  toast('Password baru tersimpan ✓');
  await startApp(data.session);
}
async function sendForgotPassword(){
  const email=document.getElementById('ag-forgot-email').value.trim().toLowerCase();
  if(!email.includes('@')){ agErr('Masukkan email yang valid.'); return; }
  const btn=document.getElementById('ag-forgot-btn'); btn.disabled=true; btn.textContent='Mengirim…';
  const {error}=await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin+location.pathname});
  btn.disabled=false; btn.textContent='Kirim Link Reset';
  if(error){ agErr(authErrorMessage(error)); return; }
  agShow('login');
  agInfo('Kalau email terdaftar, link reset password sudah dikirim ✓ Cek inbox (dan folder spam).');
}
if(sb){
  sb.auth.onAuthStateChange((event, session)=>{
    if(event==='PASSWORD_RECOVERY'){ agGate(true); agShow('recovery'); }
  });
}
async function doLogout(){
  if(sb) await sb.auth.signOut();
  location.reload();
}

/* --- sinkronisasi --- */
let pushTimer=null, dirty=false;
function setSync(state){
  const label=document.getElementById('sf-sync-label');
  const dot=document.getElementById('sync-ind');
  const map={ ok:'Tersimpan di cloud', syncing:'Menyimpan…', offline:'Offline', local:'Mode lokal' };
  const color={ ok:'#5D9C7B', syncing:'#C9A05B', offline:'#B2503F', local:'#8A8577' };
  if(label) label.textContent=map[state]||'—';
  if(dot) dot.style.background=color[state]||'#8A8577';
}
function schedulePush(){
  if(!CONFIGURED||!USER){ setSync('local'); return; }
  dirty=true; setSync('syncing');
  clearTimeout(pushTimer);
  pushTimer=setTimeout(pushRemote, 1200);
}
async function pushRemote(){
  if(!CONFIGURED||!USER||!dirty) return;
  if(!navigator.onLine){ setSync('offline'); return; }
  try{
    const {error}=await sb.from('user_data').upsert({
      user_id:USER.id, data:DB, updated_at:new Date(localT).toISOString()
    });
    if(error) throw error;
    dirty=false; setSync('ok');
  }catch(e){ setSync('offline'); }
}
async function pullRemote(){
  if(!CONFIGURED||!USER) return;
  try{
    const {data, error}=await sb.from('user_data').select('data, updated_at').eq('user_id', USER.id).maybeSingle();
    if(error) throw error;
    const remoteT= data? new Date(data.updated_at).getTime() : 0;
    if(data && remoteT>localT){ DB=data.data; persistLocal(); }
    else if(localT>remoteT){ dirty=true; await pushRemote(); }
    setSync('ok');
  }catch(e){ setSync(navigator.onLine?'local':'offline'); }
}
window.addEventListener('online', ()=>{ if(dirty) pushRemote(); else setSync(USER?'ok':'local'); });
window.addEventListener('offline', ()=>setSync('offline'));

/* ================= BOOT ================= */
function render(){ ensureSchema(); renderHome(); renderTxns(); renderEnv(); renderReport(); renderSettings(); renderDebts();
  const emailLabel= USER? USER.email : 'Mode lokal (Supabase belum dikonfigurasi)';
  const em=document.getElementById('st-email'); if(em) em.textContent=emailLabel;
  const sfEmail=document.getElementById('sf-email'); if(sfEmail) sfEmail.textContent=emailLabel;
  const sfAvatar=document.getElementById('sf-avatar'); if(sfAvatar) sfAvatar.textContent= USER? USER.email.charAt(0).toUpperCase() : '?';
}
async function startApp(session){
  USER=session.user;
  const isAdmin=(USER.email||'').toLowerCase()===ADMIN_EMAIL;
  document.querySelectorAll('.js-admin-btn').forEach(b=>{ b.style.display= isAdmin? 'flex':'none'; });
  document.querySelectorAll('.js-admin-only').forEach(b=>{ b.style.display= isAdmin? 'block':'none'; });
  KEY='amplop_v2_'+USER.id;
  const firstRun=!localStorage.getItem(KEY);
  load();
  await pullRemote();
  agGate(false); go('home');
  if(firstRun && !DB.txns.length && !Object.keys(DB.allocations).length){
    save();
    setTimeout(()=>document.getElementById('onboard-modal').classList.add('open'), 400);
  }
}
const isRecoveryLink = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);
async function bootApp(){
  if(!CONFIGURED){
    /* mode pengembangan: tanpa Supabase, jalan lokal seperti biasa */
    const firstRun=!localStorage.getItem(KEY);
    load(); go('home'); setSync('local');
    if(firstRun){ save(); setTimeout(()=>document.getElementById('onboard-modal').classList.add('open'), 400); }
    return;
  }
  if(isRecoveryLink){
    /* link reset password: JANGAN langsung masuk, tunggu password baru diisi dulu */
    load(); agShow('recovery'); agGate(true);
    return;
  }
  const {data:{session}}=await sb.auth.getSession();
  if(session){ await startApp(session); return; }
  const pending=loadPendingRegister();
  if(pending){
    /* Tab sempat reload di tengah proses Daftar (mis. pindah ke app Email
       lalu balik lagi) — lanjutkan dari step OTP, bukan hilang ke form Masuk. */
    pendingRegisterEmail=pending.email;
    pendingRegisterOtpType=pending.type;
    document.getElementById('ag-reg-sent-to').textContent=pending.email;
    load(); agShow('register-otp'); agGate(true);
    return;
  }
  load(); agShow('login'); agGate(true);
}
bootApp();
/* ================= FITUR: AUTO-UPDATE PWA ================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      /* browser cuma cek update service worker sesekali (bisa ~24 jam) — cek
         juga tiap kali app dibuka/dibawa ke depan, supaya versi baru dari
         server ketemu lebih cepat, bukan cuma nunggu jadwal browser. */
      reg.update().catch(()=>{});
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState==='visible') reg.update().catch(()=>{});
      });
    }).catch(()=>{});
  });
  /* begitu service worker versi baru selesai dipasang (skipWaiting+clients.claim
     di sw.js bikin dia langsung ambil alih), reload sekali supaya HTML/CSS/JS
     yang sedang tampil ikut jadi versi terbaru — bukan cuma service worker-nya.
     Ditunda dulu kalau ada modal yang lagi terbuka, biar isian form tidak
     hilang mendadak. */
  let swUpdateApplied=false;
  function applyPendingSwUpdate(){
    if(swUpdateApplied) return;
    if(document.querySelector('.modal-bg.open')){ setTimeout(applyPendingSwUpdate, 3000); return; }
    swUpdateApplied=true;
    window.location.reload();
  }
  navigator.serviceWorker.addEventListener('controllerchange', applyPendingSwUpdate);
}

/* ================= FITUR: INSTAL PWA ================= */
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  document.querySelectorAll('.js-install-btn').forEach(b=>{ b.style.display='flex'; });
});
async function installApp(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const {outcome}=await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  document.querySelectorAll('.js-install-btn').forEach(b=>{ b.style.display='none'; });
  if(outcome==='accepted') toast('Amplop diinstal ✓ Cek home screen/desktop-mu');
}
window.addEventListener('appinstalled', ()=>{
  deferredInstallPrompt=null;
  document.querySelectorAll('.js-install-btn').forEach(b=>{ b.style.display='none'; });
});
function isStandaloneMode(){ return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true; }
function isSafariBrowser(){
  const ua=navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Android/.test(ua);
}
/* Safari (Mac/iOS) tidak pernah memicu beforeinstallprompt sama sekali — kalau
   setelah beberapa detik event itu tak kunjung muncul dan browsernya Safari,
   tampilkan tombol dengan instruksi manual, daripada diam menghilang. */
setTimeout(()=>{
  if(isStandaloneMode() || deferredInstallPrompt) return;
  if(!isSafariBrowser()) return;
  const btns=document.querySelectorAll('.js-install-btn');
  if(!btns.length) return;
  const isMac=/Macintosh/.test(navigator.userAgent) && !('ontouchend' in document);
  btns.forEach(btn=>{
    btn.style.display='flex';
    btn.onclick=()=>toast(isMac
      ? 'Di Safari Mac: klik menu File → "Tambahkan ke Dock"'
      : 'Di Safari: tekan tombol Bagikan (Share), lalu "Tambah ke Layar Utama"');
  });
}, 3000);
