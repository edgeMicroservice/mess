const find = require('lodash/find');

const { extractFromServiceType } = require('../../util/serviceNameHelper');
const { getRichError } = require('../../util/logHelper');

const makeSessionMap = (context) => {
  let SESSION_KEYS_MAP;
  try {
    SESSION_KEYS_MAP = JSON.parse(context.env.SESSION_KEYS_MAP);
  } catch (error) {
    throw getRichError('System', 'Cannot parse SESSION_KEYS_MAP env string to JSON');
  }
  if (!SESSION_KEYS_MAP) throw getRichError('System', 'SESSION_KEYS_MAP env not assigned');
  if (!Array.isArray(SESSION_KEYS_MAP)) throw getRichError('System', 'SESSION_KEYS_MAP env is not an array');

  const { projectClientId } = extractFromServiceType(context.info.serviceType);

  const findBySessionId = (sessionId) => find(
    SESSION_KEYS_MAP, (map) => map.sessionId === sessionId,
  );

  const findByProject = (projectId) => {
    const projectSessionMap = find(
      SESSION_KEYS_MAP, (map) => map.projectId === (projectId || projectClientId),
    );
    if (projectSessionMap) return projectSessionMap;
    return find(
      SESSION_KEYS_MAP, (map) => map.projectId === 'common',
    );
  };

  return {
    findBySessionId,
    findByProject,
  };
};

module.exports = makeSessionMap;
