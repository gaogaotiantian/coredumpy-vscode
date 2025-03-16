// Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
// For details: https://github.com/gaogaotiantian/coredumpy-vscode/blob/master/NOTICE.txt

const vscode = require('vscode');
const { globalState } = require('./globalState');

async function debugFile(filePath) {
    const debugConfig = {
        type: 'coredumpy',
        name: 'load coredumpy file',
        request: 'launch',
        program: filePath,
        args: []
    };

    await globalState.serverStartPromise;
    vscode.debug.startDebugging(undefined, debugConfig);
    vscode.commands.executeCommand('workbench.view.debug');
}

exports.debugFile = debugFile;
