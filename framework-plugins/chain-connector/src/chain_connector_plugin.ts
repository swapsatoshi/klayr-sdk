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

import { Plugins } from 'klayr-sdk';
import { CCU_TOTAL_CCM_SIZE } from './constants';
import { configSchema } from './schemas';
import { ChainConnectorPluginConfig } from './types';
import { ChainAPIClient } from './chain_api_client';
import { BlockEventHandler } from './block_event_handler';
import { ChainConnectorDB } from './db';
import { ChainConnectorEndpoint } from './endpoint';

export class ChainConnectorPlugin extends Plugins.BasePlugin<ChainConnectorPluginConfig> {
	public readonly endpoint = new ChainConnectorEndpoint();
	public configSchema = configSchema;

	private readonly _chainConnectorDB = new ChainConnectorDB();
	private _receivingChainClient!: ChainAPIClient;
	private _sendingChainClient!: ChainAPIClient;
	private _ownChainID!: Buffer;
	private _receivingChainID!: Buffer;
	private _blockEventHandler!: BlockEventHandler;

	public get nodeModulePath(): string {
		return __filename;
	}

	public async init(context: Plugins.PluginInitContext): Promise<void> {
		await super.init(context);
		if (this.config.maxCCUSize > CCU_TOTAL_CCM_SIZE) {
			throw new Error(`maxCCUSize cannot be greater than ${CCU_TOTAL_CCM_SIZE} bytes.`);
		}
		this._receivingChainID = Buffer.from(this.config.receivingChainID, 'hex');
		this._blockEventHandler = new BlockEventHandler({
			maxCCUSize: this.config.maxCCUSize,
			ownChainID: Buffer.from(this.appConfig.genesis.chainID, 'hex'),
			receivingChainID: Buffer.from(this.config.receivingChainID, 'hex'),
			registrationHeight: this.config.registrationHeight,
			ccuFee: this.config.ccuFee,
			isSaveCCU: this.config.isSaveCCU,
			ccuSaveLimit: this.config.ccuSaveLimit,
			noFeeHeight: this.config.noFeeHeight,
		});
		this._sendingChainClient = new ChainAPIClient({
			ipcPath: this.appConfig.system.dataPath,
			logger: this.logger,
		});
	}

	public async load(): Promise<void> {
		await this._chainConnectorDB.load(this.dataPath);
		this.endpoint.load(this.config.encryptedPrivateKey, this._chainConnectorDB);

		await this._sendingChainClient.connect(this.apiClient);
		this._ownChainID = Buffer.from(this.appConfig.genesis.chainID, 'hex');
		if (this._receivingChainID[0] !== this._ownChainID[0]) {
			throw new Error('Receiving Chain ID network does not match the sending chain network.');
		}
		this._receivingChainClient = new ChainAPIClient({
			logger: this.logger,
			ipcPath: this.config.receivingChainIPCPath,
			wsConnectionString: this.config.receivingChainWsURL,
		});
		await this._blockEventHandler.load({
			db: this._chainConnectorDB,
			logger: this.logger,
			receivingChainAPIClient: this._receivingChainClient,
			sendingChainAPIClient: this._sendingChainClient,
		});
	}

	public async unload(): Promise<void> {
		if (this._receivingChainClient) {
			await this._receivingChainClient.disconnect();
		}
		if (this._sendingChainClient) {
			await this._sendingChainClient.disconnect();
		}

		this._chainConnectorDB.close();
	}
}
