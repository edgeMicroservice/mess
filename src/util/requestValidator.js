const Promise = require('bluebird');

const missingNodeIdAndUrl = 'Must provide either imageUrl or imageHostNodeId.';
const foundBothNodeIdAndUrl = 'Provide either imageUrl or imageHostNodeId but not both.';
const missingImageId = 'Provide imageId is required with imageHostNodeId.';

const checkNewImageParams = (newImage) => new Promise((resolve, reject) => {
  const { imageHostNodeId, imageUrl, imageId } = newImage;
  let errorMessage;

  if (!imageUrl && !imageHostNodeId) {
    errorMessage = new Error(missingNodeIdAndUrl);
  } else if (imageUrl && imageHostNodeId) {
    errorMessage = new Error(foundBothNodeIdAndUrl);
  } else if (imageHostNodeId && !imageId) {
    errorMessage = new Error(missingImageId);
  }

  if (!errorMessage) return resolve();

  return reject(errorMessage);
});


const checkNewContainerParams = (newContainer) => new Promise((resolve, reject) => {
  const { imageHostNodeId, imageUrl } = newContainer;
  let errorMessage;

  if (imageUrl && imageHostNodeId) {
    errorMessage = new Error(foundBothNodeIdAndUrl);
  }

  if (!errorMessage) return resolve();

  return reject(errorMessage);
});

module.exports = {
  checkNewImageParams,
  checkNewContainerParams,
};
