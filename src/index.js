const { init } = require('@mimik/edge-ms-helper/init-helper');

const swaggerMiddleware = require('../build/mess-swagger-mw');
const { edgeSessionMiddleware } = require('./lib/auth-helper');

mimikModule.exports = init([edgeSessionMiddleware, swaggerMiddleware]);
