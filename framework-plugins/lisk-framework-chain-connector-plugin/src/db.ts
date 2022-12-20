/*
 * Copyright © 2022 Lisk Foundation
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

import { codec, db as liskDB, AggregateCommit } from 'lisk-sdk';
import * as os from 'os';
import { join } from 'path';
import { ensureDir } from 'fs-extra';
import {
	DB_KEY_AGGREGATE_COMMITS,
	DB_KEY_BLOCK_HEADERS,
	DB_KEY_CROSS_CHAIN_MESSAGES,
	DB_KEY_VALIDATORS_HASH_PREIMAGE,
} from './constants';
import {
	aggregateCommitsInfoSchema,
	blockHeadersInfoSchema,
	ccmsFromEventsSchema,
	validatorsHashPreimageInfoSchema,
} from './schemas';
import { BlockHeader, CrossChainMessagesFromEvents, ValidatorsData } from './types';

const { Database } = liskDB;
type KVStore = liskDB.Database;

interface BlockHeadersInfo {
	blockHeaders: BlockHeader[];
}

interface AggregateCommitsInfo {
	aggregateCommits: AggregateCommit[];
}

interface ValidatorsHashPreimage {
	validatorsHashPreimage: ValidatorsData[];
}

interface CrossChainMessagesInfo {
	ccmsFromEvents: CrossChainMessagesFromEvents[];
}

export const getDBInstance = async (
	dataPath: string,
	dbName = 'lisk-framework-chain-connector-plugin.db',
): Promise<KVStore> => {
	const dirPath = join(dataPath.replace('~', os.homedir()), 'plugins/data', dbName);
	await ensureDir(dirPath);

	return new Database(dirPath);
};

export class ChainConnectorStore {
	private readonly _db: KVStore;
	private readonly _blockHeadersDBKey: Buffer;
	private readonly _aggregateCommitsDBKey: Buffer;
	private readonly _validatorsHashPreimageDBKey: Buffer;
	private readonly _crossChainMessagesDBKey: Buffer;

	public constructor(db: KVStore, private readonly _chainType: Buffer) {
		this._db = db;
		this._blockHeadersDBKey = Buffer.concat([this._chainType, DB_KEY_BLOCK_HEADERS]);
		this._aggregateCommitsDBKey = Buffer.concat([this._chainType, DB_KEY_AGGREGATE_COMMITS]);
		this._validatorsHashPreimageDBKey = Buffer.concat([
			this._chainType,
			DB_KEY_VALIDATORS_HASH_PREIMAGE,
		]);
		this._crossChainMessagesDBKey = Buffer.concat([this._chainType, DB_KEY_CROSS_CHAIN_MESSAGES]);
	}

	public close() {
		this._db.close();
	}

	public async getBlockHeaders(): Promise<BlockHeader[]> {
		try {
			const encodedInfo = await this._db.get(this._blockHeadersDBKey);

			return codec.decode<BlockHeadersInfo>(blockHeadersInfoSchema, encodedInfo).blockHeaders;
		} catch (error) {
			if (!(error instanceof liskDB.NotFoundError)) {
				throw error;
			}

			// Set initial value
			const encodedInitialData = codec.encode(blockHeadersInfoSchema, { blockHeaders: [] });
			await this._db.set(this._blockHeadersDBKey, encodedInitialData);

			return [];
		}
	}

	public async setBlockHeaders(blockHeaders: BlockHeader[]) {
		const encodedInfo = codec.encode(blockHeadersInfoSchema, { blockHeaders });

		await this._db.set(this._blockHeadersDBKey, encodedInfo);
	}

	public async getAggregateCommits(): Promise<AggregateCommit[]> {
		try {
			const encodedInfo = await this._db.get(this._aggregateCommitsDBKey);

			return codec.decode<AggregateCommitsInfo>(aggregateCommitsInfoSchema, encodedInfo)
				.aggregateCommits;
		} catch (error) {
			if (!(error instanceof liskDB.NotFoundError)) {
				throw error;
			}
			// Set initial value
			const encodedInitialData = codec.encode(aggregateCommitsInfoSchema, { aggregateCommits: [] });
			await this._db.set(this._aggregateCommitsDBKey, encodedInitialData);

			return [];
		}
	}

	public async setAggregateCommits(aggregateCommits: AggregateCommit[]) {
		const encodedInfo = codec.encode(aggregateCommitsInfoSchema, { aggregateCommits });
		await this._db.set(this._aggregateCommitsDBKey, encodedInfo);
	}

	public async getValidatorsHashPreimage(): Promise<ValidatorsData[]> {
		try {
			const encodedInfo = await this._db.get(this._validatorsHashPreimageDBKey);

			return codec.decode<ValidatorsHashPreimage>(validatorsHashPreimageInfoSchema, encodedInfo)
				.validatorsHashPreimage;
		} catch (error) {
			if (!(error instanceof liskDB.NotFoundError)) {
				throw error;
			}
			// Set initial value
			const encodedInitialData = codec.encode(validatorsHashPreimageInfoSchema, {
				validatorsHashPreimage: [],
			});
			await this._db.set(this._validatorsHashPreimageDBKey, encodedInitialData);

			return [];
		}
	}

	public async setValidatorsHashPreimage(validatorsHashInput: ValidatorsData[]) {
		const encodedInfo = codec.encode(validatorsHashPreimageInfoSchema, {
			validatorsHashPreimage: validatorsHashInput,
		});
		await this._db.set(this._validatorsHashPreimageDBKey, encodedInfo);
	}

	public async getCrossChainMessages(): Promise<CrossChainMessagesFromEvents[]> {
		try {
			const encodedInfo = await this._db.get(this._crossChainMessagesDBKey);
			return codec.decode<CrossChainMessagesInfo>(ccmsFromEventsSchema, encodedInfo).ccmsFromEvents;
		} catch (error) {
			if (!(error instanceof liskDB.NotFoundError)) {
				throw error;
			}
			// Set initial value
			const encodedInitialData = codec.encode(ccmsFromEventsSchema, { ccmsFromEvents: [] });
			await this._db.set(this._crossChainMessagesDBKey, encodedInitialData);

			return [];
		}
	}

	public async setCrossChainMessages(ccms: CrossChainMessagesFromEvents[]) {
		const encodedInfo = codec.encode(ccmsFromEventsSchema, { ccmsFromEvents: ccms });
		await this._db.set(this._crossChainMessagesDBKey, encodedInfo);
	}
}
