'use strict';

(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var cart = loadCart(); // { productId: qty }
  var products = [];

  var el = {
    products: document.getElementById('products'),
    cart: document.getElementById('cart'),
    items: document.getElementById('cart-items'),
    total: document.getElementById('cart-total'),
    count: document.getElementById('cart-count'),
    message: document.getElementById('message'),
    form: document.getElementById('checkout'),
    version: document.getElementById('version'),
  };

  function naira(n) {
    return '₦' + n.toLocaleString('en-NG');
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem('yuma-cart')) || {};
    } catch (e) {
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem('yuma-cart', JSON.stringify(cart));
    } catch (e) { /* storage may be blocked; the cart still works for this visit */ }
  }

  function bottle(colors) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 60 100');
    svg.setAttribute('aria-hidden', 'true');
    var cap = document.createElementNS(SVG_NS, 'rect');
    cap.setAttribute('x', '22'); cap.setAttribute('y', '4');
    cap.setAttribute('width', '16'); cap.setAttribute('height', '14');
    cap.setAttribute('rx', '3'); cap.setAttribute('fill', '#2b2623');
    var body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', '8'); body.setAttribute('y', '18');
    body.setAttribute('width', '44'); body.setAttribute('height', '76');
    body.setAttribute('rx', '10'); body.setAttribute('fill', colors[0]);
    var label = document.createElementNS(SVG_NS, 'rect');
    label.setAttribute('x', '14'); label.setAttribute('y', '42');
    label.setAttribute('width', '32'); label.setAttribute('height', '30');
    label.setAttribute('rx', '4'); label.setAttribute('fill', '#fffdf9');
    svg.appendChild(cap); svg.appendChild(body); svg.appendChild(label);
    return svg;
  }

  function text(tag, cls, value) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    node.textContent = value;
    return node;
  }

  function renderProducts() {
    el.products.textContent = '';
    products.forEach(function (p) {
      var card = document.createElement('article');
      card.className = 'product';

      var art = document.createElement('div');
      art.className = 'art';
      art.style.background = p.colors[1];
      art.appendChild(bottle(p.colors));

      var row = document.createElement('div');
      row.className = 'row';
      row.appendChild(text('span', 'price', naira(p.price)));
      var add = text('button', 'button', 'Add to cart');
      add.type = 'button';
      add.setAttribute('data-id', p.id);
      add.addEventListener('click', function () {
        addToCart(p.id);
        add.textContent = 'Added ✓';
        setTimeout(function () { add.textContent = 'Add to cart'; }, 900);
      });
      row.appendChild(add);

      card.appendChild(art);
      card.appendChild(text('span', 'category', p.category + ' · ' + p.size));
      card.appendChild(text('h3', '', p.name));
      card.appendChild(text('p', '', p.description));
      card.appendChild(row);
      el.products.appendChild(card);
    });
  }

  function cartLines() {
    return Object.keys(cart)
      .map(function (id) {
        var p = products.find(function (x) { return x.id === id; });
        return p ? { product: p, qty: cart[id] } : null;
      })
      .filter(Boolean);
  }

  function renderCart() {
    var lines = cartLines();
    var total = 0;
    var count = 0;
    el.items.textContent = '';
    if (lines.length === 0) {
      el.items.appendChild(text('li', '', 'Your cart is empty.'));
    }
    lines.forEach(function (line) {
      total += line.product.price * line.qty;
      count += line.qty;
      var li = document.createElement('li');
      li.appendChild(text('span', '', line.product.name));

      var qty = document.createElement('span');
      qty.className = 'qty';
      var minus = text('button', '', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Remove one ' + line.product.name);
      minus.addEventListener('click', function () { changeQty(line.product.id, -1); });
      var plus = text('button', '', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Add one ' + line.product.name);
      plus.addEventListener('click', function () { changeQty(line.product.id, 1); });
      qty.appendChild(minus);
      qty.appendChild(document.createTextNode(' ' + line.qty + ' '));
      qty.appendChild(plus);
      li.appendChild(qty);
      li.appendChild(text('span', '', naira(line.product.price * line.qty)));
      el.items.appendChild(li);
    });
    el.total.textContent = naira(total);
    el.count.textContent = String(count);
    el.form.querySelector('button[type=submit]').disabled = lines.length === 0;
  }

  function addToCart(id) {
    cart[id] = Math.min((cart[id] || 0) + 1, 10);
    saveCart();
    renderCart();
  }

  function changeQty(id, delta) {
    var next = (cart[id] || 0) + delta;
    if (next <= 0) delete cart[id];
    else cart[id] = Math.min(next, 10);
    saveCart();
    renderCart();
  }

  function openCart() { el.cart.hidden = false; }
  function closeCart() { el.cart.hidden = true; }

  function setMessage(msg, kind) {
    el.message.textContent = msg;
    el.message.className = 'message ' + (kind || '');
  }

  function checkout(event) {
    event.preventDefault();
    var data = new FormData(el.form);
    var body = {
      customer: {
        name: String(data.get('name') || ''),
        email: String(data.get('email') || ''),
        address: String(data.get('address') || ''),
      },
      items: Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; }),
    };
    setMessage('Placing your order…', '');
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (json) { return { ok: res.ok, json: json }; });
      })
      .then(function (result) {
        if (!result.ok) {
          setMessage(result.json.error || 'Could not place the order.', 'error');
          return;
        }
        cart = {};
        saveCart();
        renderCart();
        el.form.reset();
        setMessage('Thank you! Order ' + result.json.id + ' received (' + naira(result.json.total) + ').', 'ok');
      })
      .catch(function () {
        setMessage('Network error. Please try again.', 'error');
      });
  }

  document.getElementById('cart-button').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  el.form.addEventListener('submit', checkout);

  fetch('/api/products')
    .then(function (res) { return res.json(); })
    .then(function (list) {
      products = list;
      // Drop anything in a saved cart that no longer exists in the catalogue.
      Object.keys(cart).forEach(function (id) {
        if (!products.some(function (p) { return p.id === id; })) delete cart[id];
      });
      renderProducts();
      renderCart();
    })
    .catch(function () {
      el.products.textContent = 'Sorry, the shop could not load. Please refresh.';
    });

  fetch('/health')
    .then(function (res) { return res.json(); })
    .then(function (h) { el.version.textContent = 'Version ' + h.version; })
    .catch(function () { /* footer version is optional */ });
})();
