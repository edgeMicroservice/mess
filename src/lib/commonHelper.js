const makeClientModel = require('./tokenSelector');
const makeMDSRequests = require('../external/mDSRequests');

const { decodePayload } = require('./jwtHelper');

const makeObjectCommonHelper = (context) => {
  const fetchNodes = () => makeClientModel(context).selectUserToken()
    .then((accessToken) => makeMDSRequests(context).findByAccount(accessToken));

  const getCurrentContextDetails = () => makeClientModel(context).selectUserToken()
    .then((accessToken) => {
      const decodedToken = decodePayload(accessToken);
      const accountId = decodedToken.sub;
      const currentNodeId = decodedToken.node_id;

      return {
        accountId,
        currentNodeId,
      };
    });

  return {
    fetchNodes,
    getCurrentContextDetails,
  };
};

module.exports = makeObjectCommonHelper;
