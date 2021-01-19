const makeClientModel = require('./tokenSelector');
const makeMCMRequests = require('../external/mCMRequests');

const { decodePayload } = require('./jwtHelper');

const makeObjectCommonHelper = (context) => {
  const fetchNodes = () => makeClientModel(context).selectUserToken()
    .then((accessToken) => makeMCMRequests(context).findByAccount(accessToken));

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
