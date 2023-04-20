let i = 0;
export default class CloudFlareKv {
  private db: any;
  static cache: Record<string, any> = {};
  init(db: any) {
    this.db = db;
  }
  async put(key: string, value: any) {
    console.debug('[kv put]', i++, key);
    CloudFlareKv.cache[key] = value;
    return this.db.put(key, value);
  }

  async get(key: string, force?: boolean) {
    force = true;
    if (!force && CloudFlareKv.cache[key] !== undefined) {
      return CloudFlareKv.cache[key];
    } else {
      console.debug('[kv get]', i++, key);
      CloudFlareKv.cache[key] = await this.db.get(key);
      return CloudFlareKv.cache[key];
    }
  }

  async delete(key: string) {
    console.debug('[kv delete]', i++, key);
    delete CloudFlareKv.cache[key];
    return this.db.delete(key);
  }

  async list(options: { prefix?: string }) {
    const rows = [];
    let cur = null;
    do {
      // @ts-ignore
      const { keys, cursor } = await this.db.list({
        prefix: options.prefix,
        cursor: cur,
      });
      console.debug('[kv list]', i++);
      rows.push(...keys);
      cur = cursor;
    } while (cur);

    return rows;
  }
}
