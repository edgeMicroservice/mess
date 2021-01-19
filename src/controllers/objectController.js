const response = require('@mimik/edge-ms-helper/response-helper');

const makeObjectValidationHelper = require('../lib/objectValidationHelper');
const makeObjectProcessor = require('../processors/objectProcessor');

const createObject = (req, res) => {
  const { context, swagger } = req;

  const { newObject } = swagger.params;

  makeObjectValidationHelper(context)
    .validateAndPopulateNewObject(newObject)
    .then((validatedObject) => makeObjectProcessor(context)
      .createObject(validatedObject)
      .then((data) => { response.sendResult({ data }, 202, res); })
      .catch((error) => { response.sendError(error, res, 400); }));
};

const readObjects = (req, res) => {
  const { context, swagger } = req;

  const { objectType, destinationNodeId, updatedAfter } = swagger.params;

  makeObjectProcessor(context)
    .readObjects(objectType, destinationNodeId, new Date(updatedAfter))
    .then((data) => { response.sendResult({ data }, 200, res); })
    .catch((error) => { response.sendError(error, res, 400); });
};

const readObject = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId } = swagger.params;

  makeObjectProcessor(context)
    .readObjects(objectType, objectId)
    .then((data) => { response.sendResult({ data }, 200, res); })
    .catch((error) => { response.sendError(error, res, 400); });
};

const updateObject = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId, updateInfo } = swagger.params;

  makeObjectValidationHelper(context)
    .validateAndPopulateObjectUpdate(objectType, objectId, updateInfo)
    .then((preppedObject) => makeObjectProcessor(context)
      .updateObject(preppedObject, updateInfo)
      .then((data) => response.sendResult({ data }, 200, res))
      .catch((error) => response.sendHttpError(error, res)));
};

const deleteObject = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId } = swagger.params;

  makeObjectProcessor(context)
    .deleteObject(objectType, objectId)
    .then((data) => response.sendResult({ data }, 200, res))
    .catch((error) => response.sendHttpError(error, res));
};

module.exports = {
  createObject,
  readObjects,
  readObject,
  updateObject,
  deleteObject,
};
