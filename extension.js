// Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
// For details: https://github.com/gaogaotiantian/coredumpy-vscode/blob/master/NOTICE.txt

const vscode = require('vscode');
const { spawn } = require('child_process');
const { PythonExtension } = require('@vscode/python-extension');

function getCoredumpyVersion(pythonPath) {
    return new Promise((resolve) => {
        const process = spawn(pythonPath, ['-m', 'pip', 'show', 'coredumpy']);
        let stdout = "";
        // wait until the process is finished
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.on('close', () => {
            // Get the stdout
            const regex = /Version: (\d+\.\d+\.\d+)/g;
            // Check if the stdout contains the version
            let m = regex.exec(stdout);

            if (m) {
                resolve(m[1]);
            } else {
                resolve(null);
            }
        });
    });
}

function showOptionsWithoutCoredumpy(message, pythonPath) {
    return new Promise((resolve) => {
        vscode.window.showWarningMessage(message, "Install Coredumpy").then((selection) => {
            if (selection === "Install Coredumpy") {
                const process = spawn(pythonPath, ['-m', 'pip', 'install', '-U', 'coredumpy']);
                process.on('close', () => {
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        });
    });
}

function versionAtLeast(version, target) {
    const versionParts = version.split(".");
    const targetParts = target.split(".");
    for (let i = 0; i < versionParts.length; i++) {
        if (i >= targetParts.length) {
            return true;
        }
        if (versionParts[i] > targetParts[i]) {
            return true;
        } else if (versionParts[i] < targetParts[i]) {
            return false;
        }
    }
    return true;
}

function confirmCoredumpyVersion(target) {
    return new Promise((resolve) => {
        PythonExtension.api().then((api) => {
            if (!api) {
                vscode.window.showErrorMessage("Please install Python extension to view the report");
                resolve(null);
            }

            const environmentPath = api.environments.getActiveEnvironmentPath();
            api.environments.resolveEnvironment(environmentPath).then((environment) => {
                getCoredumpyVersion(environment.path).then((version) => {
                    if (!version || !versionAtLeast(version, target)) {
                        let message = "Please upgrade coredumpy to view the report";
                        if (!version) {
                            message = "Please install coredumpy to view the report";
                        }
                        showOptionsWithoutCoredumpy(message, environment.path).then((installed) => {
                            if (installed) {
                                resolve(environment.path);
                            } else {
                                resolve(null);
                            }
                        });
                    } else {
                        resolve(environment.path);
                    }
                });
            });
        });
    });
}


function startDebugAdapterServer() {
    return confirmCoredumpyVersion("0.2.0").then((pythonPath) => {
        debugAdapterProcess = spawn(pythonPath, ['-m', 'coredumpy', 'host']);

        debugAdapterProcess.stdout.on('data', (data) => {
            console.log(`Debugger stdout: ${data}`);
        });

        debugAdapterProcess.stderr.on('data', (data) => {
            console.error(`Debugger stderr: ${data}`);
        });

        debugAdapterProcess.on('close', (code) => {
            console.log(`Debugger exits with code ${code}`);
        });
    })
}

var serverStartPromise = null;
var debugAdapterProcess = null;


function activate(context) {
    serverStartPromise = startDebugAdapterServer();

    const factory = new CoreDumPyDebugAdapterDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('coredumpy', factory));

    const debugFileCommand = vscode.commands.registerCommand('coredumpy.loadFile', async (fileUri) => {
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }

        if (fileUri) {
            const filePath = fileUri.fsPath;
            const debugConfig = {
                type: 'coredumpy',
                name: 'load coredumpy file',
                request: 'launch',
                program: filePath,
                args: []
            };

            await serverStartPromise;
            vscode.debug.startDebugging(undefined, debugConfig);
        } else {
            vscode.window.showErrorMessage('Failed to get the file.');
        }
    });

    context.subscriptions.push(debugFileCommand);
}
exports.activate = activate;

class CoreDumPyDebugAdapterDescriptorFactory {
    async createDebugAdapterDescriptor(session) {
        await serverStartPromise;
        return new vscode.DebugAdapterServer(6742, 'localhost');
    }
}

function deactivate() {
    if (debugAdapterProcess) {
        debugAdapterProcess.kill();
        debugAdapterProcess = null;
    }
}
exports.deactivate = deactivate;
