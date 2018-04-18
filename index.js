"use strict";

const cmdApply = require("./commands/shape-apply.js");
const cmdUserResetToken = require("./commands/user-reset-token.js");

(function() {
  "use strict";
  exports.topics = [
    {
      name: "shape",
      description: "commands for shape"
    },
    {
      name: "user",
      description: "commands for user"
    }
  ];
  exports.namespace = {
    name: "browserforce",
    description: "Various commands for browserforce"
  };
  exports.commands = [cmdApply, cmdUserResetToken];
})();
