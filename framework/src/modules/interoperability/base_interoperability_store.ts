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

import { codec } from '@liskhq/lisk-codec';
import { NotFoundError } from '@liskhq/lisk-chain';
import { utils } from '@liskhq/lisk-cryptography';
import { regularMerkleTree } from '@liskhq/lisk-tree';
import { SubStore } from '../../state_machine/types';
import {
	CROSS_CHAIN_COMMAND_ID_CHANNEL_TERMINATED,
	CCM_STATUS_OK,
	EMPTY_BYTES,
	MODULE_ID_INTEROPERABILITY,
	STORE_PREFIX_CHAIN_DATA,
	STORE_PREFIX_TERMINATED_STATE,
	STORE_PREFIX_CHANNEL_DATA,
	STORE_PREFIX_OUTBOX_ROOT,
	STORE_PREFIX_TERMINATED_OUTBOX,
	STORE_PREFIX_OWN_CHAIN_DATA,
	MAINCHAIN_ID,
	CHAIN_TERMINATED,
	MIN_RETURN_FEE,
	EMPTY_FEE_ADDRESS,
	CCM_STATUS_MODULE_NOT_SUPPORTED,
	CCM_STATUS_CROSS_CHAIN_COMMAND_NOT_SUPPORTED,
	MAX_UINT32,
} from './constants';
import {
	chainAccountSchema,
	terminatedStateSchema,
	ccmSchema,
	channelSchema,
	outboxRootSchema,
	terminatedOutboxSchema,
	ownChainAccountSchema,
} from './schemas';
import {
	ChannelData,
	CCMsg,
	ChainAccount,
	SendInternalContext,
	TerminatedStateAccount,
	OwnChainAccount,
	CCMApplyContext,
	StoreCallback,
	TerminatedOutboxAccount,
	TerminateChainContext,
	ImmutableStoreCallback,
} from './types';
import { getCCMSize, getIDAsKeyForStore } from './utils';
import {
	createCCCommandExecuteContext,
	createCCMsgBeforeApplyContext,
	createCCMsgBeforeSendContext,
} from './context';
import { BaseInteroperableAPI } from './base_interoperable_api';
import { BaseCCCommand } from './base_cc_command';

export abstract class BaseInteroperabilityStore {
	public readonly getStore: StoreCallback | ImmutableStoreCallback;
	protected readonly moduleID: Buffer;
	protected readonly interoperableModuleAPIs = new Map<number, BaseInteroperableAPI>();

	public constructor(
		moduleID: Buffer,
		getStore: StoreCallback | ImmutableStoreCallback,
		interoperableModuleAPIs: Map<number, BaseInteroperableAPI>,
	) {
		this.moduleID = moduleID;
		this.getStore = getStore;
		this.interoperableModuleAPIs = interoperableModuleAPIs;
	}

	public async getOwnChainAccount(): Promise<OwnChainAccount> {
		const ownChainAccountStore = this.getStore(this.moduleID, STORE_PREFIX_OWN_CHAIN_DATA);
		return ownChainAccountStore.getWithSchema<OwnChainAccount>(
			getIDAsKeyForStore(MAINCHAIN_ID),
			ownChainAccountSchema,
		);
	}

	public async setOwnChainAccount(ownChainAccount: OwnChainAccount): Promise<void> {
		const ownChainAccountStore = this.getStore(
			this.moduleID,
			STORE_PREFIX_OWN_CHAIN_DATA,
		) as SubStore;
		await ownChainAccountStore.setWithSchema(
			getIDAsKeyForStore(MAINCHAIN_ID),
			ownChainAccount,
			ownChainAccountSchema,
		);
	}

	public async getChannel(chainID: Buffer): Promise<ChannelData> {
		const channelAccountStore = this.getStore(this.moduleID, STORE_PREFIX_CHANNEL_DATA);
		return channelAccountStore.getWithSchema<ChannelData>(chainID, channelSchema);
	}

	public async setChannel(chainID: Buffer, channeldata: ChannelData): Promise<void> {
		const channelAccountStore = this.getStore(this.moduleID, STORE_PREFIX_CHANNEL_DATA) as SubStore;
		await channelAccountStore.setWithSchema(chainID, channeldata, channelSchema);
	}

	public async appendToInboxTree(chainID: Buffer, appendData: Buffer) {
		const channelSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHANNEL_DATA,
		) as SubStore;
		const channel = await channelSubstore.getWithSchema<ChannelData>(chainID, channelSchema);
		const updatedInbox = regularMerkleTree.calculateMerkleRoot({
			value: utils.hash(appendData),
			appendPath: channel.inbox.appendPath,
			size: channel.inbox.size,
		});
		await channelSubstore.setWithSchema(
			chainID,
			{ ...channel, inbox: updatedInbox },
			channelSchema,
		);
	}

	public async appendToOutboxTree(chainID: Buffer, appendData: Buffer) {
		const channelSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHANNEL_DATA,
		) as SubStore;
		const channel = await channelSubstore.getWithSchema<ChannelData>(chainID, channelSchema);
		const updatedOutbox = regularMerkleTree.calculateMerkleRoot({
			value: utils.hash(appendData),
			appendPath: channel.outbox.appendPath,
			size: channel.outbox.size,
		});
		await channelSubstore.setWithSchema(
			chainID,
			{ ...channel, outbox: updatedOutbox },
			channelSchema,
		);
	}

	public async addToOutbox(chainID: Buffer, ccm: CCMsg) {
		const serializedMessage = codec.encode(ccmSchema, ccm);
		await this.appendToOutboxTree(chainID, serializedMessage);

		const channelSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHANNEL_DATA,
		);
		const channel = await channelSubstore.getWithSchema<ChannelData>(chainID, channelSchema);

		const outboxRootSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_OUTBOX_ROOT,
		) as SubStore;
		await outboxRootSubstore.setWithSchema(chainID, channel.outbox.root, outboxRootSchema);
	}

	public async hasTerminatedStateAccount(chainID: Buffer): Promise<boolean> {
		const terminatedStateSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_STATE,
		);
		return terminatedStateSubstore.has(chainID);
	}

	public async getChainAccount(chainID: Buffer): Promise<ChainAccount> {
		const chainSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHAIN_DATA,
		);
		return chainSubstore.getWithSchema<ChainAccount>(chainID, chainAccountSchema);
	}

	public async getAllChainAccounts(startChainID: Buffer): Promise<ChainAccount[]> {
		const chainSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHAIN_DATA,
		);
		const endBuf = utils.intToBuffer(MAX_UINT32, 4);
		const chainIDs = await chainSubstore.iterate({ gte: startChainID, lte: endBuf });

		const response = [];
		for (const chainID of chainIDs) {
			const chainIDBuffer = utils.intToBuffer(chainID.key.readUInt32BE(0) + 1, 4);
			response.push(
				await chainSubstore.getWithSchema<ChainAccount>(chainIDBuffer, chainAccountSchema),
			);
		}

		return response;
	}

	public async chainAccountExist(chainID: Buffer): Promise<boolean> {
		const chainSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHAIN_DATA,
		);
		try {
			await chainSubstore.getWithSchema<ChainAccount>(chainID, chainAccountSchema);
		} catch (error) {
			if (!(error instanceof NotFoundError)) {
				throw error;
			}
			return false;
		}

		return true;
	}

	public async getTerminatedStateAccount(chainID: Buffer): Promise<TerminatedStateAccount> {
		const terminatedStateSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_STATE,
		);
		return terminatedStateSubstore.getWithSchema<TerminatedStateAccount>(
			chainID,
			terminatedStateSchema,
		);
	}

	public async createTerminatedOutboxAccount(
		chainID: Buffer,
		outboxRoot: Buffer,
		outboxSize: number,
		partnerChainInboxSize: number,
	): Promise<void> {
		const terminatedOutboxSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_OUTBOX,
		) as SubStore;

		const terminatedOutbox = {
			outboxRoot,
			outboxSize,
			partnerChainInboxSize,
		};

		await terminatedOutboxSubstore.setWithSchema(chainID, terminatedOutbox, terminatedOutboxSchema);
	}

	public async hasTerminatedOutboxAccount(chainID: Buffer) {
		const terminatedOutboxSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_OUTBOX,
		);
		return terminatedOutboxSubstore.has(chainID);
	}

	public async setTerminatedOutboxAccount(
		chainID: Buffer,
		params: Partial<TerminatedOutboxAccount>,
	): Promise<boolean> {
		// Passed params is empty, no need to call this method
		if (Object.keys(params).length === 0) {
			return false;
		}
		const terminatedOutboxSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_OUTBOX,
		) as SubStore;

		const doesOutboxExist = await terminatedOutboxSubstore.has(chainID);

		if (!doesOutboxExist) {
			return false;
		}

		const account = await terminatedOutboxSubstore.getWithSchema<TerminatedOutboxAccount>(
			chainID,
			terminatedOutboxSchema,
		);

		const terminatedOutbox = {
			...account,
			...params,
		};

		await terminatedOutboxSubstore.setWithSchema(chainID, terminatedOutbox, terminatedOutboxSchema);

		return true;
	}

	public async terminatedOutboxAccountExist(chainID: Buffer) {
		const terminatedOutboxSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_OUTBOX,
		);

		return terminatedOutboxSubstore.has(chainID);
	}

	public async getTerminatedOutboxAccount(chainID: Buffer) {
		const terminatedOutboxSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_OUTBOX,
		);

		return terminatedOutboxSubstore.getWithSchema<TerminatedOutboxAccount>(
			chainID,
			terminatedOutboxSchema,
		);
	}

	public async createTerminatedStateAccount(chainID: Buffer, stateRoot?: Buffer): Promise<boolean> {
		const chainSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_CHAIN_DATA,
		) as SubStore;
		const isExist = await this.chainAccountExist(chainID);
		let terminatedState: TerminatedStateAccount;

		if (stateRoot) {
			if (isExist) {
				const chainAccount = await chainSubstore.getWithSchema<ChainAccount>(
					chainID,
					chainAccountSchema,
				);
				chainAccount.status = CHAIN_TERMINATED;
				await chainSubstore.setWithSchema(chainID, chainAccount, chainAccountSchema);
				const outboxRootSubstore = this.getStore(
					getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
					STORE_PREFIX_OUTBOX_ROOT,
				) as SubStore;
				await outboxRootSubstore.del(chainID);
			}
			terminatedState = {
				stateRoot,
				mainchainStateRoot: EMPTY_BYTES,
				initialized: true,
			};
		} else if (isExist) {
			const chainAccount = await chainSubstore.getWithSchema<ChainAccount>(
				chainID,
				chainAccountSchema,
			);
			chainAccount.status = CHAIN_TERMINATED;
			await chainSubstore.setWithSchema(chainID, chainAccount, chainAccountSchema);
			const outboxRootSubstore = this.getStore(
				getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
				STORE_PREFIX_OUTBOX_ROOT,
			) as SubStore;
			await outboxRootSubstore.del(chainID);

			terminatedState = {
				stateRoot: chainAccount.lastCertificate.stateRoot,
				mainchainStateRoot: EMPTY_BYTES,
				initialized: true,
			};
		}

		// State root is not available, set it to empty bytes temporarily.
		// This should only happen on a sidechain.
		else {
			// Processing on the mainchain
			const ownChainAccount = await this.getOwnChainAccount();
			if (ownChainAccount.id.equals(getIDAsKeyForStore(MAINCHAIN_ID))) {
				// If the account does not exist on the mainchain, the input chainID is invalid.
				return false;
			}
			const chainAccount = await chainSubstore.getWithSchema<ChainAccount>(
				getIDAsKeyForStore(MAINCHAIN_ID),
				chainAccountSchema,
			);
			terminatedState = {
				stateRoot: EMPTY_BYTES,
				mainchainStateRoot: chainAccount.lastCertificate.stateRoot,
				initialized: false,
			};
		}

		const terminatedStateSubstore = this.getStore(
			getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			STORE_PREFIX_TERMINATED_STATE,
		) as SubStore;
		await terminatedStateSubstore.setWithSchema(chainID, terminatedState, terminatedStateSchema);

		return true;
	}

	public async terminateChainInternal(
		chainID: Buffer,
		terminateChainContext: TerminateChainContext,
	): Promise<boolean> {
		const messageSent = await this.sendInternal({
			moduleID: getIDAsKeyForStore(MODULE_ID_INTEROPERABILITY),
			crossChainCommandID: utils.intToBuffer(CROSS_CHAIN_COMMAND_ID_CHANNEL_TERMINATED, 4),
			receivingChainID: chainID,
			fee: BigInt(0),
			status: CCM_STATUS_OK,
			params: EMPTY_BYTES,
			eventQueue: terminateChainContext.eventQueue,
			feeAddress: EMPTY_FEE_ADDRESS,
			getAPIContext: terminateChainContext.getAPIContext,
			getStore: terminateChainContext.getStore,
			logger: terminateChainContext.logger,
			networkIdentifier: terminateChainContext.networkIdentifier,
		});

		if (!messageSent) {
			return false;
		}

		return this.createTerminatedStateAccount(chainID);
	}

	public async apply(
		ccmApplyContext: CCMApplyContext,
		interoperableCCCommands: Map<number, BaseCCCommand[]>,
	): Promise<void> {
		const { ccm, eventQueue, logger, networkIdentifier, getAPIContext, getStore } = ccmApplyContext;
		const isTerminated = await this.hasTerminatedStateAccount(ccm.sendingChainID);
		if (isTerminated) {
			return;
		}

		const beforeCCMApplyContext = createCCMsgBeforeApplyContext(
			{
				logger,
				ccm,
				eventQueue,
				getAPIContext,
				getStore,
				networkIdentifier,
				feeAddress: ccmApplyContext.feeAddress,
			},
			ccmApplyContext.ccu,
			ccmApplyContext.trsSender,
		);

		for (const mod of this.interoperableModuleAPIs.values()) {
			if (mod?.beforeApplyCCM) {
				try {
					await mod.beforeApplyCCM(beforeCCMApplyContext);
				} catch (error) {
					return;
				}
			}
		}

		if (ccm.status !== CCM_STATUS_OK || ccm.fee < MIN_RETURN_FEE * BigInt(getCCMSize(ccm))) {
			return;
		}

		const ccCommands = interoperableCCCommands.get(ccm.moduleID.readInt32BE(0));

		// When moduleID is not supported
		if (!ccCommands) {
			const beforeCCMSendContext = createCCMsgBeforeSendContext({
				ccm,
				eventQueue,
				getAPIContext,
				logger,
				networkIdentifier,
				getStore,
				feeAddress: EMPTY_FEE_ADDRESS,
			});

			await this.sendInternal({
				eventQueue: beforeCCMSendContext.eventQueue,
				feeAddress: beforeCCMSendContext.feeAddress,
				getAPIContext: beforeCCMSendContext.getAPIContext,
				getStore: beforeCCMSendContext.getStore,
				logger: beforeCCMSendContext.logger,
				networkIdentifier: beforeCCMSendContext.networkIdentifier,
				crossChainCommandID: ccm.crossChainCommandID,
				moduleID: ccm.moduleID,
				fee: BigInt(0),
				params: ccm.params,
				receivingChainID: ccm.receivingChainID,
				status: CCM_STATUS_MODULE_NOT_SUPPORTED,
			});

			return;
		}
		const ccCommand = ccCommands.find(cmd => cmd.ID.equals(ccm.crossChainCommandID));

		// When commandID is not supported
		if (!ccCommand) {
			const beforeCCMSendContext = createCCMsgBeforeSendContext({
				ccm,
				eventQueue,
				getAPIContext,
				logger,
				networkIdentifier,
				getStore,
				feeAddress: EMPTY_FEE_ADDRESS,
			});

			await this.sendInternal({
				eventQueue: beforeCCMSendContext.eventQueue,
				feeAddress: beforeCCMSendContext.feeAddress,
				getAPIContext: beforeCCMSendContext.getAPIContext,
				getStore: beforeCCMSendContext.getStore,
				logger: beforeCCMSendContext.logger,
				networkIdentifier: beforeCCMSendContext.networkIdentifier,
				crossChainCommandID: ccm.crossChainCommandID,
				moduleID: ccm.moduleID,
				fee: BigInt(0),
				params: ccm.params,
				receivingChainID: ccm.receivingChainID,
				status: CCM_STATUS_CROSS_CHAIN_COMMAND_NOT_SUPPORTED,
			});

			return;
		}

		const ccCommandExecuteContext = createCCCommandExecuteContext({
			ccm,
			ccmSize: getCCMSize(ccm),
			eventQueue,
			logger,
			networkIdentifier,
			getAPIContext,
			getStore,
			feeAddress: ccmApplyContext.feeAddress,
		});

		await ccCommand.execute(ccCommandExecuteContext);
	}

	// Different in mainchain and sidechain so to be implemented in each module store separately
	public abstract isLive(chainID: Buffer, timestamp?: number): Promise<boolean>;
	public abstract sendInternal(sendContext: SendInternalContext): Promise<boolean>;

	// To be implemented in base class
	public abstract getInboxRoot(chainID: Buffer): Promise<void>;
	public abstract getOutboxRoot(chainID: Buffer): Promise<void>;
}
