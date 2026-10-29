function aiHelp() {
  return 'Chat with a language model through OpenRouter. Run these on the TV (ssh):\n\ncurl -X POST localhost:8765/api/voice/set -d \'{"llm":{"key":"sk-or-...","model":"openrouter/auto"}}\'\ncurl -X POST localhost:8765/api/voice/set -d \'{"llm":{"enabled":true}}\'\n\nOptional: "system" sets the instructions. Ask by text from anywhere on the TV:\ncurl -X POST localhost:8765/api/voice/ask -d \'{"text":"What is the capital of Peru?"}\'\n\nSpoken and typed questions go to OpenRouter and the model you chose; no audio does. The key stays on the TV.\n\nHome Assistant (Assist), with a long-lived access token:\ncurl -X POST localhost:8765/api/voice/set -d \'{"ha":{"url":"http://homeassistant.local:8123","token":"..."}}\'\nOptional: "route" is ha-first, ha-only or ai-only; "selfSigned":true accepts a self-signed certificate; "agent" is a conversation entity.';
}
function liveRefresh() {
  api('/api/live/status').then(
    function (r) {
      lv = r;
      if (view === 'livetv') {
        build();
        if (idx >= rows.length) idx = 0;
        draw();
      }
    },
    function () {}
  );
}
function openNotifyQr() {
  if (!napi || !napi.enabled) {
    banner('Switch notifications on first', 'err');
    return;
  }
  shareMode = 'notify';
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr('Notification address and token');
  $('share').querySelector('ol').innerHTML = tr(
    '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera and open the page: it shows the address and the token with <b>Copy</b> buttons.</li><li>The token is a <b>secret</b>: anyone who sees this code while it is open can read it.</li>'
  );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/manager/notify-api', { page: true }).then(
    function (r) {
      if (view !== 'share') return;
      if (!r.pageUrl) {
        $('sharemsg').textContent = tr('The notification listener is not running.');
        return;
      }
      drawQr(r.pageUrl);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = r.pageUrl;
      $('sharemsg').textContent = tr(
        'The page opens for ten minutes. It is not encrypted: the token travels over your Wi-Fi, so use a network you trust.'
      );
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
function openLiveTv() {
  api('/api/live/status').then(
    function (r) {
      lv = r;
      push('livetv');
    },
    function () {
      lv = null;
      push('livetv');
    }
  );
}
/* Wallpapers: photos uploaded from a phone and synced from Immich (helper/wallpapers.js); the launcher's Customize switches them on */
function openWallpapers() {
  api('/api/photofeed/status').then(
    function (r) {
      pf = r;
    },
    function () {}
  );
  api('/api/wallpapers/status').then(
    function (r) {
      wp = r;
      if (view !== 'wallpapers') push('wallpapers');
      else {
        build();
        draw();
      }
      if (r.immich && r.immich.state === 'syncing') setTimeout(wallRefresh, 3000);
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function wallRefresh() {
  if (view === 'wallpapers') openWallpapers();
}
function wallCall(path, b, msg) {
  api(path, b || {}).then(
    function (r) {
      wp = r;
      if (msg) banner(msg, 'ok');
      if (view !== 'wallpapers') pop();
      else {
        build();
        draw();
      }
      if (r.immich && r.immich.state === 'syncing') setTimeout(wallRefresh, 3000);
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function openWallPair(tab) {
  var feed = tab === 'feed';
  shareMode = 'wall';
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr(feed ? 'Photo feed for the screensaver' : 'Wallpapers');
  $('share').querySelector('ol').innerHTML = feed
    ? tr(
        '<li>Phone or computer on the <b>same network</b> as the TV.</li><li>Scan the code, or type the address below and the code.</li><li>Paste the <b>setup code</b> from your photo server (family-calendar: Admin &gt; Photo feeds) and choose <b>Check and save</b>.</li>'
      )
    : tr(
        '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>Choose <b>Upload photos</b>, <b>Configure Immich</b> or <b>Photo feed</b>.</li>'
      );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/wallpapers/pair', feed ? { tab: 'feed' } : {}).then(
    function (r) {
      if (view !== 'share' || shareMode !== 'wall') return;
      if (r.error) {
        $('sharemsg').textContent = tr(r.error);
        return;
      }
      drawQr(r.qr);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = tr(r.url + '   code ' + r.code);
      $('sharemsg').textContent = tr(
        'The page stays open while you use it, at most an hour. It is not encrypted: your photos and the Immich key travel over your Wi-Fi.'
      );
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
function openHaPair() {
  openPair('ha');
}
/* More > Home Assistant: its address and token live with Voice's settings (/api/voice/status), Voice and the cards both use them */
function openHa() {
  api('/api/voice/status').then(
    function (v) {
      vo = v;
      push('ha');
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
/* Cards: a card for each place of the theme (/api/cards/status, /api/cards/set); also opened from the launcher's Customize > Cards */
var cs = null,
  cardSlot = null;
function openCards() {
  api('/api/cards/status', {}).then(
    function (r) {
      cs = r;
      if (view !== 'cards') push('cards');
      else {
        build();
        draw();
      }
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
/* the card type a place shows: the one chosen, else the theme's own; null when it stays empty */
function cardTypeOf(sl) {
  var c = ((cs && cs.cards) || {})[sl.id];
  var ty = c && c.type ? c.type : sl.card || 'none';
  return ty === 'none' ? null : ty;
}
function cardTypeName(ty) {
  var n = ty;
  ((cs && cs.types) || []).forEach(function (x) {
    if (x.type === ty) n = x.name;
  });
  return n;
}
function setCardType(ty) {
  api('/api/cards/set', { slot: cardSlot.id, type: ty }).then(
    function (r) {
      if (r.error) {
        banner(r.error, 'err');
        return;
      }
      api('/api/cards/status', {}).then(function (s) {
        cs = s;
        /* a weather card without a place: straight to its ZIP code */
        if (ty === 'weather' && !cardOf(cardSlot).lat) {
          build();
          draw();
          openZip();
        } else {
          pop();
          openCards();
        }
      });
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function cardOf(sl) {
  return ((cs && cs.cards) || {})[sl.id] || {};
}
/* a card's choice from the TV (the weather's unit, what it shows): the next of its type's choices */
function nextCardOption(key) {
  var c = cardOf(cardSlot),
    fd = null;
  ((cs && cs.types) || []).forEach(function (x) {
    if (x.type === c.type)
      x.fields.forEach(function (f) {
        if (f.key === key) fd = f;
      });
  });
  if (!fd) return;
  var vals = fd.choices.map(function (ch) {
    return ch[0];
  });
  var nv = vals[(vals.indexOf(c[key] || '') + 1) % vals.length];
  api('/api/cards/option', { slot: cardSlot.id, key: key, value: nv }).then(function (r) {
    if (r.error) return banner(r.error, 'err');
    c[key] = nv;
    if (nv === '') delete c[key];
    build();
    draw();
  });
}
function choiceName(key, v) {
  var c = cardOf(cardSlot),
    n = v;
  ((cs && cs.types) || []).forEach(function (x) {
    if (x.type === c.type)
      x.fields.forEach(function (f) {
        if (f.key === key)
          f.choices.forEach(function (ch) {
            if (ch[0] === (v || '')) n = ch[1];
          });
      });
  });
  return n;
}
/* the weather card's place by its ZIP or postal code, typed on the TV (POST /api/cards/place, searched in the TV's country) */
function openZip() {
  $('zipin').value = '';
  $('zipmsg').textContent = '';
  push('zip');
}
function closeZip() {
  $('zipin').blur();
  pop();
}
function zipGo() {
  var v = $('zipin').value.replace(/^\s+|\s+$/g, '');
  if (!v) return;
  $('zipmsg').textContent = tr('Looking it up\u2026');
  api('/api/cards/place', { slot: cardSlot.id, zip: v }).then(
    function (r) {
      if (view !== 'zip') return;
      if (r.error) {
        $('zipmsg').textContent = tr(r.error);
        return;
      }
      api('/api/cards/status', {}).then(function (s) {
        cs = s;
        closeZip();
        banner(tr('Weather for %s').replace('%s', r.place.name + (r.place.area ? ', ' + r.place.area : '')), '');
      });
    },
    function () {
      $('zipmsg').textContent = tr('The service did not answer.');
    }
  );
}
/* keys while the ZIP screen is up: typing in the field, the remote's numbers anywhere; true when the key was used here */
function zipKey(e) {
  var inp = $('zipin'),
    k = e.keyCode;
  if (document.activeElement === inp) {
    if (k === 13 || k === 461 || k === 27) {
      inp.blur();
      if (k === 13) zipGo();
      e.preventDefault();
      return true;
    }
    if (k === 38 || k === 40) {
      inp.blur();
      return false;
    }
    setTimeout(zipTyped, 0);
    return true;
  }
  var d = k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1;
  if (d < 0) return false;
  inp.value = (inp.value + d).slice(0, 10);
  zipTyped();
  e.preventDefault();
  return true;
}
function zipTyped() {
  $('zipmsg').textContent = '';
  build();
  draw();
}
/* Cards: the options of the cards in the theme's slots, typed on a phone page (helper/cards.js) */
function openCardsPair() {
  shareMode = 'cards';
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr('Cards');
  $('share').querySelector('ol').innerHTML = tr(
    '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>Choose a card for each place and fill in its options, then tap <b>Save</b>.</li>'
  );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/cards/pair', {}).then(
    function (r) {
      if (view !== 'share' || shareMode !== 'cards') return;
      if (r.error) {
        $('sharemsg').textContent = tr(r.error);
        return;
      }
      drawQr(r.qr);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = tr(r.url + '   code ' + r.code);
      $('sharemsg').textContent = tr(
        'The page stays open while you use it, at most an hour. It is not encrypted: what you type travels over your Wi-Fi.'
      );
      watchCardsSave();
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
/* Phone remote: the phones paired and the QR code that pairs another (helper/remote.js) */
var rs = null,
  remoteFromHome = false;
function openRemote() {
  api('/api/remote/status').then(
    function (r) {
      rs = r;
      if (view !== 'remote') push('remote');
      else {
        build();
        draw();
      }
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
/* opened from the launcher's Customize > Phone remote: Back goes to Home */
function remoteBack() {
  if (remoteFromHome) {
    remoteFromHome = false;
    api('/api/launch', { id: 'com.webos.app.home' }).catch(function () {});
  }
  pop();
}
function openRemotePair() {
  shareMode = 'remote';
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr('Phone remote');
  $('share').querySelector('ol').innerHTML = tr(
    '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>The remote opens on the phone. To keep it as an app, add it to the Home Screen; on an iPhone, open the icon and pair it again there (a new code).</li>'
  );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/remote/pair', {}).then(
    function (r) {
      if (view !== 'share' || shareMode !== 'remote') return;
      if (r.error) {
        $('sharemsg').textContent = tr(r.error);
        return;
      }
      drawQr(r.qr);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = tr(r.url + '   code ' + r.code);
      $('sharemsg').textContent = tr(
        'The code works for five minutes. Each phone gets its own key, and you can remove a phone here. Only for the home network.'
      );
      watchRemotePair();
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
/* once a phone has paired, the code goes and the list shows the new phone */
function watchRemotePair() {
  var had = ((rs && rs.devices) || []).length;
  (function poll() {
    setTimeout(function () {
      if (view !== 'share' || shareMode !== 'remote') return;
      api('/api/remote/status').then(
        function (r) {
          if (view !== 'share' || shareMode !== 'remote') return;
          if (r.devices.length <= had && r.pairing) return poll();
          rs = r;
          $('share').style.display = 'none';
          pop();
          build();
          draw();
          if (r.devices.length > had) banner('Paired: ' + r.devices[r.devices.length - 1].name, '');
        },
        function () {
          poll();
        }
      );
    }, 2000);
  })();
}
/* once the phone page saves, this screen goes: back to Home when it was opened from Customize > Cards (the cards show there), else
   to the Cards list. The phone page stays usable for more changes (at most an hour). */
function watchCardsSave() {
  var since = Date.now();
  (function poll() {
    setTimeout(function () {
      if (view !== 'share' || shareMode !== 'cards') return;
      api('/api/cards/status', {}).then(
        function (s) {
          if (view !== 'share' || shareMode !== 'cards') return;
          if (!(s && s.savedAt > since)) return poll();
          $('share').style.display = 'none';
          pop();
          if (cardsFromHome) {
            cardsFromHome = false;
            api('/api/launch', { id: 'com.webos.app.home' }).catch(function () {});
          }
          openCards();
        },
        function () {
          poll();
        }
      );
    }, 2000);
  })();
}
function openLivePair() {
  shareMode = 'live';
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr('Set up Live TV');
  $('share').querySelector('ol').innerHTML = tr(
    '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>Enter the <b>code</b> below and your playlist address.</li>'
  );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/live/pair', {}).then(
    function (r) {
      if (view !== 'share') return;
      drawQr(r.url);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = tr(r.url + '   code ' + r.code);
      $('sharemsg').textContent = tr(
        'The page stays open for ten minutes. It is not encrypted: the playlist address, which may hold an access key, travels over your Wi-Fi.'
      );
      (function poll(n) {
        if (view !== 'share' || shareMode !== 'live') return;
        api('/api/live/status').then(
          function (s2) {
            if (s2.configured && (!lv || !lv.configured || s2.channels !== lv.channels)) {
              lv = s2;
              closeShare();
              banner('Playlist saved', 'ok');
              return;
            }
            if (n < 300)
              setTimeout(function () {
                poll(n + 1);
              }, 2000);
          },
          function () {
            setTimeout(function () {
              poll(n + 1);
            }, 3000);
          }
        );
      })(0);
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
function openChannel() {
  banner('Looking for the dev build\u2026', 'work');
  api('/api/manager/tests').then(
    function (r) {
      banner('');
      tst = r;
      push('channel');
      for (var k = 0; k < rows.length; k++)
        if (rows[k].sub && /^selected/.test(rows[k].sub)) {
          idx = k;
          draw();
          break;
        }
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function setChannel(tag) {
  banner('Switching\u2026', 'work');
  api('/api/manager/channel', { tag: tag }).then(
    function (s) {
      if (s.error) {
        banner(s.error, 'err');
        return;
      }
      st = s;
      pop();
      banner(
        tag
          ? 'Following the dev builds. If the Launcher or Service row offers an update, that is the dev build.'
          : 'Back on the stable releases',
        'ok'
      );
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function openModels() {
  banner('Loading the model list\u2026', 'work');
  api('/api/voice/models').then(
    function (r) {
      if (r.error) {
        banner(r.error, 'err');
        return;
      }
      banner('');
      mdl = [{ id: 'openrouter/auto', name: 'Auto (OpenRouter picks)', price: null }].concat(r.picks);
      var cur = ((vo || {}).llm || {}).model;
      if (
        cur &&
        !mdl.some(function (x) {
          return x.id === cur;
        })
      )
        mdl.splice(1, 0, { id: cur, name: cur, price: null });
      push('models');
      for (var k = 0; k < rows.length; k++)
        if (rows[k].sub && /selected$/.test(rows[k].sub)) {
          idx = k;
          draw();
          break;
        }
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function haTest() {
  banner('Asking Home Assistant\u2026', 'work');
  api('/api/voice/ha-test', {}).then(
    function (r) {
      if (r.error) {
        banner(r.error, 'err');
        return;
      }
      banner('Connected to ' + (r.name || 'Home Assistant') + (r.version ? ' ' + r.version : ''), 'ok');
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function openAgents() {
  banner('Asking Home Assistant\u2026', 'work');
  api('/api/voice/ha-agents').then(
    function (r) {
      if (r.error) {
        banner(r.error, 'err');
        return;
      }
      banner('');
      agl = r.agents || [];
      push('agents');
      var cur = ((vo || {}).ha || {}).agent;
      for (var k = 0; k < rows.length; k++)
        if (rows[k].sub && /selected$/.test(rows[k].sub)) {
          idx = k;
          draw();
          break;
        }
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function pickAgent(id) {
  api('/api/voice/set', { ha: { agent: id } }).then(
    function (x) {
      if (x.error) {
        banner(x.error, 'err');
        return;
      }
      vo = x;
      banner(id ? 'Agent: ' + id : 'Default agent', 'ok');
      pop();
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
function pickModel(id) {
  api('/api/voice/set', { llm: { model: id } }).then(
    function (x) {
      if (x.error) {
        banner(x.error, 'err');
        return;
      }
      vo = x;
      banner('Model: ' + id, 'ok');
      pop();
    },
    function () {
      banner('The service did not answer', 'err');
    }
  );
}
/* the phone page of Voice, or with only 'ha' the one for Home Assistant (address and token, used by Voice and the cards) */
function openPair(only) {
  shareMode = 'pair';
  pairBase = (vo && vo.pairedAt) || 0;
  push('share');
  $('share').style.display = 'block';
  $('shareurl').textContent = '';
  $('qrbox').style.visibility = 'hidden';
  $('share').querySelector('h2').textContent = tr(only === 'ha' ? 'Home Assistant' : 'Set up from your phone');
  $('share').querySelector('ol').innerHTML =
    only === 'ha'
      ? tr(
          '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>Enter the <b>address</b> of Home Assistant and a <b>long-lived access token</b>, and tap <b>Save</b>.</li>'
        )
      : tr(
          '<li>Phone on the <b>same Wi-Fi</b> as the TV.</li><li>Scan the code with the camera.</li><li>Enter your <b>OpenRouter key</b> and model, and tap <b>Save</b>.</li>'
        );
  $('sharemsg').textContent = tr('Preparing\u2026');
  api('/api/voice/pair', only === 'ha' ? { only: 'ha' } : {}).then(
    function (r) {
      if (view !== 'share') return;
      drawQr(r.url);
      $('qrbox').style.visibility = 'visible';
      $('shareurl').textContent = tr(r.url);
      $('sharemsg').textContent = tr(
        'The page stays open for ten minutes, or until you save. It is not encrypted: the key travels over your Wi-Fi, so use a network you trust.'
      );
      pollPair(0);
    },
    function () {
      $('sharemsg').textContent = tr('The service did not answer.');
    }
  );
}
function pollPair(n) {
  if (view !== 'share' || shareMode !== 'pair') return;
  api('/api/voice/status').then(
    function (v) {
      if (v.pairedAt > pairBase) {
        vo = v;
        closeShare();
        banner('Saved', 'ok');
        return;
      }
      if (!v.pairing && n > 1) {
        $('sharemsg').textContent = tr('The page has closed. Close this and try again.');
        return;
      }
      setTimeout(function () {
        pollPair(n + 1);
      }, 2000);
    },
    function () {
      setTimeout(function () {
        pollPair(n + 1);
      }, 3000);
    }
  );
}
function voiceRefresh() {
  clearTimeout(pollT);
  api('/api/voice/status').then(
    function (v) {
      vo = v;
      var j = v.job || {};
      if (j.state === 'working') banner(j.message, 'work');
      else if (j.state === 'error') banner(j.message, 'err');
      else if (v.listening) banner('Listening…', 'work');
      else banner('');
      if (view === 'voice' || view === 'ha') {
        build();
        if (idx >= rows.length) idx = 0;
        draw();
      }
      if (j.state === 'working' || v.listening) pollT = setTimeout(voiceRefresh, 1000);
      else
        api('/api/manager/status').then(function (s) {
          st = s;
        });
    },
    function () {
      pollT = setTimeout(voiceRefresh, 2000);
    }
  );
}
