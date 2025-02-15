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

import { Modules, chain, codec } from 'klayr-sdk';
import { ChainAPIClient } from './chain_api_client';
import { ChainConnectorDB } from './db';
import { BlockHeader, LastSentCCM, Logger, ModuleMetadata } from './types';
import { CCM_PROCESSED, CCM_SEND_SUCCESS, DEFAULT_SENT_CCU_TIMEOUT } from './constants';
import { CCUHandler } from './ccu_handler';

interface NewBlockHandlerConfig {
	registrationHeight: number;
	ownChainID: Buffer;
	receivingChainID: Buffer;
	maxCCUSize: number;
	ccuFee: string;
	isSaveCCU: boolean;
	ccuSaveLimit: number;
	noFeeHeight: number;
}

interface NewBlockHandlerInitArgs {
	logger: Logger;
	db: ChainConnectorDB;
	sendingChainAPIClient: ChainAPIClient;
	receivingChainAPIClient: ChainAPIClient;
}

interface Data {
	readonly blockHeader: chain.BlockHeaderJSON;
}
type FinalizedHeightInfo = { inboxSize: number; lastCertificateHeight: number };

export class BlockEventHandler {
	private readonly _ownChainID!: Buffer;
	private readonly _ccuHandler!: CCUHandler;
	private readonly _ccuFrequency!: number;
	private readonly _ccuSaveLimit: number;
	private readonly _receivingChainID: Buffer;
	private readonly _isReceivingChainMainchain!: boolean;
	private _db!: ChainConnectorDB;
	private _logger!: Logger;
	private _sendingChainAPIClient!: ChainAPIClient;
	private _receivingChainAPIClient!: ChainAPIClient;
	private _lastCertificate!: Modules.Interoperability.LastCertificate;
	private _interoperabilityMetadata!: ModuleMetadata;
	private _heightToDeleteIndex!: Map<number, FinalizedHeightInfo>;
	private _receivingChainFinalizedHeight!: number;
	private _isReceivingChainRegistered = false;
	private _lastSentCCUTxID = '';
	private _lastSentCCM!: LastSentCCM;
	private _lastIncludedCCMOnReceivingChain!: LastSentCCM | undefined;
	private _lastDeletionHeight!: number;
	private _sentCCUTxTimeout!: NodeJS.Timer;

	public constructor(config: NewBlockHandlerConfig) {
		this._ownChainID = config.ownChainID;
		this._ccuSaveLimit = config.ccuSaveLimit;
		this._receivingChainFinalizedHeight = 0;
		this._receivingChainID = config.receivingChainID;
		// If the running node is mainchain then receiving chain will be sidechain or vice verse.
		this._isReceivingChainMainchain = !Modules.Interoperability.getMainchainID(
			this._ownChainID,
		).equals(this._ownChainID);
		this._ccuHandler = new CCUHandler({
			maxCCUSize: config.maxCCUSize,
			ownChainID: config.ownChainID,
			receivingChainID: config.receivingChainID,
			registrationHeight: config.registrationHeight,
			ccuFee: config.ccuFee,
			isSaveCCU: config.isSaveCCU,
			noFeeHeight: config.noFeeHeight,
		});
	}

	public async load(args: NewBlockHandlerInitArgs) {
		this._logger = args.logger;
		this._db = args.db;
		this._sendingChainAPIClient = args.sendingChainAPIClient;
		this._receivingChainAPIClient = args.receivingChainAPIClient;
		this._heightToDeleteIndex = new Map();
		this._interoperabilityMetadata = await this._sendingChainAPIClient.getMetadataByModuleName(
			Modules.Interoperability.MODULE_NAME_INTEROPERABILITY,
		);
		this._ccuHandler.load({
			db: args.db,
			lastCertificate: this._lastCertificate,
			logger: args.logger,
			receivingChainAPIClient: args.receivingChainAPIClient,
			sendingChainAPIClient: args.sendingChainAPIClient,
			interoperabilityMetadata: this._interoperabilityMetadata,
		});

		await this._receivingChainAPIClient.connect();
		this._lastIncludedCCMOnReceivingChain = await this._db.getLastSentCCM();
		// On a new block start with CCU creation process
		this._sendingChainAPIClient.subscribe(
			'chain_newBlock',
			async (data?: Record<string, unknown>) => {
				try {
					await this._handleNewBlock(data);
				} catch (error) {
					this._logger.error({ err: error as Error }, 'Failed to handle new block.');
				}
			},
		);

		this._sendingChainAPIClient.subscribe(
			'chain_deleteBlock',
			async (data?: Record<string, unknown>) => {
				try {
					await this._deleteBlockHandler(data);
				} catch (error) {
					this._logger.error({ err: error as Error }, 'Failed to handle delete block.');
				}
			},
		);

		// Initialize the receiving chain client in the end of load so not to miss the initial new blocks
		this._initializeReceivingChainClient().catch(this._logger.error);
	}

	private async _handleNewBlock(data?: Record<string, unknown>) {
		const { blockHeader: receivedBlock } = data as unknown as Data;
		const newBlockHeader = chain.BlockHeader.fromJSON(receivedBlock).toObject();

		await this._saveOnNewBlock(newBlockHeader);

		const nodeInfo = await this._sendingChainAPIClient.getNodeInfo();

		if (nodeInfo.syncing) {
			this._logger.debug('No CCU generation is possible as the node is syncing.');
			return;
		}
		let chainAccount: Modules.Interoperability.ChainAccount | undefined;

		// Fetch last certificate from the receiving chain and update the _lastCertificate
		try {
			chainAccount = await this._receivingChainAPIClient.getChainAccount(this._ownChainID);
		} catch (error) {
			// If receivingChainAPIClient is not ready then still save data on new block
			// Error is handled within this function so need to have try/catch
			await this._initializeReceivingChainClient();
			this._logger.error(
				{ err: error as Error },
				'Error occurred while accessing receivingChainAPIClient but all data is saved on new block.',
			);

			return;
		}

		// If sending chain is not registered with the receiving chain then only save data on new block and exit
		if (!chainAccount || (chainAccount && !chainAccount.lastCertificate)) {
			this._logger.info(
				'Sending chain is not registered to the receiving chain yet and has no chain data.',
			);
			return;
		}

		this._lastCertificate = chainAccount.lastCertificate;
		this._logger.info(
			`Last certificate value has been set with height ${this._lastCertificate.height}`,
		);

		const numOfBlocksSinceLastCertificate = newBlockHeader.height - this._lastCertificate.height;
		if (this._ccuFrequency > numOfBlocksSinceLastCertificate) {
			this._logger.info(
				{
					ccuFrequency: this._ccuFrequency,
					nextPossibleCCUHeight: this._ccuFrequency - numOfBlocksSinceLastCertificate,
				},
				'No attempt to create CCU either due to provided ccuFrequency',
			);

			return;
		}

		// Check if receiving chain is registered yet or not
		if (!this._isReceivingChainRegistered) {
			const receivingChainAccount = await this._sendingChainAPIClient.getChainAccount(
				this._receivingChainID,
			);
			if (!receivingChainAccount) {
				this._logger.info(
					'Receiving chain is not registered on the sending chain yet and has no chain data.',
				);
				return;
			}
			this._isReceivingChainRegistered = true;
		}

		let computedCCUParams;

		// Compute CCU when there is no pending CCU that was sent earlier
		if (this._lastSentCCUTxID === '') {
			computedCCUParams = await this._ccuHandler.computeCCU(
				this._lastCertificate,
				this._lastIncludedCCMOnReceivingChain,
			);
		} else {
			this._logger.info(
				`Still pending CCU on the receiving CCU with tx ID ${this._lastSentCCUTxID}`,
			);

			return;
		}

		if (!computedCCUParams) {
			this._logger.info(`No CCU params were generated for block height ${newBlockHeader.height}`);

			return;
		}

		const ccuSubmitResult = await this._ccuHandler.submitCCU(
			computedCCUParams.ccuParams,
			this._lastSentCCUTxID,
		);
		if (ccuSubmitResult) {
			this._lastSentCCUTxID = ccuSubmitResult;
			// Wait until 1 hour
			this._sentCCUTxTimeout = setTimeout(() => {
				this._lastSentCCUTxID = '';
				clearTimeout(this._sentCCUTxTimeout);
			}, DEFAULT_SENT_CCU_TIMEOUT);
			// If CCU was sent successfully then save the lastSentCCM if any
			if (computedCCUParams.lastCCMToBeSent) {
				this._lastSentCCM = computedCCUParams.lastCCMToBeSent;
				this._logger.info(
					`Last sent CCM with nonce ${this._lastSentCCM.nonce.toString()} is saved.`,
				);
			}
			this._logger.info(`CCU transaction was successfully sent with Tx ID ${ccuSubmitResult}.`);
			return;
		}
		this._logger.info(
			`Last sent CCU tx with ID ${this._lastSentCCUTxID} was not yet included in the receiving chain.`,
		);
	}

	private async _saveOnNewBlock(newBlockHeader: BlockHeader) {
		await this._db.saveToDBOnNewBlock(newBlockHeader);
		// Check for events if any and store them
		const events = await this._sendingChainAPIClient.getEvents(newBlockHeader.height);

		const ccmsFromEvents = [];
		// eslint-disable-next-line no-restricted-syntax, no-labels
		ccmInEventsCheck: if (events && events.length > 0) {
			const ccmSendSuccessEvents = events.filter(
				eventAttr =>
					eventAttr.name === CCM_SEND_SUCCESS &&
					eventAttr.module === Modules.Interoperability.MODULE_NAME_INTEROPERABILITY,
			);

			const ccmProcessedEvents = events.filter(
				eventAttr =>
					eventAttr.name === CCM_PROCESSED &&
					eventAttr.module === Modules.Interoperability.MODULE_NAME_INTEROPERABILITY,
			);

			if (ccmSendSuccessEvents.length === 0 && ccmProcessedEvents.length === 0) {
				// If there are no CCMs present in the events for the height then skip CCM saving part
				// eslint-disable-next-line no-labels
				break ccmInEventsCheck;
			}

			// Save ccm send success events
			if (ccmSendSuccessEvents.length > 0) {
				const ccmSendSuccessEventInfo = this._interoperabilityMetadata.events.filter(
					e => e.name === CCM_SEND_SUCCESS,
				);

				if (!ccmSendSuccessEventInfo?.[0]?.data) {
					throw new Error('No schema found for "ccmSendSuccess" event data.');
				}

				for (const e of ccmSendSuccessEvents) {
					const eventData = codec.decode<Modules.Interoperability.CcmSendSuccessEventData>(
						ccmSendSuccessEventInfo[0].data,
						Buffer.from(e.data, 'hex'),
					);
					ccmsFromEvents.push(eventData.ccm);
				}
			}
			// Save ccm processed events based on CCMProcessedResult FORWARDED = 1
			if (ccmProcessedEvents.length > 0) {
				const ccmProcessedEventInfo = this._interoperabilityMetadata.events.filter(
					e => e.name === CCM_PROCESSED,
				);

				if (!ccmProcessedEventInfo?.[0]?.data) {
					throw new Error('No schema found for "ccmProcessed" event data.');
				}

				for (const e of ccmProcessedEvents) {
					const eventData = codec.decode<Modules.Interoperability.CcmProcessedEventData>(
						ccmProcessedEventInfo[0].data,
						Buffer.from(e.data, 'hex'),
					);
					if (eventData.result === Modules.Interoperability.CCMProcessedResult.FORWARDED) {
						ccmsFromEvents.push(eventData.ccm);
					}
				}
			}
		}

		await this._db.setCCMsByHeight(
			ccmsFromEvents
				.map(ccm => ({ ...ccm, height: newBlockHeader.height }))
				.filter(
					ccm =>
						this._isReceivingChainMainchain || ccm.receivingChainID.equals(this._receivingChainID),
				),
			newBlockHeader.height,
		);

		const validatorsData = await this._sendingChainAPIClient.getBFTParametersAtHeight(
			newBlockHeader.height,
		);

		await this._db.setValidatorsDataByHash(
			validatorsData.validatorsHash,
			{ ...validatorsData, height: newBlockHeader.height },
			newBlockHeader.height,
		);
	}

	private async _initializeReceivingChainClient() {
		try {
			await this._receivingChainAPIClient.connect();
			this._receivingChainAPIClient.subscribe(
				'chain_newBlock',
				async (data?: Record<string, unknown>) => this._newBlockReceivingChainHandler(data),
			);
		} catch (error) {
			this._logger.error(
				error,
				'Not able to connect to receivingChainAPIClient. Trying again on next new block.',
			);
		}
	}

	private async _newBlockReceivingChainHandler(_?: Record<string, unknown>) {
		try {
			const { finalizedHeight, syncing } = await this._receivingChainAPIClient.getNodeInfo();
			// If receiving node is syncing then return
			if (syncing) {
				this._logger.debug('Receiving chain is syncing.');
				return;
			}
			this._receivingChainFinalizedHeight = finalizedHeight;
			const channelDataOnReceivingChain = await this._receivingChainAPIClient.getChannelAccount(
				this._ownChainID,
			);
			if (!channelDataOnReceivingChain) {
				throw new Error('No channel data available on receiving chain.');
			}
			const chainAccount = await this._receivingChainAPIClient.getChainAccount(this._ownChainID);
			if (!chainAccount) {
				throw new Error('No chain data available on receiving chain.');
			}
			this._heightToDeleteIndex.set(finalizedHeight, {
				inboxSize: channelDataOnReceivingChain.inbox.size,
				lastCertificateHeight: chainAccount.lastCertificate?.height,
			});
			if (this._lastSentCCUTxID !== '') {
				try {
					await this._receivingChainAPIClient.getTransactionByID(this._lastSentCCUTxID);
					this._logger.info(
						`CCU transaction with ${this._lastSentCCUTxID} was included on the receiving chain`,
					);
					// Reset last sent CCU to be blank
					this._lastSentCCUTxID = '';
					clearTimeout(this._sentCCUTxTimeout);
					// Update last included CCM if there was any in the last sent CCU
					if (this._lastSentCCM) {
						this._lastIncludedCCMOnReceivingChain = this._lastSentCCM;
						await this._db.setLastSentCCM(this._lastIncludedCCMOnReceivingChain);
					}
				} catch (error) {
					throw new Error(`Failed to get transaction with ID ${this._lastSentCCUTxID}`);
				}
			}
			await this._cleanup();
		} catch (error) {
			this._logger.debug(error, 'Error occured while receiving block from receiving chain.');
		}
	}

	private async _cleanup() {
		// Delete CCUs
		// When given -1 then there is no limit
		if (this._ccuSaveLimit !== -1) {
			const { list: listOfCCUs, total } = await this._db.getListOfCCUs();
			if (total > this._ccuSaveLimit) {
				// listOfCCUs is a descending list of CCUs by nonce
				for (let i = total - 1; i >= this._ccuSaveLimit; i -= 1) {
					await this._db.deleteCCUTransaction(Buffer.from(listOfCCUs[i]?.id as string, 'hex'));
				}
			}
		}
		let finalizedInfoAtHeight = this._heightToDeleteIndex.get(this._receivingChainFinalizedHeight);
		if (!finalizedInfoAtHeight) {
			for (let i = 1; i < this._heightToDeleteIndex.size; i += 1) {
				if (this._heightToDeleteIndex.get(this._receivingChainFinalizedHeight - i)) {
					finalizedInfoAtHeight = this._heightToDeleteIndex.get(
						this._receivingChainFinalizedHeight - i,
					);
					break;
				}
			}
		}

		const endDeletionHeightByLastCertificate = finalizedInfoAtHeight
			? finalizedInfoAtHeight.lastCertificateHeight
			: 0;

		if (this._lastCertificate.height > 0) {
			// Delete CCMs
			await this._db.deleteCCMsBetweenHeight(
				this._lastDeletionHeight,
				endDeletionHeightByLastCertificate - 1,
			);

			// Delete blockHeaders
			await this._db.deleteBlockHeadersBetweenHeight(
				this._lastDeletionHeight,
				endDeletionHeightByLastCertificate - 1,
			);

			// Delete aggregateCommits
			await this._db.deleteAggregateCommitsBetweenHeight(
				this._lastDeletionHeight,
				endDeletionHeightByLastCertificate - 1,
			);

			// Delete validatorsHashPreimage
			await this._db.deleteValidatorsHashBetweenHeights(
				this._lastDeletionHeight,
				endDeletionHeightByLastCertificate - 1,
			);

			this._lastDeletionHeight = endDeletionHeightByLastCertificate;

			this._logger.debug(
				`Deleted data on cleanup between heights 1 and ${endDeletionHeightByLastCertificate}`,
			);
		}

		// Delete info less than finalized height
		this._heightToDeleteIndex.forEach((_, key) => {
			if (key < this._receivingChainFinalizedHeight) {
				this._heightToDeleteIndex.delete(key);
			}
		});
	}

	private async _deleteBlockHandler(data?: Record<string, unknown>) {
		const { blockHeader: receivedBlock } = data as unknown as Data;

		const deletedBlockHeader = chain.BlockHeader.fromJSON(receivedBlock).toObject();

		// Delete ccmEvents for the height of blockHeader
		await this._db.deleteCCMsByHeight(deletedBlockHeader.height);
		await this._db.deleteBlockHeaderByHeight(deletedBlockHeader.height);
		await this._db.deleteAggregateCommitByHeight(deletedBlockHeader.height);
		await this._db.deleteValidatorsHashByHeight(deletedBlockHeader.height);
	}
}
