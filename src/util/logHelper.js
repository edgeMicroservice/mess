const logType = {
  ERROR: 'Error',
  DEBUG: 'Debug',
};

const log = (type, message, info) => {
  if (!info) {
    console.log(`\n \n##### ${type}: ${message}`, '\n \n');
  } else if (typeof info === 'object') {
    console.log(`\n \n##### ${type}: ${message}\n`, `\n${JSON.stringify(info, null, 2)}`, '\n \n');
  } else {
    console.log(`\n \n##### ${type}: ${message}:`, info, '\n \n');
  }
};

const throwException = (message, error) => {
  log(logType.ERROR, message, error);

  if (!error) {
    throw new Error(message);
  }

  let errorMessage = message;
  errorMessage += `: ${JSON.stringify(error)}`;
  throw new Error(errorMessage);
};

const debugLog = (message, info) => {
  log(logType.DEBUG, message, info);
};

let isLogged = false;
const middlewareRequestLog = (handlerName, req) => {
  const {
    method,
    url,
    body,
    authorization,
  } = req;
  if (!isLogged) {
    log(logType.DEBUG, 'Received Request', {
      method,
      url,
      body,
      authorization,
      env: req.context.env,
    });
  }
  isLogged = true;
  log(logType.DEBUG, `In '${handlerName}' handler`);
};

const middlewareLoggedNext = (handlerName, next, error) => {
  if (error) {
    debugLog(`'${handlerName}' failed`);
    next(error);
  } else {
    debugLog(`'${handlerName}' passed`);
    next();
  }
};

module.exports = {
  debugLog,
  throwException,
  middlewareRequestLog,
  middlewareLoggedNext,
};
