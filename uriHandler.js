// Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
// For details: https://github.com/gaogaotiantian/coredumpy-vscode/blob/master/NOTICE.txt

const { debugFile } = require('./debugFile.js');

const https = require('https');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { globalState } = require('./globalState.js');
const AdmZip = require('adm-zip');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                // Remove the file if the request did not succeed.
                fs.unlink(dest, () => {});
                return reject(new Error(`Failed to get '${url}' (statusCode: ${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            // Delete the file if there's an error during download.
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function downloadArtifact(owner, repo, artifactId, outputPath) {
    const url = await globalState.octokit.request(
        'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip',
        {
            owner: owner,
            repo: repo,
            artifact_id: artifactId,
            archive_format: 'zip'
        }
    )
    const buffer = Buffer.from(url.data, 'binary');
    await fs.promises.writeFile(outputPath, buffer);
}

const uriHandler = {
    async handleUri(uri) {
        // parse the URI
        await globalState.linkToGithub();
        const parsedUri = vscode.Uri.parse(uri);
        if (parsedUri.path === '/load-github-artifact') {
            const params = new URLSearchParams(parsedUri.query);
            const tempdir = globalState.getTempDir();
            const downloadPath = path.join(tempdir, params.get('artifactId') + '.zip');
            await downloadArtifact(params.get('owner'), params.get('repo'), params.get('artifactId'), downloadPath);
            const zip = new AdmZip(downloadPath);
            const extractPath = globalState.getTempDir();
            zip.extractAllTo(extractPath, true);
            const files = fs.readdirSync(extractPath);
            files.forEach((file) => {
                const filePath = path.join(extractPath, file);
                if (fs.statSync(filePath).isFile()) {
                    debugFile(filePath);
                }
            });
        } else {
            vscode.window.showErrorMessage(`Unsupported URI path: ${parsedUri.path}`);
            return;
        }
    }
};

exports.uriHandler = uriHandler;
