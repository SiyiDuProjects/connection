import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import { keepProtocolMessagesTogether } from './local-test-protocol.mjs';

const db = await PGlite.create();
await db.exec('create table counter (value integer); insert into counter values (0)');
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 3 });
keepProtocolMessagesTogether(socket, db);
await socket.start();
const clients = Array.from({length:3}, () => postgres(`postgresql://postgres@127.0.0.1:${socket.port}/postgres`, {max:1,prepare:false}));
try {
  for (let batch=0; batch<20; batch++) {
    await Promise.all(clients.map(async (client, index) => {
      const label = `client-${index}-${batch}`;
      const rows = await client.unsafe(index % 2 ? 'select $1::text as label' : 'select $1::text as label, $2::int as number', index % 2 ? [label] : [label, batch]);
      assert.equal(rows[0].label, label);
      await client.begin(async tx => {
        await tx.unsafe('update counter set value = value + $1::int', [1]);
        await new Promise(resolve => setTimeout(resolve, 1));
        const rows = await tx.unsafe('select $1::text as label, $2::int as number', [label, batch]);
        assert.equal(rows[0].label, label);
        assert.equal(rows[0].number, batch);
      });
    }));
  }
  await assert.rejects(clients[0].begin(async tx => {
    await tx.unsafe('update counter set value = value + $1::int', [500]);
    throw new Error('rollback fixture');
  }), /rollback fixture/);
  assert.equal((await clients[1].unsafe('select value from counter'))[0].value, 60);
  console.log('PASS 60 interleaved unnamed queries and transactions across three clients; values, commits and rollback remain isolated.');
} finally {
  await Promise.all(clients.map(client => client.end()));
  await socket.stop(); await db.close();
}
