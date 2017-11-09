const mongoose = require('mongoose')
const paginate = require('mongoose-paginate')
const Schema = mongoose.Schema

const userSchema = new Schema ({
	phone: { type: String, required: true, unique: true, background: false },
	balance: { type: Number, required: true, default: 0 },
	name: String,
	passcode: String,
	tokenVersion: { type: Number, required: true, default: 0 },
	transactions: [{ type: Schema.Types.ObjectId, ref: 'Transaction' }],
	countryCode: { type: String, required: true },
	deviceToken: { type: String, required: true, default: '0' }
})
userSchema.plugin(paginate)

const transactionSchema = new Schema ({
	from: { type: Schema.Types.ObjectId, ref: 'User' },
	fromOldBalance: { type: Number, required: true },
	fromNewBalance: { type: Number, required: true },
	sentAmount: { type: Number, required: true },
	to: { type: Schema.Types.ObjectId, ref: 'User' },
	toOldBalance: { type: Number, required: true },
	toNewBalance: { type: Number, required: true },
	receivedAmount: { type: Number, required: true },
	feeAmount: { type: Number, required: true },
	date: { type: Number, required: true },
	message: String
})

/*const transactionSchema = new Schema ({
	fromId: { type: Schema.Types.ObjectId, ref: 'User' },
	fromPhone: { type: Number, ref: 'User', required: true },
	fromName: String,
	fromOldBalance: { type: Number, required: true },
	fromNewBalance: { type: Number, required: true },
	sentAmount: { type: Number, required: true },
	toId: { type: Schema.Types.ObjectId, ref: 'User' },
	toPhone: { type: Number, ref: 'User', required: true },
	toName: String,
	toOldBalance: { type: Number, required: true },
	toNewBalance: { type: Number, required: true },
	receivedAmount: { type: Number, required: true },
	date: { type: Number, required: true },
	message: String
})*/
transactionSchema.plugin(paginate)


exports.user = mongoose.model('User', userSchema)
exports.transaction = mongoose.model('Transaction', transactionSchema)