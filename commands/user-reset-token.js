"use strict";
/* eslint-disable capitalized-comments */

const Promise = require("bluebird");

const forceUtils = require("../lib/forceUtils.js");
const Browserforce = require("../lib/browser");

async function apply(bf) {
  let page = await bf.browser.newPage();
  await page.goto(
    `${bf.org.authConfig.instanceUrl}/_ui/system/security/ResetApiTokenEdit`
  );
  await page.waitFor("input[type=submit]");
  await Promise.all([
    page.waitForNavigation(),
    page.click("input[type=submit]")
  ]);
  await page.waitFor("span.topMessageContent");
  let response = await page.$eval("span.topMessageContent", el => el.innerText);
  await page.close();
  return response;
}

module.exports = {
  topic: "user",
  command: "reset-token",
  description: "reset the security token",
  flags: [
    {
      name: "targetusername",
      char: "u",
      description: "username for the target org",
      hasValue: true
    }
  ],
  run(context) {
    const targetUsername = context.flags.targetusername;

    let org;
    let bf;
    return forceUtils
      .getOrg(targetUsername)
      .then(function(orgResult) {
        org = orgResult;
        console.log(
          `Resetting Security Token for user ${org.authConfig.username}`
        );
        bf = new Browserforce(org);
      })
      .then(function() {
        return bf.login();
      })
      .then(function() {
        return apply(bf);
      })
      .then(function(response) {
        console.log(response);
        return bf.logout();
      })
      .then(function() {
        process.exit(0);
      })
      .catch(function(err) {
        console.error(err.message);
        process.exit(1);
      });
  }
};
