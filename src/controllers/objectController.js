const response = require('@mimik/edge-ms-helper/response-helper');

const makeObjectValidationHelper = require('../lib/objectValidationHelper');
const makeObjectProcessor = require('../processors/objectProcessor');


const createObject = (req, res) => {
  const { context, swagger } = req;

  const { newObject } = swagger.params;

  makeObjectValidationHelper(context)
    .validateAndPopulateNewObject(newObject)
    .then((preppedObject) => makeObjectProcessor(context)
      .createObject(preppedObject)
      .then((data) => { response.sendResult({ data }, 201, res); })
      .catch((error) => { response.sendError(error, res, 400); }));
};

const readObjects = (req, res) => {
  const { context, swagger } = req;

  const { objectType, destinationNodeId } = swagger.params;

  makeObjectProcessor(context)
    .readObjects(objectType, destinationNodeId)
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
      .catch((error) => response.sendHttpError(error, res, 400)));
};

const deleteObject = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId } = swagger.params;

  makeObjectProcessor(context)
    .deleteObject(objectType, objectId)
    .then((data) => response.sendResult({ data }, 200, res))
    .catch((error) => response.sendHttpError(error, res, 400));
};

const readObjectData = (req, res) => {
  const { context, swagger } = req;

  const { objectType, objectId } = swagger.params;

  makeObjectProcessor(context)
    .readObjectData(objectType, objectId)
    .then(({ path, mimeType }) => res.writeMimeFile(path, mimeType))
    .catch((error) => response.sendHttpError(error, res, 400));
};

const updateObjectData = (req, res) => {
  const { context, swagger, handleFormRequest } = req;

  const { objectType, objectId } = swagger.params;

  makeObjectProcessor(context)
    .updateObjectData(objectType, objectId, handleFormRequest)
    .then((data) => response.sendResult({ data }, 200, res))
    .catch((error) => response.sendHttpError(error, res, 400));
};

module.exports = {
  createObject,
  readObjects,
  readObject,
  updateObject,
  deleteObject,
  readObjectData,
  updateObjectData,
};
