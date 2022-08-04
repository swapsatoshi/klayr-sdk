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

import { chain, aggregateCommitSchema } from 'lisk-sdk';

export const configSchema = {
	$id: '#/plugins/chainConnector/config',
	type: 'object',
	properties: {
		mainchainIPCPath: {
			type: 'string',
			description: 'The IPC path to a mainchain node',
		},
		sidechainIPCPath: {
			type: 'string',
			description: 'The IPC path to a sidechain node',
		},
		ccmBasedFrequency: {
			type: 'integer',
			description: 'Number of Cross chain messages after which a CCU should be created',
		},
		livenessBasedFrequency: {
			type: 'integer',
			description: 'Number of blocks after which a CCU should be created',
		},
	},
	required: ['mainchainIPCPath'],
	default: {
		ccmFrequency: 10,
		livenessFrequency: 86400,
	},
};

export const validatorsDataSchema = {
	$id: '/modules/bft/validatorsHashInput',
	type: 'object',
	required: ['validators', 'certificateThreshold'],
	properties: {
		validators: {
			type: 'array',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['blsKey', 'bftWeight'],
				properties: {
					address: { dataType: 'bytes', fieldNumber: 1 },
					blsKey: { dataType: 'bytes', fieldNumber: 2 },
					bftWeight: { dataType: 'uint64', fieldNumber: 3 },
				},
			},
		},
		certificateThreshold: { dataType: 'uint64', fieldNumber: 2 },
		validatorsHash: { dataType: 'bytes', fieldNumber: 3 },
	},
};

export const ccmSchema = {
	$id: '/modules/interoperability/ccm',
	type: 'object',
	required: [
		'nonce',
		'moduleID',
		'crossChainCommandID',
		'sendingChainID',
		'receivingChainID',
		'fee',
		'status',
		'params',
	],
	properties: {
		nonce: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		moduleID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		crossChainCommandID: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		sendingChainID: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		receivingChainID: {
			dataType: 'bytes',
			fieldNumber: 5,
		},
		fee: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
		status: {
			dataType: 'uint32',
			fieldNumber: 7,
		},
		params: {
			dataType: 'bytes',
			fieldNumber: 8,
		},
		id: {
			dataType: 'bytes',
			fieldNumber: 9,
		},
	},
};

export const chainConnectorInfoSchema = {
	$id: '#/plugins/chainConnector/info',
	type: 'object',
	properties: {
		blockHeaders: {
			type: 'array',
			fieldNumber: 1,
			items: {
				...chain.blockHeaderSchema,
			},
		},
		aggregateCommits: {
			type: 'array',
			fieldNumber: 2,
			items: {
				...aggregateCommitSchema,
			},
		},
		validatorsHashPreimage: {
			type: 'array',
			fieldNumber: 3,
			items: {
				...validatorsDataSchema,
			},
		},
		crossChainMessages: {
			type: 'array',
			fieldNumber: 4,
			items: {
				...ccmSchema,
			},
		},
	},
	required: ['blockHeaders', 'aggregateCommits', 'validatorsHashPreimage', 'crossChainMessages'],
};
