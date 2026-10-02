// PGlite has one PostgreSQL session. pglite-socket 0.2.11 locks explicit
// transactions, but otherwise may interleave Parse/Describe/Bind from different
// clients and overwrite the unnamed statement. Hold its existing queue ownership
// until ReadyForQuery, as well as for the explicit transactions it already locks.
// This adapter is used only by the disposable local test runner.
export function keepProtocolMessagesTogether(socket, db) {
  const queue = socket.queryQueue;
  if (!queue || queue.db !== db) throw new Error('Unsupported PGlite socket queue version.');
  let protocolOpen = false;
  let response = Buffer.alloc(0);
  queue.db = {
    isInTransaction: () => protocolOpen || db.isInTransaction(),
    runExclusive: callback => db.runExclusive(callback),
    exec: async sql => {
      const result = await db.exec(sql);
      protocolOpen = false;
      response = Buffer.alloc(0);
      return result;
    },
    execProtocolRawStream: (message, options) => {
      protocolOpen = true;
      return db.execProtocolRawStream(message, {
        ...options,
        onRawData(data) {
          response = Buffer.concat([response, Buffer.from(data)]);
          while (response.length >= 5) {
            const length = response.readUInt32BE(1) + 1;
            if (response.length < length) break;
            if (response[0] === 90) protocolOpen = false; // ReadyForQuery
            response = response.subarray(length);
          }
          options.onRawData(data);
        },
      });
    },
  };
}
