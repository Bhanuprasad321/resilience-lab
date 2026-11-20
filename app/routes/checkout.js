const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// POST /checkout - converts the session cart into a persisted Order document
router.post('/', async (req, res, next) => {
  try {
    const cart = req.session.cart || [];
    if (!cart.length) {
      return res.status(400).json({ error: 'Cart is empty. Add items before checkout.' });
    }

    // Price snapshot: order items capture price at checkout time
    const orderItems = cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price, // Snapshot
      quantity: item.quantity,
    }));

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const customer = (req.session.user && req.session.user.username) || 'guest';

    const order = await Order.create({
      customer,
      items: orderItems,
      total: Math.round(total * 100) / 100,
      status: 'created',
    });

    // Clear session cart after successful order creation
    req.session.cart = [];

    res.status(201).json({
      message: 'Order created successfully',
      orderId: order._id,
      customer: order.customer,
      total: order.total,
      itemCount: order.items.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
