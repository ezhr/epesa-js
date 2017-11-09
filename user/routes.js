var express = require('express')
var router = express.Router()
var mongoose = require('mongoose')
var paginate = require('mongoose-paginate')
var jwt = require('jsonwebtoken')
var async = require('async')
var cList = require('countries-list')
var jsonQuery = require('json-query')
var gcm = require('node-gcm')

var User = require('./model').user
var Transaction = require('./model').transaction

const secret = require('../config').secret
const gcmKey = require('../config').gcmKey

const fee = require('../app').fee
const signUpOffer = 1000000.00

var sender = new gcm.Sender(gcmKey)

/*router.get('/', (req, res) => {
	res.status(400).send('Nothing to see here.' })
})*/

router.get('/test', (req, res) => {

})

router.get('/finduser', (req, res) => {
	User.findOne({ phone: req.headers['xx-phone']}, 'id phone', { lean: true }, (err, user) => {
		if (err) {
			console.log(err)
			res.json({ success: false, message: err })
		}
		else if (user)
			res.status(400).send('Unfortunately, ' + req.headers['xx-phone'] + ' has already been registered. Try to sign in instead.')
		else if (!user)
			res.status(200).json({ message: 'User ' + req.headers['xx-phone'] + ' does not exist.' })
	})
})

// New user from data provided
router.post('/new', (req, res) => {
	User.create({
		phone: req.headers['xx-phone'],
		name: req.body.name,
		passcode: req.body.passcode,
		countryCode: req.body.countryCode,
		balance: signUpOffer,
		deviceToken: req.headers['xx-devicetoken']
	}, (err, user) => {
		if (err) {
			if (err.code == 11000) 
				res.status(400).send('The phone number you entered has already been registered. Try signing in or register with another number.')
			else {
				console.log(err)
				res.status(500).send('Internal Server Error.')
			}
		} else
		res.status(200).json({ message: 'Your account has been created!\n\nTo show our gratitude for signing up, we\'ve credited your wallet with a bonus amount of Tsh. ' + signUpOffer + '.\n\n Welcome to epesa!' })
		var date = new Date().getTime();
		User.findOne({ phone: 'epesa'}, (err, epesaUser) => {
			if (err)
				console.log(err)
			else if (!epesaUser)
				console.log('epesa user not found.')
			else {
				console.log(epesaUser)
				console.log(epesaUser.id)
				Transaction.create({
					from: epesaUser._id,
					fromOldBalance: 0,
					fromNewBalance: 0,
					to: user._id,
					toOldBalance: 0,
					toNewBalance: (user.balance).toFixed(2),
					sentAmount: (+signUpOffer).toFixed(2),
					receivedAmount: (+signUpOffer).toFixed(2),
					feeAmount: (0).toFixed(2),
					date: date,
					message: 'epesa Signup Offer'
				}, (err, transaction) => {
					console.log(transaction)
					if (err) {
						console.log(err)
					} else {
						user.transactions.push(transaction._id)
						user.save((err, user) => {
							if (err)
								console.log(err)
						})
					}
				})
			}
		})
	})
})

// Authenticate user and return jwt
router.get('/signin', (req, res) => {
	User.findOne({ phone: req.headers['xx-phone'] }, 'name phone tokenVersion passcode', (err, user) => {
		if (err) {
			console.log(err)
			res.status(500).send(err)
		} else if (!user) {
			res.status(400).send('User not found, please recheck credentials or register.')
		} else {
			user.tokenVersion++
			var tokenUser = {
				_id: user._id,
				name: user.name,
				phone: user.phone,
				tokenVersion: user.tokenVersion
			}
			var passcodeLength = user.passcode.length
			var result = generateToken(tokenUser)
			if (result[0] == false) {
				res.status(400).send(result[1])
			}
			else {
				user.save((err, user) => {
					if (err) {
						console.log(err)
						res.status(500).send(err)
					}
					else
						res.status(200).json({ user: tokenUser, token: result[1], passcodeLength: passcodeLength })
				})
			}
		}
	})
})

// Authentication middleware
router.use('/', (req, res, next) => {
	var result = authenticateUser(req.headers['xx-token'])
	if (result[0] == false) {
		res.json({ success: false, message: result[1] })
	} else {
		var decoded = result[1]
		var userId = decoded._id
		var tokenVersion = decoded.tokenVersion
		User.findById(userId, (err, user) => {
			if (err) {
				console.log(err)
				res.status(500).send(err)
			}
			else if (!user)
				res.status(400).send('User not found')
			else {
				if (tokenVersion < user.tokenVersion) {
					res.status(400).send('Old token, please sign in again.')
				} else {
					req.userId = userId
					next()
				}
			}
		})
	}
})

router.get('/refreshdevicetoken', (req, res) => {
	User.findById(req.userId, (err, user) => {
		if (err) {
			console.log(err)
			res.status(500).send(err)
		} else {
			user.deviceToken = req.headers['xx-devicetoken']
			user.save((err) => {
				if (err) {
					console.log(err)
					res.status(500).send(err)
				} else {
					res.status(200).json({ message: 'Device token refreshed.' })
				}
			})
		}
	})
})

router.get('/checkpasscode', (req, res) => {
	User.findById(req.userId, 'passcode', {lean: true}, (err, user) => {
		if (err) {
			console.log(err)
			res.status(500).json({ message: err })
		} else {
			if (!req.headers['xx-passcode'] == user.passcode) {
				res.status(400).send('Wrong passcode. Please try again.')
			} else {
				res.status(200).json({ message: 'Passcode check success.' })
			}
		}
	})
})

router.get('/balance', (req, res) => {
	User.findById(req.userId, 'balance', { lean: true }, (err, user) => {
		if (err){
			console.log(err)
			res.status(500).send(err)
		} else {
			res.status(200).send(user)
		}
	})
})


/*	
To-Do:
	- Send notification to receiver's phone
	- Get more information from sender's device: get location, etc
	- Taxes and fees, do something with respect to this
	- Check security? Idk.
	*/

	router.post('/transfer/:phone', (req, res) => {
		User.findById(req.userId, (err, from) => {
			if (err){
				console.log(err)
				res.status(500).send(err)
			} else if (!from) {
				res.status(400).send('No user found for number ' + req.params.phone)
			} else {
				if (req.body.amount < 1) {
					res.status(400).send('Please enter a correct amount to send!')
				}
				else if (from.phone == req.params.phone) {
					res.status(400).send('Cannot send cash to yourself! Please check the receiver\'s number.')
				} else {
					if (req.headers['xx-passcode'] != from.passcode) {
						res.status(400).send('Invalid passcode, please try again.')
						return
					}
					var country = getCountryObject(from.countryCode)
					var toPhone = parsePhone(req.params.phone, country.phone)
					User.findOne({ phone: toPhone }, (err, to) => {
						if (err) {
							console.log(err)
							res.status(500).send(err)
						}
						else if (!to)
							res.status(400).send('Recipient not found! Please check receiver\'s number!')
						else {
							if (from.balance < req.body.amount) {
								res.status(400).send('The amount you wish to send is more than your current balance. Please top up your balance at an E-Pesa agent or send a smaller amount.')
							} else {
								var receivedAmount = parseFloat(req.body.amount).toFixed(2)
								var feeAmount = (receivedAmount * fee).toFixed(2)
								var sentAmount = (+feeAmount + +receivedAmount).toFixed(2)
								async.waterfall([
									function(callback) {
										var date = new Date().getTime()
										Transaction.create({
											from: from._id,
											fromOldBalance: (+from.balance + +sentAmount).toFixed(2),
											fromNewBalance: (+from.balance).toFixed(2),
											to: to._id,
											toOldBalance: (+to.balance - +receivedAmount).toFixed(2),
											toNewBalance: (to.balance).toFixed(2),
											sentAmount: (+sentAmount).toFixed(2),
											receivedAmount: (+receivedAmount).toFixed(2),
											feeAmount: (+feeAmount).toFixed(2),
											date: date,
											message: req.body.message
										}, (err, transaction) => {
											if (err) {
												console.log(err)
												callback('0')
											} else {
												callback(null, transaction._id)
											}
										})
									},
									function(transactionId, callback) {
										from.balance -= +sentAmount
										from.transactions.push(transactionId)
										from.save((err) => {
											if (err) {
												console.log(err)
												callback('1')
											}
											else
												callback(null, transactionId)
										})
									},
									function(transactionId, callback) {
										to.balance += +receivedAmount
										to.transactions.push(transactionId)
										to.save((err) => {
											if (err) {
												console.log(err)
												callback('2')
											}
											else
												callback(null)
										})
									}
									], function(err) {
									// Todo: fix these errors!
									if (err) {
										console.log('err ' + err)
										if (err == 1) {
											from.balance += sentAmount
											from.save((err) => {
												if (err) {
													console.log(err)
												}
											})
										}
										res.status(500).send('Transaction failed. Please try again later.')
									} else {
										res.status(200).json({ message: 'You have successfully transfered Tsh. '+ sentAmount + ' to ' + to.name })
										var notification = new gcm.Message();
										notification.addData({
											title: 'Money received!',
											sender: from.phone,
											amount: receivedAmount
										});

										var deviceToken = to.deviceToken

										sender.send( notification, { to: deviceToken }, 10, function (err, response) {
											if (err) {
												console.error(err);
											} else {
												console.log(response);
											}
										});
									}
								})
							}
						}
					})
				}
			}
		})
})

router.get('/transactions/:from', (req, res) => {
	var date = new Date
	var fromDate = parseInt(req.params.from, 10)
	User.findById(req.userId, 'transactions').exec((err, user) => {
		var transactionIds = user.transactions
		var compiledTransactions = []
		Transaction.find({'_id': transactionIds})
		.where('date').gt(fromDate)
		.populate('to from')
		.select('to from date message sentAmount receivedAmount')
		.exec((err, transactions) => {
			//console.log(transactions)
			if (err) {
				console.log(err)
				res.status(500).send(err)
			} else if (!transactions) {
				res.status(200).json([])
				//res.json({ success: false, message: 'No new transactions.' })
			} else {
				async.each(transactions, (transaction, callback) => {
					var returnedTransaction
					if (transaction.from._id == req.userId) {
						returnedTransaction = {
							amount: transaction.sentAmount,
							contactPhone: transaction.to.phone,
							contactName: transaction.to.name,
							date: transaction.date,
							message: transaction.message,
							sent: true,
							_id: transaction._id
						}
					} else {
						returnedTransaction = {
							amount: transaction.receivedAmount,
							contactPhone: transaction.from.phone,
							contactName: transaction.from.name,
							date: transaction.date,
							message: transaction.message,
							sent: false,
							_id: transaction._id
						}
					}
					compiledTransactions.push(returnedTransaction)
					callback()
				}, (err, callback) => {
					if (err) {
						console.log(err)
						res.status(500).send(err)
					}
					if (compiledTransactions.length > 0)
						res.status(200).send(compiledTransactions)
					else 
						res.status(200).json([])
				})
			}
		})
	})
})
router.post('/contacts/check', (req, res) => {
	User.findById(req.userId, 'countryCode', (err, user) => {
		if (err){
			console.log(err)
			res.status(500).send(err)
		} else if (!user) {
			res.status(400).send('No user found for number ' + req.params.phone)
		} else {
			var compiledContacts = []
			async.each(req.body, (contact, callback) => {
				var phone = parsePhone(contact.phone, user.countryCode)
				if (phone.length < 8) {
					callback()
				} else {
					User.findOne({ phone: phone }, 'phone', { lean: true }, (err, user) => {
						if (err) {
							callback(err)
						} else if (!user) {
							callback()
						} else if (user) {
							user.name = contact.name
							user.phone = user.phone
							compiledContacts.push(user)
							callback()
						}
					})
				}
			}, (err) => {
				if (err) {
					console.log(err)
					res.status(500).send(err)
				} else {
					console.log(compiledContacts)
					res.status(200).send(compiledContacts)
				}
			})
		}
	})
})


// Functions
var generateToken = (user) => {

	try {
		var token = jwt.sign(user, secret, { expiresIn: '5y'} )
		return [true, token]
	} catch (err) {
		console.log(err)
		return [false, err]
	}
}

var authenticateUser = (token) => {

	try {
		var decoded = jwt.verify(token, secret)
		return [true, decoded]
	} catch (err) {
		return [false, err]
	}
}

var getCountryObject = (countryCode) => {
	var query = 'countries[**][*phone=' + countryCode + ']'
	var result = jsonQuery(query, {data: cList}).value[0]
	return result
}

var parsePhone = (number, code) => {
	if (number.charAt(0) === '0') {
		number = number.slice(1)
		number = code + number
	} else if (number.charAt(0) === '+') {
		number = number.slice(1)
	}
	return number
}

module.exports = router
module.exports.authenticateUser = authenticateUser()