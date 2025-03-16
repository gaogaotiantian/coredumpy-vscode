// Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
// For details: https://github.com/gaogaotiantian/coredumpy-vscode/blob/master/NOTICE.txt

const os = require('os');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

class GlobalState {
    constructor() {
        this.tempdir = null;
        this.serverStartPromise = null;
        this.octokit = null;
    }

    createTempDir() {
        if (this.tempdir === null) {
            this.tempdir = fs.mkdtempSync(path.join(os.tmpdir(), 'coredumpy-'));
        }
    }

    getTempDir() {
        this.createTempDir();
        return fs.mkdtempSync(path.join(this.tempdir, "tmp-"));
    }

    deleteTempDir() {
        if (this.tempdir !== null) {
            const fs = require('fs');
            fs.rmdirSync(this.tempdir, { recursive: true });
            this.tempdir = null;
        }
    }

    async linkToGithub() {
        if (this.octokit) {
            return;
        }
        const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
        const { Octokit } = await import('@octokit/rest');
        this.octokit = new Octokit({
            auth: session.accessToken
        });
    }
}

const globalState = new GlobalState();

exports.globalState = globalState;
