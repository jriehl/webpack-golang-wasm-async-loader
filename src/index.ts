import {readFileSync, unlinkSync} from "fs";
import {basename, join} from "path";
import {promisify} from 'util';
import {execFile} from "child_process";

const proxyBuilder = (filename: string) => `
export default gobridge(fetch('${filename}').then(response => response.arrayBuffer()));
`;

const getGoBin = (root: string) => `${root}/bin/go`;

async function loader(this: any, contents: string) {
  const cb = this.async();

  let resourceDirectory = this.resourcePath.substr(0, this.resourcePath.lastIndexOf("/"));

  // let path: string;
  const promisingExec = promisify(execFile);
  let goRoot = (await promisingExec('/usr/bin/env', ['go', 'env', 'GOROOT'])).stdout.trim() || process.env.GOROOT;
  let goPath = (await promisingExec('/usr/bin/env', ['go', 'env', 'GOPATH'])).stdout.trim() || process.env.GOPATH;
  console.log(`GOROOT = ${goRoot}, GOPATH = ${goPath}`);

  const opts = {
    env: {
      GOPATH: goPath,
      GOROOT: goRoot,
      GOCACHE: join(__dirname, "./.gocache"),
      GOOS: "js",
      GOARCH: "wasm"
    },
    cwd: resourceDirectory
  };

  const goBin = getGoBin(opts.env.GOROOT);
  const outFile = `${this.resourcePath}.wasm`;
  // const args = ["build", "-x", "-a", "-v", "-o", outFile, this.resourcePath];  // TODO: remove this
  const args = ["build", "-o", outFile, this.resourcePath];

  execFile(goBin, args, opts, (err) => {
    if (err) {
      cb(err);
      return;
    }

    let out = readFileSync(outFile);
    unlinkSync(outFile);
    const emittedFilename = basename(this.resourcePath, ".go") + ".wasm";
    this.emitFile(emittedFilename, out, null);

    cb(
      null,
      [
        "require('!",
        // join(process.env.GOROOT, "/misc/wasm/wasm_exec.js"),
        join(__dirname, "..", "lib", "wasm_exec.js"),
        "');",
        "import gobridge from '",
        join(__dirname, "..", "dist", "gobridge.js"),
        "';",
        proxyBuilder(emittedFilename)
      ].join("")
    );
  });
}

export default loader;
