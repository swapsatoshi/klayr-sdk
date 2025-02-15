/*
 * Copyright © 2024 Lisk Foundation
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

import { apiClient, cryptography, chain, TransactionJSON, Modules, Engine } from 'klayr-sdk';
import {
	bftParametersJSONToObj,
	chainAccountDataJSONToObj,
	channelDataJSONToObj,
	getTokenIDKLY,
	proveResponseJSONToObj,
} from './utils';
import {
	BFTParametersJSON,
	BFTParametersWithoutGeneratorKey,
	EventCallback,
	JSONObject,
	Logger,
	ModulesMetadata,
	NodeInfo,
	ProveResponseJSON,
} from './types';

const { address } = cryptography;
interface APIConfig {
	wsConnectionString?: string;
	ipcPath?: string;
	logger: Logger;
}

export class ChainAPIClient {
	public chainID!: Buffer;
	private readonly _config: APIConfig;
	private _client!: apiClient.APIClient;

	public constructor(config: APIConfig) {
		this._config = config;
	}

	public async connect(client?: apiClient.APIClient) {
		if (client) {
			this._client = client;

			return;
		}
		if (!this._config.ipcPath && !this._config.wsConnectionString) {
			throw new Error('IPC path and WS url are undefined in the configuration.');
		}
		if (this._config.ipcPath) {
			this._client = await apiClient.createIPCClient(this._config.ipcPath);
		} else if (this._config.wsConnectionString) {
			this._client = await apiClient.createWSClient(this._config.wsConnectionString);
		}

		this.chainID = Buffer.from((await this.getNodeInfo()).chainID, 'hex');
	}

	public async disconnect() {
		await this._client.disconnect();
	}

	public subscribe(eventName: string, cb: EventCallback): void {
		this._client?.subscribe(eventName, cb);
	}

	public async postTransaction(txBytes: Buffer): Promise<{ transactionId: string }> {
		const result = await this._client?.invoke<{
			transactionId: string;
		}>('txpool_postTransaction', {
			transaction: txBytes.toString('hex'),
		});

		return result as { transactionId: string };
	}

	public async getTransactionByID(id: string): Promise<TransactionJSON> {
		const result = await this._client?.invoke<TransactionJSON>('chain_getTransactionByID', {
			id,
		});

		return result;
	}

	public async getAuthAccountNonceFromPublicKey(publicKey: Buffer): Promise<string> {
		return (
			await this._client.invoke<{ nonce: string }>('auth_getAuthAccount', {
				address: address.getKlayr32AddressFromPublicKey(publicKey),
			})
		).nonce;
	}

	public async getNodeInfo(): Promise<NodeInfo> {
		return this._client.node.getNodeInfo();
	}

	public async getChannelAccount(
		chainID: Buffer,
	): Promise<Modules.Interoperability.ChannelData | undefined> {
		const channelAccount = await this._client.invoke<Modules.Interoperability.ChannelDataJSON>(
			'interoperability_getChannel',
			{
				chainID: chainID.toString('hex'),
			},
		);
		if (!channelAccount || channelAccount?.inbox === undefined) {
			return undefined;
		}

		return channelDataJSONToObj(channelAccount);
	}

	public async getChainAccount(
		chainID: Buffer,
	): Promise<Modules.Interoperability.ChainAccount | undefined> {
		const chainAccount = await this._client.invoke<Modules.Interoperability.ChainAccountJSON>(
			'interoperability_getChainAccount',
			{
				chainID: chainID.toString('hex'),
			},
		);

		if (!chainAccount || chainAccount?.lastCertificate === undefined) {
			return undefined;
		}
		return chainAccountDataJSONToObj(chainAccount);
	}

	public async hasUserTokenAccount(userAddress: string) {
		return this._client.invoke<{ exists: boolean }>('token_hasUserAccount', {
			address: userAddress,
			// It is always KLY token
			tokenID: `${getTokenIDKLY(this.chainID).toString('hex')}`,
		});
	}

	public async getTokenInitializationFee() {
		return this._client.invoke<{
			userAccount: string;
			escrowAccount: string;
		}>('token_getInitializationFees');
	}

	public async getBFTHeights() {
		return this._client.invoke<Engine.BFTHeights>('consensus_getBFTHeights');
	}

	public async getEvents(height: number) {
		return this._client.invoke<JSONObject<chain.EventAttr[]>>('chain_getEvents', { height });
	}

	public async getMetadataByModuleName(moduleName: string) {
		const { modules: modulesMetadata } = await this._client.invoke<{
			modules: ModulesMetadata;
		}>('system_getMetadata');
		const moduleMetadata = modulesMetadata.find(m => m.name === moduleName);

		if (!moduleMetadata) {
			throw new Error(`No metadata found for ${moduleName} module.`);
		}

		return moduleMetadata;
	}

	public async getInclusionProof(queryKeys: Buffer[]) {
		return proveResponseJSONToObj(
			await this._client.invoke<ProveResponseJSON>('state_prove', {
				queryKeys: [...queryKeys].map(k => k.toString('hex')),
			}),
		);
	}

	public async getSavedInclusionProofAtHeight(height: number) {
		return proveResponseJSONToObj(
			await this._client.invoke<ProveResponseJSON>('chain_getInclusionProofsAtHeight', {
				height,
			}),
		);
	}

	public async getBFTParametersAtHeight(height: number): Promise<BFTParametersWithoutGeneratorKey> {
		return bftParametersJSONToObj(
			await this._client.invoke<BFTParametersJSON>('consensus_getBFTParametersActiveValidators', {
				height,
			}),
		);
	}
}
