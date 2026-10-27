// The service's own overrides of LG's settings (configd, luna://com.webos.service.config), in RAM. configd builds the TV's settings
// from layers: folders of <namespace>.json files, where a file in a higher layer overrides only the settings it names. This keeps the
// overrides in the layer "TV Region Manager Options", /var/run/tvconfig/rmm/<country> (in RAM, priority 154: above LG's base and
// distro layers), which configd selects again whenever it is asked to read its layers (reconfigure). The layer above it in RAM,
// /var/run/tvconfig/remote, is no use: configd picks that one only at boot, before the folder exists.
//   set(ns, values)   writes <ns>.json with those settings into every country folder there, then asks configd to read its layers again
//   clear(ns)         removes them the same way
//   isSet(ns, values) whether they are all in place (they vanish with a restart of the TV)
//   owned(ns)         whether every country folder holds what this wrote for that namespace (whatever the values)
//   get(names)        the settings as configd gives them now (getConfigs)
// What was written is recorded in /tmp (RAM, like the files): a file is replaced or removed only when it holds exactly what this wrote,
// so a file of LG's is never touched, and LG's folders are never created.
const fs = require('fs'),
  path = require('path');

const DIR = process.env.CYTV_LGCONFIG_DIR || '/var/run/tvconfig/rmm';
const RECORD = process.env.CYTV_LGCONFIG_RECORD || '/tmp/cleanyourtv-lgconfig.json';
const NS = /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/; // com.webos.surfacemanager

// ctx: {luna}; o: {dir, record} (tests)
function create(ctx, opts) {
  const o = opts || {};
  const dir = o.dir || DIR,
    recFile = o.record || RECORD;
  const readRec = () => {
    try {
      const r = JSON.parse(fs.readFileSync(recFile, 'utf8'));
      return r && typeof r === 'object' ? r : {};
    } catch (_) {
      return {};
    }
  };
  const writeRec = r => {
    fs.writeFileSync(recFile + '.tmp', JSON.stringify(r));
    fs.renameSync(recFile + '.tmp', recFile);
  };
  const read = f => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch (_) {
      return null;
    }
  };
  // the country folders configd may select (pre_reconfigure.sh fills them from the TV's region group)
  const folders = () => {
    try {
      return fs
        .readdirSync(dir)
        .map(n => path.join(dir, n))
        .filter(d => {
          try {
            return fs.statSync(d).isDirectory();
          } catch (_) {
            return false;
          }
        });
    } catch (_) {
      return [];
    }
  };
  const supported = () => folders().length > 0;
  const content = values => JSON.stringify(values) + '\n';
  const files = ns => folders().map(d => path.join(d, ns + '.json'));
  const reread = () => ctx.luna('luna://com.webos.service.config/reconfigure', {}, { wait: 15000 });

  function isSet(ns, values) {
    const want = content(values),
      list = NS.test(ns) ? files(ns) : [];
    return list.length > 0 && list.every(f => read(f) === want);
  }
  // true when every folder holds these settings afterwards; a folder with someone else's file of that name is left as it is
  async function set(ns, values) {
    if (!NS.test(ns) || !supported()) return false;
    const want = content(values),
      rec = readRec();
    let changed = false,
      all = true;
    for (const f of files(ns)) {
      const now = read(f);
      if (now === want) continue; // already there (written before, or identical): ownership stays as recorded
      if (now !== null && now !== rec[f]) {
        all = false;
        continue;
      }
      fs.writeFileSync(f + '.tmp', want);
      fs.renameSync(f + '.tmp', f);
      rec[f] = want;
      changed = true;
    }
    if (changed) {
      writeRec(rec);
      await reread();
    }
    return all;
  }
  // true when something was removed
  async function clear(ns) {
    if (!NS.test(ns)) return false;
    const rec = readRec();
    let changed = false,
      dirty = false;
    for (const f of Object.keys(rec)) {
      if (path.basename(f) !== ns + '.json') continue;
      if (read(f) === rec[f]) {
        try {
          fs.unlinkSync(f);
          changed = true;
        } catch (_) {}
      }
      delete rec[f];
      dirty = true;
    }
    if (dirty) writeRec(rec);
    if (changed) await reread();
    return changed;
  }
  function owned(ns) {
    const rec = readRec(),
      list = NS.test(ns) ? files(ns) : [];
    return list.length > 0 && list.every(f => rec[f] !== undefined && read(f) === rec[f]);
  }
  async function get(names) {
    const r = await ctx.luna('luna://com.webos.service.config/getConfigs', { configNames: names });
    return (r && r.configs) || {};
  }
  return { supported, isSet, owned, set, clear, get, dir };
}

module.exports = { create, DIR, RECORD };
