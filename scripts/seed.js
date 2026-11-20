const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/resilience_lab';
const SEED_COUNT = parseInt(process.env.SEED_COUNT, 10) || 50000;
const BATCH_SIZE = 2500;

// Product schema matching app/models/Product.js
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  stock: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now },
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const CATEGORIES = ['Electronics', 'Home & Kitchen', 'Books', 'Clothing', 'Sports & Outdoors', 'Beauty & Health', 'Toys & Games'];

const ADJECTIVES = ['Wireless', 'Ergonomic', 'Ultra-Durable', 'Smart', 'Eco-Friendly', 'Portable', 'Industrial-Grade', 'Compact', 'Precision', 'High-Performance', 'Rechargeable', 'Waterproof', 'Noise-Cancelling', 'Vintage', 'Modular'];
const NOUNS = ['Headphones', 'Coffee Grinder', 'Mechanical Keyboard', 'Standing Desk', 'Water Bottle', 'Backpack', 'Action Camera', 'Fitness Tracker', 'Bluetooth Speaker', 'Monitor Stand', 'Power Bank', 'Chef Knife', 'Air Purifier', 'LED Lamp', 'Drone'];

const SENTENCE_A = [
  'Engineered for discerning professionals who demand uncompromising reliability and peak performance.',
  'Crafted from aerospace-grade lightweight materials designed to endure severe everyday wear and tear.',
  'Features intuitive touch controls and adaptive energy management for extended operational cycles.',
  'Seamlessly integrates with your everyday workflow while minimizing latency and physical strain.',
  'Built with precision-calibrated components tested under demanding ambient operating environments.'
];

const SENTENCE_B = [
  'Equipped with advanced noise-dampening acoustic chambers and high-fidelity neodymium transducers.',
  'Features high-capacity thermal dissipation pathways that prevent throttling during prolonged heavy usage.',
  'Includes customizable firmware profiles and dual low-latency wireless connectivity protocols.',
  'Provides ergonomic tactile feedback optimized through extensive biometric ergonomics testing.',
  'Delivers consistently accurate output backed by rigorous quality assurance benchmarking.'
];

const SENTENCE_C = [
  'Backed by an industry-leading 3-year replacement guarantee and dedicated technical support.',
  'Packaged in 100% recyclable biodegradable cardboard with zero single-use plastic waste.',
  'Compatible across all standard operating platforms without requiring third-party driver installations.',
  'Rated IP68 water and dust resistance for worry-free operation outdoors and in harsh workshop conditions.',
  'An essential addition to modern minimalist workspaces and demanding mobile setups alike.'
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProduct(index) {
  const adj = getRandomElement(ADJECTIVES);
  const noun = getRandomElement(NOUNS);
  const category = getRandomElement(CATEGORIES);
  const name = `${adj} ${noun} Pro-Series #${index + 1}`;
  
  // Multi-sentence description containing diverse keyword-rich text to make unindexed regex scanning expensive
  const description = `${getRandomElement(SENTENCE_A)} ${getRandomElement(SENTENCE_B)} ${getRandomElement(SENTENCE_C)} Tag: ${adj.toLowerCase()}-${noun.toLowerCase()}-v${(index % 9) + 1}.`;
  
  const price = Math.round((10 + Math.random() * 490) * 100) / 100;
  const stock = Math.floor(Math.random() * 200) + 10;

  return {
    name,
    description,
    price,
    category,
    stock,
  };
}

async function seed() {
  console.log(`Connecting to MongoDB at: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Connected to MongoDB successfully.');

  // Idempotency: drop collection before reseeding
  try {
    await Product.collection.drop();
    console.log('Existing products collection dropped for idempotent seeding.');
  } catch (err) {
    if (err.code === 26) {
      console.log('Collection did not exist yet; creating freshly.');
    } else {
      console.warn('Note on dropping collection:', err.message);
    }
  }

  console.log(`Generating and inserting ${SEED_COUNT.toLocaleString()} products in batches of ${BATCH_SIZE.toLocaleString()}...`);
  const startTime = Date.now();

  let insertedCount = 0;
  while (insertedCount < SEED_COUNT) {
    const currentBatchSize = Math.min(BATCH_SIZE, SEED_COUNT - insertedCount);
    const batch = [];
    for (let i = 0; i < currentBatchSize; i++) {
      batch.push(generateProduct(insertedCount + i));
    }

    await Product.insertMany(batch, { ordered: false });
    insertedCount += currentBatchSize;
    process.stdout.write(`\rProgress: ${insertedCount.toLocaleString()} / ${SEED_COUNT.toLocaleString()} products inserted (${Math.round((insertedCount / SEED_COUNT) * 100)}%)`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nDone! Successfully seeded ${insertedCount.toLocaleString()} products in ${durationSec}s.`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
