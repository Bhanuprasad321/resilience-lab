const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Escape regex special characters to prevent ReDoS or invalid regex syntax errors
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// GET /products - list products; supports ?search= and ?limit=
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = req.query.search ? String(req.query.search).trim() : null;

    let filter = {};
    if (search) {
      const safeRegex = new RegExp(escapeRegex(search), 'i');
      // Intentionally unindexed search over 50,000 documents:
      // Forces a full collection scan across multi-sentence text on each query
      filter = {
        $or: [
          { name: safeRegex },
          { description: safeRegex },
        ],
      };
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
