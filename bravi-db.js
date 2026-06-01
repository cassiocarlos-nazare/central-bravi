// ============================================================
// bravi-db.js — Central Bravi v1.2
// localStorage (primário) + Google Apps Script (backup)
// ============================================================

const BraviDB = (() => {
  const P = 'bravi_';
  const TABELAS = ['profissionais','clientes','projetos','setores','funcoes',
                   'vinculos','prospects','reunioes','prof_extras','horas'];

  let apiUrl = localStorage.getItem('bravi_api_url') || '';

  // ── LER ──
  const ler = (t) => {
    try { return JSON.parse(localStorage.getItem(P+t) || '[]'); } catch(e) { return []; }
  };

  // ── SALVAR (localStorage + push em background) ──
  const salvar = (t, dados) => {
    localStorage.setItem(P+t, JSON.stringify(dados));
    _push(t, dados); // fire-and-forget, sem await
  };

  // ── CONFIGURAR API ──
  const configurarAPI = (url) => {
    apiUrl = url.trim();
    localStorage.setItem('bravi_api_url', apiUrl);
    console.log('BraviDB: API configurada →', apiUrl);
  };

  const temAPI    = () => !!apiUrl;
  const getApiUrl = () => apiUrl;

  // ── PUSH (fire-and-forget, sem CORS visível) ──
  const _push = (t, dados) => {
    if (!apiUrl) return;
    const body = new URLSearchParams({
      action: 'salvar', tabela: t, dados: JSON.stringify(dados)
    });
    fetch(apiUrl, { method:'POST', mode:'no-cors', body }).catch(()=>{});
  };

  // ── ENVIAR TUDO (dispara tudo em paralelo, retorna imediato) ──
  const enviarTudoParaAPI = () => {
    if (!apiUrl) { console.warn('BraviDB: API não configurada'); return false; }
    TABELAS.forEach(t => _push(t, ler(t)));
    console.log('BraviDB: ✅ Dados enviados em background!');
    return true;
  };

  // ── SINCRONIZAR (GET — lê da API para localStorage) ──
  const sincronizar = async () => {
    if (!apiUrl) return false;
    try {
      const resultados = await Promise.all(
        TABELAS.map(async t => {
          try {
            const r = await fetch(apiUrl + '?action=ler&tabela=' + t + '&_=' + Date.now());
            if (!r.ok) return false;
            const j = await r.json();
            if (j.ok && Array.isArray(j.dados)) {
              localStorage.setItem(P+t, JSON.stringify(j.dados));
              return true;
            }
            return false;
          } catch(e) { return false; }
        })
      );
      const ok = resultados.filter(Boolean).length;
      console.log('BraviDB: sync ' + ok + '/' + TABELAS.length + ' tabelas');
      return ok > 0;
    } catch(e) { console.warn('BraviDB: sync falhou', e.message); return false; }
  };

  // ── EXPORTAR JSON ──
  const exportar = () => {
    const bk = { exportadoEm: new Date().toISOString(), versao: '1.2' };
    TABELAS.forEach(t => { bk[t] = ler(t); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(bk,null,2)],{type:'application/json'}));
    a.download = 'bravi-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    console.log('BraviDB: backup exportado!');
  };

  // ── IMPORTAR JSON ──
  const importar = (arquivo, callback) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result); let n = 0;
        TABELAS.forEach(t => { if (d[t]) { salvar(t, d[t]); n++; } });
        callback && callback(true, n);
      } catch(err) { callback && callback(false, 0); }
    };
    r.readAsText(arquivo);
  };

  return { ler, salvar, configurarAPI, temAPI, getApiUrl,
           sincronizar, enviarTudoParaAPI, exportar, importar };
})();
