const SAIDA_CATS = ["Mercado","Alimentação","Transporte","Casa","Contas","Lazer","Saúde","Apostas","Delivery (negócio)","Compras","Outros"];
const ENTRADA_CATS = ["Salário","Moto","Vendas","Delivery (negócio)","Apostas","Outros"];
const CHAVE = "caixa-do-pellegrini-v1";
const VALOR_MAX = 1000000; // acima disso é erro de digitação ou de ditado
const AVISO_LIMITE = 0.8; // começa a avisar quando usar 80% do limite

const brl = v => (v<0?"-":"") + "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const semR = v => brl(v).replace("R$ ","");
const ymd = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const hoje = () => ymd(new Date());
const $ = id => document.getElementById(id);
const ddmm = d => String(d).slice(8,10)+"/"+String(d).slice(5,7);
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const num = x => { const s=String(x==null?"":x).trim().replace(/R\$\s*/i,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",","."); const v=parseFloat(s); return isFinite(v)?Math.abs(v):0; };
const recentes = (a,b) => String(b.data).localeCompare(String(a.data))||(b.criado||0)-(a.criado||0);
const fimDoMes = m => { const [a,b]=m.split("-").map(Number); return new Date(a,b,0).getDate(); };
const noMes = (m,dia) => m+"-"+String(Math.min(dia,fimDoMes(m))).padStart(2,"0");
function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML.replace(/"/g,"&quot;"); }

let estado={lanc:[],contas:[],limite:0}, mes=hoje().slice(0,7), contaAberta=null, editando=null;
const diasAbertos=new Set(), catsAbertas=new Set();
try{ const s=JSON.parse(localStorage.getItem(CHAVE)); if(s&&Array.isArray(s.lanc)) estado={lanc:s.lanc,contas:s.contas||[],limite:s.limite||0}; }catch{}
function guardar(){ try{ localStorage.setItem(CHAVE,JSON.stringify(estado)); }catch{ mostrar("Não consegui guardar no celular. Libere espaço e tente de novo."); } }
if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
const novoId = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function adicionar(it){ const l={id:novoId(),criado:Date.now(),...it}; estado.lanc.push(l); guardar(); return l; }
function apagar(id){
  estado.lanc=estado.lanc.filter(l=>l.id!==id);
  for(const c of estado.contas) for(const m in c.pagos) if(c.pagos[m]===id) delete c.pagos[m];
  guardar();
}

function nomeMes(m){ const [a,b]=m.split("-").map(Number); return new Date(a,b-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); }
function mudaMes(n){ const [a,b]=mes.split("-").map(Number); const d=new Date(a,b-1+n,1); mes=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); contaAberta=null; render(); }
$("ant").onclick=()=>mudaMes(-1); $("prox").onclick=()=>mudaMes(1);

function resumo(lista){
  let entrou=0,saiu=0;
  for(const l of lista){ const v=Number(l.valor)||0; if(l.tipo==="entrada") entrou+=v; else saiu+=v; }
  return {entrou,saiu,sobra:entrou-saiu};
}
const doMes = m => estado.lanc.filter(l=>String(l.data||"").startsWith(m)).sort(recentes);

// contas: as fixas aparecem em todo mês desde que foram criadas; as avulsas, só no mês delas
const contasDoMes = m => estado.contas.filter(c=>c.todoMes?m>=c.inicio:c.mes===m).map(c=>({c,venc:noMes(m,c.dia),pago:!!(c.pagos&&c.pagos[m])})).sort((a,b)=>a.venc.localeCompare(b.venc));
const abertas = m => contasDoMes(m).filter(x=>!x.pago);
const faltaPagar = m => abertas(m).reduce((t,x)=>t+(Number(x.c.valor)||0),0);
function prazo(venc){
  const d=Math.round((new Date(venc+"T12:00")-new Date(hoje()+"T12:00"))/864e5);
  if(d<0) return {txt:`Atrasada ${-d} ${d===-1?"dia":"dias"}`,atraso:true};
  if(d===0) return {txt:"Vence hoje",atraso:true};
  if(d===1) return {txt:"Vence amanhã"};
  return {txt:`Vence dia ${venc.slice(8,10)}, em ${d} dias`};
}
function salvarConta(nome,valor,dia,todoMes){
  const m=dia>=Number(hoje().slice(8,10))?hoje().slice(0,7):proximoMes(hoje().slice(0,7));
  const c={id:novoId(),nome,valor,dia,todoMes,inicio:hoje().slice(0,7),mes:todoMes?"":m,categoria:categoriaDe(nome),pagos:{}};
  estado.contas.push(c); guardar(); return c;
}
function proximoMes(m){ const [a,b]=m.split("-").map(Number); const d=new Date(a,b,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function pagarConta(c,m,valor,forma,lancExistente){
  const data=hoje().startsWith(m)?hoje():noMes(m,c.dia);
  const l=lancExistente||adicionar({tipo:"saida",valor,categoria:c.categoria||"Contas",data,descricao:c.nome,forma:forma||""});
  c.pagos=c.pagos||{}; c.pagos[m]=l.id; guardar(); return l;
}
function acharConta(texto,m){
  const t=norm(texto); if(!t) return null;
  return abertas(m).find(x=>{ const n=norm(x.c.nome).replace(/^conta (?:de|do|da) /,""); return n&&(t.includes(n)||n.includes(t)); })||null;
}

function itemDetalhe(l,comDia){
  const extra=[comDia?ddmm(l.data):"",l.descricao?l.categoria:"",l.forma,l.parcela?`parcela ${l.parcela}`:""].filter(Boolean).join(" · ");
  const ent=l.tipo==="entrada";
  return `<li><div><b>${esc(l.descricao||l.categoria||"Sem descrição")}</b><small>${esc(extra)}</small><button class="ed" data-ed="${esc(l.id)}">editar</button><button class="ed perigo" data-del="${esc(l.id)}">apagar</button></div><span class="num ${ent?"g":"b"}">${ent?"+":"−"} ${semR(Number(l.valor)||0)}</span></li>`;
}

function renderContas(){
  const lista=contasDoMes(mes), falta=faltaPagar(mes), n=lista.filter(x=>!x.pago).length;
  $("cResumo").textContent=lista.length?(n?`${n} em aberto`:"Tudo pago"):"";
  $("contas").innerHTML=lista.length?lista.map(({c,venc,pago})=>{
    const p=prazo(venc), aberta=contaAberta===c.id;
    const sub=pago?`Paga${c.todoMes?" · todo mês":""}`:`${p.txt}${c.todoMes?" · todo mês":""}`;
    const botoes=pago?`<button class="mini" data-desfaz="${esc(c.id)}">Desmarcar</button>`:`<button class="mini prim" data-pagar="${esc(c.id)}">Paguei</button>`;
    const forma=aberta?`<div class="campos"><input data-pv inputmode="decimal" aria-label="Valor pago" placeholder="Valor (R$)" value="${c.valor?esc(String(c.valor).replace(".",",")):""}"><select data-pf aria-label="Forma de pagamento"><option value="">Pagamento</option><option>Pix</option><option>Débito</option><option>Crédito</option><option>Dinheiro</option><option>Boleto</option></select><button class="prim tudo" data-confirma="${esc(c.id)}">Confirmar pagamento</button></div>`:"";
    return `<div class="conta${pago?" paga":""}"><div class="lin"><div><b>${esc(c.nome)}</b><small class="${!pago&&p.atraso?"atraso":""}">${esc(sub)}</small><button class="ed perigo" data-delconta="${esc(c.id)}">apagar conta</button></div><div class="btns"><span class="num">${c.valor?semR(Number(c.valor)):"—"}</span>${botoes}</div></div>${forma}</div>`;
  }).join(""):`<p class="dica">Nenhuma conta em ${esc(nomeMes(mes))}. Fale, por exemplo: aluguel 800 vence todo dia 5.</p>`;
  return falta;
}
function renderLimite(saiu){
  const L=Number(estado.limite)||0, box=$("limite");
  box.classList.remove("alerta");
  if(document.activeElement!==$("lInput")) $("lInput").value=L?String(L).replace(".",","):"";
  if(!L){ $("lValor").textContent=""; $("lBarra").style.width="0"; $("lEstado").textContent="Defina quanto quer gastar no mês e eu aviso quando estiver chegando perto."; return; }
  $("lValor").textContent=brl(L);
  const uso=saiu/L, resta=L-saiu; $("lBarra").style.width=Math.min(100,uso*100).toFixed(1)+"%";
  let txt=resta>=0?`Usou ${brl(saiu)}. Restam ${brl(resta)}.`:`Passou ${brl(-resta)} do limite.`;
  if(mes===hoje().slice(0,7)&&resta>0){ const dias=fimDoMes(mes)-Number(hoje().slice(8,10))+1; txt+=` Dá ${brl(resta/dias)} por dia até o fim do mês.`; }
  $("lEstado").textContent=txt;
  if(uso>=AVISO_LIMITE) box.classList.add("alerta");
}
function render(){
  { const n=nomeMes(mes); $("mesNome").textContent=n[0].toUpperCase()+n.slice(1); }
  const lista=doMes(mes), t=resumo(lista), falta=renderContas();
  $("tSobra").textContent=brl(t.sobra); $("tSobra").className=t.sobra<0?"neg":"pos";
  $("tEntrou").textContent=brl(t.entrou); $("tSaiu").textContent=brl(t.saiu); $("tFalta").textContent=brl(falta);
  renderLimite(t.saiu);

  const atual=hoje().slice(0,7), diasPassados=mes===atual?Number(hoje().slice(8,10)):mes<atual?fimDoMes(mes):0;
  const porCat={}; for(const l of lista) if(l.tipo!=="entrada"){ const c=l.categoria||"Outros"; porCat[c]=(porCat[c]||0)+(Number(l.valor)||0); }
  const cats=Object.entries(porCat).sort((a,b)=>b[1]-a[1]), max=cats.length?cats[0][1]:1;
  const prev=t.sobra-falta, cred=lista.filter(l=>l.tipo!=="entrada"&&l.forma==="Crédito").reduce((s,l)=>s+(Number(l.valor)||0),0);
  $("iPrev").textContent=lista.length||falta?brl(prev):"—"; $("iPrev").className=prev<0?"b":"";
  $("iDia").textContent=t.saiu&&diasPassados?brl(t.saiu/diasPassados):"—";
  $("iCred").textContent=cred?brl(cred):"—";
  $("iMaior").textContent=cats.length?brl(cats[0][1]):"—"; $("iMaiorCat").textContent=cats.length?cats[0][0]:"";

  const dias={}; for(const l of lista) (dias[l.data]=dias[l.data]||[]).push(l);
  const chaves=Object.keys(dias).sort().reverse();
  $("dias").innerHTML=chaves.length?chaves.map(d=>{ const r=resumo(dias[d]), ab=diasAbertos.has(d);
    const det=ab?`<tr class="det"><td colspan="4"><ul class="lista">${dias[d].slice().sort((a,b)=>(a.criado||0)-(b.criado||0)).map(l=>itemDetalhe(l)).join("")}</ul></td></tr>`:"";
    return `<tr class="dia" data-dia="${esc(d)}"><td class="num"><span class="seta">${ab?"▾":"▸"}</span> ${esc(ddmm(d))}</td><td class="r num g">${r.entrou?semR(r.entrou):"—"}</td><td class="r num b">${r.saiu?semR(r.saiu):"—"}</td><td class="r num ${r.sobra<0?"b":"g"}">${semR(r.sobra)}</td></tr>${det}`; }).join("")
    :`<tr><td colspan="4" class="vazio">Nada em ${esc(nomeMes(mes))} ainda. Toque em Falar e diga o que gastou.</td></tr>`;

  $("cats").innerHTML=cats.length?cats.map(([c,v])=>`<details class="catd" data-cat="${esc(c)}"${catsAbertas.has(c)?" open":""}><summary><div class="cat"><span>${esc(c)}</span><div class="bar"><i style="width:${(v/max*100).toFixed(1)}%"></i></div><span class="num">${brl(v)}</span></div></summary><ul class="lista">${lista.filter(l=>l.tipo!=="entrada"&&(l.categoria||"Outros")===c).map(l=>itemDetalhe(l,true)).join("")}</ul></details>`).join("")
    :`<p class="dica">Nenhum gasto em ${esc(nomeMes(mes))}.</p>`;
  $("extrato").innerHTML=lista.length?lista.map(l=>itemDetalhe(l,true)).join(""):`<li class="vazio" style="display:block">Nada lançado em ${esc(nomeMes(mes))}.</li>`;
}

$("dias").addEventListener("click",e=>{
  if(e.target.closest("button")) return;
  const tr=e.target.closest("tr[data-dia]"); if(!tr) return;
  const d=tr.dataset.dia; if(diasAbertos.has(d)) diasAbertos.delete(d); else diasAbertos.add(d); render();
});
$("cats").addEventListener("toggle",e=>{ const c=e.target.dataset&&e.target.dataset.cat; if(!c) return; if(e.target.open) catsAbertas.add(c); else catsAbertas.delete(c); },true);

// apagar pede um segundo toque
function confirmar(b,acao){
  if(b.dataset.ok==="1") return acao();
  const antes=b.textContent; b.dataset.ok="1"; b.textContent="toque de novo pra apagar";
  setTimeout(()=>{ if(b.isConnected){ b.dataset.ok=""; b.textContent=antes; } },3000);
}
document.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  const d=b.dataset;
  if(d.del) return confirmar(b,()=>{ apagar(d.del); render(); });
  if(d.ed) return abrirEdicao(d.ed);
  if(d.delconta) return confirmar(b,()=>{ estado.contas=estado.contas.filter(c=>c.id!==d.delconta); guardar(); render(); });
  if(d.pagar){ contaAberta=contaAberta===d.pagar?null:d.pagar; return render(); }
  if(d.desfaz){ const c=estado.contas.find(x=>x.id===d.desfaz); if(c&&c.pagos[mes]){ apagar(c.pagos[mes]); render(); } return; }
  if(d.confirma){
    const c=estado.contas.find(x=>x.id===d.confirma), caixa=b.closest(".conta"), v=num(caixa.querySelector("[data-pv]").value);
    if(!c) return;
    if(!(v>0&&v<VALOR_MAX)) return mostrar("Coloque o valor pago.");
    const l=pagarConta(c,mes,v,caixa.querySelector("[data-pf]").value); contaAberta=null; render();
    mostrar(`${c.nome} paga: ${brl(v)}.`,[()=>apagar(l.id)]);
  }
});

$("cBtn").onclick=()=>{
  const nome=$("cNome").value.trim(), valor=num($("cValor").value), dia=parseInt($("cDia").value,10);
  if(!nome) return mostrar("Coloque o nome da conta.");
  if(!(dia>=1&&dia<=31)) return mostrar("Coloque o dia do vencimento, de 1 a 31.");
  if(valor>=VALOR_MAX) return mostrar("Esse valor parece errado. Confira e tente de novo.");
  salvarConta(nome,valor,dia,$("cFixa").checked);
  $("cNome").value=$("cValor").value=$("cDia").value=""; render(); mostrar(`Conta salva: ${nome}.`);
};
$("lBtn").onclick=()=>{ estado.limite=num($("lInput").value); guardar(); $("lInput").blur(); render(); mostrar(estado.limite?`Limite do mês: ${brl(estado.limite)}.`:"Limite tirado."); };

// lançar na mão e editar usam o mesmo formulário
function opcoesCat(tipo,atual){ const l=tipo==="entrada"?ENTRADA_CATS:SAIDA_CATS; $("fCat").innerHTML=l.map(c=>`<option${c===atual?" selected":""}>${esc(c)}</option>`).join(""); }
function limparForm(){
  editando=null; $("form").reset(); $("fData").value=hoje(); opcoesCat("saida");
  $("manualTit").textContent="Lançar na mão"; $("fSalvar").textContent="Salvar"; $("fCancelar").hidden=true; $("lParc").hidden=false;
}
function abrirEdicao(id){
  const l=estado.lanc.find(x=>x.id===id); if(!l) return;
  editando=id; $("fTipo").value=l.tipo==="entrada"?"entrada":"saida"; opcoesCat($("fTipo").value,l.categoria);
  $("fData").value=l.data; $("fValor").value=String(l.valor).replace(".",","); $("fForma").value=l.forma||""; $("fDesc").value=l.descricao||"";
  $("manualTit").textContent="Editar lançamento"; $("fSalvar").textContent="Salvar alteração"; $("fCancelar").hidden=false; $("lParc").hidden=true;
  $("manual").open=true; $("manual").scrollIntoView({behavior:"smooth",block:"center"});
}
$("fTipo").onchange=()=>{ opcoesCat($("fTipo").value); $("lParc").hidden=!!editando||$("fTipo").value==="entrada"; };
$("fCancelar").onclick=limparForm;
$("form").addEventListener("submit",e=>{
  e.preventDefault();
  const valor=num($("fValor").value);
  if(!(valor>0&&valor<VALOR_MAX)) return mostrar("Confira o valor.");
  const it={tipo:$("fTipo").value,valor,categoria:$("fCat").value,data:$("fData").value,descricao:$("fDesc").value.trim(),forma:$("fForma").value};
  if(editando){ const l=estado.lanc.find(x=>x.id===editando); if(l) Object.assign(l,it); guardar(); mes=it.data.slice(0,7); limparForm(); $("manual").open=false; render(); return mostrar("Lançamento alterado."); }
  const n=parseInt($("fParc").value,10)||1;
  if(n>1&&it.tipo==="saida") it.parcelas=Math.min(n,48);
  const {linha,desfazer}=lancar(it); mes=it.data.slice(0,7); limparForm(); render(); mostrar(linha,desfazer);
});

// compra parcelada vira um lançamento por mês, cada um no mês em que a parcela cai
function lancar(it){
  const n=it.parcelas||1; const {parcelas,...base}=it;
  if(n<2){ const l=adicionar(base); return {linha:linhaItem(base),desfazer:[()=>apagar(l.id)]}; }
  const cada=Math.floor(it.valor/n*100)/100, ultima=Math.round((it.valor-cada*(n-1))*100)/100, grupo=novoId(), ids=[];
  const [a,m,d]=it.data.split("-").map(Number);
  for(let i=0;i<n;i++){
    const x=new Date(a,m-1+i,1), mm=x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0");
    ids.push(adicionar({...base,valor:i===n-1?ultima:cada,data:noMes(mm,d),parcela:`${i+1}/${n}`,grupo}).id);
  }
  return {linha:`${base.descricao||base.categoria}: ${brl(it.valor)} em ${n}x de ${brl(cada)}, ${base.categoria}`,desfazer:[()=>ids.forEach(apagar)]};
}
const linhaItem = i => `${i.tipo==="entrada"?"Entrada":"Saída"} ${brl(i.valor)}, ${i.categoria}${i.descricao?": "+i.descricao:""}${i.forma?", "+i.forma:""}`;

function mostrar(txt,desfazer){
  const r=$("resp"); r.hidden=false; r.textContent=txt;
  if(desfazer&&desfazer.length){ const a=document.createElement("div"); a.className="acoes"; const b=document.createElement("button"); b.textContent="Desfazer";
    b.onclick=()=>{ b.disabled=true; for(const f of desfazer.slice().reverse()) f(); render(); r.textContent="Desfeito."; }; a.append(b); r.append(a); }
}
function falar(txt){
  if(!("speechSynthesis" in window)) return;
  const u=new SpeechSynthesisUtterance(txt.replace(/R\$ /g,"").replace(/[−+·]/g," ")); u.lang="pt-BR"; speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function textoDia(d){
  const l=estado.lanc.filter(x=>x.data===d); if(!l.length) return `Nada lançado em ${ddmm(d)}.`;
  const r=resumo(l); return `${ddmm(d)}: entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)}.\n`+l.map(linhaItem).join("\n");
}
function textoContas(){
  const m=hoje().slice(0,7), a=abertas(m);
  if(!a.length) return "Nenhuma conta em aberto neste mês.";
  return `Falta pagar ${brl(faltaPagar(m))}:\n`+a.map(x=>`${x.c.nome}${x.c.valor?" "+brl(Number(x.c.valor)):""}, ${prazo(x.venc).txt.toLowerCase()}`).join("\n");
}
function textoLimite(){
  const L=Number(estado.limite)||0; if(!L) return "Você ainda não definiu um limite. Fale: meu limite é 2000.";
  const m=hoje().slice(0,7), s=resumo(doMes(m)).saiu, resta=L-s;
  return resta>=0?`Ainda pode gastar ${brl(resta)} neste mês.`:`Você passou ${brl(-resta)} do limite.`;
}
function avisoLimite(){
  const L=Number(estado.limite)||0; if(!L) return "";
  const s=resumo(doMes(hoje().slice(0,7))).saiu;
  return s>L?`Atenção: passou ${brl(s-L)} do limite do mês.`:s>=L*AVISO_LIMITE?`Atenção: já usou ${Math.round(s/L*100)}% do limite do mês.`:"";
}
function respondePeriodo(p,categoria){
  const h=hoje(); let lista,nome;
  if(p==="hoje"){ lista=estado.lanc.filter(l=>l.data===h); nome="Hoje"; }
  else if(p==="ontem"){ const d=new Date(); d.setDate(d.getDate()-1); const o=ymd(d); lista=estado.lanc.filter(l=>l.data===o); nome="Ontem"; }
  else if(p==="semana"){ const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); const ini=ymd(d); lista=estado.lanc.filter(l=>l.data>=ini&&l.data<=h); nome="Nesta semana"; }
  else if(p==="mespassado"){ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); lista=doMes(ymd(d).slice(0,7)); nome="No mês passado"; }
  else { lista=doMes(h.slice(0,7)); nome="Neste mês"; }
  if(categoria) lista=lista.filter(l=>l.categoria===categoria);
  const r=resumo(lista);
  if(categoria) return `${nome}, em ${categoria}: saiu ${brl(r.saiu)}, entrou ${brl(r.entrou)}. Resultado: ${brl(r.sobra)}.`;
  return `${nome}: entrou ${brl(r.entrou)}, saiu ${brl(r.saiu)}. Sobrou ${brl(r.sobra)}.`;
}

function comando(texto){
  const txt=String(texto||"").trim(); if(!txt) return;
  const r=interpretar(txt,hoje());
  const responde=a=>{ mostrar(a); falar(a); $("cmd").value=""; };
  if(r.pergunta==="dia"){ mes=r.data.slice(0,7); diasAbertos.add(r.data); render(); return responde(textoDia(r.data)); }
  if(r.pergunta==="contas") return responde(textoContas());
  if(r.pergunta==="limite") return responde(textoLimite());
  if(r.pergunta) return responde(respondePeriodo(r.pergunta,r.categoria));
  if(r.limite!==undefined){ estado.limite=r.limite; guardar(); render(); return responde(r.limite?`Limite do mês: ${brl(r.limite)}.`:"Limite tirado."); }
  if(r.conta){
    const c=r.conta;
    if(!c.nome) { const m="Faltou o nome da conta. Exemplo: aluguel 800 vence todo dia 5."; mostrar(m); return falar(m); }
    if(!(c.dia>=1&&c.dia<=31)) { const m=`Faltou o dia do vencimento de ${c.nome}. Exemplo: ${c.nome} vence dia 10.`; mostrar(m); return falar(m); }
    const nova=salvarConta(c.nome,c.valor,c.dia,c.todoMes); render();
    const a=`Conta salva: ${c.nome}${c.valor?", "+brl(c.valor):""}, ${c.todoMes?"todo dia":"dia"} ${c.dia}.`;
    mostrar(a,[()=>{ estado.contas=estado.contas.filter(x=>x.id!==nova.id); guardar(); }]); falar(a); $("cmd").value=""; return;
  }
  if(r.pagar){
    const m=hoje().slice(0,7), x=acharConta(r.pagar,m);
    if(!x){ const a=`Não achei conta em aberto com o nome ${r.pagar}. Fale com o valor: paguei 80 de ${r.pagar}.`; mostrar(a); return falar(a); }
    if(!x.c.valor){ const a=`${x.c.nome} não tem valor salvo. Fale: paguei 80 de ${x.c.nome}.`; mostrar(a); return falar(a); }
    const l=pagarConta(x.c,m,Number(x.c.valor),""); render();
    const a=`${x.c.nome} paga: ${brl(Number(x.c.valor))}.`; mostrar(a,[()=>apagar(l.id)]); falar(a); $("cmd").value=""; return;
  }
  const itens=r.itens.filter(i=>i.valor>0&&i.valor<VALOR_MAX), linhas=[], desfazer=[];
  for(const it of itens){
    const f=lancar(it); linhas.push(f.linha); desfazer.push(...f.desfazer);
    // gasto com o nome de uma conta em aberto já dá baixa nela
    if(it.tipo==="saida"&&!it.parcelas){
      const m=it.data.slice(0,7), x=acharConta(it.descricao,m);
      if(x){ const l=estado.lanc[estado.lanc.length-1]; pagarConta(x.c,m,it.valor,it.forma,l); linhas.push(`Conta ${x.c.nome} marcada como paga.`); }
    }
  }
  if(!linhas.length){ const m=`Não entendi: "${txt}". Tente assim: gastei 50 no mercado.`; mostrar(m); return falar("Não entendi. Fale de novo."); }
  $("cmd").value=""; mes=itens[0].data.slice(0,7); render();
  const av=avisoLimite(); if(av) linhas.push(av);
  const fim=r.naoEntendi.length?`\nNão entendi: ${r.naoEntendi.join("; ")}`:"";
  mostrar(linhas.join("\n")+fim,desfazer); falar(linhas.join(". "));
}
$("enviar").onclick=()=>comando($("cmd").value);
$("cmd").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); comando($("cmd").value); } });

// microfone: toca, fala, e ao terminar a frase ele já lança
const Reconhecer=window.SpeechRecognition||window.webkitSpeechRecognition;
let ouvindo=null;
$("falar").onclick=()=>{
  if(ouvindo){ ouvindo.stop(); return; }
  if(!Reconhecer){ mostrar("Este navegador não tem reconhecimento de voz. Use o microfone do teclado na caixa abaixo."); return; }
  if("speechSynthesis" in window) speechSynthesis.cancel();
  const rec=new Reconhecer(); rec.lang="pt-BR"; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
  let final="", erro="";
  rec.onstart=()=>{ ouvindo=rec; $("falar").classList.add("ouvindo"); $("falarTxt").textContent="Ouvindo… toque pra parar"; };
  rec.onresult=e=>{ let parcial=""; final=""; for(const x of e.results){ if(x.isFinal) final+=x[0].transcript; else parcial+=x[0].transcript; } $("cmd").value=final||parcial; };
  rec.onerror=e=>{ erro=e.error; };
  rec.onend=()=>{
    ouvindo=null; $("falar").classList.remove("ouvindo"); $("falarTxt").textContent="Falar";
    if(erro==="not-allowed"||erro==="service-not-allowed") return mostrar("O microfone está bloqueado. Toque no cadeado ao lado do endereço, ou nas permissões do app, e libere o microfone.");
    if(erro==="network") return mostrar("O reconhecimento de voz precisa de internet. Confira sua conexão e tente de novo.");
    const texto=final||$("cmd").value;
    if(texto.trim()) comando(texto); else if(erro==="no-speech"||!erro) mostrar("Não ouvi nada. Toque em Falar e tente de novo.");
  };
  try{ rec.start(); }catch{ mostrar("Não consegui ligar o microfone. Tente de novo."); }
};

// backup: como os dados ficam só neste celular, dá pra salvar uma cópia e restaurar depois
$("bkSalvar").onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(estado)],{type:"application/json"}));
  const a=document.createElement("a"); a.href=url; a.download=`caixa-do-pellegrini-${hoje()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  mostrar("Backup salvo na pasta de downloads do celular.");
};
$("bkArquivo").onchange=async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const d=JSON.parse(await f.text()); if(!d||!Array.isArray(d.lanc)) throw 0;
    const ids=new Set(estado.lanc.map(l=>l.id)), cids=new Set(estado.contas.map(c=>c.id));
    const novos=d.lanc.filter(l=>l&&l.id&&!ids.has(l.id)), novas=(d.contas||[]).filter(c=>c&&c.id&&!cids.has(c.id));
    estado.lanc.push(...novos); estado.contas.push(...novas); if(!estado.limite&&d.limite) estado.limite=d.limite;
    guardar(); render(); mostrar(`Backup restaurado: ${novos.length} lançamentos e ${novas.length} contas novas.`);
  }catch{ mostrar("Esse arquivo não é um backup do Caixa."); }
  e.target.value="";
};

// link que lança com um toque: #lancar=saida_2026-11-07_50_Mercado_Pix_Descrição_id~...
// fica depois do #, então não vai pro servidor. O id evita lançar duas vezes.
function lerLink(){
  let h=location.hash; try{ h=decodeURIComponent(h); }catch{ return; }
  const m=h.match(/^#lancar=(.+)$/); if(!m) return;
  history.replaceState(null,"",location.pathname+location.search);
  const ids=new Set(estado.lanc.map(l=>l.id)), novos=[];
  for(const p of m[1].split("~")){
    const [tipo,data,valor,cat,forma,desc,id]=p.split("_"), v=Number(valor), lista=tipo==="entrada"?ENTRADA_CATS:SAIDA_CATS;
    if(!["saida","entrada"].includes(tipo)||!/^\d{4}-\d{2}-\d{2}$/.test(data)||!(v>0&&v<VALOR_MAX)) continue;
    const chave="link-"+(id||[tipo,data,valor,cat,desc].join("-"));
    if(ids.has(chave)) continue;
    ids.add(chave);
    novos.push({id:chave,criado:Date.now()+novos.length,tipo,data,valor:v,categoria:lista.includes(cat)?cat:"Outros",forma:forma||"",descricao:desc||""});
  }
  if(!novos.length) return mostrar("Esses lançamentos já estavam aí. Nada mudou.");
  estado.lanc.push(...novos); guardar(); mes=novos[0].data.slice(0,7); render();
  mostrar(novos.map(linhaItem).join("\n"),[()=>novos.forEach(l=>apagar(l.id))]);
}

limparForm();
render();
lerLink();
window.addEventListener("hashchange",lerLink);
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
