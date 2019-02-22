import { core, SfdxCommand, UX } from '@salesforce/command';
import * as jsonMergePatch from 'json-merge-patch';
import Browserforce from './browserforce';

export abstract class BrowserforcePlugin extends SfdxCommand {

  protected static requiresUsername = true;

  static retrieve = async function (this, argv?: string[], opts?) {
    if (!argv) argv = process.argv.slice(2);
    let cmd = new this(argv, null)
    return cmd._retrieve();
  }

  protected browserforce: Browserforce;

  protected definition;
  protected plan;

  public constructor(browserforce: Browserforce, org: core.Org) {
    super([], null);
    this.browserforce = browserforce;
  }

  public async init() {
    console.log('init');
    this.logger = await core.Logger.child(this.statics.name);
    this.ux = new UX(this.logger, true);
    this.ux.log('init from plugin');
    console.log('hi');
    // assign org and browserforce
    // assign definition
  }

  public async run() {
    console.log('run');
    throw new Error('BrowserforcePlugin should not be run directly');
  }

  public async _retrieve() {
    console.log('_retrieve');
    await this.init();
    this.ux.startSpinner(`[${this.constructor.name}] retrieving state`);
    this.plan = await this.retrieve(this.definition);
    this.ux.stopSpinner();
    return this.plan;
  }

  public async _apply() {
    return await this.apply(this.plan);
  }

  public async catch(e) {
    console.error(e);
  }

  // tslint:disable-next-line:no-any
  public abstract async retrieve(definition?): Promise<any>;
  public diff(state, definition) {
    return jsonMergePatch.generate(state, definition);
  }
  // tslint:disable-next-line:no-any
  public abstract async apply(plan: JSON): Promise<any>;
}
