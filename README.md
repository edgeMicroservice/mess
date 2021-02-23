# mess
---
mess microsevice is defined to do the following:
      - Provides the view of the cluster, with nodes and services running on them.

# How to use it?
---

#### If this is your first time developing edge microservice, please follow the edge microservice development quick start guide from [mimik's developer portal](https://developer.mimik.com/resources/documentation/latest/getting-started/quick-start).

#### Before you use, you need to build the microservice and later deploy it to edgeSDK.

# Build Process
---

The build script **default.yml** is specified under **config** directory.

1. Install dependencies: ```npm install```
2. Run the build script: ```npm run build```
3. Package to container: ```npm run package```

# Deployment
---

For **mobile application development**, deployment is programmatically by **Android or iOS Wrappers**, learn more about it:

- Android: [Link](https://developer.mimik.com/resources/documentation/latest/wrappers/android-wrapper)
- iOS: [Link](https://developer.mimik.com/resources/documentation/latest/wrappers/ios-wrapper)

For **microservice development**, things you will need:

- edgeSDK running on the deployment targeted device.
- Obtained edge Acess Token and associate the device from **edgeSDK OAuth Tool**.
- Run the following commands under the same directory of your containerized microservice file:

```
curl -i -H 'Authorization: Bearer <edge Access Token>' -F "image=@<file name>.tar" http://<target IP address>:8083/mcm/v1/images
```

- To run the microservice after successful deployment, with environment variables:

```
curl -i -H 'Authorization: Bearer <edge Access Token>' -d '<env Variables>' http://<target IP address>:8083/mcm/v1/containers
```

- <target IP address> is localhost if running on local
- <file name> is the packaged file (*.tar) generated in 'deploy' folder of the project
- <edge Access Token> is provided by edgeSDK OAauth Tool. Copy the token and replace <edge Access Token>
- <env Variables> are provided in the repo file local/start-example.json. Omit variables inside start-example.json file (if required), copy the text and replace <env Variables>

- For more information and explanation, you can visit our [mCM container management API references](https://developer.mimik.com/resources/documentation/latest/getting-started/quick-start) and [general guide on packaing, deployment, and exporting microservice](https://developer.mimik.com/resources/documentation/latest/apis/mcm).