/* Lazy worker client. Result IDs and filters are tied to each exact query request. */
(function (root) {
  'use strict';
  class SemanticSearch {
    constructor(ids, onStatus) {
      this.ids = ids;
      this.onStatus = onStatus;
      this.serial = 0;
      this.pending = new Map();
    }
    cancel() {
      const id = ++this.serial;
      for (const {resolve} of this.pending.values()) resolve(null);
      this.pending.clear();
      this.worker?.postMessage({type: 'cancel', id});
    }
    search(query, allowed) {
      this.cancel();
      if (!this.worker) {
        this.worker = new Worker(new URL('semantic-worker.js', document.baseURI));
        this.worker.onmessage = ({data}) => {
          if (data.type === 'status') { this.onStatus?.(data.message); return; }
          const request = this.pending.get(data.id);
          if (!request) return;
          this.pending.delete(data.id);
          if (data.type === 'error') request.reject(new Error(data.message));
          else request.resolve(data.results);
        };
        this.worker.onerror = () => {
          for (const {reject} of this.pending.values()) reject(new Error('Meaning search could not start'));
          this.pending.clear();
          this.worker.terminate();
          this.worker = null;
        };
      }
      const id = this.serial;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {resolve, reject});
        this.worker.postMessage({type:'search', id, query, allowed, ids:this.ids});
      });
    }
  }
  root.SemanticSearch = SemanticSearch;
})(globalThis);
