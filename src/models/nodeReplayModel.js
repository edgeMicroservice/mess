const Promise = require('bluebird');

const {
  map,
  keys,
  filter,
} = require('lodash');

const {
  requestTypes,
  maximumRetries,
  minimumRetryDelay,
  requestsSorter,
  generateNodeReplayStoragePath,
  extractNodeIdFromStoragePath,
} = require('../util/nodeReplayUtil');

const MODEL_NAME = 'requests';

/*
  NodeReplay Data Schema example

  (Id)               (Data)
  nodeId/request = {
    requests: [
      {
        requestType: update_metadata,
        requestAfter: new Date(),
        objectId,
        objectType,
      }
    ],
    retries: {
      retryNumber: 0,
      retryAfter: new Date(),
      lastSuccessAt: new Date()
    },
  }
*/

const earliestDate = new Date('1970-01-01');

const makeNodeReplay = (context) => {
  const { storage } = context;

  const formatNodeReplay = (nodeReplay) => {
    const newRetries = {
      retryNumber: 0,
      retryAfter: earliestDate,
      lastSuccessAt: new Date(),
    };

    if (!nodeReplay) return { requests: [], retries: newRetries };

    const updatedNodeReplay = nodeReplay;
    if (!updatedNodeReplay.retries) updatedNodeReplay.retries = newRetries;
    else {
      if (!updatedNodeReplay.retries.retryNumber) updatedNodeReplay.retries.retryNumber = 0;

      updatedNodeReplay.retries.retryAfter = !updatedNodeReplay.retries.retryAfter
        ? earliestDate
        : new Date(updatedNodeReplay.retries.retryAfter);

      updatedNodeReplay.retries.lastSuccessAt = !updatedNodeReplay.retries.lastSuccessAt
        ? earliestDate
        : new Date(updatedNodeReplay.retries.lastSuccessAt);
    }

    updatedNodeReplay.requests = !updatedNodeReplay.requests
      ? []
      : map(updatedNodeReplay.requests, (request) => {
        const updatedRequest = request;
        updatedRequest.requestAfter = !updatedRequest.requestAfter
          ? earliestDate
          : new Date(updatedRequest.requestAfter);
      });

    updatedNodeReplay.requests = requestsSorter(updatedNodeReplay.requests);
    return updatedNodeReplay;
  };

  const persistNodeReplay = (storagePath, nodeReplay) => {
    try {
      const formattedNodeReplay = formatNodeReplay(nodeReplay);
      const requestStr = JSON.stringify(formattedNodeReplay);
      storage.setItemWithTag(storagePath, requestStr, MODEL_NAME);
      return Promise.resolve(formattedNodeReplay);
    } catch (error) {
      return Promise.reject(new Error(`Error occured while persisting requests: ${error}`));
    }
  };

  const fetchNodeReplay = (storagePath) => {
    try {
      const nodeReplayStr = storage.getItem(storagePath);

      if (!nodeReplayStr) return Promise.resolve(formatNodeReplay());

      const nodeReplay = JSON.parse(nodeReplayStr);
      return Promise.resolve(formatNodeReplay(nodeReplay));
    } catch (error) {
      return Promise.reject(new Error(`Error occured while fetching requests: ${error}`));
    }
  };

  const removeNodeReplay = (storagePath) => {
    try {
      storage.removeItem(storagePath, MODEL_NAME);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(`Error occured while deleting requests: ${error}`));
    }
  };

  const getNodeReplay = (nodeId, filters, checkIfCanRequestNow = true) => {
    const storagePath = generateNodeReplayStoragePath(nodeId);

    return fetchNodeReplay(storagePath)
      .then((nodeReplay) => {
        if (checkIfCanRequestNow) {
          if (new Date() < new Date(nodeReplay.retries.retryAfter)
            || nodeReplay.retries.retryNumber > maximumRetries) return formatNodeReplay();
        }

        if (!filters) return nodeReplay;

        const {
          objectId,
          objectType,
          requestType,
        } = filters;

        const filteredNodeReplay = nodeReplay;
        filteredNodeReplay.requests = filter(filteredNodeReplay.requests, (request) => {
          if (objectId && request.objectId !== objectId) return false;
          if (objectType && request.objectType !== objectType) return false;
          if (requestType && request.requestType !== requestType) return false;

          return true;
        });
        return filteredNodeReplay;
      });
  };

  const getAllNodeReplays = () => {
    const nodeReplaysMap = {};

    storage.eachItemByTag(
      MODEL_NAME,
      (key, value) => {
        try {
          const nodeReplay = JSON.parse(value);
          const nodeId = extractNodeIdFromStoragePath(key);
          nodeReplaysMap[nodeId] = formatNodeReplay(nodeReplay);
        } catch (error) {
          // TODO Log this properly
          console.log('===> getAllNodeReplays error', error);
        }
      },
    );

    return Promise.resolve(nodeReplaysMap);
  };

  const getAllNodeIds = (checkIfCanRequestNow = true) => {
    const nodeIds = [];

    // TODO remove inactive nodes

    storage.eachItemByTag(
      MODEL_NAME,
      (key, value) => {
        try {
          const nodeReplay = JSON.parse(value);
          const nodeId = extractNodeIdFromStoragePath(key);

          if (checkIfCanRequestNow
            && new Date() > new Date(nodeReplay.retries.retryAfter)
            && nodeReplay.retries.retryNumber <= maximumRetries) {
            nodeIds.push(nodeId);
          } else {
            nodeIds.push(nodeId);
          }
        } catch (error) {
          // TODO Log this properly
          console.log('===> getAllNodeIds error', error);
        }
      },
    );

    return Promise.resolve(nodeIds);
  };

  const markNodeFailedRetry = (nodeId) => {
    const storagePath = generateNodeReplayStoragePath(nodeId);

    return fetchNodeReplay(storagePath)
      .then((existingNodeReplay) => {
        const updatedNodeReplay = existingNodeReplay;

        const { retries: { retryNumber, lastSuccessAt } } = updatedNodeReplay;

        const retryAfter = new Date();
        retryAfter.setSeconds(retryAfter.getSeconds() + minimumRetryDelay ** (retryNumber + 1));

        updatedNodeReplay.retries = {
          retryNumber: retryNumber + 1,
          retryAfter,
          lastSuccessAt,
        };

        return persistNodeReplay(storagePath, updatedNodeReplay);
      });
  };

  const addRequest = (nodeId, requestType, requestAfter, object) => {
    const storagePath = generateNodeReplayStoragePath(nodeId);

    return fetchNodeReplay(nodeId)
      .then((existingNodeReplay) => {
        const existingRequestsWithoutObject = [];
        const existingRequestsWithObject = [];

        let doesObjectHaveDeleteRequest = false;
        let doesObjectHaveCreateRequest = false;
        let doesSameRequestExist = false;

        existingNodeReplay.requests.forEach((request) => {
          if (request.objectId === object.id && request.objectType === object.type) {
            existingRequestsWithObject.push(request);

            if (request.requestType === requestTypes.DELETE_OBJECT) doesObjectHaveDeleteRequest = true;
            if (request.requestType === requestTypes.CREATE_OBJECT) doesObjectHaveCreateRequest = true;
            if (request.requestType === requestType) doesSameRequestExist = true;
          } else {
            existingRequestsWithoutObject.push(request);
          }
        });

        if (doesObjectHaveDeleteRequest) throw new Error(`Request cannot be saved for object as deletetion already requested: ${JSON.stringify({ requestType, object })}`);

        const updatedNodeReplay = existingNodeReplay;
        const newRequest = {
          requestType,
          objectId: object.id,
          objectType: object.type,
        };
        if (requestAfter) newRequest.requestAfter = requestAfter;

        if (doesSameRequestExist) {
          updatedNodeReplay.requests = [
            ...map(existingRequestsWithObject, (request) => {
              if (requestType === request.requestType) {
                return { ...request, requestAfter };
              }
              return request;
            }),
            ...existingRequestsWithoutObject,
          ];
        } else if (requestType === requestTypes.DELETE_OBJECT) {
          if (doesObjectHaveCreateRequest) {
            updatedNodeReplay.requests = existingRequestsWithoutObject;
          } else {
            updatedNodeReplay.requests = [
              newRequest,
              ...updatedNodeReplay.requests,
            ];
          }
        } else {
          updatedNodeReplay.requests = [
            newRequest,
            ...updatedNodeReplay.requests,
          ];
        }

        return persistNodeReplay(storagePath, updatedNodeReplay);
      });
  };

  const deleteRequest = (nodeId, requestType, object, updateRetries = true) => {
    const storagePath = generateNodeReplayStoragePath(nodeId);

    return fetchNodeReplay(nodeId)
      .then((existingNodeReplay) => {
        const newRequests = filter(existingNodeReplay.requests, (extReq) => {
          if (extReq.requestType === requestType
            && extReq.objectId === object.id
            && extReq.objectType === object.type) return false;

          return true;
        });

        if (newRequests.length < 1) return removeNodeReplay(storagePath).then(formatNodeReplay);

        const updatedNodeReplay = existingNodeReplay;
        updatedNodeReplay.requests = newRequests;
        if (updateRetries) updatedNodeReplay.retries = undefined;

        return persistNodeReplay(storagePath, updatedNodeReplay);
      });
  };

  const deleteAllRequestsForObject = (object) => getAllNodeReplays()
    .then((nodeReplaysMap) => {
      const nodeIds = keys(nodeReplaysMap);

      const requestDeletionPromises = [];

      nodeIds.forEach((nodeId) => {
        const updatedNodeReplay = nodeReplaysMap[nodeId];
        const requests = filter(updatedNodeReplay.requests, (request) => {
          if (request.object === object.id && request.objectType === object.type) return false;
          return true;
        });

        if (updatedNodeReplay.requests.length !== requests.length) {
          updatedNodeReplay.requests = requests;

          requestDeletionPromises.push(persistNodeReplay(nodeId, updatedNodeReplay)
            .catch((error) => {
              // TODO log error properly
              console.log('===> deletion promise error', { nodeId, object, error });
            }));
        }
      });

      return Promise.all(requestDeletionPromises);
    });


  return {
    getNodeReplay,
    getAllNodeIds,
    markNodeFailedRetry,
    addRequest,
    deleteRequest,
    deleteAllRequestsForObject,
  };
};

module.exports = makeNodeReplay;
