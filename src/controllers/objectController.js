const response = require('@mimik/edge-ms-helper/response-helper');
const makeObjectProcessor = require('../processors/objectProcessor');


const createObject = (req, res) => {
  const { context, swagger } = req;

  const { newObject } = swagger.params;

  makeObjectProcessor(context)
    .createObject(newObject)
    .then((data) => response.sendResult({ data }, 202, res))
    .catch((error) => response.sendHttpError(error, res));
};

const readObjects = (req, res) => {
  const { context, swagger } = req;

  const { objectType, destinationNodeId, updatedAfter } = swagger.params;

  makeObjectProcessor(context)
    .readObjects(objectType, destinationNodeId, new Date(updatedAfter))
    .then((data) => response.sendResult({ data }, 200, res))
    .catch((error) => response.sendHttpError(error, res));
};

// const postImage = (req, res) => {
//   const { context, swagger } = req;

//   checkNewImageParams(swagger.params.newImage)
//     .then(() => makeImageProcessor(context)
//       .postImage(swagger.params.newImage)
//       .then((result) => response.sendResult(result, 201, res)))
//     .catch((err) => response.sendError(err, res, 400));
// };

// const getImages = (req, res) => {
//   const { context } = req;

//   makeImageProcessor(context)
//     .getImages()
//     .then((data) => response.sendResult({ data }, 200, res))
//     .catch((err) => response.sendError(err, res, 400));
// };

// const deleteImage = (req, res) => {
//   const { context, swagger } = req;

//   makeImageProcessor(context)
//     .deleteImage(swagger.params.id)
//     .then(() => response.sendResult({ data: swagger.params.id }, 200, res))
//     .catch((err) => response.sendError(err, res, 400));
// };

module.exports = {
  createObject,
  readObjects,
};
