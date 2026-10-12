// Persistência: segredos (sessão e local keys) no cofre do sistema —
// Keychain / Credential Manager / Secret Service — e o resto no tiny.store.
(() => {
  const secrets = tiny.app.secrets;

  async function read() {
    const session = await secrets.get('session').then((s) => (s ? JSON.parse(s) : null)).catch(() => null);
    const inventory = await tiny.store.get('inventory').catch(() => null);
    const keys = {};
    for (const device of inventory ?? []) {
      const key = await secrets.get(`key:${device.id}`).catch(() => null);
      if (key) keys[device.id] = key;
    }
    return { session, inventory, keys };
  }

  /** Recebe o evento `persist` do backend. Uma chave por aparelho: o Credential Manager limita o tamanho. */
  async function write({ session, inventory, keys }) {
    if (session) await secrets.set('session', JSON.stringify(session));
    else await secrets.delete('session');

    const previous = (await tiny.store.get('inventory').catch(() => null)) ?? [];
    await tiny.store.set('inventory', inventory);
    for (const [id, key] of Object.entries(keys)) if (key) await secrets.set(`key:${id}`, key);
    for (const device of previous) if (!(device.id in keys)) await secrets.delete(`key:${device.id}`);
  }

  TuyaBar.vault = { read, write };
})();
