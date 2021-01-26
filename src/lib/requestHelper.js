const Promise = require('bluebird');
const { keys, floor, random } = require('lodash');

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

  const sendRequest = (nodeId, requestType, requestAfter, object) => commonHelper
    .getCurrentContextDetails(({ currentNodeId }) => {
      const requester = () => {
        // TODO Handle currentNodeId scenarios
        // if (nodeId === currentNodeId) return Promise.resolve(false);

        // TODO add detection for type of failure and let it only retry if transient failure

        if (new Date() < requestAfter) return Promise.resolve(false);

        switch (requestType) {
          case requestTypes.CREATE_OBJECT:
            return messRequests.createObjectInCluster(nodeId, object);
          case requestTypes.UPDATE_OBJECT_DATA:
            return messRequests.updateObjectDataInCluster(nodeId, object);
          case requestTypes.UPDATE_OBJECT_METADATA:
            return messRequests.updateObjectMetadataInCluster(nodeId, object);
          case requestTypes.DELETE_OBJECT:
            return messRequests.deleteObjectInCluster(nodeId, object);
          case requestTypes.RECEIVAL_FAILED:
            return messRequests.markReceivalFailed(currentNodeId, nodeId, object);
          default:
            throw new Error(`Unknown requestType is requested to be sent: ${JSON.stringify({ nodeId, requestType, object })}`);
        }
      };

      // TODO ONLY THROW ERROR IF TRANSIENT ISSUE, SO QUEUE PROCESSOR CAN STOP

      return requester()
        .then((didSendRequest) => {
          if (didSendRequest) {
            // make sure request is still closed on failure if the failure was not connectivity
            return nodeReplayModel.deleteRequest(nodeId, requestType, object)
              .then((response) => {
                console.log('===> success received from cluster call', {
                  nodeId, requestType, object, response,
                });
              })
              .catch((error) => {
                console.log('===> error received from cluster call', {
                  nodeId, requestType, object, error,
                });
              });
          }
          return undefined;
        })
        .catch((error) => nodeReplayModel.markNodeFailedRetry(nodeId)
          .catch((retryError) => {
            console.log('===> error while marking retry failed', { error: retryError });
          })
          .then(() => { throw error; }));
    });

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

  const notifyMess = (nodeId, requestType, object) => {
    let requestAfter;
    if (requestType === requestTypes.RECEIVAL_FAILED) {
      requestAfter = new Date();
      requestAfter.setSeconds(requestAfter.getSeconds() + RECEIVAL_FAILED_DELAY);
    }

    return nodeReplayModel.addRequest(nodeId, requestType, requestAfter, object)
      .then(() => sendRequest(nodeId, requestType, requestAfter, object))
      .then(() => {
        initializeReplays();
      })
      .catch((error) => {
        console.log('===> error', error);
      });
  };


  return {
    notifyMess,
    initializeReplays,
  };
};

module.exports = makeRequestHelper;
