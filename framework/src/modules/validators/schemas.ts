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

export const validatorAccountSchema = {
	type: 'object',
	properties: {
		generatorKey: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		blsKey: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
	},
	required: ['generatorKey', 'blsKey'],
};

export const generatorListSchema = {
	type: 'object',
	properties: {
		addresses: {
			type: 'array',
			fieldNumber: 1,
			items: {
				dataType: 'bytes',
			},
		},
	},
	required: ['addresses'],
};

export const validatorAddressSchema = {
	type: 'object',
	properties: {
		address: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
	required: ['address'],
};

export const genesisDataSchema = {
	type: 'object',
	properties: {
		timestamp: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
	required: ['timestamp'],
};
