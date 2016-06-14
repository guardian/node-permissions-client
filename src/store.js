'use strict';
const ONE_MINUTE = 60000;

module.exports = function (globalConfig, defaultS3, updateInterval, logger) {
	const APPLICATION_NAME = globalConfig.app;
	const BUCKET = globalConfig.s3Bucket;
	const OBJECT_KEY = [
		globalConfig.s3BucketPrefix,
		globalConfig.s3PermissionsFile
	].join('/').replace(/\/+/, '/');
	const UPDATE_CALLBACK = globalConfig.onUpdate || function () {};
	const s3 = globalConfig.s3Client || new defaultS3({
		region: globalConfig.s3Region
	});
	/**
	 * Map the permissions of a given app
	 * key: permission name
	 * value: Object with `defaultValue` and `overrides`
	 */
	const appPermissionCache = {};
	let installId;

	function install () {
		if (!installId) {
			logger.info('Installing permission client');
			process.nextTick(() => refresh());
			installId = setInterval(refresh, updateInterval || ONE_MINUTE);
		} else {
			logger.warn('Permission client installed twice, ignoring');
		}
	}

	function uninstall () {
		clearInterval(installId);
		installId = null;
	}

	function refresh () {
		logger.info('Refreshing permission client');
		s3.getObject({
			Bucket: BUCKET,
			Key: OBJECT_KEY
		}, (error, data) => {
			if (error) {
				logger.error('Error from S3.getObject', error);
			} else {
				cache(data);
			}
		});
	}

	function cache (data) {
		try {
			const json = JSON.parse(data.Body.toString());
			json.forEach(definition => {
				const permission = definition.permission;
				if (permission.app === APPLICATION_NAME) {
					const overrides = {};
					(definition.overrides || []).forEach(person => {
						overrides[person.userId] = person.active;
					});
					appPermissionCache[permission.name] = {
						defaultValue: permission.defaultValue,
						overrides: overrides
					};
				}
			});
			process.nextTick(UPDATE_CALLBACK);
			logger.info('Permission client refreshed correctly');
		} catch (ex) {
			logger.error('Invalid JSON from permission bucket');
		}
	}

	function value (permissionName, userId) {
		if (permissionName in appPermissionCache) {
			const permission = appPermissionCache[permissionName];
			if (userId in permission.overrides) {
				return !!permission.overrides[userId];
			} else {
				return !!permission.defaultValue;
			}
		} else {
			logger.error('Permission \'' + permissionName + '\' does not exist for app \'' + APPLICATION_NAME + '\'');
			return false;
		}
	}

	return {install, uninstall, value};
};
