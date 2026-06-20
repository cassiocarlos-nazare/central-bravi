// ============================================================
// bravi-auth.js — Central Bravi
// Sessão compartilhada entre módulos (login feito no hub/index.html).
// Inclua este arquivo em qualquer módulo que precise checar login.
// ============================================================
const BraviAuth = (() => {
  const LS_SESSAO = 'bravi_sessao';

  /**
   * Lê a sessão ativa do localStorage, validando expiração.
   * Retorna null se não houver sessão ou se estiver expirada.
   */
  function getSessao() {
    try {
      const raw = localStorage.getItem(LS_SESSAO);
      if (!raw) return null;
      const sessao = JSON.parse(raw);
      if (!sessao || !sessao.expiraEm || Date.now() > sessao.expiraEm) {
        localStorage.removeItem(LS_SESSAO);
        return null;
      }
      return sessao;
    } catch (e) { return null; }
  }

  /**
   * Garante que existe uma sessão válida; caso contrário, redireciona
   * para o hub (index.html) e interrompe a execução do módulo atual.
   * Use no topo de cada módulo protegido, antes de renderizar qualquer coisa.
   *
   * @returns {object|null} a sessão, ou null (já redirecionou)
   */
  function exigirSessao() {
    const sessao = getSessao();
    if (!sessao) {
      window.location.href = 'index.html';
      return null;
    }
    return sessao;
  }

  /**
   * Determina o papel efetivo de acesso para regras de UI:
   * 'admin' e 'gestao' têm acesso amplo (tratados como equivalentes nas
   * regras de visibilidade atuais); 'profissional' é restrito aos próprios dados.
   */
  function temAcessoGestao(sessao) {
    return !!sessao && (sessao.papel === 'admin' || sessao.papel === 'gestao');
  }

  function ehProfissional(sessao) {
    return !!sessao && sessao.papel === 'profissional';
  }

  function logout() {
    localStorage.removeItem(LS_SESSAO);
    window.location.href = 'index.html';
  }

  return { getSessao, exigirSessao, temAcessoGestao, ehProfissional, logout, LS_SESSAO };
})();
