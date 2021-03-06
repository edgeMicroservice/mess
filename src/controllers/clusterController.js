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
    .then(({ updateType, objectUpdate }) => makeClusterProcessor(context)
      .updateObjectInCluster(updateType, objectUpdate, updateInfo.receivalFailedBy)
      .then((data) => { response.sendResult({ data }, 200, res); })
      .catch((error) => { response.sendError(error, res, 400); }));
};

const deleteObjectInCluster = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId } = swagger.params;

  makeClusterProcessor(context)
    .deleteObjectInCluster(objectType, objectId)
    .then((data) => { response.sendResult({ data }, 200, res); })
    .catch((error) => { response.sendError(error, res); });
};

module.exports = {
  createObjectInCluster,
  updateObjectInCluster,
  deleteObjectInCluster,
};
