"use strict";

/**
 * CommonJS bridge so Next/webpack never rewrites native driver requires.
 *
 * mssql keeps ONE process-wide `shared.driver`. Loading both
 * `mssql/tedious` and `mssql/msnodesqlv8` means whichever loaded last wins
 * for `pool.request()` — that caused:
 *   connection.queryRaw is not a function
 * when a Tedious pool was queried with the msnodesqlv8 Request class.
 *
 * Every loadTedious() / loadWindows() call REBINDS shared.driver.
 */

function bindDriver(name) {
  const shared = require("mssql/lib/shared");
  const ConnectionPool = require(`mssql/lib/${name}/connection-pool`);
  const Transaction = require(`mssql/lib/${name}/transaction`);
  const Request = require(`mssql/lib/${name}/request`);
  shared.driver.name = name;
  shared.driver.ConnectionPool = ConnectionPool;
  shared.driver.Transaction = Transaction;
  shared.driver.Request = Request;
}

module.exports = {
  loadTedious() {
    bindDriver("tedious");
    return require("mssql/tedious");
  },
  loadWindows() {
    bindDriver("msnodesqlv8");
    return require("mssql/msnodesqlv8");
  },
};
