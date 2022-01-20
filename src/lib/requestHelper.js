const Promise = require('bluebird');

const keys = require('lodash/keys');
const floor = require('lodash/floor');
const random = require('lodash/random');
const map = require('lodash/map');
const every = require('lodash/every');
const filter = require('lodash/filter');

const makeTokenSelector = require('./tokenSelector');
const makeCommonHelper = require('./commonHelper');
const makeObjectModel = require('../models/objectModel');
const makeNodeReplayModel = require('../models/nodeReplayModel');
const makeMESSRequests = require('../external/messRequests');
const makeMDSRequests = require('../external/mDSRequests');

const { requestTypes } = require('../util/nodeReplayUtil');

const RECEIVAL_FAILED_DELAY = 300; // seconds

let isReplayRequested;
const activeNodeReplays = {};

const makeRequestHelper = (context) => {
  const objectModel = makeObjectModel(context);
  const commonHelper = makeCommonHelper(context);
  const messRequests = makeMESSRequests(context);
  const nodeReplayModel = makeNodeReplayModel(context);

  // Objective for this method is to cache cluster node list before response is returned as it causes service to crash otherwise
  const cacheCluster = () => makeTokenSelector(context)
    .selectUserToken()
    .then((edgeAccessToken) => makeMDSRequests(context)
      .findByAccount(edgeAccessToken));

  const markObjectReceived = (nodeId, object) => {
    const { destinations } = object;
    const updatedDestinations = map(destinations, (dest) => {
      if (dest.nodeId !== nodeId) return dest;

      const updatedDest = dest;
      updatedDest.receivedAt = new Date();
      return updatedDest;
    });

    return objectModel.updateObject(object.type, object.id, { destinations: updatedDestinations });
  };

  const markObjectDeleted = (nodeId, object) => {
    const { destinations } = object;
    const updatedDestinations = map(destinations, (dest) => {
      if (dest.nodeId !== nodeId) return dest;

      const updatedDest = dest;
      updatedDest.deletedAt = new Date();
      return updatedDest;
    });

    return objectModel.updateObject(object.type, object.id, { destinations: updatedDestinations })
      .then((updatedObject) => {
        const areAllDestinationsDeleted = every(updatedObject.destinations, (dest) => !!dest.deletedAt);
        if (!areAllDestinationsDeleted) return updatedObject;

        return objectModel.deleteObject(object.type, object.id);
      });
  };

  const deleteRequestSuccessfully = (nodeId, requestType, object) => nodeReplayModel.deleteRequest(nodeId, requestType, object);

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

      const alreadyQueuedNodeIds = keys(activeNodeReplays);
      const selectableNodeIds = filter(nodeIds, (nodeId) => !alreadyQueuedNodeIds.includes(nodeId));

      const randomNodeId = selectableNodeIds[floor(random() * selectableNodeIds.length)];

      return nodeReplayModel.getNodeReplay(randomNodeId)
        .then((nodeReplay) => ({ nodeId: randomNodeId, nodeReplay }));
    });

  const replayProcessor = (nodeId) => {
    const nodeReplay = activeNodeReplays[nodeId];

    return Promise.mapSeries(nodeReplay.requests, (request) => (() => {
      if (request.requestType === requestTypes.DELETE_OBJECT) {
        return Promise.resolve({
          id: request.objectId,
          type: request.objectType,
        });
      }

      return objectModel.getObject(request.objectType, request.objectId);
    })()
      .then((object) => sendRequest(nodeId, request.requestType, request.requestAfter, object)));
  };

  const initializeReplays = (priorityNodeId) => {
    let selectedNodeId = priorityNodeId;

    return Promise.resolve()
      .then(() => {
        if (priorityNodeId) return nodeReplayModel.getNodeReplay(priorityNodeId, undefined, false);

        return randomNodeReplayPicker()
          .then(({ nodeId, nodeReplay }) => {
            selectedNodeId = nodeId;
            return nodeReplay;
          });
      })
      .then((nodeReplay) => {
        if (!nodeReplay) return undefined;

        activeNodeReplays[selectedNodeId] = nodeReplay;
        return replayProcessor(selectedNodeId)
          .catch((error) => {
            console.log('===> error occured in queueProcessor', error);
          });
      })
      .catch((error) => {
        console.log('===> error occured in initializeReplays', { error });
      });
  };

  const notifyMess = (nodeId, requestTypesToAdd, object) => commonHelper
    .getCurrentContextDetails()
    .then(({ currentNodeId }) => {
      if (nodeId === currentNodeId) {
        return Promise.map([requestTypesToAdd], (requestType) => {
          if (requestType === requestTypes.DELETE_OBJECT) return markObjectDeleted(nodeId, object);
          if (requestType === requestTypes.UPDATE_OBJECT_DATA) return markObjectReceived(nodeId, object);

          return Promise.resolve();
        });
      }

      let requestTypesArr = [];
      if (typeof requestTypesToAdd === 'string') requestTypesArr.push(requestTypesToAdd);
      else if (Array.isArray(requestTypes)) requestTypesArr = requestTypesToAdd;
      else throw new Error(`Unknown requestTypesToAdd passed to notifyMess: ${requestTypesToAdd}`);

      return Promise.map(requestTypesArr, (requestType) => {
        let requestAfter;
        if (requestType === requestTypes.RECEIVAL_FAILED) {
          requestAfter = new Date();
          requestAfter.setSeconds(requestAfter.getSeconds() + RECEIVAL_FAILED_DELAY);
        }

        return nodeReplayModel.addRequest(nodeId, requestType, requestAfter, object);
      })
        .then(() => initializeReplays(nodeId))
        .catch((error) => {
          console.log('===> error occured in notifyMess', error);
        });
    });

  const runReplaysParallelly = (mainProcess) => {
    const shouldRequestReplay = !isReplayRequested;
    isReplayRequested = true;

    return cacheCluster()
      .then(typeof mainProcess === 'function' ? mainProcess : () => mainProcess)
      .finally(() => (shouldRequestReplay ? initializeReplays().catch(() => { }) : Promise.resolve()));
  };

  return {
    notifyMess,
    runReplaysParallelly,
  };
};

module.exports = makeRequestHelper;
