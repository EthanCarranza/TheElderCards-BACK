const app = require('./index.js');

module.exports = async (req, res) => {
  return app(req, res);
};