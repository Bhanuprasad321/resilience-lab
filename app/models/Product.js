const mongoose = require('mongoose');

// Deliberately NO indexes on name or description in Phase 1 Baseline!
// This causes queries with ?search= to trigger full collection scans (COLLSCAN)
// across 50,000 documents, producing measurable CPU saturation and latency spikes.
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
    default: 100,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Product', productSchema);
