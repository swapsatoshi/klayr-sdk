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

import { GeneratorStore } from '../generator';
import { APIContext, BlockHeader } from '../state_machine';

export interface BFTHeader {
	id: Buffer;
	previousBlockID: Buffer;
	generatorAddress: Buffer;
	timestamp: number;
	height: number;
	maxHeightPrevoted: number;
	maxHeightPreviouslyForged: number;
	receivedAt?: number;
}

export interface Validator {
	address: Buffer;
	bftWeight: bigint;
}

export interface ValidatorAPI {
	getGenerator: (apiContext: APIContext, timestamp: number) => Promise<Buffer>;
	getSlotNumber: (apiContext: APIContext, timestamp: number) => number;
	getSlotTime: (apiContext: APIContext, slot: number) => number;
}

export interface LiskBFTAPI {
	verifyGeneratorInfo: (
		apiContext: APIContext,
		generatorStore: GeneratorStore,
		info: {
			address: Buffer;
			height: number;
			maxHeightPrevoted: number;
			maxHeightPreviouslyForged: number;
			override?: boolean;
		},
	) => Promise<void>;
	getValidators: (_apiContext: APIContext) => Promise<Validator[]>;
	getBFTHeader(header: BlockHeader): BFTHeader;
}
