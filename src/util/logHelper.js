const http = require('http');
const VError = require('verror');
const includes = require('lodash/includes');

const DEFAULT_NO_MESSAGE = 'no message';
const DEFAULT_NO_ERROR_NAME = 'no error name';
const NOT_HTTP_CODE = 'not http code';
const NO_ERROR = 'not an error object';
const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
const ERROR = 'error';

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

const getErrorStatusCode = (na, er) => {
  if (!na || na === 'System') return 500;
  if (na === 'Partial') return 206;
  if (na === 'MultiStatus') return 207;
  if (na === 'Parameter' || na === 'ParameterError' || (er && er.name === 'CastError' && er.kind !== 'ObjectId')) return 400;
  if (na === 'UnAuthorized') return 401;
  if (na === 'Forbidden') return 403;
  if (na === 'NotFound' || (er && er.name === 'CastError' && er.kind === 'ObjectId')) return 404;
  if (na === 'NotImplemented') return 405;
  if (na === 'Conflict' || (er && er.name === 'EntryError')) return 409;
  if (na === 'Unprocessable') return 422;
  return 500;
};

const getErrorIds = (num) => {
  if (num === 500) return [num, 'System', http.STATUS_CODES[num]];
  if (num === 400) return [num, 'Parameter', http.STATUS_CODES[num]];
  if (num === 401) return [num, 'UnAuthorized', http.STATUS_CODES[num]];
  if (num === 403) return [num, 'Forbidden', http.STATUS_CODES[num]];
  if (num === 404) return [num, 'NotFound', http.STATUS_CODES[num]];
  if (num === 405) return [num, 'NotImplemented', http.STATUS_CODES[num]];
  if (num === 409) return [num, 'Conflict', http.STATUS_CODES[num]];
  if (num === 420) return [num, 'Unprocessable', http.STATUS_CODES[num]];
  if (http.STATUS_CODES[num]) return [num, http.STATUS_CODES[num], http.STATUS_CODES[num]];
  return [500, DEFAULT_NO_ERROR_NAME, NOT_HTTP_CODE];
};

/**
 *
 * Create a rich error.
 *
 * @function getRichError
 * @requires @mimik/sumologic-winston-logger
 * @category sync
 * @param {object} val - If it is a string it represents the name of the error, if it is a number it represents the code of the error (e.g. 400, 500, ....).
 * Invalid string or number will result to a 500 Internal Error title.
 * @param {string} message - Message to associated with the error.
 * @param {object} info - Info as a JSON object to associate to the error.
 * @param {object} err - Error to encapsulate in the created error as a cause.
 * @param {string} logLevel - Indicates if the error needs to be log at creation with a specific level. If logLevel is `false` a error log will be created with `error`` level.
 * @param {string} correlationId - CorrelationId to be added to the log when log is enabled.
 * @return {object} The rich error.
 *
 * The error object if a [vError](https://www.npmjs.com/package/verror) object with the following:
 * ``` javascript
 * {
 *    "name": "name of the error",
 *    "info": "info of the error",
 *    "cause": "encapsulated error",
 *    "message": "message of the error"
 * }
 * ```
 */
const getRichError = (val, message, info, origErr, logLevel) => {
  log(logType.ERROR, message, origErr);

  const buildCause = (err) => {
    if (err === undefined || err === null || err instanceof VError) return err;
    const tempError = new Error(DEFAULT_NO_MESSAGE);

    if (err instanceof Error) {
      if (err.message) tempError.message = err.message;
      if (err.name) tempError.name = err.name;
      if (err.info) tempError.info = err.info;
      if (err.cause) tempError.cause = err.cause;
      if (err.statusCode) tempError.statusCode = err.statusCode;
      if (err.body) {
        Object.keys(err.body).forEach((key) => { tempError[key] = err.body[key]; });
      } else if (err.error) {
        Object.keys(err.error).forEach((key) => { tempError[key] = err.error[key]; });
      }
      if (tempError.statusCode) {
        tempError.title = err.title || http.STATUS_CODES[err.statusCode] || NOT_HTTP_CODE;
      }
      return tempError;
    }
    if (typeof err === 'object') {
      Object.keys(err).forEach((key) => { tempError[key] = err[key]; });
      return tempError;
    }
    if (typeof err === 'string' || typeof err === 'number') {
      tempError.message = err;
      return tempError;
    }
    tempError.message = NO_ERROR;
    tempError.info = err;
    return tempError;
  };
  let ids;
  const error = buildCause(origErr);

  if (typeof val === 'number') ids = getErrorIds(val);
  else ids = getErrorIds(getErrorStatusCode(val, error));
  const options = {
    name: ids[1],
    info,
  };

  if (error) options.cause = error;
  const verror = new VError(options, message || DEFAULT_NO_MESSAGE);

  [verror.statusCode, , verror.title] = ids;
  // if hide is undefined or null we should not log. hide has to be explicitely set to false.
  if (logLevel !== null && logLevel !== undefined) {
    if (logLevel === false) log(ERROR);
    else if (includes(LOG_LEVELS, logLevel)) log(logLevel);
    else if (logLevel !== true) log(ERROR);
  }
  return verror;
};

module.exports = {
  debugLog,
  throwException,
  getRichError,
  middlewareRequestLog,
  middlewareLoggedNext,
};
