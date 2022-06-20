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
import { MAINCHAIN_ID } from '../../../../../../src/modules/interoperability/constants';
import { SidechainCCSidechainTerminatedCommand } from '../../../../../../src/modules/interoperability/sidechain/cc_commands/sidechain_terminated';
import { SidechainInteroperabilityStore } from '../../../../../../src/modules/interoperability/sidechain/store';
import { sidechainTerminatedCCMParamsSchema } from '../../../../../../src/modules/interoperability/schema';
import { CCCommandExecuteContext } from '../../../../../../src/modules/interoperability/types';
import { createExecuteCCMsgAPIContext } from '../../../../../../src/testing';

describe('SidechainCCSidechainTerminatedCommand', () => {
	const terminateChainInternalMock = jest.fn();
	const hasTerminatedStateAccountMock = jest.fn();
	const createTerminatedStateAccountMock = jest.fn();

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

	const ccmSidechainTerminatedParams = {
		chainID: 5,
		stateRoot: getRandomBytes(32),
	};

	const encodedSidechainTerminatedParams = codec.encode(
		sidechainTerminatedCCMParamsSchema,
		ccmSidechainTerminatedParams,
	);

	const ccm = {
		nonce: BigInt(0),
		moduleID: 1,
		crossChainCommandID: 1,
		sendingChainID: MAINCHAIN_ID,
		receivingChainID: 1,
		fee: BigInt(20000),
		status: 0,
		params: encodedSidechainTerminatedParams,
	};
	const ccmNew = {
		...ccm,
		sendingChainID: 2,
	};
	const sampleExecuteContext: CCCommandExecuteContext = createExecuteCCMsgAPIContext({
		ccm,
		networkIdentifier,
	});
	const sampleExecuteContextNew: CCCommandExecuteContext = createExecuteCCMsgAPIContext({
		ccm: ccmNew,
		networkIdentifier,
	});

	let mainchainInteroperabilityStore: SidechainInteroperabilityStore;
	let ccSidechainTerminatedCommand: SidechainCCSidechainTerminatedCommand;

	beforeEach(() => {
		mainchainInteroperabilityStore = new SidechainInteroperabilityStore(
			ccm.moduleID,
			sampleExecuteContext.getStore,
			ccAPIsMap,
		);
		mainchainInteroperabilityStore.terminateChainInternal = terminateChainInternalMock;
		mainchainInteroperabilityStore.hasTerminatedStateAccount = hasTerminatedStateAccountMock;
		mainchainInteroperabilityStore.createTerminatedStateAccount = createTerminatedStateAccountMock;

		ccSidechainTerminatedCommand = new SidechainCCSidechainTerminatedCommand(1, ccAPIsMap);
		(ccSidechainTerminatedCommand as any)['getInteroperabilityStore'] = jest
			.fn()
			.mockReturnValue(mainchainInteroperabilityStore);
	});

	it('should call terminateChainInternal when sendingChainID !== MAINCHAIN_ID', async () => {
		await ccSidechainTerminatedCommand.execute(sampleExecuteContextNew);

		expect(terminateChainInternalMock).toBeCalledTimes(1);
		expect(terminateChainInternalMock).toHaveBeenCalledWith(
			ccmNew.sendingChainID,
			expect.objectContaining({
				ccm: ccmNew,
				networkIdentifier,
			}),
		);
	});

	it('should return without creating a entry for the chainID in the terminated account substore when entry already exists and sendingChainID === MAINCHAIN_ID', async () => {
		hasTerminatedStateAccountMock.mockResolvedValueOnce(true);
		await ccSidechainTerminatedCommand.execute(sampleExecuteContext);

		expect(terminateChainInternalMock).toBeCalledTimes(0);
		expect(createTerminatedStateAccountMock).toBeCalledTimes(0);
	});

	it('should create an entry for the chainID in the terminated account substore when an entry does not exist and sendingChainID === MAINCHAIN_ID', async () => {
		hasTerminatedStateAccountMock.mockResolvedValueOnce(false);
		await ccSidechainTerminatedCommand.execute(sampleExecuteContext);

		expect(createTerminatedStateAccountMock).toBeCalledTimes(1);
		expect(createTerminatedStateAccountMock).toHaveBeenCalledWith(
			ccmSidechainTerminatedParams.chainID,
			ccmSidechainTerminatedParams.stateRoot,
		);
	});
});