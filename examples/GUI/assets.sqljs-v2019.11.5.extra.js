// init sqljsExec
(function () {
/*
 * this function will init sqljs
 */
    "use strict";
    let callbackDict;
    let callbackId;
    let sqljsExec;
    let sqljsTableExport;
    let sqljsTableImport;
    let worker;
    if (!(
        typeof window === "object" && window && window.document
        && typeof document.addEventListener === "function"
    ) || window.sqljsExec) {
        return;
    }
    sqljsExec = function (msg) {
    /*
     * this function will post <msg> to worker and return a promise
     */
        let callback;
        let err;
        // preserve stack-trace
        err = new Error();
        // normalize <msg>
        if (typeof msg === "string") {
            msg = {
                sql: msg
            };
        }
        msg = Object.assign({
            action: "exec",
            sql: "\n"
        }, msg);
        return new Promise(function (resolve, reject) {
            callback = function (data) {
                // if errmsg, then prepend it to err.stack and reject
                if (data.errmsg) {
                    err.message = data.errmsg;
                    err.stack = data.errmsg + "\n" + err.stack;
                    reject(err);
                    return;
                }
                resolve(data);
            };
            // increment callbackId
            callbackId = (callbackId | 0) + 1;
            msg.id = callbackId;
            callbackDict[msg.id] = callback;
            worker.postMessage(msg);
        });
    };
    sqljsTableExport = async function (opt) {
    /*
     * this function will export table <opt>.sql "SELECT ... FROM ..."
     * from sqlite3
     */
        let csv;
        let data;
        if (typeof opt === "string") {
            opt = {
                exportType: "dict",
                sql: opt
            };
        }
        data = (
            await sqljsExec(opt)
        ).results[0] || {
            columns: [
                "column_1"
            ],
            values: []
        };
        switch (opt.exportType) {
        case "csv":
            break;
        // export - list of dict
        case "dict":
            return data.values.map(function (list) {
                let dict;
                dict = {};
                data.columns.forEach(function (key, ii) {
                    dict[key] = list[ii];
                });
                return dict;
            });
        // export - list of list
        default:
            return data;
        }
/*
https://tools.ietf.org/html/rfc4180#section-2
2.  Definition of the CSV Format
While there are various specifications and implementations for the
CSV format (for ex. [4], [5], [6] and [7]), there is no formal
specification in existence, which allows for a wide variety of
interpretations of CSV files.  This section documents the format that
seems to be followed by most implementations:
1.  Each record is located on a separate line, delimited by a line
    break (CRLF).  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
2.  The last record in the file may or may not have an ending line
    break.  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx
3.  There maybe an optional header line appearing as the first line
    of the file with the same format as normal record lines.  This
    header will contain names corresponding to the fields in the file
    and should contain the same number of fields as the records in
    the rest of the file (the presence or absence of the header line
    should be indicated via the optional "header" parameter of this
    MIME type).  For example:
    field_name,field_name,field_name CRLF
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
4.  Within the header and each record, there may be one or more
    fields, separated by commas.  Each line should contain the same
    number of fields throughout the file.  Spaces are considered part
    of a field and should not be ignored.  The last field in the
    record must not be followed by a comma.  For example:
    aaa,bbb,ccc
5.  Each field may or may not be enclosed in double quotes (however
    some programs, such as Microsoft Excel, do not use double quotes
    at all).  If fields are not enclosed with double quotes, then
    double quotes may not appear inside the fields.  For example:
    "aaa","bbb","ccc" CRLF
    zzz,yyy,xxx
6.  Fields containing line breaks (CRLF), double quotes, and commas
    should be enclosed in double-quotes.  For example:
    "aaa","b CRLF
    bb","ccc" CRLF
    zzz,yyy,xxx
7.  If double-quotes are used to enclose fields, then a double-quote
    appearing inside a field must be escaped by preceding it with
    another double quote.  For example:
    "aaa","b""bb","ccc"
 */
        csv = "";
/*
3.  There maybe an optional header line appearing as the first line
    of the file with the same format as normal record lines.  This
    header will contain names corresponding to the fields in the file
    and should contain the same number of fields as the records in
    the rest of the file (the presence or absence of the header line
    should be indicated via the optional "header" parameter of this
    MIME type).  For example:
    field_name,field_name,field_name CRLF
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
 */
        data.values.unshift(data.columns);
        data.values.forEach(function (row) {
            csv += row.map(function (val) {
                if (val === null) {
                    return "";
                }
                if (typeof val === "string") {
/*
7.  If double-quotes are used to enclose fields, then a double-quote
    appearing inside a field must be escaped by preceding it with
    another double quote.  For example:
    "aaa","b""bb","ccc"
 */
                    val = val.replace((
                        /"/g
                    ), "\"\"");
/*
6.  Fields containing line breaks (CRLF), double quotes, and commas
    should be enclosed in double-quotes.  For example:
    "aaa","b CRLF
    bb","ccc" CRLF
    zzz,yyy,xxx
 */
                    if ((
                        /[\r\n",]/
                    ).test(val)) {
                        val = "\"" + val + "\"";
                    }
                    return val;
                }
                return String(val);
/*
4.  Within the header and each record, there may be one or more
    fields, separated by commas.  Each line should contain the same
    number of fields throughout the file.  Spaces are considered part
    of a field and should not be ignored.  The last field in the
    record must not be followed by a comma.  For example:
    aaa,bbb,ccc
 */
            }).join(",");
/*
1.  Each record is located on a separate line, delimited by a line
    break (CRLF).  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
 */
/*
2.  The last record in the file may or may not have an ending line
    break.  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx
 */
            csv += "\r\n";
        });
        return csv;
    };
    sqljsTableImport = async function (opt) {
    /*
     * this function will import table <opt>.csv or <opt>.values into sqlite3
     */
        let byteLength;
        let columns;
        let csv;
        let match;
        let quote;
        let rgx;
        let row;
        let rowLength;
        let rowid;
        let sqlCommand;
        let sqlEnd;
        let sqlExec;
        let sqlInsert;
        let sqlProgress;
        let sqlSanitize;
        let sqlStringify;
        let tableName;
        let timeStart;
        let val;
        let values;
        sqlEnd = async function () {
        /*
         * this function will insert remaining rows into sqlite3
         * and count inserted rows
         */
            // insert remaining rows
            sqlExec();
            // handle null-case
            if (!rowid) {
                row = [
                    "column_1"
                ];
                sqlInsert();
                sqlExec();
            }
            // count inserted rows
            return (
                await sqljsExec({
                    sql: sqlSanitize("SELECT COUNT(*) FROM " + tableName + ";")
                })
            ).results[0].values[0][0];
        };
        sqlExec = function () {
        /*
         * this function will exec <sqlCommand> in sqlite3
         */
            let opt2;
            if (!sqlCommand) {
                return;
            }
            // init opt2
            byteLength += sqlCommand.length;
            opt2 = {
                byteLength,
                rowid
            };
            // exec <sqlCommand>
            sqljsExec({
                sql: sqlSanitize(
                    "INSERT INTO " + tableName + " VALUES\n"
                    + sqlCommand.slice(0, -2)
                    + ";"
                )
            }).then(function () {
                sqlProgress(opt2);
            });
            // reset <sqlCommand>
            sqlCommand = "";
        };
        sqlInsert = function () {
        /*
         * this function will insert <row> into sqlite3
         */
            let ii;
            let tmp;
            // insert <columns>
            if (!rowid && columns === "create") {
                columns = row;
                tmp = Array.from(row);
                ii = 0;
                while (ii < row.length) {
                    row[ii] = "column_" + (ii + 1);
                    ii += 1;
                }
                sqlInsert();
                row = tmp;
            }
            // sql-stringify <row>
            ii = 0;
            while (ii < row.length) {
                row[ii] = sqlStringify(row[ii]);
                ii += 1;
            }
            // create table <tableName>
            if (!rowid) {
                rowLength = row.length;
                sqljsExec({
                    sql: sqlSanitize(
                        "DROP TABLE IF EXISTS " + tableName + ";\n"
                        + "CREATE TEMP TABLE " + tableName + " ("
                        + row.join(" TEXT,") + " TEXT"
                        + ");"
                    )
                });
                // reset <row>
                row = [];
                rowid += 1;
                return;
            }
            if (row.length) {
                // enforce <rowLength>
                sqlCommand += "(";
                ii = 0;
                while (ii < rowLength) {
                    if (ii) {
                        sqlCommand += ",";
                    }
                    sqlCommand += row[ii] || "''";
                    ii += 1;
                }
                sqlCommand += "),\n";
                // reset <row>
                row = [];
                rowid += 1;
            }
            // execute <sqlCommand>
            if (sqlCommand.length && sqlCommand.length >= 0x100000) {
                sqlExec();
                return true;
            }
        };
        sqlProgress = opt.sqlProgress || function (opt2) {
        /*
         * this function will give progress-updates
         * when inserting large data (e.g. 100mb) into sqlite3
         */
            console.error(
                "sqljsTableImport"
                + " - " + (Date.now() - timeStart) + " ms"
                + " - inserted " + Number(opt2.rowid - 1).toLocaleString()
                + " rows"
                + " - " + Number(opt2.byteLength >> 20).toLocaleString()
                + " MB"
            // + "\n" + opt2.sqlSnippet + "..."
            );
        };
        sqlSanitize = opt.sqlSanitize || function (sqlCommand) {
        /*
         * this function will sanitize <sqlCommand>
         * of invalid/uncommon unicode-characters before executing in sqlite3
         */
            // common unicode-ranges
            // latin    "\t\r\n\u0020-\u007e\u00a0-\u024f"
            // greek    "\u0370-\u03ff"
            // cyrillic "\u0400-\u04ff"
            // currency "\u20a0-\u20cf"
            // cjk      "\u3400-\u4dbf\u4e00-\u9fff"
            return sqlCommand.replace((
                /[^\t\r\n\u0020-\u007e\u00a0-\u9fff]/gu
            ), "\ufffd");
        };
        sqlStringify = function (val) {
        /*
         * this function will stringify <val> before inserting into sqlite3
         */
            val = (
                typeof val === "string"
                ? val
                : (val === null || val === undefined)
                ? ""
                : String(
                    typeof val === "boolean"
                    ? val | 0
                    : val
                )
            );
            return "'" + val.replace((
                /'/g
            ), "''") + "'";
        };
        // init
        byteLength = 0;
        csv = opt.csv;
        rgx = (
            /(.*?)(""|"|,|\r\n|\n)/g
        );
        row = [];
        rowLength = 0;
        rowid = 0;
        sqlCommand = "";
        tableName = sqlStringify(opt.tableName || "tmp1");
        timeStart = Date.now();
        val = "";
        values = opt.values;
        columns = opt.columns;
        // insert <columns>
        if (Array.isArray(columns)) {
            row = Array.from(columns);
            sqlInsert();
        }
        // import - list of list
        if (values && Array.isArray(values[0])) {
            values.forEach(function (elem) {
                // insert <row>
                row = Array.from(elem);
                sqlInsert();
            });
            return await sqlEnd();
        }
        // import - list of dict
        if (values) {
            values.forEach(function (elem, ii) {
                // insert <columns>
                if (ii === 0 && !Array.isArray(columns)) {
                    columns = Object.keys(elem);
                    row = Array.from(columns);
                    sqlInsert();
                    return;
                }
                // insert <row>
                row = columns.map(function (key) {
                    return elem[key];
                });
                sqlInsert();
            });
            return await sqlEnd();
        }
// import - csv
/*
https://tools.ietf.org/html/rfc4180#section-2
2.  Definition of the CSV Format
While there are various specifications and implementations for the
CSV format (for ex. [4], [5], [6] and [7]), there is no formal
specification in existence, which allows for a wide variety of
interpretations of CSV files.  This section documents the format that
seems to be followed by most implementations:
1.  Each record is located on a separate line, delimited by a line
    break (CRLF).  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
2.  The last record in the file may or may not have an ending line
    break.  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx
3.  There maybe an optional header line appearing as the first line
    of the file with the same format as normal record lines.  This
    header will contain names corresponding to the fields in the file
    and should contain the same number of fields as the records in
    the rest of the file (the presence or absence of the header line
    should be indicated via the optional "header" parameter of this
    MIME type).  For example:
    field_name,field_name,field_name CRLF
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
4.  Within the header and each record, there may be one or more
    fields, separated by commas.  Each line should contain the same
    number of fields throughout the file.  Spaces are considered part
    of a field and should not be ignored.  The last field in the
    record must not be followed by a comma.  For example:
    aaa,bbb,ccc
5.  Each field may or may not be enclosed in double quotes (however
    some programs, such as Microsoft Excel, do not use double quotes
    at all).  If fields are not enclosed with double quotes, then
    double quotes may not appear inside the fields.  For example:
    "aaa","bbb","ccc" CRLF
    zzz,yyy,xxx
6.  Fields containing line breaks (CRLF), double quotes, and commas
    should be enclosed in double-quotes.  For example:
    "aaa","b CRLF
    bb","ccc" CRLF
    zzz,yyy,xxx
7.  If double-quotes are used to enclose fields, then a double-quote
    appearing inside a field must be escaped by preceding it with
    another double quote.  For example:
    "aaa","b""bb","ccc"
 */
        while (true) {
            match = rgx.exec(csv);
            if (!match) {
/*
2.  The last record in the file may or may not have an ending line
    break.  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx
 */
                if (!row.length) {
                    break;
                }
                // if eof missing crlf, then mock it
                rgx.lastIndex = csv.length;
                match = [
                    "\n", "", "\n"
                ];
            }
            // build <val>
            val += match[1];
            if (match[2] === "\"") {
/*
5.  Each field may or may not be enclosed in double quotes (however
    some programs, such as Microsoft Excel, do not use double quotes
    at all).  If fields are not enclosed with double quotes, then
    double quotes may not appear inside the fields.  For example:
    "aaa","bbb","ccc" CRLF
    zzz,yyy,xxx
 */
                quote = !quote;
            } else if (quote) {
/*
7.  If double-quotes are used to enclose fields, then a double-quote
    appearing inside a field must be escaped by preceding it with
    another double quote.  For example:
    "aaa","b""bb","ccc"
 */
                if (match[2] === "\"\"") {
                    val += "\"";
/*
6.  Fields containing line breaks (CRLF), double quotes, and commas
    should be enclosed in double-quotes.  For example:
    "aaa","b CRLF
    bb","ccc" CRLF
    zzz,yyy,xxx
 */
                } else {
                    val += match[2];
                }
            } else if (match[2] === ",") {
/*
4.  Within the header and each record, there may be one or more
    fields, separated by commas.  Each line should contain the same
    number of fields throughout the file.  Spaces are considered part
    of a field and should not be ignored.  The last field in the
    record must not be followed by a comma.  For example:
    aaa,bbb,ccc
 */
                // delimit <val>
                row.push(val);
                val = "";
            } else if (match[2] === "\r\n" || match[2] === "\n") {
/*
1.  Each record is located on a separate line, delimited by a line
    break (CRLF).  For example:
    aaa,bbb,ccc CRLF
    zzz,yyy,xxx CRLF
 */
                // delimit <val>
                row.push(val);
                val = "";
                if (sqlInsert()) {
                    // do not starve event-loop with message-posts
                    await new Promise(setTimeout);
                }
            }
        }
        return await sqlEnd();
    };
    // init callbackDict
    callbackDict = {};
    // init worker
    worker = new Worker(
        "assets.sqljs-v2019.11.5.rollup.js"
    );
    // init sqljs_worker evt-handling
    worker.addEventListener("message", function (msg) {
    /*
     * this function will handle <msg> from sqljs-worker
     */
        let callback;
        callback = callbackDict[msg.data.id];
        delete callbackDict[msg.data.id];
        if (callback) {
            callback(msg.data);
        }
    });
    // export
    window.sqljsTableImport = sqljsTableImport;
    window.sqljsExec = sqljsExec;
    window.sqljsTableExport = sqljsTableExport;
}());
