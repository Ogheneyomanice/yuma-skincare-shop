'use strict';

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const products = require('./products');

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_STORED_ORDERS = 1000;

function createApp() {
  const app = express();
  const startedAt = Date.now();
  const orders = []; // In memory only. A real shop would use a database.

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    );
    next();
  });

  // Used by the load balancer, the Docker HEALTHCHECK, CI smoke tests and scripts/check_health.sh.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: process.env.APP_VERSION || 'dev',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  app.get('/api/products', (req, res) => {
    res.json(products);
  });

  app.post('/api/orders', (req, res) => {
    const { customer, items } = req.body || {};

    const validCustomer =
      customer &&
      typeof customer.name === 'string' &&
      customer.name.trim() !== '' &&
      typeof customer.email === 'string' &&
      EMAIL_PATTERN.test(customer.email) &&
      typeof customer.address === 'string' &&
      customer.address.trim() !== '';
    if (!validCustomer) {
      return res.status(400).json({ error: 'Name, a valid email and an address are required.' });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: 'Your cart must contain between 1 and 20 items.' });
    }

    // Prices always come from the server, never from the browser.
    let total = 0;
    const lines = [];
    for (const item of items) {
      const product = products.find((p) => p.id === (item && item.id));
      const qty = Number(item && item.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) {
        return res.status(400).json({ error: 'One of the items in your cart is invalid.' });
      }
      total += product.price * qty;
      lines.push({ id: product.id, name: product.name, qty, unitPrice: product.price });
    }

    const order = {
      id: 'YUM-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        address: customer.address.trim(),
      },
      lines,
      total,
      status: 'received',
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    if (orders.length > MAX_STORED_ORDERS) orders.shift();

    return res.status(201).json({ id: order.id, total: order.total, status: order.status });
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = { createApp };
