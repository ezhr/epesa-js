# epesa - an e-wallet application

epesa was developed as a potential startup, an e-wallet for Africa's bankless society.  Due to circumstances that prevented epesa's eventual launch, the project was made open source.

This is the back end that powers epesa.

This is a fully functional REST API that allows to create users and transfer money amongst them.  It supports features such as JSONWebTokens (ensuring that a user is signed in from only one device at a time), FCM Push Notifications support, and more.  It is written in JavaScript using Express.  The data is persisted using MongoDB.  Other libraries of note used in this project include mongoose, jsonwebtoken, async, json-query and node-gcm for Push Notifications.  Email and PDF generation support was planned.

## To use this project:

You may use this project for your own (personal and NON-COMMERCIAL) use.  To do so, you will need to make a new file named ```config.js``` in the root.  The following is what this file should look like:

```
module.exports = {
	database: '[mongodb-address]',
	secret: '[secret-key-for-jwt-generation]',
	gcmKey: '[fcm-token-from-google-console]'
}
```

This app may then be hosted on a VPS or provider, and may be interfaced with using an app, such as the epesa Android app (also available in my repos).