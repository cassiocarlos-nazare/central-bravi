// ============================================================
// bravi-db.js — Central Bravi v1.1
// Armazenamento localStorage + sync Google Apps Script
// ============================================================

const BraviDB = (() => {
  const P = 'bravi_';
  const TABELAS = ['profissionais','clientes','projetos','setores','funcoes','vinculos','prospects','reunioes','prof_extras','horas'];

  let apiUrl = localStorage.getItem('bravi_api_url') || '';

  // ── LER (localStorage — rápido) ──
  const ler = (t) => {
    try { return JSON.parse(localStorage.getItem(P+t) || '[]'); }
    catch(e) { return []; }
  };

  // ── SALVAR (localStorage + push API em background) ──
  const salvar = (t, dados) => {
    localStorage.setItem(P+t, JSON.stringify(dados));
    if (apiUrl) _push(t, dados);
  };

  // ── CONFIGURAR API ──
  const configurarAPI = (url) => {
    apiUrl = url.trim();
    localStorage.setItem('bravi_api_url', apiUrl);
    console.log('BraviDB: API configurada →', apiUrl);
  };

  const temAPI   = () => !!apiUrl;
  const getApiUrl = () => apiUrl;

  // ── SINCRONIZAR (API → localStorage) ──
  // GET simples — Apps Script responde com CORS ok para GET
  const sincronizar = async () => {
    if (!apiUrl) return false;
    try {
      let ok = true;
      for (const t of TABELAS) {
        const url = apiUrl + '?action=ler&tabela=' + t + '&_=' + Date.now();
        const r   = await fetch(url);
        if (!r.ok) { ok = false; continue; }
        const j = await r.json();
        if (j.ok && Array.isArray(j.dados)) {
          localStorage.setItem(P+t, JSON.stringify(j.dados));
        } else { ok = false; }
      }
      return ok;
    } catch(e) {
      console.warn('BraviDB: sync falhou →', e.message);
      return false;
    }
  };

  // ── PUSH (POST com no-cors → fire-and-forget, sem ler resposta) ──
  // no-cors: browser envia a requisição mas não lê a resposta — evita erro CORS
  // Apps Script salva os dados normalmente do lado do servidor
  const _push = async (t, dados) => {
    if (!apiUrl) return;
    try {
      // Usa form-encoded para evitar preflight CORS no POST
      const body = new URLSearchParams({
        action: 'salvar',
        tabela: t,
        dados:  JSON.stringify(dados)
      });
      await fetch(apiUrl, {
        method: 'POST',
        mode:   'no-cors',   // não lê resposta mas evita erro CORS
        body
      });
    } catch(e) {} // falha silenciosa — localStorage já foi salvo
  };

  // ── ENVIAR TUDO (migration / backup manual) ──
  const enviarTudoParaAPI = async () => {
    if (!apiUrl) return false;
    try {
      for (const t of TABELAS) await _push(t, ler(t));
      return true;
    } catch(e) { return false; }
  };

  // ── EXPORTAR JSON ──
  const exportar = () => {
    const bk = { exportadoEm: new Date().toISOString(), versao: '1.1' };
    TABELAS.forEach(t => { bk[t] = ler(t); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(bk, null, 2)], { type:'application/json' }));
    a.download = 'bravi-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  };

  // ── IMPORTAR JSON ──
  const importar = (arquivo, callback) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        let n = 0;
        TABELAS.forEach(t => { if (d[t]) { salvar(t, d[t]); n++; } });
        callback && callback(true, n);
      } catch(err) { callback && callback(false, 0); }
    };
    r.readAsText(arquivo);
  };

  return { ler, salvar, configurarAPI, temAPI, getApiUrl, sincronizar, enviarTudoParaAPI, exportar, importar };
})();
