const Promise = require('bluebird');

const {
  filter,
  map,
} = require('lodash');

const {
  requestTypes,
  generateRequestStoragePath,
  revertRequestStoragePath,
} = require('../util/requestUtil');

const MODEL_NAME = 'requests';

/*
  Data example

  nodeId/request = [
    {
      requestType: update_metadata,
      object: {
        id: 'id'
        type: 'type'
      }
    }
  ]
*/

const makeRequestModel = (context) => {
  const { storage } = context;

  const persistRequests = (storagePath, requests) => {
    try {
      const requestStr = JSON.stringify(requests);
      storage.setItemWithTag(storagePath, requestStr, MODEL_NAME);
      return Promise.resolve(requests);
    } catch (error) {
      return Promise.reject(new Error(`Error occured while persisting requests: ${error}`));
    }
  };

  const fetchRequests = (storagePath) => {
    try {
      const requests = storage.getItem(storagePath);

      if (!requests) return Promise.resolve([]);

      return Promise.resolve(JSON.parse(requests));
    } catch (error) {
      return Promise.reject(new Error(`Error occured while fetching requests: ${error}`));
    }
  };

  const removeRequests = (storagePath) => {
    try {
      storage.removeItemWithTag(storagePath, MODEL_NAME);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(`Error occured while deleting requests: ${error}`));
    }
  };

  const getRequests = (nodeId, filters) => {
    const storagePath = generateRequestStoragePath(nodeId);

    return fetchRequests(storagePath)
      .then((requests) => {
        if (!filters) return requests;

        const {
          objectId,
          objectType,
          requestType,
        } = filters;

        return filter(requests, (request) => {
          if (objectId && request.object.id !== objectId) return false;
          if (objectType && request.object.id !== objectType) return false;
          if (requestType && request.requestType !== requestType) return false;

          return true;
        });
      });
  };

  const addRequest = (nodeId, requestType, object) => {
    const storagePath = generateRequestStoragePath(nodeId);

    return fetchRequests(nodeId)
      .then((existingRequests) => {
        const existingRequestsForObject = [];
        const existingRequestsWithoutObject = [];

        let newRequestsForObject = [];

        let objectHasDeleteRequest = false;

        existingRequests.forEach((request) => {
          if (request.object.id === object.id && request.object.type === object.type) {
            existingRequestsForObject.push(request);

            if (request.requestType === requestTypes.DELETE_OBJECT) objectHasDeleteRequest = true;
          } else {
            existingRequestsWithoutObject.push(request);
          }
        });

        if (objectHasDeleteRequest) throw new Error(`Request cannot be saved for object as deletetion already requested: ${JSON.stringify({ requestType, object })}`);

        if (requestType === requestTypes.DELETE_OBJECT) {
          newRequestsForObject.push({
            requestType,
            object,
          });
        } else {
          newRequestsForObject = map(existingRequestsForObject, (extReq) => {
            if (extReq.requestType === requestType) return { requestType, object };
            return extReq;
          });
        }

        const allRequests = [...newRequestsForObject, ...existingRequestsWithoutObject];

        return persistRequests(storagePath, allRequests);
      });
  };

  const deleteRequests = (nodeId, requestType, object) => {
    const storagePath = generateRequestStoragePath(nodeId);

    return fetchRequests(nodeId)
      .then((existingRequests) => {
        if (existingRequests.length < 1) return existingRequests;

        const newRequests = filter(existingRequests, (extReq) => {
          if (extReq.requestType === requestType
            && extReq.object.id === object.id
            && extReq.object.type === object.type) return false;

          return true;
        });

        if (existingRequests.length === newRequests.length) return existingRequests;
        if (newRequests.length < 1) return removeRequests(storagePath).then(() => []);

        return persistRequests(storagePath, newRequests);
      });
  };

  const deleteAllRequestsForObject = (nodeId, object) => {
    const storagePath = generateRequestStoragePath(nodeId);

    return fetchRequests(nodeId)
      .then((existingRequests) => {
        if (existingRequests.length < 1) return existingRequests;

        const newRequests = filter(existingRequests, (extReq) => {
          if (extReq.object.id === object.id
            && extReq.object.type === object.type) return false;

          return true;
        });

        if (existingRequests.length === newRequests.length) return existingRequests;
        if (newRequests.length < 1) return removeRequests(storagePath).then(() => []);

        return persistRequests(storagePath, newRequests);
      });
  };

  const getRequestsPerNode = () => {
    const requestsPerNode = {};

    storage.eachItemByTag(
      MODEL_NAME,
      (key, value) => {
        try {
          const requests = JSON.parse(value);
          const nodeId = revertRequestStoragePath(key);
          requestsPerNode[nodeId] = requests;
        } catch (error) {
          // TODO Log this properly
          console.log('===> getRequestsPerNode error', error);
        }
      },
    );

    return Promise.resolve(requestsPerNode);
  };

  return {
    getRequests,
    addRequest,
    deleteRequests,
    deleteAllRequestsForObject,
    getRequestsPerNode,
  };
};

module.exports = makeRequestModel;
