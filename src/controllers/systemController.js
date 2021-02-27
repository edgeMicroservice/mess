const response = require('@mimik/edge-ms-helper/response-helper');
const makeSystemProcessor = require('../processors/systemProcessor');

function getHealthCheck(req, res) {
  const { context, swagger } = req;
  const swaggerInfo = swagger.info;

  makeSystemProcessor(context)
    .getHealthCheck(swaggerInfo)
    .then((data) => { response.sendResult({ data }, 200, res); });
}

module.exports = {
  getHealthCheck,
};
