const Promise = require('bluebird');
const {
  keys,
  floor,
  random,
  map,
} = require('lodash');

const makeCommonHelper = require('./commonHelper');
const makeObjectModel = require('../models/objectModel');
const makeNodeReplayModel = require('../models/nodeReplayModel');
const makeMESSRequests = require('../external/messRequests');

const { requestTypes } = require('../util/nodeReplayUtil');

const RECEIVAL_FAILED_DELAY = 300; // seconds

const requestQueue = {};

const makeRequestHelper = (context) => {
  const objectModel = makeObjectModel(context);
  const commonHelper = makeCommonHelper(context);
  const messRequests = makeMESSRequests(context);
  const nodeReplayModel = makeNodeReplayModel(context);

  const markObjectReceived = (nodeId, object) => {
    const { destinations } = object;
    const updatedDestinations = map(destinations, (dest) => {
      if (dest.nodeId !== nodeId) return dest;

      const updatedDest = dest;
      updatedDest.receivedAt = new Date();
      return updatedDest;
    });

    return makeObjectModel(context).updateObject(object.type, object.id, { destinations: updatedDestinations });
  };

  const markObjectDeleted = (nodeId, object) => {
    const { destinations } = object;
    const updatedDestinations = map(destinations, (dest) => {
      if (dest.nodeId !== nodeId) return dest;

      const updatedDest = dest;
      updatedDest.deletedAt = new Date();
      return updatedDest;
    });

    return makeObjectModel(context).updateObject(object.type, object.id, { destinations: updatedDestinations });
  };

  const deleteRequestSuccessfully = (nodeId, requestType, object) => nodeReplayModel.deleteRequest(nodeId, requestType, object)
    .then((response) => {
      console.log('===> success received from cluster call', {
        nodeId, requestType, object, response,
      });
    })
    .catch((error) => {
      console.log('===> error received while deleting object', {
        nodeId, requestType, object, error,
      });
    });

  const sendRequest = (nodeId, requestType, requestAfter, object) => {
    const requester = () => {
      if (new Date() < requestAfter) return Promise.resolve(false);

      switch (requestType) {
        case requestTypes.CREATE_OBJECT:
          return messRequests.createObjectInCluster(nodeId, object);

        case requestTypes.UPDATE_OBJECT_DATA:
          return messRequests.updateObjectDataInCluster(nodeId, object)
            .then((response) => markObjectReceived(nodeId, object)
              .then(() => response));

        case requestTypes.UPDATE_OBJECT_METADATA:
          return messRequests.updateObjectMetadataInCluster(nodeId, object);

        case requestTypes.DELETE_OBJECT:
          return messRequests.deleteObjectInCluster(nodeId, object)
            .then((response) => markObjectDeleted(nodeId, object)
              .then(() => response));

        case requestTypes.RECEIVAL_FAILED:
          return commonHelper
            .getCurrentContextDetails()
            .then(({ currentNodeId }) => messRequests.markReceivalFailed(currentNodeId, nodeId, object));

        default:
          throw new Error(`Unknown requestType is requested to be sent: ${JSON.stringify({ nodeId, requestType, object })}`);
      }
    };

    return requester()
      .then((didSendRequest) => {
        if (didSendRequest) return deleteRequestSuccessfully(nodeId, requestType, object);
        return undefined;
      })
      .catch((error) => {
        const { statusCode } = error;
        if (statusCode
          && (floor(statusCode / 100) === 5 || statusCode === 429)) {
          return nodeReplayModel.markNodeFailedRetry(nodeId)
            .catch((retryError) => {
              console.log('===> error while marking retry failed', { error: retryError });
            })
            .then(() => { throw error; });
        }

        return deleteRequestSuccessfully(nodeId, requestType, object);
      });
  };

  const randomNodeReplayPicker = () => nodeReplayModel.getAllNodeIds()
    .then((nodeIds) => {
      if (nodeIds.length < 1) return {};

      const randomNodeId = nodeIds[floor(random() * nodeIds.length)];

      return nodeReplayModel.getNodeReplay(randomNodeId)
        .then((nodeReplay) => ({ nodeId: randomNodeId, nodeReplay }));
    });

  const queueProcessor = () => {
    const nodeId = keys(requestQueue)[0];
    const nodeReplay = requestQueue[nodeId];

    return Promise.mapSeries(nodeReplay.requests, (request) => objectModel.getObject(
      request.objectType, request.objectId,
    )
      .then((object) => sendRequest(nodeId, request.requestType, request.requestAfter, object)))
      .then(randomNodeReplayPicker)
      .then(({ nodeId: newNodeId, nodeReplay: newNodeReplay }) => {
        if (newNodeId) {
          console.log('===> all tasks are completed');
          return undefined;
        }
        requestQueue[newNodeId] = newNodeReplay;
        delete requestQueue[nodeId];
        return queueProcessor();
      });
  };

  const initializeReplays = (priorityNodeId) => {
    if (keys(requestQueue) > 0) return Promise.resolve();

    let selectedNodeId = priorityNodeId;

    return (() => {
      if (priorityNodeId) return nodeReplayModel.getNodeReplay(priorityNodeId, undefined, false);

      return randomNodeReplayPicker()
        .then(({ nodeId, nodeReplay }) => {
          selectedNodeId = nodeId;
          return nodeReplay;
        });
    })()
      .then((nodeReplay) => {
        requestQueue[selectedNodeId] = nodeReplay;
        queueProcessor();
      })
      .catch((error) => {
        console.log('===> error occured in initializeReplays', { error });
      });
  };

  const notifyMess = (nodeId, requestTypesToAdd, object) => commonHelper
    .getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) {
        return Promise.map((requestTypesToAdd), (requestType) => {
          if (requestType === requestTypes.DELETE_OBJECT) return markObjectDeleted(nodeId, object);
          if (requestType === requestTypes.UPDATE_OBJECT_DATA) return markObjectReceived(nodeId, object);

          return Promise.resolve();
        });
      }

      let requestTypesArr = [];

      if (typeof requestTypes === 'string') requestTypesArr.push(requestTypesToAdd);
      else if (Array.isArray(requestTypes)) requestTypesArr = requestTypesToAdd;
      else throw new Error(`Uknown requestTypesToAdd passed to notifyMess: ${requestTypesToAdd}`);

      return Promise.map(requestTypesArr, (requestType) => {
        let requestAfter;
        if (requestType === requestTypes.RECEIVAL_FAILED) {
          requestAfter = new Date();
          requestAfter.setSeconds(requestAfter.getSeconds() + RECEIVAL_FAILED_DELAY);
        }
        return nodeReplayModel.addRequest(nodeId, requestType, requestAfter, object);
      })
        .then(() => { initializeReplays(nodeId); })
        .catch((error) => {
          console.log('===> error occured in notifyMess', error);
        });
    });


  return {
    notifyMess,
    initializeReplays,
  };
};

module.exports = makeRequestHelper;
