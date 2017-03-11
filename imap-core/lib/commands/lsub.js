'use strict';

let imapHandler = require('../handler/imap-handler');
let imapTools = require('../imap-tools');
let utf7 = require('utf7').imap;

// tag LSUB "" "%"

module.exports = {
    state: ['Authenticated', 'Selected'],

    schema: [{
        name: 'reference',
        type: 'string'
    }, {
        name: 'mailbox',
        type: 'string'
    }],

    handler(command, callback) {

        let reference = command.attributes[0] && command.attributes[0].value || '';
        let mailbox = command.attributes[1] && command.attributes[1].value || '';

        // Check if LIST method is set
        if (typeof this._server.onLsub !== 'function') {
            return callback(null, {
                response: 'NO',
                message: 'LSUB not implemented'
            });
        }

        let query = imapTools.normalizeMailbox(reference + mailbox, !this.acceptUTF8Enabled);

        let lsubResponse = (err, list) => {

            if (err) {
                return callback(err);
            }

            imapTools.filterFolders(imapTools.generateFolderListing(list, true), query).forEach(folder => {
                if (!folder) {
                    return;
                }

                let path = folder.path;
                if (!this.acceptUTF8Enabled) {
                    path = utf7.encode(path);
                }

                let response = {
                    tag: '*',
                    command: 'LSUB',
                    attributes: [
                        [].concat(folder.flags || []).map(flag => ({
                            type: 'atom',
                            value: flag
                        })),
                        '/', path
                    ]
                };

                this.send(imapHandler.compiler(response));
            });

            callback(null, {
                response: 'OK'
            });

        };

        if (!mailbox) {
            // return delimiter only
            return lsubResponse(null, {
                path: '/',
                flags: '\\Noselect'
            });
        }

        // Do folder listing
        // Concat reference and mailbox. No special reference handling whatsoever
        this._server.onLsub(imapTools.normalizeMailbox(reference + mailbox), this.session, lsubResponse);
    }
};
