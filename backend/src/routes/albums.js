const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => res.json([]));

module.exports = router;
