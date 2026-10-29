// Every place on the TV the service reads or writes. The environment variables point them elsewhere for the tests on a computer
// (tools/test); on the TV none of them is set.
const path = require('path');
const env = process.env;

const D = env.CYTV_DIR || '/media/developer/cleanyourtv';
const SERVICE_DIR = env.CYTV_SERVICE_DIR || '/media/developer/apps/usr/palm/services/com.cleanyourtv.manager.service';

module.exports = {
  D, // the service's own folder: helper files, config.json, the launcher (app/), Live TV data, themes
  SERVICE_DIR, // the installed package (the manager app's service folder)
  // the installed apps (the manager and the picker): next to the services folder of the package
  APPS: env.CYTV_APPS_DIR || path.resolve(SERVICE_DIR, '..', '..', 'applications'),
  CONF: D + '/config.json',
  USAGE: D + '/usage.json',
  TV: D + '/tv.json', // what tvprofile.js found out about this TV
  DISABLE: D + '/DISABLE', // present while LG's Home is chosen
  PICKER_MODE: D + '/picker-mode', // read by scripts/inputkey.sh
  CHANNEL: D + '/channel', // the update channel ('dev' for the dev builds)
  SOURCE: D + '/source', // "owner/repo [branch]": another repository, for testing
  // the Homebrew Channel skips its telnet server (an open root shell on the network) while this file exists
  TELNET_OFF: process.env.CYTV_TELNET_OFF || '/var/luna/preferences/webosbrew_telnet_disabled',
  LIVE: env.CYTV_LIVE_DIR || D + '/live',
  THEMES: env.CYTV_THEMES || path.join(__dirname, 'themes'),
  VOICE: D + '/voice',
  WEATHER: D + '/weather.json', // the weather card's last answers (weather.js)
  HOOK: D + '/inputhook',
  APP: D + '/app',
  HOME_OVERLAY: D + '/home-overlay', // what stage-home.sh mounts over LG's Home: a copy of app/ with LG's appinfo.json
  COMPAT: [D + '/compat.json', SERVICE_DIR + '/compat.json'],
  INITD: env.CYTV_INITD || '/var/lib/webosbrew/init.d',
  SETUP_LOG: '/media/developer/cytv-setup.log',
  SERVICE_LOG: '/tmp/cleanyourtv-helper.log',
  RUNFILE: env.CYTV_RUNFILE || '/tmp/cytv-run.json',
  ONSCREEN: env.CYTV_ONSCREEN || '/tmp/cytv-onscreen.json', // the apps that were on the screen, with their process (apps.js, running.js)
  HOOK_CFG: '/home/root/.config/lginputhook',
  HOOK_LOG: '/tmp/lginput-hook-lginput2.log',
  LASTAPP: '/var/luna/preferences/bootd_last_foreground_app_id.json',
  PROC: env.CYTV_PROC || '/proc',
  SYS: env.CYTV_SYS || '/sys', // the kernel's devices: thermal zones, the cores' clock, the eMMC's wear (metrics.js)
  // the writable places whose free space TV health shows (metrics.js); a list separated by ':' in the tests
  DISKS: (env.CYTV_DISKS || '/var:/tmp:/media/developer').split(':'),
  SSHD_CONFIG: env.CYTV_SSHD_CONFIG || '/etc/ssh/sshd_config', // OpenSSH's settings, where a TV runs it (exposure.js)
  SYSTEMCTL: env.CYTV_SYSTEMCTL || 'systemctl', // LG's running services, on request (exposure.js)
  SBIN: env.CYTV_SBIN || '/usr/sbin', // LG's programs the debloat stubs (debloatcheck.js)
  HOME_APP: '/usr/palm/applications/com.webos.app.home',
  FULLHOME_APP: '/usr/palm/applications/com.webos.app.fullhome',
  STANDIN: env.CYTV_STANDIN || '/tmp/cleanyourtv-home-standin', // LG's Home program while scripts/home-standin.sh is mounted over it
  // configd's runtime layer (RAM, LG's highest priority): where lgvolume.js puts its one setting to hide LG's volume bar
  LGVOL_DIR: env.CYTV_LGVOL_DIR || '/var/run/tvconfig/remote',
  // child processes find the system tools first, as in a login shell on the TV
  ENV: Object.assign({}, env, { PATH: '/usr/bin:/usr/sbin:/bin:/sbin:' + (env.PATH || '') }),
};
