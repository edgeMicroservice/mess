const makeObjectModel = require('../models/objectModel');
const makeTokenSelector = require('../lib/tokenSelector');
const makeRequestHelper = require('../lib/requestHelper');
const makeDataSyncRequests = require('../external/dataSyncRequests');

const { getEdgeServiceLinkByNodeId } = require('../lib/auth-helper');

const {
  requestTypes,
} = require('../util/nodeReplayUtil');
const {
  objectServiceRoles,
  objectClusterUpdateTypes,
} = require('../util/objectUtil');

const makeClusterProcessor = (context) => {
  const initializeReplays = () => makeRequestHelper(context).initializeReplays();

  const createObjectInCluster = (newObject) => initializeReplays()
    .then(() => {
      const objectToSave = newObject;
      objectToSave.serviceRole = objectServiceRoles.DESTINATION;

      return makeObjectModel(context).saveObject(newObject);
    });

  const updateObjectInCluster = (updateType, objectUpdate, receivalFailedBy) => initializeReplays()
    .then(() => makeObjectModel(context).getObject(objectUpdate.type, objectUpdate.id)
      .then((object) => (() => {
        switch (updateType) {
          case objectClusterUpdateTypes.METADATA_UPDATED:
            return makeObjectModel(context).updateObject(objectUpdate.type, objectUpdate.id, objectUpdate);

          case objectClusterUpdateTypes.DATA_UPDATED:
            return Promise.all([
              makeRequestHelper(context).notifyMess(object.originId, requestTypes.RECEIVAL_FAILED, object),
              makeTokenSelector(context).selectUserToken()
                .then((accessToken) => {
                  const { serviceType } = context.info;
                  return getEdgeServiceLinkByNodeId(object.originId, serviceType, accessToken, context)
                    .then((originMessLink) => makeDataSyncRequests(context).syncData(object, originMessLink));
                }),
            ]);

          case objectClusterUpdateTypes.RECEIVAL_FAILED:
            return makeRequestHelper(context).notifyMess(receivalFailedBy, requestTypes.UPDATE_OBJECT_DATA, object);

          default:
            throw new Error(`Unexpected update type found on cluster object: ${JSON.stringify({ updateType, objectUpdate })}`);
        }
      })()));

  const deleteObjectInCluster = (objectType, objectId) => initializeReplays()
    .then(() => {
      const objectModel = makeObjectModel(context);

      return objectModel.getObject(objectType, objectId)
        .then((object) => objectModel.deleteObject(objectType, objectId)
          .then(() => object));
    });

  return {
    createObjectInCluster,
    updateObjectInCluster,
    deleteObjectInCluster,
  };
};

module.exports = makeClusterProcessor;