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
import { utils, address as cryptoAddress } from '@klayr/cryptography';
import { DynamicRewardModule } from '../../../../src/modules/dynamic_reward';
import { DynamicRewardEndpoint } from '../../../../src/modules/dynamic_reward/endpoint';
import { PrefixedStateReadWriter } from '../../../../src/state_machine/prefixed_state_read_writer';
import {
	InMemoryPrefixedStateDB,
	createFakeBlockHeader,
	createTransientModuleEndpointContext,
} from '../../../../src/testing';

describe('DynamicRewardModuleEndpoint', () => {
	const genesisConfig: any = { blockTime: 7 };
	const moduleConfig: any = {
		distance: 3000000,
		offset: 2160,
		brackets: [
			'500000000', // Initial Reward
			'400000000', // Milestone 1
			'300000000', // Milestone 2
			'200000000', // Milestone 3
			'100000000', // Milestone 4
		],
		tokenID: '0000000000000000',
		factorMinimumRewardActiveValidators: 1000,
	};

	const address = utils.getRandomBytes(20);
	const address1 = utils.getRandomBytes(20);
	const address2 = utils.getRandomBytes(20);
	const address3 = utils.getRandomBytes(20);

	let rewardModule: DynamicRewardModule;
	let stateStore: PrefixedStateReadWriter;
	let endpoint: DynamicRewardEndpoint;

	beforeEach(async () => {
		rewardModule = new DynamicRewardModule();
		await rewardModule.init({ genesisConfig, moduleConfig });
		rewardModule.addDependencies(
			{ mint: jest.fn() } as any,
			{ isSeedRevealValid: jest.fn() } as any,
			{
				getValidatorsParams: jest.fn().mockResolvedValue({
					validators: [
						{ address, bftWeight: BigInt(230) },
						{ address: address1, bftWeight: BigInt(270) },
						{ address: address2, bftWeight: BigInt(0) },
					],
				}),
			} as any,
			{
				getRoundLength: jest.fn().mockReturnValue(53),
				getNumberOfActiveValidators: jest.fn().mockReturnValue(51),
			} as any,
		);
		stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
		endpoint = rewardModule.endpoint;
		endpoint.init(rewardModule['_moduleConfig'], genesisConfig.blockTime);
	});

	describe('getExpectedValidatorRewards', () => {
		it('should fail when input is invalid', async () => {
			await expect(
				endpoint.getExpectedValidatorRewards(
					createTransientModuleEndpointContext({
						stateStore,
						params: {},
					}),
				),
			).rejects.toThrow('Parameter validatorAddress must be a string');
		});

		it('should return zero when input address is not validator', async () => {
			const response = await endpoint.getExpectedValidatorRewards(
				createTransientModuleEndpointContext({
					stateStore,
					params: {
						validatorAddress: cryptoAddress.getKlayr32AddressFromAddress(address3),
					},
				}),
			);

			expect(response).toEqual({
				blockReward: '0',
				dailyReward: '0',
				monthlyReward: '0',
				yearlyReward: '0',
			});
		});

		it('should return expected reward for a standby validator with default reward', async () => {
			const response = await endpoint.getExpectedValidatorRewards(
				createTransientModuleEndpointContext({
					stateStore,
					params: {
						validatorAddress: cryptoAddress.getKlayr32AddressFromAddress(address2),
					},
					context: {
						header: createFakeBlockHeader({ height: 10000 }),
					},
				}),
			);

			expect(response).toEqual({
				blockReward: '500000000',
				dailyReward: '116441971200',
				monthlyReward: '3493259136000',
				yearlyReward: '42501319488000',
			});
		});

		it('should return expected reward for an active validator with bft weight', async () => {
			const response = await endpoint.getExpectedValidatorRewards(
				createTransientModuleEndpointContext({
					stateStore,
					params: {
						validatorAddress: cryptoAddress.getKlayr32AddressFromAddress(address),
					},
					context: {
						header: createFakeBlockHeader({ height: 10000 }),
					},
				}),
			);

			// total reward for active validators is 9LSK (5LSK - 0.5LSK) * 2, which will be distributed by weight
			expect(response).toEqual({
				blockReward: '464000000', // 9 * (230/500) + 0.5
				dailyReward: '108058147200',
				monthlyReward: '3241744416000',
				yearlyReward: '39441223728000',
			});
		});
	});
});
