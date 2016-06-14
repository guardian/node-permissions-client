'use strict';

const AWS = require('aws-sdk');
const storeCreator = require('./store');

function Unauthorized (message) {
	this.message = message;
	this.stack = (new Error()).stack;
}
Unauthorized.prototype = Object.create(Error.prototype);
Unauthorized.prototype.constructor = Unauthorized;
Unauthorized.prototype.name = 'Unauthorized';

function permissionClient (config) {
	const logger = config.logger || console;

	if (!config || !config.app) {
		logger.error('Missing \'app\' configuration parameter in permission client');
		return invalidMiddlewareCreator;
	} else if (!config.s3Bucket || !config.s3BucketPrefix || !config.s3PermissionsFile) {
		logger.error('Invalid S3 configuration in permission client');
		return invalidMiddlewareCreator;
	} else {
		return createMiddleware(config, config.updateInterval * 1000, logger);
	}
}

function createMiddleware (config, updateInterval, logger) {
	const CALL_NEXT = config.sendStatus === false;
	const store = storeCreator(config, AWS.S3, updateInterval, logger);
	store.install();

	function middlewareCreator (permission) {
		return (req, res, next) => {
			const email = req.guUser ? req.guUser.email : '';
			if (!email) {
				const message = 'Missing guUser in request object. Is your middleware authenticated?';
				logger.warn(message);
				if (CALL_NEXT) {
					next(new Unauthorized(message));
				} else {
					res.sendStatus(403);
				}
			} else if (store.value(permission, email)) {
				next();
			} else {
				logger.info('User is not authorized to access permission ' + permission);
				if (CALL_NEXT) {
					next(new Unauthorized('User is not authorized'));
				} else {
					res.sendStatus(403);
				}
			}
		};
	}

	middlewareCreator.getStored = () => {
		return {};
	};
	middlewareCreator.dispose = () => {
		store.uninstall();
	};

	return middlewareCreator;
}

function invalidMiddlewareCreator (/* permission */) {
	return (req, res, next) => next(new Error('Permission client is not configured correctly'));
}

permissionClient.Unauthorized = Unauthorized;
module.exports = permissionClient;
