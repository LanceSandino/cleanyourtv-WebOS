// The hub's neigh.sh: a permanent neighbour entry on the hub's host for each TV in .env, with the MAC the hub learned (or TV_MAC for the
// first TV), so wake packets sent to a sleeping TV's own address leave the host; it skips a TV without a MAC or a route, and never
// prints a MAC. `ip` is a stand-in that answers `route get` and writes down every `neigh replace`.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, run } = require('./lib');

run(async () => {
  const D = path.join(tmp, 'hub-neigh'),
    bin = path.join(D, 'bin'),
    calls = path.join(D, 'calls');
  fs.mkdirSync(path.join(D, 'data'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(
    path.join(bin, 'ip'),
    '#!/bin/sh\n' +
      'if [ "$1 $2 $3" = "-o route get" ]; then [ "$4" = "10.0.0.9" ] && exit 2; echo "$4 dev eth7 src 10.0.0.2 uid 0"; exit 0; fi\n' +
      'echo "$*" >> ' +
      JSON.stringify(calls) +
      '\n'
  );
  fs.chmodSync(path.join(bin, 'ip'), 0o755);
  const MAC1 = '02:00:5e:10:20:41',
    MAC2 = '02:00:5e:10:20:42';
  fs.writeFileSync(path.join(D, '.env'), 'TV_HOSTS="10.0.0.7,10.0.0.8,10.0.0.9,10.0.0.10"\nWAKE_ADDR=10.0.0.255\n');
  fs.writeFileSync(path.join(D, 'data', 'tv-mac'), MAC1 + '\n');
  fs.writeFileSync(path.join(D, 'data', 'tv-mac-10.0.0.8'), MAC2 + '\n');
  fs.writeFileSync(path.join(D, 'data', 'tv-mac-10.0.0.9'), MAC2 + '\n'); // no route to it
  // 10.0.0.10 has no MAC learned yet
  const env = Object.assign({}, process.env, { PATH: bin + ':' + process.env.PATH });
  let r = cp.spawnSync('sh', [path.join(root, 'hub', 'neigh.sh'), D], { encoding: 'utf8', env });
  let did = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n') : [];
  ok(
    r.status === 0 &&
      JSON.stringify(did) ===
        JSON.stringify([
          'neigh replace 10.0.0.7 lladdr ' + MAC1 + ' dev eth7 nud permanent',
          'neigh replace 10.0.0.8 lladdr ' + MAC2 + ' dev eth7 nud permanent',
        ]) &&
      /10\.0\.0\.7 kept by its MAC on eth7/.test(r.stdout) &&
      /10\.0\.0\.9: no route/.test(r.stdout) &&
      /10\.0\.0\.10: no MAC learned yet/.test(r.stdout) &&
      r.stdout.indexOf(MAC1) < 0 &&
      r.stdout.indexOf(MAC2) < 0,
    'each TV with a MAC and a route is kept as a permanent neighbour, the others are named, no MAC is printed: ' +
      JSON.stringify([did, r.stdout, r.stderr])
  );
  // TV_MAC in .env wins for the first TV; one TV_HOST works as well
  fs.unlinkSync(calls);
  fs.writeFileSync(path.join(D, '.env'), "TV_HOST=10.0.0.7\nTV_MAC='02:00:5E:10:20:43'\n");
  r = cp.spawnSync('sh', [path.join(root, 'hub', 'neigh.sh'), D], { encoding: 'utf8', env });
  did = fs.readFileSync(calls, 'utf8').trim().split('\n');
  ok(
    r.status === 0 && did.length === 1 && did[0] === 'neigh replace 10.0.0.7 lladdr 02:00:5e:10:20:43 dev eth7 nud permanent',
    'TV_MAC is used for the first TV, in lower case, with one TV_HOST: ' + JSON.stringify(did)
  );
});
