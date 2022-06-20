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

import { BaseInteroperabilityCCCommand } from './base_interoperability_cc_commands';
import { BaseInteroperableAPI } from './base_interoperable_api';
import { BaseInteroperableModule } from './base_interoperable_module';
import { MODULE_ID_INTEROPERABILITY, MODULE_NAME_INTEROPERABILITY } from './constants';

export abstract class BaseInteroperabilityModule extends BaseInteroperableModule {
	public id = MODULE_ID_INTEROPERABILITY; // Common id for mainchain/sidechain interoperability module
	public name = MODULE_NAME_INTEROPERABILITY; // Common name for mainchain/sidechain interoperability module
	protected interoperableCCCommands = new Map<number, BaseInteroperabilityCCCommand[]>();
	protected interoperableCCAPIs = new Map<number, BaseInteroperableAPI>();
	public abstract registerInteroperableModule(): void;
}