/*
 * Copyright © 2019 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

'use strict';

require('../../functional');
const crypto = require('crypto');
const { transfer, TransferTransaction } = require('@liskhq/lisk-transactions');
const accountFixtures = require('../../../../fixtures/accounts');
const typesRepresentatives = require('../../../../fixtures/types_representatives');
const phases = require('../../../../utils/legacy/transaction_confirmation');
const sendTransactionPromise = require('../../../../utils/http/api')
	.sendTransactionPromise;
const randomUtil = require('../../../../utils/random');
const apiCodes = require('../../../../../src/modules/http_api/api_codes');
const {
	getNetworkIdentifier,
} = require('../../../../utils/network_identifier');

const networkIdentifier = getNetworkIdentifier(
	__testContext.config.genesisBlock,
);

const specialChar = '❤';
const nullChar1 = '\0';
const nullChar2 = '\x00';
const nullChar3 = '\u0000';

describe('POST /api/transactions (type 0) transfer funds', () => {
	let transaction;
	const goodTransaction = randomUtil.transaction(0);
	const badTransactions = [];
	const goodTransactions = [];
	// Low-frills deep copy
	const cloneGoodTransaction = JSON.parse(JSON.stringify(goodTransaction));

	const account = randomUtil.account();

	describe('schema validations', () => {
		typesRepresentatives.allTypes.forEach(test => {
			it(`using ${test.description} should fail`, async () => {
				return sendTransactionPromise(test.input, 400).then(res => {
					expect(res).to.have.nested.property('body.message').that.is.not.empty;
				});
			});
		});

		it('with lowercase recipientId should fail', async () => {
			transaction = randomUtil.transaction(0);
			transaction.asset.recipientId = transaction.asset.recipientId.toLowerCase();
			transaction.signature = crypto.randomBytes(64).toString('hex');

			return sendTransactionPromise(transaction, 400).then(res => {
				expect(res.body.message).to.be.equal('Validation errors');
				badTransactions.push(transaction);
			});
		});
	});

	describe('transaction processing', () => {
		it('with invalid signature should fail', async () => {
			transaction = randomUtil.transaction(0);
			transaction.signature = crypto.randomBytes(64).toString('hex');

			return sendTransactionPromise(
				transaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					`Failed to validate signature ${transaction.signature}`,
				);
				badTransactions.push(transaction);
			});
		});

		it('mutating data used to build the transaction id should fail', async () => {
			transaction = randomUtil.transaction(0);
			transaction.nonce += 1;

			return sendTransactionPromise(
				transaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.eql('Transaction was rejected with errors');
				expect(res.body.code).to.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors).to.not.be.empty;
				badTransactions.push(transaction);
			});
		});

		it('using zero amount should fail', async () => {
			// TODO: Remove signRawTransaction on lisk-transactions 3.0.0
			transaction = new TransferTransaction({
				networkIdentifier,
				nonce: '0',
				fee: BigInt(10000000).toString(),
				asset: {
					amount: '0',
					recipientId: account.address,
				},
			});
			transaction.sign(accountFixtures.genesis.passphrase);

			return sendTransactionPromise(
				transaction.toJSON(),
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					'Amount must be a valid number in string format.',
				);
				badTransactions.push(transaction);
			});
		});

		it('when sender has no funds should fail', async () => {
			transaction = transfer({
				networkIdentifier,
				nonce: '0',
				fee: BigInt(10000000).toString(),
				amount: '1',
				passphrase: account.passphrase,
				recipientId: '1L',
			});

			return sendTransactionPromise(
				transaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					`Account does not have enough LSK: ${account.address}, balance: 0`,
				);
				badTransactions.push(transaction);
			});
		});

		it('using entire balance should fail', async () => {
			transaction = transfer({
				networkIdentifier,
				nonce: '0',
				fee: BigInt(10000000).toString(),
				amount: accountFixtures.genesis.balance,
				passphrase: accountFixtures.genesis.passphrase,
				recipientId: account.address,
			});

			return sendTransactionPromise(
				transaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.include(
					'Account does not have enough LSK: 11237980039345381032L, balance: ',
				);
				badTransactions.push(transaction);
			});
		});

		it('using network identifier from different network should fail', async () => {
			const networkIdentifierOtherNetwork =
				'91a254dc30db5eb1ce4001acde35fd5a14d62584f886d30df161e4e883220eb1';
			const transactionFromDifferentNetwork = new TransferTransaction({
				networkIdentifier: networkIdentifierOtherNetwork,
				nonce: '0',
				fee: BigInt(10000000).toString(),
				asset: {
					amount: '1',
					recipientId: account.address,
				},
			});
			transactionFromDifferentNetwork.sign(accountFixtures.genesis.passphrase);

			return sendTransactionPromise(
				transactionFromDifferentNetwork.toJSON(),
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);

				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.include(
					`Failed to validate signature ${transactionFromDifferentNetwork.signature}`,
				);
				badTransactions.push(transactionFromDifferentNetwork);
			});
		});

		it('when sender has funds should be ok', async () => {
			return sendTransactionPromise(goodTransaction).then(res => {
				expect(res.body.data.message).to.be.equal('Transaction(s) accepted');
				goodTransactions.push(goodTransaction);
			});
		});

		it('sending transaction with same id twice should fail', async () => {
			return sendTransactionPromise(
				goodTransaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					`Transaction is already processed: ${goodTransaction.id}`,
				);
			});
		});

		it('sending transaction with same id twice but older timestamp should fail', async () => {
			cloneGoodTransaction.timestamp -= 1;

			return sendTransactionPromise(
				cloneGoodTransaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.equal(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					`Transaction is already processed: ${cloneGoodTransaction.id}`,
				);
			});
		});

		describe('with additional data field', () => {
			describe('invalid cases', () => {
				const invalidCases = typesRepresentatives.additionalDataInvalidCases.concat(
					typesRepresentatives.nonStrings,
				);

				invalidCases.forEach(test => {
					it(`using ${test.description} should fail`, async () => {
						const accountAdditionalData = randomUtil.account();
						transaction = transfer({
							networkIdentifier,
							nonce: '1',
							fee: BigInt(10000000).toString(),
							amount: '1',
							passphrase: accountFixtures.genesis.passphrase,
							recipientId: accountAdditionalData.address,
						});
						transaction.asset.data = test.input;
						return sendTransactionPromise(
							transaction,
							apiCodes.PROCESSING_ERROR,
						).then(res => {
							expect(res.body.message).to.be.equal(
								'Transaction was rejected with errors',
							);
							expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
							expect(res.body.errors[0].message).to.not.be.empty;
							badTransactions.push(transaction);
						});
					});
				});
			});

			describe('valid cases', () => {
				const validCases = typesRepresentatives.additionalDataValidCases.concat(
					typesRepresentatives.strings,
				);

				validCases.forEach((test, i) => {
					it(`using ${test.description} should be ok`, async () => {
						const accountAdditionalData = randomUtil.account();
						transaction = transfer({
							networkIdentifier,
							nonce: (i + 2).toString(),
							fee: BigInt(10000000).toString(),
							amount: '1',
							passphrase: accountFixtures.genesis.passphrase,
							recipientId: accountAdditionalData.address,
							data: test.input,
						});

						return sendTransactionPromise(transaction).then(res => {
							expect(res.body.data.message).to.be.equal(
								'Transaction(s) accepted',
							);
							goodTransactions.push(transaction);
						});
					});
				});

				it('using SQL characters escaped as single quote should be ok', async () => {
					const additioinalData = "'0'";
					const accountAdditionalData = randomUtil.account();
					transaction = transfer({
						networkIdentifier,
						nonce: '11',
						fee: BigInt(10000000).toString(),
						amount: '1',
						passphrase: accountFixtures.genesis.passphrase,
						recipientId: accountAdditionalData.address,
						data: additioinalData,
					});

					return sendTransactionPromise(transaction).then(res => {
						expect(res.body.data.message).to.be.equal(
							'Transaction(s) accepted',
						);
						goodTransactions.push(transaction);
					});
				});
			});

			describe('edge cases', () => {
				it('using specialChar should be ok', () => {
					const additioinalData = `${specialChar} hey \x01 :)`;
					const accountAdditionalData = randomUtil.account();
					transaction = transfer({
						networkIdentifier,
						nonce: '12',
						fee: BigInt(10000000).toString(),
						amount: '1',
						passphrase: accountFixtures.genesis.passphrase,
						recipientId: accountAdditionalData.address,
						data: additioinalData,
					});

					return sendTransactionPromise(transaction).then(res => {
						expect(res.body.data.message).to.be.equal(
							'Transaction(s) accepted',
						);
						goodTransactions.push(transaction);
					});
				});

				it('using nullChar1 should fail', () => {
					const additioinalData = `${nullChar1} hey :)`;
					const accountAdditionalData = randomUtil.account();
					transaction = transfer({
						networkIdentifier,
						nonce: '13',
						fee: BigInt(10000000).toString(),
						amount: '1',
						passphrase: accountFixtures.genesis.passphrase,
						recipientId: accountAdditionalData.address,
						data: additioinalData,
					});

					return sendTransactionPromise(
						transaction,
						apiCodes.PROCESSING_ERROR,
					).then(res => {
						expect(res.body.message).to.be.eql(
							'Transaction was rejected with errors',
						);
						expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
						expect(res.body.errors[0].message).to.be.equal(
							'\'.data\' should match format "transferData"',
						);
						badTransactions.push(transaction);
					});
				});

				it('using nullChar2 should fail', () => {
					const additionalData = `${nullChar2} hey :)`;
					const accountAdditionalData = randomUtil.account();
					transaction = transfer({
						networkIdentifier,
						nonce: '14',
						fee: BigInt(10000000).toString(),
						amount: '1',
						passphrase: accountFixtures.genesis.passphrase,
						recipientId: accountAdditionalData.address,
						data: additionalData,
					});

					return sendTransactionPromise(
						transaction,
						apiCodes.PROCESSING_ERROR,
					).then(res => {
						expect(res.body.message).to.be.eql(
							'Transaction was rejected with errors',
						);
						expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
						expect(res.body.errors[0].message).to.be.equal(
							'\'.data\' should match format "transferData"',
						);
						badTransactions.push(transaction);
					});
				});

				it('using nullChar3 should fail', () => {
					const additioinalData = `${nullChar3} hey :)`;
					const accountAdditionalData = randomUtil.account();
					transaction = transfer({
						networkIdentifier,
						nonce: '15',
						fee: BigInt(10000000).toString(),
						amount: '1',
						passphrase: accountFixtures.genesis.passphrase,
						recipientId: accountAdditionalData.address,
						data: additioinalData,
					});

					return sendTransactionPromise(
						transaction,
						apiCodes.PROCESSING_ERROR,
					).then(res => {
						expect(res.body.message).to.be.eql(
							'Transaction was rejected with errors',
						);
						expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
						expect(res.body.errors[0].message).to.be.equal(
							'\'.data\' should match format "transferData"',
						);
						badTransactions.push(transaction);
					});
				});
			});
		});
	});

	describe('confirmation', () => {
		phases.confirmation(goodTransactions, badTransactions);
	});

	describe('validation', () => {
		it('sending already confirmed transaction should fail', async () => {
			return sendTransactionPromise(
				goodTransaction,
				apiCodes.PROCESSING_ERROR,
			).then(res => {
				expect(res.body.message).to.be.eql(
					'Transaction was rejected with errors',
				);
				expect(res.body.code).to.be.eql(apiCodes.PROCESSING_ERROR);
				expect(res.body.errors[0].message).to.be.equal(
					`Transaction is already confirmed: ${goodTransaction.id}`,
				);
			});
		});
	});
});
