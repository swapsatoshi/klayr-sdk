/*
 * LiskHQ/klayr-commander
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
 *
 */

import BaseGenerator from './base_generator';

export default class InitGenerator extends BaseGenerator {
	public async initializing(): Promise<void> {
		await this._loadAndValidateTemplate();

		// Enable skipInstall for env so that the only generator install will run
		this.env.options.skipInstall = true;
		this.log('Initializing git repository');
		this.spawnCommandSync('git', ['init', '--quiet']);
	}

	public configuring(): void {
		this.log('Updating .klayrrc.json file');
		this._klayrRC.setPath('template', this._klayrTemplateName);
	}

	public writing(): void {
		this.log('Creating project structure');
		this.composeWith({
			Generator: this._klayrTemplate.generators.init,
			path: this._klayrTemplatePath,
		});
	}

	public install(): void {
		this.log('\n');

		this.spawnCommandSync(
			'npm',
			this._registry !== undefined ? ['install', '--registry', this._registry] : ['install'],
		);
	}
}
