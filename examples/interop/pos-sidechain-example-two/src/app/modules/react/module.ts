/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/member-ordering */

import { Modules } from 'klayr-sdk';
import { CrossChainReactCommand } from './commands/react_cc_command';
import { ReactEndpoint } from './endpoint';
import { ReactMethod } from './method';
import { ReactInteroperableMethod } from './cc_method';
import { InteroperabilityMethod } from './types';

export class ReactModule extends Modules.Interoperability.BaseInteroperableModule {
	public endpoint = new ReactEndpoint(this.stores, this.offchainStores);
	public method = new ReactMethod(this.stores, this.events);
	public commands = [new CrossChainReactCommand(this.stores, this.events)];
	private _interoperabilityMethod!: InteroperabilityMethod;

	public crossChainMethod = new ReactInteroperableMethod(this.stores, this.events);

	/* public constructor() {
			super();
			this.stores.register(ReactionStore, new ReactionStore(this.name, 0));
	 } */

	public metadata(): Modules.ModuleMetadata {
		return {
			...this.baseMetadata(),
			endpoints: [],
			commands: this.commands.map(command => ({
				name: command.name,
				params: command.schema,
			})),
			assets: [],
		};
	}

	public addDependencies(interoperabilityMethod: InteroperabilityMethod) {
		this._interoperabilityMethod = interoperabilityMethod;
	}

	// Lifecycle hooks
	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(_args: Modules.ModuleInitArgs) {
		this.commands[0].init({
			interoperabilityMethod: this._interoperabilityMethod,
		});
	}

	// public async insertAssets(_context: InsertAssetContext) {
	// 	// initialize block generation, add asset
	// }

	// public async verifyAssets(_context: BlockVerifyContext): Promise<void> {
	// 	// verify block
	// }

	// Lifecycle hooks
	// public async verifyTransaction(_context: TransactionVerifyContext): Promise<VerificationResult> {
	// verify transaction will be called multiple times in the transaction pool
	// return { status: VerifyStatus.OK };
	// }

	// public async beforeCommandExecute(_context: TransactionExecuteContext): Promise<void> {
	// }

	// public async afterCommandExecute(_context: TransactionExecuteContext): Promise<void> {

	// }
	// public async initGenesisState(_context: GenesisBlockExecuteContext): Promise<void> {

	// }

	// public async finalizeGenesisState(_context: GenesisBlockExecuteContext): Promise<void> {

	// }

	// public async beforeTransactionsExecute(_context: BlockExecuteContext): Promise<void> {

	// }

	// public async afterTransactionsExecute(_context: BlockAfterExecuteContext): Promise<void> {

	// }
}
