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
import { getRandomBytes } from '@liskhq/lisk-cryptography';
import { MainchainCCRegistrationCommand } from '../../../../../../src/modules/interoperability/mainchain/cc_commands/registration';
import { MainchainInteroperabilityStore } from '../../../../../../src/modules/interoperability/mainchain/store';
import { registrationCCMParamsSchema } from '../../../../../../src/modules/interoperability/schema';
import { CCCommandExecuteContext } from '../../../../../../src/modules/interoperability/types';
import { createExecuteCCMsgAPIContext } from '../../../../../../src/testing';

describe('MainchainCCRegistrationCommand', () => {
	const terminateChainInternalMock = jest.fn();
	const getChannelMock = jest.fn();
	const getOwnChainAccountMock = jest.fn();

	const ownChainAccount = {
		name: 'mainchain',
		id: 1,
		nonce: BigInt(0),
	};

	const ccAPIMod1 = {
		beforeSendCCM: jest.fn(),
		beforeApplyCCM: jest.fn(),
	};

	const ccAPIMod2 = {
		beforeSendCCM: jest.fn(),
		beforeApplyCCM: jest.fn(),
	};

	const ccAPIsMap = new Map();
	ccAPIsMap.set(1, ccAPIMod1);
	ccAPIsMap.set(2, ccAPIMod2);

	const networkIdentifier = getRandomBytes(32);

	const ccmRegistrationParams = {
		networkID: networkIdentifier,
		name: ownChainAccount.name,
		messageFeeTokenID: {
			chainID: 1,
			localID: 0,
		},
	};

	const encodedRegistrationParams = codec.encode(
		registrationCCMParamsSchema,
		ccmRegistrationParams,
	);

	const ccm = {
		nonce: BigInt(0),
		moduleID: 1,
		crossChainCommandID: 1,
		sendingChainID: 2,
		receivingChainID: 1,
		fee: BigInt(20000),
		status: 0,
		params: encodedRegistrationParams,
	};
	const channelData = {
		inbox: {
			appendPath: [],
			root: Buffer.alloc(0),
			size: 1,
		},
		messageFeeTokenID: {
			chainID: 1,
			localID: 0,
		},
		outbox: {
			appendPath: [],
			root: Buffer.alloc(0),
			size: 1,
		},
		partnerChainOutboxRoot: Buffer.alloc(0),
	};
	const sampleExecuteContext: CCCommandExecuteContext = createExecuteCCMsgAPIContext({
		ccm,
		networkIdentifier,
	});

	let mainchainInteroperabilityStore: MainchainInteroperabilityStore;
	let ccRegistrationCommand: MainchainCCRegistrationCommand;

	beforeEach(() => {
		mainchainInteroperabilityStore = new MainchainInteroperabilityStore(
			ccm.moduleID,
			sampleExecuteContext.getStore,
			ccAPIsMap,
		);
		mainchainInteroperabilityStore.terminateChainInternal = terminateChainInternalMock;
		mainchainInteroperabilityStore.getChannel = getChannelMock;
		mainchainInteroperabilityStore.getOwnChainAccount = getOwnChainAccountMock;

		ccRegistrationCommand = new MainchainCCRegistrationCommand(1, ccAPIsMap);
		(ccRegistrationCommand as any)['getInteroperabilityStore'] = jest
			.fn()
			.mockReturnValue(mainchainInteroperabilityStore);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.inbox.size !== 1', async () => {
		// Arrange
		const dataWithMoreThanOneInboxSize = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: 1,
				localID: 0,
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};

		getChannelMock.mockResolvedValue(dataWithMoreThanOneInboxSize);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when ccm.status !== CCM_STATUS_OK', async () => {
		// Arrange
		const invalidCCM = {
			nonce: BigInt(0),
			moduleID: 1,
			crossChainCommandID: 1,
			sendingChainID: 2,
			receivingChainID: 1,
			fee: BigInt(20000),
			status: 1,
			params: encodedRegistrationParams,
		};

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute({ ...sampleExecuteContext, ccm: invalidCCM });

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm: invalidCCM,
			}),
		);
	});

	it('should call terminateChainInternal when ownChainAccount.id !== ccm.receivingChainID', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue({ ...ownChainAccount, id: 3 });

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when ownChainAccount.name !== decodedParams.name', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue({ ...ownChainAccount, name: 'chain1' });

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.chainID !== decodedParams.chainID', async () => {
		// Arrange
		const incorrectChainIDChannelData = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: 3,
				localID: 0,
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};
		getChannelMock.mockResolvedValue(incorrectChainIDChannelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when sendingChainChannelAccount.localID !== decodedParams.localID', async () => {
		// Arrange
		const incorrectChainIDChannelData = {
			inbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 2,
			},
			messageFeeTokenID: {
				chainID: 1,
				localID: 5,
			},
			outbox: {
				appendPath: [],
				root: Buffer.alloc(0),
				size: 1,
			},
			partnerChainOutboxRoot: Buffer.alloc(0),
		};
		getChannelMock.mockResolvedValue(incorrectChainIDChannelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when decodedParams.networkID !== ownChainAccount.networkID', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		const differentNetworkID = getRandomBytes(32);
		await ccRegistrationCommand.execute({
			...sampleExecuteContext,
			networkIdentifier: differentNetworkID,
		});

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier: differentNetworkID,
				ccm,
			}),
		);
	});

	it('should call terminateChainInternal when ccm.nonce !== 0', async () => {
		// Arrange
		const invalidCCM = {
			nonce: BigInt(1), // nonce not equal to 0
			moduleID: 1,
			crossChainCommandID: 1,
			sendingChainID: 2,
			receivingChainID: 1,
			fee: BigInt(20000),
			status: 0,
			params: encodedRegistrationParams,
		};
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute({ ...sampleExecuteContext, ccm: invalidCCM });

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccm.sendingChainID,
			expect.objectContaining({
				networkIdentifier,
				ccm: invalidCCM,
			}),
		);
	});

	it('should execute successfully', async () => {
		// Arrange
		getChannelMock.mockResolvedValue(channelData);

		getOwnChainAccountMock.mockResolvedValue(ownChainAccount);

		await ccRegistrationCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(0);
	});
});