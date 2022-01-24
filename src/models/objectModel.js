const Promise = require('bluebird');

const isMatch = require('lodash/isMatch');
const takeWhile = require('lodash/takeWhile');

const {
  generateObjectMetadataStoragePath,
  generateObjectDataStoragePath,
} = require('../util/objectUtil');

const MODEL_NAME = 'object';

const makeObjectModel = (context) => {
  const { storage } = context;

  const persistObject = (storagePath, object) => {
    try {
      const objectStr = JSON.stringify(object);
      storage.setItemWithTag(storagePath, objectStr, MODEL_NAME);

      return Promise.resolve(object);
    } catch (error) {
      return Promise.reject(new Error(`Error occured while persisting object: ${error}`));
    }
  };

  const fetchObject = (storagePath) => {
    try {
      const objectStr = storage.getItem(storagePath);
      const object = objectStr ? JSON.parse(objectStr) : undefined;

      return Promise.resolve(object);
    } catch (error) {
      return Promise.reject(new Error(`Error occured while fetching object: ${error}`));
    }
  };

  const removeObjectAndData = (objectStoragePath, objectDataStoragePath) => {
    try {
      storage.removeItem(objectStoragePath);
      storage.deleteFile(objectDataStoragePath);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(`Error occured while deleting object: ${error}`));
    }
  };

  const getObject = (objectType, objectId) => {
    const storagePath = generateObjectMetadataStoragePath(objectType, objectId);

    return fetchObject(storagePath)
      .then((object) => {
        if (!object) {
          const err = new Error();
          err.message = `No such file: ${storagePath}`;
          err.statusCode = 404;
          throw err;
        }

        return object;
      });
  };

  const saveObject = (newObject) => {
    const storagePath = generateObjectMetadataStoragePath(newObject.type, newObject.id);

    return fetchObject(storagePath)
      .then((origObject) => {
        if (origObject) throw new Error('Object already exists with same objectId and objectType');
        return persistObject(storagePath, newObject);
      });
  };

  const updateObject = (objectType, objectId, updateInfo) => {
    const storagePath = generateObjectMetadataStoragePath(objectType, objectId);

    return getObject(objectType, objectId)
      .then((origObject) => {
        const updatedObject = { ...origObject, ...updateInfo };
        return persistObject(storagePath, updatedObject);
      });
  };

  const deleteObject = (objectType, objectId) => {
    const objectStoragePath = generateObjectMetadataStoragePath(objectType, objectId);
    const objectDataStoragePath = generateObjectDataStoragePath(objectType, objectId);

    return getObject(objectType, objectId)
      .then(() => removeObjectAndData(objectStoragePath, objectDataStoragePath));
  };

  const getAllObjects = (filters) => {
    const objectList = [];
    storage.eachItemByTag(
      MODEL_NAME,
      (key, value) => {
        try {
          const object = JSON.parse(value);
          objectList.push(object);
        } catch (error) {
          // TODO Log this properly
          console.log('===> getAllObjects error', error);
        }
      },
    );

    if (!filters) return Promise.resolve(objectList);

    const result = takeWhile(objectList, (object) => isMatch(object, filters));
    return Promise.resolve(result);
  };


  return {
    getObject,
    saveObject,
    updateObject,
    deleteObject,
    getAllObjects,
  };
};

module.exports = makeObjectModel;
