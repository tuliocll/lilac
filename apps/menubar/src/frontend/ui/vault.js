// Persistência: segredos (sessão e local keys) no cofre do sistema —
// Keychain / Credential Manager / Secret Service — e o resto no tiny.store.
//
// As local keys vão agrupadas em poucos itens (`keys:0`, `keys:1`…): no macOS,
// cada item é um pedido de senha quando outro executável o lê ou regrava
// (atualização do app, `tinyjs dev`). Antes era um item por aparelho e tudo
// era regravado a cada sincronização — trinta aparelhos, dezenas de pedidos.
//
// Regras que protegem as chaves:
//   - cada aparelho fica sempre no mesmo grupo (novo entra no último que couber),
//     então uma gravação interrompida no meio não embaralha nada;
//   - uma chave guardada só sai quando o aparelho sai do inventário — nunca
//     porque chegou vazia;
//   - se um grupo não pôde ser lido, as chaves não são regravadas até ler;
//   - gravações entram em fila: duas ao mesmo tempo não se atropelam.
(() => {
  const secrets = tiny.app.secrets;
  /** abaixo do limite de 2560 bytes por item do Credential Manager (Windows) */
  const GROUP_BYTES = 2000;
  const bytes = (text) => new TextEncoder().encode(text).length;
  const macOS = () => {
    try {
      return tiny.system.isMacOS();
    } catch {
      return false;
    }
  };

  const parse = (text) => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  /**
   * Os grupos de chaves como estão no cofre; um grupo `null` não deu para ler.
   * `groups` inteiro `null`: nem a contagem deu para ler (tiny.store falhou).
   */
  let groups = [];
  /** Itens do formato antigo (`key:<id>`) para apagar depois de migrar. */
  let legacyToDelete = [];
  /** Último conteúdo de cada item no cofre: só regrava o que mudou. */
  const written = new Map();

  /** Lê um item; erro (pedido negado, cofre trancado) é diferente de "não existe". */
  async function get(name) {
    const value = await secrets.get(name);
    if (value) written.set(name, value);
    return value;
  }

  async function put(name, value) {
    if (written.get(name) === value) return;
    await secrets.set(name, value);
    written.set(name, value);
  }

  async function remove(name) {
    await secrets.delete(name);
    written.delete(name);
  }

  /** Lê o que ainda falta (a contagem, os grupos). Devolve false se algo continua ilegível. */
  async function loadGroups() {
    if (groups === null) {
      const count = await tiny.store.get('keyGroups').catch(() => undefined);
      if (count === undefined) return false;
      groups = Array.from({ length: typeof count === 'number' ? count : 0 }, () => null);
    }
    if (!groups.includes(null)) return true;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i] !== null) continue;
      groups[i] = await get(`keys:${i}`).then((text) => parse(text) ?? {}, () => null);
    }
    return !groups.includes(null);
  }

  async function readKeys(inventory, loggedIn) {
    const count = await tiny.store.get('keyGroups').catch(() => undefined);
    if (count === undefined) {
      groups = null; // sem a contagem não dá para saber o formato: não mexe em nada
      return {};
    }
    if (typeof count === 'number') {
      groups = Array.from({ length: count }, () => null);
      await loadGroups();
      return Object.assign({}, ...groups.filter(Boolean));
    }
    groups = [];
    // Formato antigo, um item por aparelho. No macOS, cada item de outro executável
    // pede senha: com conta, a sincronização logo em seguida traz as chaves de volta,
    // então só lemos as dos aparelhos importados (que a nuvem não conhece). Sem
    // internet nessa primeira abertura, o controle local espera a primeira sincronização.
    // Fora do macOS não há pedido por item: lemos e migramos tudo.
    const skipCloud = loggedIn && macOS();
    const keys = {};
    for (const device of inventory ?? []) {
      const name = `key:${device.id}`;
      if (skipCloud && device.homeId !== 'imported') continue;
      const key = await secrets.get(name).catch(() => null);
      if (key) keys[device.id] = key;
      // no macOS só apagamos o que lemos (com "Sempre Permitir", sem novo pedido);
      // os demais itens antigos ficam onde estão, inertes
      if (key || !macOS()) legacyToDelete.push(name);
    }
    return keys;
  }

  async function read() {
    const session = parse(await get('session').catch(() => null));
    // conta LG ThinQ (token, país e id do cliente), num item só
    const thinq = parse(await get('thinq').catch(() => null));
    const inventory = await tiny.store.get('inventory').catch(() => null);
    // só a conta Smart Life traz as local keys de volta: a LG não conta aqui
    return { session, inventory, keys: await readKeys(inventory, Boolean(session)), thinq };
  }

  /**
   * Os grupos novos a partir dos atuais: quem saiu do inventário sai do grupo,
   * quem mudou de chave muda no lugar, quem é novo entra no último grupo que couber.
   */
  function nextGroups(inventory, keys) {
    const present = new Set(inventory.map((d) => d.id));
    const next = groups.map((g) => Object.fromEntries(Object.entries(g).filter(([id]) => present.has(id))));
    const placed = new Map();
    next.forEach((g, i) => Object.keys(g).forEach((id) => placed.set(id, i)));
    for (const [id, key] of Object.entries(keys).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!key || !present.has(id)) continue;
      if (placed.has(id)) {
        next[placed.get(id)][id] = key;
        continue;
      }
      let last = next.length - 1;
      if (last < 0 || bytes(JSON.stringify({ ...next[last], [id]: key })) > GROUP_BYTES) {
        next.push({});
        last++;
      }
      next[last][id] = key;
      placed.set(id, last);
    }
    while (next.length && !Object.keys(next.at(-1)).length) next.pop();
    return next;
  }

  async function writeKeys(inventory, keys) {
    // um grupo ilegível regravado agora perderia as chaves dele: espera a próxima
    if (!(await loadGroups())) return;
    const next = nextGroups(inventory, keys);
    // ordem segura: grupos, depois a contagem, depois o que sobrou
    for (let i = 0; i < next.length; i++) await put(`keys:${i}`, JSON.stringify(next[i]));
    await tiny.store.set('keyGroups', next.length);
    const before = groups.length;
    groups = next;
    for (let i = next.length; i < before; i++) await remove(`keys:${i}`).catch(() => {});
    for (const name of legacyToDelete.splice(0)) await secrets.delete(name).catch(() => {});
  }

  async function writeNow({ session, inventory, keys, thinq }) {
    if (session) await put('session', JSON.stringify(session));
    else await remove('session');
    if (thinq) await put('thinq', JSON.stringify(thinq));
    else if (written.has('thinq')) await remove('thinq');
    await tiny.store.set('inventory', inventory);
    await writeKeys(inventory, keys);
  }

  /** Recebe o evento `persist` do backend. Uma gravação por vez, na ordem em que chegam. */
  let queue = Promise.resolve();
  function write(data) {
    const run = queue.then(() => writeNow(data));
    queue = run.catch(() => {});
    return run;
  }

  Lilac.vault = { read, write };
})();
