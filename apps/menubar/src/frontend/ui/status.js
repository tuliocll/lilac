// Barra de status (rodapé) e indicador de atividade na barra de título.
// Mensagens guardam a chave de tradução para serem re-traduzidas ao trocar de idioma.
(() => {
  const { $ } = Lilac.dom;
  const { t } = Lilac.i18n;

  let last = { text: '' };
  let busyCount = 0;

  function render() {
    const text = last.key ? t(last.key, last.vars) : last.text;
    $('status').textContent = text;
    $('status').classList.toggle('warn', Boolean(last.warn));
  }

  /** Mensagem traduzida: show('status.foundLocal', { count: 3 }) */
  function show(key, vars, { warn = false } = {}) {
    last = { key, vars, warn };
    render();
  }

  /** Texto pronto (ex.: erro vindo do backend). */
  function showText(text, { warn = false } = {}) {
    last = { text, warn };
    render();
  }

  /** Marca trabalho em andamento; devolve a função que encerra. */
  function busy() {
    busyCount++;
    document.body.classList.add('busy');
    let done = false;
    return () => {
      if (done) return;
      done = true;
      busyCount = Math.max(0, busyCount - 1);
      document.body.classList.toggle('busy', busyCount > 0);
    };
  }

  Lilac.i18n.onChange(render);
  Lilac.status = { show, showText, busy, clear: () => showText('') };
})();
