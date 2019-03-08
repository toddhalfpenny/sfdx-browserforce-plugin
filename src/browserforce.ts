import { core } from '@salesforce/command';
import * as pRetry from 'p-retry';
import * as puppeteer from 'puppeteer';
import { URL } from 'url';

const PERSONAL_INFORMATION_PATH =
  'setup/personalInformationSetup.apexp?nooverride=1';

const ERROR_DIV_SELECTOR = '#errorTitle';
const ERROR_DIVS_SELECTOR = 'div.errorMsg';

export default class Browserforce {
  public org: core.Org;
  public logger: core.Logger;
  public browser: puppeteer.Browser;
  public page: puppeteer.Page;
  constructor(org, logger?) {
    this.org = org;
    this.logger = logger;
  }

  public async login() {
    this.browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: !(process.env.BROWSER_DEBUG === 'true')
    });
    await this.openPage(
      `secur/frontdoor.jsp?sid=${
        this.org.getConnection().accessToken
      }&retURL=${encodeURIComponent(PERSONAL_INFORMATION_PATH)}`,
      { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] }
    );
    return this;
  }

  public async logout() {
    await this.browser.close();
    return this;
  }

  public async resolveDomains() {
    // resolve ip addresses of both LEX and classic domains
    for (const url of [this.getInstanceUrl(), this.getLightningUrl()]) {
      const resolver = await core.MyDomainResolver.create({
        url: new URL(url)
      });
      await resolver.resolve();
    }
  }

  public async throwPageErrors(page) {
    const errorHandle = await page.$(ERROR_DIV_SELECTOR);
    if (errorHandle) {
      const errorMsg = await page.evaluate(
        (div: HTMLDivElement) => div.innerText,
        errorHandle
      );
      await errorHandle.dispose();
      if (errorMsg && errorMsg.trim()) {
        throw new Error(errorMsg.trim());
      }
    }
    const errorElements = await page.$$(ERROR_DIVS_SELECTOR);
    if (errorElements.length) {
      const errorMessages = await page.evaluate((...errorDivs) => {
        return errorDivs.map((div: HTMLDivElement) => div.innerText);
      }, ...errorElements);
      const errorMsg = errorMessages
        .map(m => m.trim())
        .join(' ')
        .trim();
      if (errorMsg) {
        throw new Error(errorMsg);
      }
    }
  }

  // path instead of url
  public async openPage(urlPath, options?) {
    const result = await pRetry(
      async () => {
        await this.resolveDomains();
        const page = await this.browser.newPage();
        page.setDefaultNavigationTimeout(
          parseInt(process.env.BROWSERFORCE_NAVIGATION_TIMEOUT_MS, 10) || 90000
        );
        await page.setViewport({ width: 1024, height: 768 });
        const url = `${this.getInstanceUrl()}/${urlPath}`;
        const response = await page.goto(url, options);
        if (response) {
          if (!response.ok()) {
            await this.throwPageErrors(page);
            throw new Error(`${response.status()}: ${response.statusText()}`);
          }
          if (response.url().indexOf('/?ec=302') > 0) {
            if (
              response.url().startsWith(this.getInstanceUrl()) ||
              response.url().startsWith(this.getLightningUrl())
            ) {
              // the url looks ok so it is a login error
              throw new pRetry.AbortError('login failed');
            } else {
              // the url is not as expected
              const redactedUrl = response
                .url()
                .replace(/sid=(.*)/, 'sid=<REDACTED>')
                .replace(/sid%3D(.*)/, 'sid=<REDACTED>');
              if (this.logger) {
                this.logger.warn(
                  `expected ${this.getInstanceUrl()} or ${this.getLightningUrl()} but got: ${redactedUrl}`
                );
                this.logger.warn('refreshing auth...');
              }
              await this.org.refreshAuth();
              throw new Error('redirection failed');
            }
          }
        }
        // await this.throwPageErrors(page);
        return page;
      },
      {
        onFailedAttempt: error => {
          if (this.logger) {
            this.logger.warn(
              `retrying ${error.retriesLeft} more time(s) because of "${error}"`
            );
          }
        },
        retries: 4,
        minTimeout: 4 * 1000
      }
    );
    return result;
  }

  public getInstanceUrl() {
    return this.org.getConnection().instanceUrl;
  }

  private getLightningUrl() {
    const myDomain = this.getInstanceUrl().match(/https?\:\/\/([^.]*)/)[1];
    return `https://${myDomain}.lightning.force.com`;
  }
}
