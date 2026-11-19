'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

const customer = { name: 'Ada Obi', email: 'ada@example.com', address: '12 Admiralty Way, Lekki, Lagos' };

function postOrder(body) {
  return fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('GET /health reports ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptimeSeconds, 'number');
});

test('GET /api/products returns the catalogue', async () => {
  const res = await fetch(`${base}/api/products`);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(list.length >= 6);
  for (const p of list) {
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.name, 'string');
    assert.ok(Number.isInteger(p.price) && p.price > 0);
  }
});

test('GET / serves the storefront', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Yuma Skincare/);
});

test('security headers are set', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('POST /api/orders creates an order and totals it on the server', async () => {
  const res = await postOrder({
    customer,
    items: [
      { id: 'vitc-serum', qty: 2 },
      { id: 'lip-duo', qty: 1 },
    ],
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.id, /^YUM-[0-9A-F]{6}$/);
  assert.equal(body.total, 18500 * 2 + 6500);
  assert.equal(body.status, 'received');
});

test('POST /api/orders ignores any price sent by the browser', async () => {
  const res = await postOrder({ customer, items: [{ id: 'lip-duo', qty: 1, price: 1 }] });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).total, 6500);
});

test('POST /api/orders rejects a bad email', async () => {
  const res = await postOrder({ customer: { ...customer, email: 'not-an-email' }, items: [{ id: 'lip-duo', qty: 1 }] });
  assert.equal(res.status, 400);
});

test('POST /api/orders rejects an unknown product', async () => {
  const res = await postOrder({ customer, items: [{ id: 'does-not-exist', qty: 1 }] });
  assert.equal(res.status, 400);
});

test('POST /api/orders rejects bad quantities', async () => {
  for (const qty of [0, -1, 11, 1.5, 'abc']) {
    const res = await postOrder({ customer, items: [{ id: 'lip-duo', qty }] });
    assert.equal(res.status, 400, `qty ${qty} should be rejected`);
  }
});

test('POST /api/orders rejects an empty cart', async () => {
  const res = await postOrder({ customer, items: [] });
  assert.equal(res.status, 400);
});

test('POST /api/orders rejects invalid JSON', async () => {
  const res = await postOrder('{ not json');
  assert.equal(res.status, 400);
});

test('unknown API routes return a JSON 404', async () => {
  const res = await fetch(`${base}/api/nothing-here`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});
