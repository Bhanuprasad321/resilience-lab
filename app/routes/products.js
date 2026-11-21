const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET /products - list products; supports ?search= and ?limit=
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = req.query.search ? String(req.query.search).trim() : null;

    let filter = {};
    if (search) {
      // Phase 2 - Step 1: Inverted text index search ($text) replaces unindexed $regex COLLSCAN
      filter = { $text: { $search: search } };
    }

    const products = await Product.find(filter).limit(limit).lean();
    res.json({
      count: products.length,
      products,
    });
  } catch (err) {
    next(err);
  }
});

// GET /products/:id - fetch a single product by ID
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
