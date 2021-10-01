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

import { Block } from '@liskhq/lisk-chain';
import { Logger } from '../../logger';
import { BFTHeights } from '../consensus';
import { APIContext, BlockHeader, ImmutableAPIContext, ImmutableSubStore } from '../state_machine';

export interface Keypair {
	publicKey: Buffer;
	privateKey: Buffer;
}

export interface GeneratorStore {
	get: (key: Buffer) => Promise<Buffer>;
	set: (key: Buffer, value: Buffer) => Promise<void>;
}

export interface Consensus {
	execute: (block: Block) => Promise<void>;
	isSynced: (height: number, maxHeightPrevoted: number) => boolean;
}

export interface BFTAPI {
	getBFTHeights: (_apiClient: ImmutableAPIContext) => Promise<BFTHeights>;
}

export interface ValidatorAPI {
	getGeneratorAtTimestamp: (apiContext: APIContext, timestamp: number) => Promise<Buffer>;
	getSlotNumber: (apiContext: APIContext, timestamp: number) => Promise<number>;
	getSlotTime: (apiContext: APIContext, slot: number) => Promise<number>;
}

export interface WritableBlockAssets {
	getAsset: (moduleID: number) => Buffer | undefined;
	setAsset: (moduleID: number, value: Buffer) => void;
}

export interface BlockGenerateContext {
	logger: Logger;
	networkIdentifier: Buffer;
	getAPIContext: () => APIContext;
	getStore: (moduleID: number, storePrefix: number) => ImmutableSubStore;
	header: BlockHeader;
	assets: WritableBlockAssets;
	getGeneratorStore: (moduleID: number) => GeneratorStore;
}

export interface GeneratorModule {
	readonly id: number;
	initBlock?: (ctx: BlockGenerateContext) => Promise<void>;
	sealBlock?: (ctx: BlockGenerateContext) => Promise<void>;
}
