var express = require('express')
var app = express()
var mongodb = require('mongodb')
var mongoose = require('mongoose')
var bodyparser = require('body-parser')
var morgan = require('morgan')
var router = express.Router()
var delay = require('express-delay')
var cList = require('countries-list')

const port = process.env.PORT || 3000
var config = require('./config')
const fee = 0.00

exports.fee = fee

mongoose.connect(config.database)

app.use(morgan('combined'))
mongoose.set('debug', true)
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({ extended: false }))

app.use(delay(2000, 4000))

var userroutes = require('./user/routes')

app.use('/user', userroutes)

app.get('/test', (req, res) => {
	var number = '0123456789'
	if (number.charAt(0) === '0') {
		number = number.slice(1)
		number = cList.countries['TZ'].phone + number
		console.log(number)
	} else {
		console.log('false')
	}
})

app.listen(port, (err) => {
	if (err)
		console.log(err)
	else
		console.log('Server up.')
})
