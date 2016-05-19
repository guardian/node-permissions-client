'use strict';
const tap = require('tap');
const permissionClient = require('../src/index');

tap.test('application name is mandatory', function (test) {
	let messageLogged = false;
	const middleware = permissionClient({
		logger: {
			error (message) {
				messageLogged = true;
				test.match(message, /missing .* parameter/i);
			}
		}
	})('any-permission');

	middleware(null, null, (err) => {
		test.equal(messageLogged, true, 'message logged');
		test.type(err, Error);
		test.match(err.message, /not configured/i);
		test.done();
	});
});

tap.test('S3 configuration is mandatory', function (test) {
	let messageLogged = false;
	const middleware = permissionClient({
		app: 'any',
		logger: {
			error (message) {
				messageLogged = true;
				test.match(message, /S3 configuration/i);
			}
		}
	})('any-permission');

	middleware(null, null, (err) => {
		test.equal(messageLogged, true, 'message logged');
		test.type(err, Error);
		test.match(err.message, /not configured/i);
		test.done();
	});
});

tap.test('calls next with error when gu email is not set', function (test) {
	let messageLogged = false;
	const middlewareCreator = permissionClient({
		app: 'any',
		s3Bucket: 'any',
		s3BucketPrefix: 'any',
		s3PermissionsFile: 'any',
		logger: {
			warn (message) {
				messageLogged = true;
				test.match(message, /missing guUser/i);

			}
		},
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(null, {
					Body: JSON.stringify([{
						permission: {
							name: 'one',
							app: 'any',
							defaultValue: true
						}
					}])
				}));
			}
		},
		sendStatus: false
	});
	const middleware = middlewareCreator('one');

	setTimeout(() => {
		middleware({}, null, (err) => {
			middlewareCreator.dispose();
			test.equal(messageLogged, true, 'message logged');
			test.type(err, permissionClient.Unauthorized);
			test.match(err.message, /missing guUser/i);
			test.done();
		});
	}, 10);
});

tap.test('calls next with error when permission is false', function (test) {
	const middlewareCreator = permissionClient({
		app: 'any',
		s3Bucket: 'any',
		s3BucketPrefix: 'any',
		s3PermissionsFile: 'any',
		logger: {
			warn () {}
		},
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(null, {
					Body: JSON.stringify([{
						permission: {
							name: 'one',
							app: 'any',
							defaultValue: false
						}
					}])
				}));
			}
		},
		sendStatus: false
	});
	const middleware = middlewareCreator('one');

	setTimeout(() => {
		middleware({ guUser: 'person@email.com' }, null, (err) => {
			middlewareCreator.dispose();
			test.type(err, permissionClient.Unauthorized);
			test.match(err.message, /not authorized/i);
			test.done();
		});
	}, 10);
});

tap.test('sends status when gu email is not set', function (test) {
	let messageLogged = false;
	const middlewareCreator = permissionClient({
		app: 'any',
		s3Bucket: 'any',
		s3BucketPrefix: 'any',
		s3PermissionsFile: 'any',
		logger: {
			warn (message) {
				messageLogged = true;
				test.match(message, /missing guUser/i);

			}
		},
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(null, {
					Body: JSON.stringify([{
						permission: {
							name: 'one',
							app: 'any',
							defaultValue: true
						}
					}])
				}));
			}
		}
		// default value:
		// sendStatus: true
	});
	const middleware = middlewareCreator('one');

	setTimeout(() => {
		middleware({}, {
			sendStatus (status) {
				middlewareCreator.dispose();
				test.equal(messageLogged, true, 'message logged');
				test.equal(status, 403, 'error status');
				test.done();
			}
		});
	}, 10);
});

tap.test('sends status when permission is false', function (test) {
	const middlewareCreator = permissionClient({
		app: 'any',
		s3Bucket: 'any',
		s3BucketPrefix: 'any',
		s3PermissionsFile: 'any',
		logger: {
			warn () {}
		},
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(null, {
					Body: JSON.stringify([{
						permission: {
							name: 'one',
							app: 'any',
							defaultValue: false
						}
					}])
				}));
			}
		}
		// default value:
		// sendStatus: true
	});
	const middleware = middlewareCreator('one');

	setTimeout(() => {
		middleware({ guUser: 'person@email.com' }, {
			sendStatus (status) {
				middlewareCreator.dispose();
				test.equal(status, 403, 'error status');
				test.done();
			}
		});
	}, 10);
});

tap.test('calls next when permission is true', function (test) {
	const middlewareCreator = permissionClient({
		app: 'any',
		s3Bucket: 'any',
		s3BucketPrefix: 'any',
		s3PermissionsFile: 'any',
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(null, {
					Body: JSON.stringify([{
						permission: {
							name: 'one',
							app: 'any',
							defaultValue: false
						},
						overrides: [{
							userId: 'person@email.com',
							active: true
						}]
					}])
				}));
			}
		}
	});
	const middleware = middlewareCreator('one');

	setTimeout(() => {
		middleware({ guUser: 'person@email.com' }, null, (error) => {
			middlewareCreator.dispose();
			test.equal(error, undefined, 'next error');
			test.done();
		});
	}, 10);
});
