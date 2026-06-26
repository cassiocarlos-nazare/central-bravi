// ============================================================
// bravi-db.js — Central Bravi v1.3
// localStorage (primário) + Google Apps Script (backup)
//
// CORREÇÃO v1.3 (26/06/2026): salvar() agora é assíncrona e ESPERA a
// confirmação do Drive antes de retornar (em vez de fire-and-forget com
// mode:'no-cors'). Isso elimina uma condição de corrida grave: antes,
// se o usuário navegasse para outro módulo rápido demais após salvar
// (ex: inativar alguém no Cadastro e ir direto pro Recesso), o outro
// módulo podia sincronizar do Drive ANTES do push anterior terminar,
// trazendo de volta dados desatualizados e revertendo a mudança.
//
// Quem usa `salvar()` esperando que ela seja "fire-and-forget" continua
// funcionando (a Promise pode ser ignorada), mas quem precisa de garantia
// de persistência agora pode usar `await BraviDB.salvar(...)`.
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
  // ── SALVAR (localStorage imediato + push ESPERANDO confirmação do Drive) ──
  // Agora retorna uma Promise. Quem só quer "salvar rápido localmente sem
  // esperar a rede" pode chamar sem await — o localStorage já foi atualizado
  // de forma síncrona antes da Promise ser criada. Quem precisa ter certeza
  // de que o Drive já tem o dado mais recente (ex: antes de navegar para
  // outro módulo que vai sincronizar) deve usar `await`.
  const salvar = (t, dados) => {
    localStorage.setItem(P+t, JSON.stringify(dados));
    return _push(t, dados);
  };
  // ── CONFIGURAR API ──
  const configurarAPI = (url) => {
    apiUrl = url.trim();
    localStorage.setItem('bravi_api_url', apiUrl);
    console.log('BraviDB: API configurada →', apiUrl);
  };
  const temAPI    = () => !!apiUrl;
  const getApiUrl = () => apiUrl;
  // ── PUSH (agora ESPERA a resposta do servidor antes de resolver) ──
  // Trocado de mode:'no-cors' (fire-and-forget, resposta opaca/ilegível)
  // para uma requisição normal que aguarda o servidor confirmar que
  // gravou. Isso é o que elimina a condição de corrida: quem chama
  // `await BraviDB.salvar(...)` só segue adiante (ex: navegar de módulo)
  // depois que o Drive já está atualizado de verdade.
  const _push = async (t, dados) => {
    if (!apiUrl) return { ok: false, erro: 'API não configurada' };
    try {
      const body = new URLSearchParams({
        action: 'salvar', tabela: t, dados: JSON.stringify(dados)
      });
      const r = await fetch(apiUrl, { method: 'POST', body });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        console.warn('BraviDB: push de "' + t + '" pode não ter sido confirmado pelo servidor.', j);
        return { ok: false, erro: (j && j.erro) || 'resposta inválida do servidor' };
      }
      return { ok: true };
    } catch (e) {
      console.warn('BraviDB: falha de rede ao salvar "' + t + '".', e);
      return { ok: false, erro: e.message || String(e) };
    }
  };
  // ── ENVIAR TUDO (dispara tudo em paralelo, espera todos terminarem) ──
  const enviarTudoParaAPI = async () => {
    if (!apiUrl) { console.warn('BraviDB: API não configurada'); return false; }
    const resultados = await Promise.all(TABELAS.map(t => _push(t, ler(t))));
    const ok = resultados.filter(r => r && r.ok).length;
    console.log('BraviDB: ✅ ' + ok + '/' + TABELAS.length + ' tabelas confirmadas no Drive.');
    return ok === TABELAS.length;
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
    const bk = { exportadoEm: new Date().toISOString(), versao: '1.3' };
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
