Node library for the Guardian's [permissions service](https://github.com/guardian/permissions)

# Dependencies

Permissions are applied on a user email, you must include an authentication library such as [panda](https://github.com/guardian/pan-domain-node).

The client requires node 4.3 or newer.

# Installation

```
npm install --save node-permissions-client
```

# Usage

```js
const permissions = require('node-permissions-client')({
	app: 'application name, should match what is in permissions model',
	s3Bucket: 'permissions-cache-s3-bucket',
	s3BucketPrefix: 'STAGE',
	s3PermissionsFile: 'permissions.json',
	s3Region: 'eu-west-1',
	// Optional values:
	sendStatus: true, // If `true` the middleware responds with status `403`. If false it forwards the error.
	logger: console, // or any other object implementing .info .warn .error
	s3Client: null, // instance of AWS.S3 in case you want to override the default
	updateInterval: 60, // seconds, how often should the cache update
	onUpdate: function () {} // callback to be notified after the cache gets updated
});

app.post('/api/sensitive/action', permissions('permission_name'), function (req, res) {
	// Your code here
});
```

## Advanced usage

### Custom logger

If your application is using a custom logger like [winston](https://github.com/winstonjs/winston) or [bunyan](https://github.com/trentm/node-bunyan) you can use the following code, by default it logs to the console.

```js
const permissionClient = require('node-permissions-client');
const bunyan = require('bunyan');
const winston = require('winston');

const bunyanLogger = bunyan.createLogger({
	level: 'warn'
});
const winstonLogger = new (winston.Logger)({
	level: 'warn',
	transports: []
});
const permissions = permissionClient({
	logger: bunyanLogger,
	// or
	logger: winstonLogger
});
```

### Multiple permissions

You can leverage express middleware to authorize an endpoint against multiple permissions.
The user must be authorized with both permissions.

```js
const permissions = require('node-permissions-client')({
	app: 'application',
	s3Bucket: 'bucket',
	s3BucketPrefix: 'STAGE',
	s3PermissionsFile: 'permissions.json'
});

app.post(
	'/api/sensitive/action',
	permissions('permission_one'),
	permissions('permission_two'),
	function (req, res) {
		// Your code here
	}
);
```

### Error handling

By default the middleware returns a `403` error if the user is not authorized.

You can customize the error response setting `sendStatus: false`

```js
const permissionsClient = require('node-permissions-client');
const permissions = permissionsClient({
	app: 'application',
	s3Bucket: 'bucket',
	s3BucketPrefix: 'STAGE',
	s3PermissionsFile: 'permissions.json',
	sendStatus: false
});

app.post('/api/sensitive/action', permissions('deny'), (req, res) => {});

app.use(function (err, req, res, next) {
	if (err instanceof permissionClient.Unauthorized) {
		res.send(403, 'Custom response');
	} else {
		next(err);
	}
});
```

# Contributing

## Local development

* Clone the repo
* `npm test`
* Run tests on change with `nodemon --exec "tap test"`

## Publishing

* Update version `package.json`
* `npm publish`
