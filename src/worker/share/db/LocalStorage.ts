export default class LocalStorage {
  private db: any;
  constructor() {
    this.init()
  }
  init() {
    this.db = window.localStorage;
  }

  put(key: string, value: any) {
    return this.db.setItem(key, value);
  }

  get(key: string) {
    return this.db.getItem(key);
  }

  delete(key: string) {
    return this.db.removeItem(key);
  }
}
