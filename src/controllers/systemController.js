const response = require('@mimik/edge-ms-helper/response-helper');
const { getHealthCheckInfo } = require('../processors/systemProcessor');

function getHealthCheck(req, res) {
  const json = getHealthCheckInfo(req);
  response.sendResult(json, 200, res);
}

module.exports = {
  getHealthCheck,
};
