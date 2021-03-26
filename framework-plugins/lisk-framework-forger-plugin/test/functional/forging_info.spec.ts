/*
 * Copyright © 2020 Lisk Foundation
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

import { testing, PartialApplicationConfig } from 'lisk-framework';
import { getForgerInfoByAddress, getForgerPlugin, waitTill } from '../utils/application';
import { ForgerPlugin } from '../../src';

describe('forger:getForgingInfo action', () => {
	let appEnv: testing.ApplicationEnv;

	beforeAll(async () => {
		const rootPath = '~/.lisk/forger-plugin';
		const config = {
			rootPath,
			label: 'forging_info_functional',
		} as PartialApplicationConfig;

		appEnv = testing.createDefaultApplicationEnv({
			config,
			plugins: [ForgerPlugin],
		});
		await appEnv.startApplication();
		await appEnv.waitNBlocks(2);
	});

	afterAll(async () => {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		jest.spyOn(process, 'exit').mockImplementation((() => {}) as never);
		await appEnv.stopApplication();
	});

	it('should return list of all forgers info', async () => {
		// Arrange
		const forgerPluginInstance = getForgerPlugin(appEnv.application);
		const forgersList = forgerPluginInstance['_forgersList'].entries() as ReadonlyArray<
			[Buffer, boolean]
		>;
		const forgersInfo = await Promise.all(
			forgersList.map(async ([forgerAddress, _]) =>
				getForgerInfoByAddress(forgerPluginInstance, forgerAddress.toString('binary')),
			),
		);
		const forgersInfoList = await appEnv.ipcClient.invoke('forger:getForgingInfo');

		// Assert
		expect(forgersInfoList).toHaveLength(forgersInfo.length);
		await waitTill(2000);
		expect(forgersInfoList).toMatchSnapshot();
		expect(
			(forgersInfoList as any).filter(
				(forger: { totalProducedBlocks: number }) => forger.totalProducedBlocks > 0,
			).length,
		).toBeGreaterThan(1);
	});
});
