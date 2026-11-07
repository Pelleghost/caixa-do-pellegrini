// Entende frases faladas em português e transforma em lançamentos. Roda no próprio celular, sem IA.
(function(){
  const UNID={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9};
  const DEZ={vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90};
  const CEM={cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};
  const SOLTOS={dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,...DEZ,...CEM};
  const SAIDAS=[
    [/\bdelivery\b|comida de mae|embalagens?\b/,"Delivery (negócio)"],
    [/apost|\bbets?\b|bet ?365|betfair|tradeball/,"Apostas"],
    [/\bmercado\b|supermercado|\bfeira\b|acougue|padaria|\bpa(?:o|es)\b|hortifruti|atacadao|assai/,"Mercado"],
    [/almoc|lanche|lanchei|janta|jantei|comida|marmita|restaurante|pizza|hamburguer|\bacai\b|\bi ?food\b|\bcafe\b|sorvete/,"Alimentação"],
    [/gasolina|abasteci|combustivel|\bposto\b|onibus|passagem|pedagio|estacionamento|\buber\b|\b99\b/,"Transporte"],
    [/aluguel|condominio|\bmove(?:l|is)\b|reforma|botijao|\bgas\b|faxina|material de limpeza/,"Casa"],
    [/\bluz\b|energia|\bagua\b|internet|telefone|celular|\bconta\b|\bcontas\b|boleto|fatura|assinatura|netflix|spotify|recarga/,"Contas"],
    [/cinema|\bshow\b|viagem|passeio|\bjogo\b|balada|cerveja|\bbar\b/,"Lazer"],
    [/farmacia|remedio|medico|dentista|consulta|\bexames?\b|academia|plano de saude/,"Saúde"],
    [/roupa|tenis|sapato|camisa|calca|presente|shopping/,"Compras"],
  ];
  const ENTRADAS=[
    [/salario|adiantamento|decimo terceiro|\b13o\b|\bferias\b/,"Salário"],
    [/\bvendi\b|\bvendas?\b/,"Vendas"],
    [/\bmoto\b|corridas?\b|\buber\b|\b99\b|\bi ?food\b|\bentregas?\b|\btrampos?\b/,"Moto"],
    [/\bdelivery\b|comida de mae/,"Delivery (negócio)"],
    [/apost|\bbets?\b|\bgreen\b|bet ?365|betfair/,"Apostas"],
  ];
  const FORMAS=[
    [/\bpix\b/,"Pix"],
    [/\b(?:no |na |pelo |com )?(?:cartao de )?debito\b/,"Débito"],
    [/\b(?:no |na |pelo |com )?(?:cartao de )?credito\b|(?<!fatura do )(?<!fatura de )\b(?:no |pelo |com o )?cartao\b/,"Crédito"],
    [/\b(?:em )?dinheiro\b|\ba vista\b/,"Dinheiro"],
    [/\bno boleto\b/,"Boleto"],
  ];
  const VERBO_ENTRADA_FORTE=/\bme (?:pagou|pagaram|deu|deram|devolveu|devolveram|mandou|mandaram)\b/;
  const VERBO_SAIDA=/gastei|paguei|comprei|custou|custaram|\bsaiu\b|torrei|perdi|apostei|transferi|mandei|emprestei|abasteci|almocei|jantei|lanchei|\bpedi\b/;
  const VERBO_ENTRADA=/recebi|ganhei|entrou|\bcaiu\b|vendi|faturei|lucrei|depositaram|\bsalario\b/;
  const ENCHIMENTO=/^(?:abasteci|almocei|jantei|lanchei|gastei|paguei|comprei|custou|custaram|saiu|torrei|perdi|apostei|transferi|mandei|emprestei|pedi|recebi|ganhei|entrou|caiu|vendi|faturei|lucrei|depositaram|me|pagou|pagaram|deu|deram|devolveu|devolveram|mandou|mandaram|foi|foram|eu|mais|com|numa|num|nuns|numas|uma|um|uns|umas|em|no|na|nos|nas|de|do|da|dos|das|pra|pro|pras|pros|para|por|pela|pelo|o|a|os|as|ai|la)\b\s*/;
  const SOBRA_FIM=/\s*\b(?:com|em|no|na|nos|nas|de|do|da|dos|das|pra|pro|para|por|pela|pelo|o|a|os|as|e|reais|real|foi|pago|paga)$/;

  const semAcento=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const paraNum=s=>parseFloat(String(s).replace(",","."));
  const ymd=(a,m,d)=>a+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  function diaAntes(hoje,n){ const [a,m,d]=hoje.split("-").map(Number); const x=new Date(a,m-1,d-n); return ymd(x.getFullYear(),x.getMonth()+1,x.getDate()); }
  // "dia 2" vale pro mês atual; se esse dia ainda não chegou, é do mês passado
  function diaDoMes(hoje,n){ const [a,m]=hoje.split("-").map(Number); const d=ymd(a,m,n); return d<=hoje?d:(m===1?ymd(a-1,12,n):ymd(a,m-1,n)); }

  function numerosPorExtenso(t){
    const un=Object.keys(UNID).join("|"), dz=Object.keys(DEZ).join("|"), cn=Object.keys(CEM).join("|");
    t=t.replace(new RegExp(`\\b(${dz}) e (${un})\\b`,"g"),(x,a,b)=>DEZ[a]+UNID[b]);
    t=t.replace(new RegExp(`\\b(${cn}) e (\\d+|${dz}|${un}|dez|onze|doze|quinze)\\b`,"g"),(x,a,b)=>CEM[a]+(/\d/.test(b)?+b:(DEZ[b]||UNID[b]||SOLTOS[b])));
    t=t.replace(/\bum mil\b/g,"mil");
    t=t.replace(/\b[a-z]+\b/g,w=>SOLTOS[w]!==undefined?SOLTOS[w]:w);
    t=t.replace(/(?:(\d+(?:[.,]\d+)?)\s*)?\bmil\b(?:\s+e\s+(\d{1,3})\b)?/g,(x,a,b)=>String(Math.round((a?paraNum(a):1)*1000)+(b?+b:0)));
    return t;
  }
  function limpar(s,acentos){
    for(const [re] of FORMAS) s=s.replace(re," ");
    s=s.replace(/\b(?:reais|real|contos?|pilas?|hoje|ontem|anteontem|agora|parcelado|parcelada)\b/g," ").replace(/\bfoi pag[oa]\b/g," ").replace(/\s+/g," ").trim();
    for(let antes=null;antes!==s;){ antes=s; s=s.replace(ENCHIMENTO,"").replace(SOBRA_FIM,"").trim(); }
    s=s.split(" ").map(w=>acentos[w]||w).join(" ");
    return s?s[0].toUpperCase()+s.slice(1):"";
  }
  const achar=(lista,c)=>(lista.find(([re])=>re.test(c))||[])[1]||null;
  window.categoriaDe=nome=>achar(SAIDAS,semAcento(nome))||"Contas";

  window.interpretar=function(texto,hoje){
    const acentos={}; for(const w of String(texto).split(/[^\p{L}\p{N}]+/u)) if(w) acentos[semAcento(w)]=w.toLowerCase();
    let t=" "+semAcento(texto)+" ";
    t=t.replace(/r\$\s*(\d[\d.,]*)/g,"$1 reais ").replace(/r\$\s*/g,"").replace(/(\d)\.(?=\d{3}\b)/g,"$1").replace(/\b(\d{1,3}) (\d{3})\b/g,"$1$2");
    t=numerosPorExtenso(t);
    t=t.replace(/(\d+)\s*(?:reais|real)\s+e\s+(\d{1,2})\s*centavos?/g,(x,a,b)=>a+","+b.padStart(2,"0")+" reais");
    const vazio={itens:[],naoEntendi:[]};

    // conta a pagar: "aluguel 800 vence todo dia 5", "luz vence dia 10"
    if(/\bvenc|\btodo dia \d|\btodo mes\b|\bconta fixa\b/.test(t)&&!/\bo que\b|\bquando\b|\bquanto\b|\bqual\b/.test(t)){
      const d=t.match(/\bdia (\d{1,2})\b/), todoMes=/\btodo (?:dia|mes)\b|\bfixa\b/.test(t);
      let s=t.replace(/\bdia \d{1,2}(?: de [a-z]+)?\b/," ").replace(/\b(?:vence|vencem|vencimento|venceu|todo mes|todo|conta fixa|conta de|conta do|conta da|conta)\b/g," ");
      const ns=(s.match(/\d+(?:[.,]\d{1,2})?/g)||[]).map(paraNum), valor=ns.length?Math.max(...ns):0;
      s=s.replace(/\d+(?:[.,]\d{1,2})?\s*(?:reais|real)?/g," ");
      return {...vazio,conta:{nome:limpar(s,acentos),valor,dia:d?+d[1]:0,todoMes}};
    }

    let diaFalado=null;
    t=t.replace(/\bdia (\d{1,2})(?: de (?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?\b/,(x,n)=>{ if(+n<1||+n>31) return x; diaFalado=diaDoMes(hoje,+n); return " "; });
    const data=diaFalado||(/\banteontem\b/.test(t)?diaAntes(hoje,2):/\bontem\b/.test(t)?diaAntes(hoje,1):hoje);

    // perguntas
    if(/\bdetalh|\bcomo foi\b|\bo que (?:eu )?(?:gastei|comprei|lancei|paguei)\b/.test(t)) return {...vazio,data,pergunta:"dia"};
    if(/\bque vence|\bfalta pagar\b|\bquanto devo\b|\bcontas? (?:em aberto|abertas?|a pagar|pra pagar)\b/.test(t)) return {...vazio,data,pergunta:"contas"};
    if(/\bposso gastar\b|\bquanto (?:ainda )?(?:resta|tenho)\b|\bdo limite\b/.test(t)) return {...vazio,data,pergunta:"limite"};
    if(/\bquanto\b|\bresumo\b|\bsaldo\b|\bsobrou\b/.test(t)&&!/\b(?:gastei|paguei|recebi|ganhei) \d/.test(t)){
      const periodo=/\bmes passado\b/.test(t)?"mespassado":/\banteontem\b/.test(t)?"mes":/\bontem\b/.test(t)?"ontem":/\bhoje\b/.test(t)?"hoje":/semana/.test(t)?"semana":"mes";
      return {...vazio,data,pergunta:periodo,categoria:achar(SAIDAS,t)};
    }

    // limite do mês: "meu limite é 2000"
    if(/\blimite\b|\bteto\b/.test(t)){ const m=t.match(/\d+(?:[.,]\d{1,2})?/); if(m) return {...vazio,limite:paraNum(m[0])}; }

    const itens=[], naoEntendi=[]; let ultimo=null, pagar=null;
    const geral=achar(FORMAS,t);
    const partes=t.split(/\s*[,;]\s+|\.\s+|\s+e\s+|\s+depois\s+|\s+tambem\s+/).map(c=>c.trim()).filter(Boolean);
    for(let c of partes){
      let parcelas=0, cadaParcela=0, m;
      if((m=c.match(/\b(?:em\s+|parcelei\s+em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\b(?:\s+de\s+(\d+(?:[.,]\d{1,2})?))?(?:\s*(?:reais|real))?/))){
        parcelas=+m[1]; cadaParcela=m[2]?paraNum(m[2]):0; c=c.replace(m[0]," ");
      }
      const ns=c.match(/\d+(?:[.,]\d{1,2})?/g);
      if(!ns&&!cadaParcela){
        const u=itens[itens.length-1], d=limpar(c,acentos);
        if(u&&d) u.descricao=u.descricao?u.descricao+" e "+d.toLowerCase():d;
        else if(d&&/paguei|\bpago\b/.test(c)) pagar=limpar(c.replace(/\bconta(?:s)? (?:de|do|da)\b|\bconta\b/g," "),acentos);
        continue;
      }
      let v=cadaParcela?cadaParcela*parcelas:0, sem=c;
      if(!cadaParcela){
        const r=c.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|contos?|pilas?)\b/);
        const lit=r?r[1]:ns.slice().sort((a,b)=>paraNum(b)-paraNum(a))[0];
        v=paraNum(lit);
        sem=r?c.replace(r[0]," "):c.replace(new RegExp("\\b"+lit.replace(/[.,]/,"[.,]")+"\\b(?:\\s*(?:contos?|pilas?))?")," ");
      }
      const catS=achar(SAIDAS,c), catE=achar(ENTRADAS,c);
      const forte=VERBO_ENTRADA_FORTE.test(c);
      let tipo=forte?"entrada":VERBO_SAIDA.test(c)?"saida":VERBO_ENTRADA.test(c)?"entrada":catS?"saida":catE?"entrada":ultimo;
      if(!tipo){ naoEntendi.push(c); continue; }
      const categoria=tipo==="saida"?(catS||(/comprei/.test(c)?"Compras":"Outros")):(catE||"Outros");
      let descricao=limpar(sem,acentos);
      if(semAcento(descricao)===semAcento(categoria)) descricao="";
      const forma=achar(FORMAS,c)||geral||(parcelas>1?"Crédito":"");
      const it={tipo,valor:v,categoria,data,descricao,forma};
      if(parcelas>1&&tipo==="saida") it.parcelas=parcelas;
      itens.push(it); ultimo=tipo;
    }
    return {itens,naoEntendi,data,pagar:itens.length?null:pagar};
  };
})();
