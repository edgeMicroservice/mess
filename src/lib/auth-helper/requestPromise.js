const Promise = require('bluebird');

const makeRequestPromise = (context) => {
  const request = (options) => {
    const { http } = context;
    return new Promise((resolve, reject) => {
      const updatedOptions = {
        url: options.url,
        type: options.type || options.method,
        authorization: options.authorization,
        data: JSON.stringify(options.data),
        success: (result) => {
          const response = result.data && result.data !== '' ? JSON.parse(result.data) : {};
          resolve(response);
        },
        error: (err) => {
          const errorContent = (!err.content || err.content === '') ? {
            message: err.message,
            status: err.status,
          } : JSON.parse(err.content);
          const errorObject = errorContent.error ? errorContent.error : errorContent;
          if (errorObject.msg) errorObject.message = errorObject.msg;
          reject(errorObject);
        },
      };

      if (options.data) {
        updatedOptions.data = JSON.stringify(options.data);
      } else if (options.body) {
        updatedOptions.data = JSON.stringify(options.body);
      }

      if (options.headers) {
        updatedOptions.headers = JSON.stringify(options.headers);
      }

      http.request(updatedOptions);
    });
  };

  return {
    request,
  };
};


module.exports = makeRequestPromise;
