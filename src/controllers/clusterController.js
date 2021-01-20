const response = require('@mimik/edge-ms-helper/response-helper');

const makeObjectValidationHelper = require('../lib/objectValidationHelper');
const makeClusterProcessor = require('../processors/clusterProcessor');

const createObjectInCluster = (req, res) => {
  const { context, swagger } = req;

  const { newObject } = swagger.params;

  makeClusterProcessor(context)
    .createObjectInCluster(newObject)
    .then((data) => { response.sendResult({ data }, 201, res); })
    .catch((error) => { response.sendError(error, res, 400); });
};

const updateObjectInCluster = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId, updateInfo } = swagger.params;

  makeObjectValidationHelper(context)
    .validateAndPopulateObjectUpdateInCluster(objectType, objectId, updateInfo)
    .then((objectUpdate) => makeClusterProcessor(context)
      .updateObjectInCluster(objectType, objectId, objectUpdate)
      .then((data) => { response.sendResult({ data }, 200, res); })
      .catch((error) => { response.sendError(error, res, 400); }));
};

const deleteObjectInCluster = () => {

};

module.exports = {
  createObjectInCluster,
  updateObjectInCluster,
  deleteObjectInCluster,
};
