const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  return req.session.cart;
}

// GET /cart - get current session cart
router.get('/', (req, res) => {
  const cart = getCart(req);
  res.json({
    count: cart.reduce((sum, item) => sum + item.quantity, 0),
    items: cart,
  });
});

// POST /cart - add item to session cart
router.post('/', async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity, 10) || 1;

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const cart = getCart(req);
    const existingIndex = cart.findIndex((item) => String(item.productId) === String(productId));

    if (existingIndex > -1) {
      cart[existingIndex].quantity += qty;
    } else {
      cart.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: qty,
      });
    }

    res.json({
      message: 'Item added to cart',
      cart,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
