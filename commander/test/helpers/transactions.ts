/*
 * Copyright © 2021 Lisk Foundation
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

import * as cryptography from '@klayr/cryptography';
import * as transactions from '@klayr/transactions';
import { codec, Schema } from '@klayr/codec';

const account = {
	passphrase: 'endless focus guilt bronze hold economy bulk parent soon tower cement venue',
	privateKey:
		'a30c9e2b10599702b985d18fee55721b56691877cd2c70bbdc1911818dabc9b9508a965871253595b36e2f8dc27bff6e67b39bdd466531be9c6f8c401253979c',
	publicKey: '508a965871253595b36e2f8dc27bff6e67b39bdd466531be9c6f8c401253979c',
	address: '9cabee3d27426676b852ce6b804cb2fdff7cd0b5',
};
export const multisigRegMsgSchema = {
	$id: '/test/auth/command/regMultisigMsg',
	type: 'object',
	required: ['address', 'nonce', 'numberOfSignatures', 'mandatoryKeys', 'optionalKeys'],
	properties: {
		address: {
			dataType: 'bytes',
			fieldNumber: 1,
			minLength: 20,
			maxLength: 20,
		},
		nonce: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		numberOfSignatures: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		mandatoryKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
			fieldNumber: 4,
		},
		optionalKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
			fieldNumber: 5,
		},
	},
};

export const registerMultisignatureParamsSchema = {
	$id: '/test/auth/command/regMultisig',
	type: 'object',
	properties: {
		numberOfSignatures: {
			dataType: 'uint32',
			fieldNumber: 1,
			minimum: 1,
			maximum: 64,
		},
		mandatoryKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
			fieldNumber: 2,
			minItems: 0,
			maxItems: 64,
		},
		optionalKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 32,
				maxLength: 32,
			},
			fieldNumber: 3,
			minItems: 0,
			maxItems: 64,
		},
		signatures: {
			type: 'array',
			items: {
				dataType: 'bytes',
				minLength: 64,
				maxLength: 64,
			},
			fieldNumber: 4,
		},
	},
	required: ['numberOfSignatures', 'mandatoryKeys', 'optionalKeys', 'signatures'],
};

export const tokenTransferParamsSchema = {
	$id: '/test/klayr/transferCommand',
	title: 'Transfer transaction command',
	type: 'object',
	required: ['tokenID', 'amount', 'recipientAddress', 'data'],
	properties: {
		tokenID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		amount: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		recipientAddress: {
			dataType: 'bytes',
			fieldNumber: 3,
			format: 'klayr32',
		},
		data: {
			dataType: 'string',
			fieldNumber: 4,
			minLength: 0,
			maxLength: 64,
		},
	},
};

export const posVoteParamsSchema = {
	$id: '/test/pos/command/stakeParams',
	type: 'object',
	required: ['stakes'],
	properties: {
		stakes: {
			type: 'array',
			fieldNumber: 1,
			minItems: 1,
			maxItems: 20,
			items: {
				type: 'object',
				required: ['validatorAddress', 'amount'],
				properties: {
					validatorAddress: {
						dataType: 'bytes',
						fieldNumber: 1,
						format: 'klayr32',
					},
					amount: {
						dataType: 'sint64',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};

export const schemaWithArray = {
	$id: '/klayr/schemaWithArray',
	type: 'object',
	required: ['attributesArray'],
	properties: {
		attributesArray: {
			type: 'array',
			fieldNumber: 1,
			items: {
				dataType: 'uint64',
			},
		},
	},
};

export const schemaWithArrayOfObjects = {
	$id: '/klayr/schemaWithArrayOfObjects',
	type: 'object',
	required: ['attributesArray'],
	properties: {
		attributesArray: {
			type: 'array',
			fieldNumber: 4,
			items: {
				type: 'object',
				required: ['module', 'attributes'],
				properties: {
					module: {
						dataType: 'string',
						minLength: 0,
						maxLength: 10,
						pattern: '^[a-zA-Z0-9]*$',
						fieldNumber: 1,
					},
					attributes: {
						dataType: 'bytes',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};

export const castValidationSchema = {
	$id: '/klayr/castValidation',
	type: 'object',
	required: [
		'uInt64',
		'sIn64',
		'uInt32',
		'sInt32',
		'uInt64Array',
		'sInt64Array',
		'uInt32Array',
		'sInt32Array',
	],
	properties: {
		uInt64: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		sInt64: {
			dataType: 'sint64',
			fieldNumber: 2,
		},
		uInt32: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		sInt32: {
			dataType: 'sint32',
			fieldNumber: 4,
		},
		uInt64Array: {
			type: 'array',
			fieldNumber: 5,
			items: {
				dataType: 'uint64',
			},
		},
		sInt64Array: {
			type: 'array',
			fieldNumber: 6,
			items: {
				dataType: 'sint64',
			},
		},
		uInt32Array: {
			type: 'array',
			fieldNumber: 7,
			items: {
				dataType: 'uint32',
			},
		},
		sInt32Array: {
			type: 'array',
			fieldNumber: 8,
			items: {
				dataType: 'sint32',
			},
		},
		nested: {
			type: 'array',
			fieldNumber: 9,
			items: {
				type: 'object',
				properties: {
					uInt64: {
						dataType: 'uint64',
						fieldNumber: 1,
					},
					sInt64: {
						dataType: 'sint64',
						fieldNumber: 2,
					},
					uInt32: {
						dataType: 'uint32',
						fieldNumber: 3,
					},
					sInt32: {
						dataType: 'sint32',
						fieldNumber: 4,
					},
				},
			},
		},
	},
};

export const genesisBlockID = Buffer.from(
	'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
	'hex',
);

export const chainID = Buffer.from('10000000', 'hex');

export const chainIDStr = chainID.toString('hex');

export const createTransferTransaction = ({
	amount,
	fee,
	recipientAddress,
	nonce,
}: {
	amount: string;
	fee: string;
	recipientAddress: string;
	nonce: number;
}): Record<string, unknown> => {
	const transaction = transactions.signTransaction(
		{
			module: 'token',
			command: 'transfer',
			nonce: BigInt(nonce),
			fee: BigInt(transactions.convertklyToBeddows(fee)),
			senderPublicKey: Buffer.from(account.publicKey, 'hex'),
			params: {
				tokenID: Buffer.from([0, 0, 0, 0, 0, 0]),
				amount: BigInt(transactions.convertklyToBeddows(amount)),
				recipientAddress: cryptography.address.getAddressFromKlayr32Address(recipientAddress),
				data: '',
			},
		},
		chainID,
		Buffer.from(account.privateKey, 'hex'),
		tokenTransferParamsSchema,
	) as any;

	return {
		...transaction,
		id: transaction.id.toString('hex'),
		senderPublicKey: transaction.senderPublicKey.toString('hex'),
		signatures: transaction.signatures.map((s: Buffer) => s.toString('hex')),
		params: {
			...transaction.params,
			tokenID: transaction.params.tokenID.toString('hex'),
			amount: transaction.params.amount.toString(),
			recipientAddress: cryptography.address.getKlayr32AddressFromAddress(
				transaction.params.recipientAddress,
			),
		},
		nonce: transaction.nonce.toString(),
		fee: transaction.fee.toString(),
	};
};

export const encodeTransactionFromJSON = (
	transaction: Record<string, unknown>,
	baseSchema: Schema,
	commandsSchemas: { module: string; command: string; schema: Schema }[],
): string => {
	const transactionTypeAssetSchema = commandsSchemas.find(
		as => as.module === transaction.module && as.command === transaction.command,
	);

	if (!transactionTypeAssetSchema) {
		throw new Error('Transaction type not found.');
	}

	const transactionAssetBuffer = codec.encode(
		transactionTypeAssetSchema.schema,
		// eslint-disable-next-line @typescript-eslint/ban-types
		codec.fromJSON(transactionTypeAssetSchema.schema, transaction.params as object),
	);

	const transactionBuffer = codec.encode(
		baseSchema,
		codec.fromJSON(baseSchema, {
			...transaction,
			params: transactionAssetBuffer,
		}),
	);

	return transactionBuffer.toString('hex');
};
