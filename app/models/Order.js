const mongoose = require('mongoose');

// Order item schema stores a price snapshot at checkout time to prevent post-checkout mutations
const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true, // Price snapshot
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customer: {
    type: String,
    default: 'anonymous',
  },
  items: {
    type: [orderItemSchema],
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'completed'],
    default: 'created',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', orderSchema);
