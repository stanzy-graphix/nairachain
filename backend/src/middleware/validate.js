const { validationResult } = require('express-validator');

// Runs after express-validator chains. Responds with a readable `error`
// (first failure) plus the full `errors` array for field-level display.
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array();
  const first = errors[0];
  res.status(400).json({ error: first.msg === 'Invalid value' ? `Invalid ${first.path}` : first.msg, errors });
};

module.exports = { validate };
