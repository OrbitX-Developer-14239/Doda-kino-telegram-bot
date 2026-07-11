export class TTLSet {
    constructor(ttlMs = 60_000) {
        this.ttlMs = ttlMs;
        this._map = new Map();
    }

    add(key) {
        if (this._map.has(key)) {
            clearTimeout(this._map.get(key));
        }
        const timer = setTimeout(() => this._map.delete(key), this.ttlMs);
        this._map.set(key, timer);
    }

    has(key) {
        return this._map.has(key);
    }

    delete(key) {
        if (this._map.has(key)) {
            clearTimeout(this._map.get(key));
            this._map.delete(key);
        }
    }

    get size() {
        return this._map.size;
    }
}

export class TTLMap {
    constructor(ttlMs = 300_000) {
        this.ttlMs = ttlMs;
        this._map = new Map();
        this._timers = new Map();
    }

    set(key, value) {
        if (this._timers.has(key)) {
            clearTimeout(this._timers.get(key));
        }
        this._map.set(key, value);
        const timer = setTimeout(() => {
            this._map.delete(key);
            this._timers.delete(key);
        }, this.ttlMs);
        this._timers.set(key, timer);
    }

    get(key) {
        return this._map.get(key);
    }

    has(key) {
        return this._map.has(key);
    }

    delete(key) {
        if (this._timers.has(key)) {
            clearTimeout(this._timers.get(key));
            this._timers.delete(key);
        }
        this._map.delete(key);
    }

    get size() {
        return this._map.size;
    }
}

export const pendingJoinRequests = new TTLSet(30 * 60 * 1000);

export const subscriptionMessageIds = new TTLMap(10 * 60 * 1000);

export const canceledSearches = new TTLSet(5 * 60 * 1000);
