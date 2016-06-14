'use strict';
const tap = require('tap');
const storeCreator = require('../src/store');

tap.test('returns false if permissions are not fetched', function (test) {
	const logger = { info () {}, error: () => {} };
	const store = storeCreator({
		s3Client: {}
	}, null, null, logger);
	test.equal(store.value('any'), false);
	test.done();
});

tap.test('creates the S3 object from config', function (test) {
	const store = storeCreator({
		s3Bucket: 'bucket',
		s3BucketPrefix: 'STAGE',
		s3PermissionsFile: 'file.json',
		s3Client: {
			getObject (obj) {
				test.deepEqual(obj, {
					Bucket: 'bucket',
					Key: 'STAGE/file.json'
				});
				store.uninstall();
				test.done();
			}
		}
	}, null, null, { info () {} });
	store.install();
});

tap.test('uses the region is specified', function (test) {
	const store = storeCreator({
		s3Bucket: 'bucket',
		s3BucketPrefix: 'STAGE',
		s3PermissionsFile: 'file.json',
		s3Region: 'eu-central-1'
		// Region is only used if the client is not specified
	}, function (params) {
		test.deepEqual(params, { region: 'eu-central-1' });

		return {
			getObject (obj) {
				test.deepEqual(obj, {
					Bucket: 'bucket',
					Key: 'STAGE/file.json'
				});
				store.uninstall();
				test.done();
			}
		};
	}, null, { info () {} });
	store.install();
});

tap.test('complains if the store is installed twice', function (test) {
	const store = storeCreator({
		s3Client: {
			getObject () {}
		}
	}, null, null, {
		info () {},
		warn (message) {
			test.match(message, /installed twice/i);
			process.nextTick(() => {
				store.uninstall();
				test.done();
			});
		}
	});
	store.install();
	store.install();
});

tap.test('logs an error if s3 errors out', function (test) {
	const store = storeCreator({
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => cb(new Error('s3 error')));
			}
		}
	}, null, null, {
		info () {},
		error (message, ex) {
			test.match(message, /s3.getobject/i);
			test.type(ex, Error);
			test.equal(ex.message, 's3 error');
			process.nextTick(() => {
				store.uninstall();
				test.done();
			});
		}
	});
	store.install();
});

tap.test('polls the configuration', function (test) {
	let counter = 0;
	const store = storeCreator({
		s3Client: {
			getObject () {
				counter += 1;
			}
		}
	}, null, 40, { info () {} });
	store.install();
	setTimeout(() => {
		// I expect the client to be called immediately, at time 40 and 80
		test.equal(counter, 3, 'number of get object calls');
		store.uninstall();
		test.done();
	}, 100);
});

tap.test('logs an error if the JSON is invalid', function (test) {
	const store = storeCreator({
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => {
					cb(null, {
						Body: 'random text'
					});
				});
			}
		}
	}, null, null, {
		info () {},
		error (message) {
			test.match(message, /invalid json/i);
			process.nextTick(() => test.done());
		}
	});
	store.install();
	store.uninstall();
});

tap.test('parse the configuration', function (test) {
	const store = storeCreator({
		app: 'app_name',
		s3Client: {
			getObject (obj, cb) {
				process.nextTick(() => {
					cb(null, {
						Body: JSON.stringify([{
							permission: {
								name: 'one',
								app: 'app_name',
								defaultValue: true
							},
							overrides: [{
								userId: 'person.one@email.com',
								active: true
							}, {
								userId: 'person.two@email.com',
								active: false
							}]
						}, {
							// This other permission is filtered out because it belongs to another app
							permission: {
								name: 'one',
								app: 'another_application',
								defaultValue: false
							},
							overrides: [{
								userId: 'person.one@email.com',
								active: false
							}, {
								userId: 'person.two@email.com',
								active: true
							}]
						}])
					});
				});
			}
		},
		onUpdate () {
			test.equal(store.value('one', 'person.one@email.com'), true, 'active same as default');
			test.equal(store.value('one', 'person.two@email.com'), false, 'active different from default');
			test.equal(store.value('one', 'missing@email.com'), true, 'default value');
			test.equal(store.value('not-defined', 'missing@email.com'), false, 'invalid permission');
		}
	}, null, null, {
		info () {},
		error (message) {
			test.match(message, /permission .*not-defined.* exist/i);
			process.nextTick(() => test.done());
		}
	});
	store.install();
	store.uninstall();
});

tap.test('updates the configuration', function (test) {
	let callCount = -1;
	const store = storeCreator({
		app: 'app_name',
		s3Client: {
			getObject (obj, cb) {
				callCount += 1;
				process.nextTick(() => {
					/**
					 * 1. default value is true and no overrides
					 * 2. override default value
					 * 3. remove the override
					 * 4. change override
					 */
					if (callCount === 0) {
						cb(null, {
							Body: JSON.stringify([{
								permission: {
									name: 'one',
									app: 'app_name',
									defaultValue: true
								},
								overrides: []
							}])
						});
					} else if (callCount === 1) {
						cb(null, {
							Body: JSON.stringify([{
								permission: {
									name: 'one',
									app: 'app_name',
									defaultValue: true
								},
								overrides: [{
									userId: 'person@email.com',
									active: false
								}]
							}])
						});
					} else if (callCount === 2) {
						cb(null, {
							Body: JSON.stringify([{
								permission: {
									name: 'one',
									app: 'app_name',
									defaultValue: true
								},
								overrides: []
							}])
						});
					} else if (callCount === 4) {
						cb(null, {
							Body: JSON.stringify([{
								permission: {
									name: 'one',
									app: 'app_name',
									defaultValue: false
								},
								overrides: []
							}])
						});
					}
				});
			}
		},
		onUpdate () {
			if (callCount === 0) {
				test.equal(store.value('one', 'person@email.com'), true, 'default value');
			} else if (callCount === 1) {
				test.equal(store.value('one', 'person@email.com'), false, 'apply override');
			} else if (callCount === 2) {
				test.equal(store.value('one', 'person@email.com'), true, 'remove override');
			} else if (callCount === 4) {
				test.equal(store.value('one', 'person@email.com'), false, 'change default');

				store.uninstall();
				process.nextTick(() => test.done());
			}
		}
	}, null, 30, { info () {} });
	store.install();
});
