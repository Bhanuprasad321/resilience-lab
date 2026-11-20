const express = require('express');
const router = express.Router();

// POST /auth/login - simple username login, creates in-memory session (Phase 1 baseline)
router.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  req.session.user = {
    username: String(username).trim(),
    loggedInAt: new Date().toISOString(),
  };

  res.json({
    message: 'Logged in successfully',
    user: req.session.user,
  });
});

module.exports = router;
