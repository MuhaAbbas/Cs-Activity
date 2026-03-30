/* ═══════════════════════════════════════
       CONFIG
       ═══════════════════════════════════════ */
    var APP_VERSION = { ver: 'V42', date: '29-Mar-2026', time: '12:00 PKT', build: 'index.html' };

    var C = {
      DB: DB.config.DB,
      ADMIN_U: DB.config.ADMIN_U, ADMIN_N: DB.config.ADMIN_N,
      MAX_PH: 5, PH_KB: 200, KM_RATE: 6.5, DED_LATE: 200, DED_ABSENT: 500,
      OFFICES: [
        { name: 'Lahore HO (PECO Road)', lat: 31.462915, lng: 74.320000 },
        { name: 'Brandreth Road, Lahore', lat: 31.575249, lng: 74.323730 },
        { name: 'Karachi Office', lat: 24.857580, lng: 67.043633 }
      ],
      GEO_RADIUS: 50,
      START_TIME: '10:00', END_TIME: '16:00', OT_START: '18:00', AUTO_CLOSE: '23:00',
      MAX_OVERNIGHT: 3,
      TAGS: ['recovery', 'followup', 'newclient', 'payment', 'demo', 'complaint', 'order', 'quote', 'meeting', 'proposal', 'delivery', 'return', 'cold', 'urgent', 'cncsale', 'ficosale'],
      MAX_WORDS: 2000
    };

    /* ═══════════════════════════════════════
       FIREBASE (XHR REST, no SDK)
       ═══════════════════════════════════════ */
    // F is provided by db.js via window.F — no local definition needed

    /* ═══════════════════════════════════════
       SOUNDS
       ═══════════════════════════════════════ */
    var S = (function () {
      var c = null; function gc() { if (!c) c = new (window.AudioContext || window.webkitAudioContext)(); return c }
      var d = {
        click: function (o, g, t) { o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(500, t + .04); g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); o.start(t); o.stop(t + .05) },
        ok: function (o, g, t) { o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + .08); o.frequency.setValueAtTime(784, t + .16); g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.start(t); o.stop(t + .25) },
        err: function (o, g, t) { o.type = 'sawtooth'; o.frequency.setValueAtTime(250, t); o.frequency.setValueAtTime(180, t + .08); g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.start(t); o.stop(t + .16) },
        att: function (o, g, t) { o.frequency.setValueAtTime(600, t); o.frequency.setValueAtTime(800, t + .06); o.frequency.setValueAtTime(1200, t + .18); g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .28); o.start(t); o.stop(t + .28) }
      };
      return { p: function (t) { try { var x = gc(), o = x.createOscillator(), g = x.createGain(); o.connect(g); g.connect(x.destination); (d[t] || d.click)(o, g, x.currentTime) } catch (e) { } } }
    })();

    /* ═══════════════════════════════════════
       UTILITIES
       ═══════════════════════════════════════ */
    function showLoad(msg, sub) { var ov = document.getElementById('load-ov'); document.getElementById('load-msg').textContent = msg || 'Loading...'; document.getElementById('load-sub').textContent = sub || ''; ov.classList.add('on') }
    function hideLoad() { document.getElementById('load-ov').classList.remove('on') }

    var U = {
      toast: function (m, t) { var e = document.createElement('div'); e.className = 'toast t-' + (t || 'info'); e.textContent = m; document.getElementById('toasts').appendChild(e); setTimeout(function () { e.remove() }, 2800) },
      today: function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') },
      dedCutoff: function () { var n = new Date(); if (n.getHours() < 17) { n.setDate(n.getDate() - 1) } return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0') },
      time: function () { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') },
      clr: function (n) { n = n || ''; var h = 0; for (var i = 0; i < n.length; i++)h = (h << 5) - h + n.charCodeAt(i) | 0; return ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#404040', '#1a1a1a'][Math.abs(h) % 6] },
      ini: function (n) { return (n || '').split(' ').map(function (w) { return w[0] }).join('').slice(0, 2).toUpperCase() || '?' }
    };

    /* ═══════════════════════════════════════
       STATE
       ═══════════════════════════════════════ */
    var ME = null;
    var _att = [];       /* today's attendance records */
    var _myAttId = null; /* current session Firebase key */
    var _journeyState = 'idle'; /* current journey state */
    var _loginTime = null;
    var _officeTimer = null;
    var _rpts = [];       /* all reports */
    var _dateMode = 'today'; /* today or old */

    /* ═══════════════════════════════════════
       APP
       ═══════════════════════════════════════ */
    var App = {

      /* ── Login tabs ── */
      ltab: function (t) { S.p('click'); document.getElementById('lt-si').classList.toggle('on', t === 'si'); document.getElementById('lt-rg').classList.toggle('on', t === 'rg'); document.getElementById('lf-si').style.display = t === 'si' ? '' : 'none'; document.getElementById('lf-rg').style.display = t === 'rg' ? '' : 'none' },

      /* ── Sign In ── */
      signIn: async function () {
        var u = document.getElementById('li-u').value.trim().toLowerCase();
        var p = document.getElementById('li-p').value;
        if (!u || !p) { U.toast('Enter username/email and password', 'warn'); return }
        var btn = document.getElementById('si-btn'); btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true;
        try {
          var users = F.arr(await F.g('users'));
          /* match by username OR email */
          var user = users.find(function (x) {
            return (x.username || '').toLowerCase() === u || (x.email || '').toLowerCase() === u;
          });
          if (user) {
            if (user.role === 'admin') {
              localStorage.removeItem('csvt8'); localStorage.removeItem('cs_s');
              U.toast('Admin → Redirecting to Admin Portal', 'info');
              setTimeout(function () { window.location.href = 'index.html' }, 500); return;
            }
            var hp = await DB.hashPassword(p);
            if (user.password !== hp) { U.toast('Incorrect password', 'err'); return }
            if (user.blocked === true) { U.toast('Account blocked — contact admin', 'err'); return }
            if (user.approved !== true) { U.toast('Account pending approval', 'warn'); return }
            ME = { id: user.id, name: user.name, username: user.username, email: user.email || '', role: 'employee' };
            this.save(); S.p('ok'); this.showEmp();
          } else {
            U.toast('User not found', 'err');
          }
        } catch (e) { U.toast('Connection error', 'err') }
        finally { btn.innerHTML = 'Sign In →'; btn.disabled = false }
      },

      /* ── Register ── */
      register: async function () {
        var n = document.getElementById('rg-n').value.trim();
        var u = document.getElementById('rg-u').value.trim().toLowerCase();
        var e = document.getElementById('rg-e').value.trim().toLowerCase();
        var p = document.getElementById('rg-p').value;
        if (!n || !u || !e || !p) { U.toast('Fill all fields', 'warn'); return }
        if (!DB.isValidEmail(e)) { U.toast('Invalid email address', 'warn'); return }
        var btn = document.getElementById('rg-btn'); btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true;
        try {
          var users = F.arr(await F.g('users'));
          if (users.find(function (x) { return (x.username || '').toLowerCase() === u })) { U.toast('Username taken', 'err'); return }
          if (users.find(function (x) { return (x.email || '').toLowerCase() === e })) { U.toast('Email already in use', 'err'); return }
          var hp = await DB.hashPassword(p);
          await F.push('users', { name: n, username: u, email: e, password: hp, wa: document.getElementById('rg-w').value.trim(), approved: false, role: 'employee', createdAt: new Date().toISOString() });
          U.toast('Registered! Wait for admin approval.', 'ok'); S.p('ok'); this.ltab('si');
        } catch (e) { U.toast('Error', 'err') }
        finally { btn.innerHTML = 'Register →'; btn.disabled = false }
      },

      /* ── Session ── */
      save: function () { localStorage.setItem('csvt8', JSON.stringify(ME)) },
      logout: function () { S.p('click'); ME = null; _att = []; _myAttId = null; if (_officeTimer) clearInterval(_officeTimer); localStorage.removeItem('csvt8'); localStorage.removeItem('cs_s'); this.scr('s-login') },
      restore: function () {
        try {
          /* Clear old V7 key if exists */
          var old = localStorage.getItem('cs_s');
          if (old) { localStorage.removeItem('cs_s') }
          var s = JSON.parse(localStorage.getItem('csvt8'));
          if (s && s.role === 'employee') { ME = s; this.showEmp() }
          else if (s && s.role === 'admin') {
            /* Admin shouldn't be in employee portal — clear and show login */
            localStorage.removeItem('csvt8');
            this.scr('s-login');
          }
        } catch (e) { this.scr('s-login') }
      },
      scr: function (id) { document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on') }); document.getElementById(id).classList.add('on') },

      /* ── Show Employee Portal ── */
      showEmp: async function () {
        this.scr('s-emp');
        document.getElementById('emp-name').textContent = ME.name.split(' ')[0];
        document.getElementById('home-ver').textContent = APP_VERSION.ver + ' · ' + APP_VERSION.date + ' · ' + APP_VERSION.time;
        showLoad('Loading', 'Fetching your data...');
        try {
          _att = F.arr(await F.g('attendance'));
          _rpts = F.arr(await F.g('reports'));
          this._leaves = F.arr(await F.g('leaves'));
          this.checkSession();
          this.loadStats();
        } catch (e) { U.toast('Error loading data', 'err') }
        hideLoad();
      },

      /* ── Navigation ── */
      nav: function (pg, btn) {
        S.p('click');
        document.querySelectorAll('#s-emp .page').forEach(function (p) { p.classList.remove('on') });
        document.getElementById('pg-' + pg).classList.add('on');
        document.querySelectorAll('.bnav .bn').forEach(function (b) { b.classList.remove('on') });
        if (btn) btn.classList.add('on');
        window.scrollTo(0, 0);
        /* Page-specific init */
        if (pg === 'activity') this.initActPage();
        if (pg === 'reports') this.renderRpts();
        if (pg === 'summary') this.loadSummary('week');
        if (pg === 'attend') this.loadMyAtt('week');
        if (pg === 'visits') this.loadMyVisits('week');
      },

      /* ── Journey state ── */
      jgo: function (state) {
        _journeyState = state;
        document.querySelectorAll('.jstate').forEach(function (el) { el.classList.remove('on') });
        var el = document.getElementById('s-' + state);
        if (el) el.classList.add('on');
        window.scrollTo(0, 0);
      },

      /* ═══════════════════════════════════════
         GPS
         ═══════════════════════════════════════ */
      _geoDist: function (lat1, lng1, lat2, lng2) {
        var R = 6371000; var dLat = (lat2 - lat1) * Math.PI / 180; var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      },

      _geoCheck: function (cb) {
        if (!navigator.geolocation) { cb(null); return }
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          var best = null;
          C.OFFICES.forEach(function (ofc) { var d = App._geoDist(lat, lng, ofc.lat, ofc.lng); if (!best || d < best.dist) best = { dist: Math.round(d), name: ofc.name } });
          cb({ lat: lat, lng: lng, dist: best ? best.dist : 99999, near: best && best.dist <= C.GEO_RADIUS, officeName: best ? best.name : '' });
        }, function (err) { cb(null) }, { enableHighAccuracy: true, timeout: 10000 });
      },

      /* ═══════════════════════════════════════
         CHECK SESSION — restore journey state
         ═══════════════════════════════════════ */
      checkSession: function () {
        var today = U.today();
        var myToday = _att.filter(function (a) { return a.userId === ME.id && a.date === today });
        var active = myToday.find(function (a) { return !a.out });
        var lastDone = myToday.filter(function (a) { return a.out }).sort(function (a, b) { return (b.out || '').localeCompare(a.out || '') })[0];

        /* Check for stale session from yesterday */
        var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        var yd = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
        var stale = _att.find(function (a) { return a.userId === ME.id && a.date === yd && !a.out });
        if (stale) {
          document.getElementById('stale-banner').style.display = 'block';
          document.getElementById('stale-banner').textContent = '⚠️ Unclosed session from ' + yd + ' — auto-closed at 23:00. Starting fresh.';
          /* Auto-close it */
          F.up('attendance/' + stale.id, { out: '23:00', outStatus: '⚠️ Auto-Closed', autoClose: true }).catch(function () { });
        }

        if (active) {
          /* Resume active session */
          _myAttId = active.id;
          _loginTime = active.time;
          /* Outside login that hasn't checked in at client yet */
          if (active.inNear === false && active.outsideReason && !active.checkedInClient) {
            this._outsideReason = active.outsideReason;
            this.showAtLocation(active);
          } else {
            this.showAtOffice(active);
          }
        } else if (lastDone) {
          /* Show done state with option to re-login */
          this.jgo('done');
          document.getElementById('done-detail').textContent = lastDone.time + ' → ' + lastDone.out + ' · ' + (lastDone.inOffice || '');
          this.renderDayTimeline('done-tl-items');
          this.renderDoneTotals();
        } else {
          this.jgo('idle');
        }
      },

      /* ═══════════════════════════════════════
         MARK ATTENDANCE
         ═══════════════════════════════════════ */
      markAttendance: async function () {
        /* Block if active session exists */
        var active = _att.find(function (a) { return a.userId === ME.id && a.date === U.today() && !a.out });
        if (active) { U.toast('Already logged in at ' + active.time + '. Checkout first.', 'err'); return }

        var btn = document.getElementById('att-btn');
        btn.textContent = '📡 Checking GPS...'; btn.disabled = true;
        showLoad('Marking Attendance', 'Checking your location...');

        this._geoCheck(async function (geo) {
          try {
            if (!geo) {
              U.toast('❌ GPS required. Enable location services.', 'err');
              btn.textContent = '📍 Mark Attendance'; btn.disabled = false; hideLoad(); return;
            }

            var todaySessions = _att.filter(function (a) { return a.userId === ME.id && a.date === U.today() });
            var seq = todaySessions.length + 1;
            var timeNow = U.time();
            var isLate = timeNow > C.START_TIME;
            var isSunday = new Date().getDay() === 0;

            if (geo.near) {
              /* ── AT OFFICE — write to Firebase ── */
              var rec = {
                userId: ME.id, userName: ME.name, date: U.today(), time: timeNow,
                ts: new Date().toISOString(), session: seq,
                inLat: geo.lat, inLng: geo.lng, inDist: geo.dist, inNear: true,
                inStatus: 'At Office', inOffice: geo.officeName,
                status: isLate ? 'Late' : 'Present',
                flags: isSunday ? ['off-day'] : (isLate ? ['late'] : ['normal']),
                stops: [{ type: 'office', name: geo.officeName, in: timeNow, out: null }]
              };
              var pushId = await F.push('attendance', rec);
              rec.id = pushId; _att.push(rec);
              _myAttId = pushId; _loginTime = timeNow;
              S.p('att');
              U.toast('✅ Checked in at ' + geo.officeName + (isLate ? ' (Late)' : ''), 'ok');
              if (isSunday) U.toast('📅 Off-day attendance flagged', 'warn');
              App.showAtOffice(rec);
            } else {
              /* ── OUTSIDE OFFICE — show reason picker ── */
              App._pendingGeo = geo;
              App._outsideReason = null;
              document.querySelectorAll('#s-outside .client-opt').forEach(function (c) { c.classList.remove('client-opt-hi') });
              document.getElementById('out-confirm-btn').style.display = 'none';
              App.jgo('outside');
              document.getElementById('outside-detail').textContent =
                'You are ' + geo.dist + 'm from ' + geo.officeName + '. GPS location will be recorded.';
            }
          } catch (e) { U.toast('Error: ' + e.message, 'err') }
          finally { btn.textContent = '📍 Mark Attendance'; btn.disabled = false; hideLoad() }
        });
      },

      /* ── Outside office — pick reason (highlight only, no save yet) ── */
      _pendingGeo: null,
      _outsideReason: null,
      pickOutsideReason: function (reason, el) {
        S.p('click');
        this._outsideReason = reason;
        document.querySelectorAll('#s-outside .client-opt').forEach(function (c) { c.classList.remove('client-opt-hi') });
        el.classList.add('client-opt-hi');
        document.getElementById('out-confirm-btn').style.display = 'block';
      },

      /* ── Outside office — confirm and write to Firebase ── */
      outsideContinue: async function () {
        var geo = this._pendingGeo; var reason = this._outsideReason;
        if (!geo || !reason) { U.toast('Select a reason', 'warn'); return }
        showLoad('Saving', 'Recording attendance...');
        try {
          var timeNow = U.time();
          var isLate = timeNow > C.START_TIME;
          var todaySessions = _att.filter(function (a) { return a.userId === ME.id && a.date === U.today() });
          var rec = {
            userId: ME.id, userName: ME.name, date: U.today(), time: timeNow,
            ts: new Date().toISOString(), session: todaySessions.length + 1,
            inLat: geo.lat, inLng: geo.lng, inDist: geo.dist, inNear: false,
            inStatus: 'Outside Office', inOffice: '',
            outsideReason: reason,
            status: isLate ? 'Late' : 'Outside',
            flags: ['outside-login', isLate ? 'late' : ''].filter(Boolean),
            stops: [{ type: 'outside-login', reason: reason, lat: geo.lat, lng: geo.lng, in: timeNow, out: null }]
          };
          var pushId = await F.push('attendance', rec);
          rec.id = pushId; _att.push(rec);
          _myAttId = pushId; _loginTime = timeNow;
          S.p('att');
          U.toast('⚠️ Logged in — Outside Office (' + reason + ')', 'warn');
          this.showAtLocation(rec);
        } catch (e) { U.toast('Error', 'err') }
        hideLoad();
      },

      /* ═══════════════════════════════════════
         SHOW "AT LOCATION" STATE (outside login)
         ═══════════════════════════════════════ */
      showAtLocation: function (rec) {
        var reason = rec.outsideReason || 'client';
        this.jgo('at_location');
        document.getElementById('atloc-title').textContent =
          reason === 'client' ? 'Client Visit — Pick Client' :
            reason === 'lead' ? 'Lead Visit — Add New Lead' :
              'Complaint Visit';
        document.getElementById('atloc-detail').textContent = 'Logged in at ' + rec.time + (rec.inLat ? ' · GPS: ' + rec.inLat.toFixed(4) + ', ' + rec.inLng.toFixed(4) : '');

        /* Show relevant form */
        document.getElementById('atloc-client').style.display = reason === 'client' ? 'block' : 'none';
        document.getElementById('atloc-lead').style.display = reason === 'lead' ? 'block' : 'none';
        document.getElementById('atloc-complaint').style.display = reason === 'complaint' ? 'block' : 'none';

        /* Reset purpose chips */
        document.querySelectorAll('#atloc-purpose .purp-chip').forEach(function (c) { c.classList.remove('on') });
        if (reason === 'complaint') {
          document.querySelectorAll('#atloc-purpose .purp-chip').forEach(function (c) { if (c.textContent.indexOf('Complaint') >= 0) c.classList.add('on') });
        }

        /* Load client list for client visit */
        if (reason === 'client') this.loadAtlocClients();
      },

      togglePurp: function (el) { S.p('click'); el.classList.toggle('on') },

      /* ── Load clients for picker ── */
      loadAtlocClients: async function () {
        try {
          var clients = C.CLIENTS || [];
          /* Also fetch custom_clients from Firebase */
          var custom = F.arr(await F.g('custom_clients'));
          var all = clients.slice();
          custom.forEach(function (c) { if (c.name) all.push(c.name) });
          all.sort();
          App._atlocClients = all;
          App._atlocSelected = null;
          var html = '';
          all.forEach(function (name) { html += '<div class="cl-row" onclick="App.selAtlocClient(this)">' + name + '</div>' });
          document.getElementById('atloc-client-list').innerHTML = html || '<div style="padding:10px;font-size:11px;color:var(--G5)">No clients found</div>';
        } catch (e) { document.getElementById('atloc-client-list').innerHTML = '<div style="padding:10px;font-size:11px;color:var(--R)">Error loading clients</div>' }
      },

      filterAtlocClients: function () {
        var q = (document.getElementById('atloc-search').value || '').toLowerCase();
        document.querySelectorAll('#atloc-client-list .cl-row').forEach(function (r) {
          r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? 'block' : 'none';
        });
      },

      _atlocSelected: null,
      selAtlocClient: function (el) {
        S.p('click');
        document.querySelectorAll('#atloc-client-list .cl-row').forEach(function (r) { r.classList.remove('sel') });
        el.classList.add('sel');
        this._atlocSelected = el.textContent.trim();
      },

      /* ── Check in at location (outside login) ── */
      /* ═══════════════════════════════════════
         CANCEL ATTENDANCE (delete record, start fresh)
         ═══════════════════════════════════════ */
      cancelAttendance: async function () {
        if (!_myAttId) { this.jgo('idle'); return }
        if (!confirm('Cancel this attendance? Record will be deleted.')) { return }
        showLoad('Cancelling', 'Removing attendance record...');
        try {
          await F.del('attendance/' + _myAttId);
          _att = F.arr(await F.g('attendance'));
          _myAttId = null; _loginTime = null;
          if (_officeTimer) clearInterval(_officeTimer);
          S.p('err');
          U.toast('Attendance cancelled', 'warn');
          this.jgo('idle');
        } catch (e) { U.toast('Error cancelling', 'err') }
        hideLoad();
      },

      /* ═══════════════════════════════════════
         CHANGE LOCATION TYPE (switch client/lead/complaint)
         ═══════════════════════════════════════ */
      changeLocationType: function () {
        S.p('click');
        /* Show a simple picker */
        var types = ['client', 'lead', 'complaint'];
        var labels = { 'client': '🏢 Client Visit', 'lead': '🆕 Lead Visit', 'complaint': '🔄 Complaint' };
        var current = this._outsideReason || 'client';
        var html = '<div style="font-size:13px;font-weight:800;color:var(--G2);margin-bottom:8px">Change visit type:</div>';
        types.forEach(function (t) {
          var sel = t === current ? 'client-opt-hi' : '';
          html += '<div class="client-opt ' + sel + '" onclick="App.doChangeType(\'' + t + '\')">' +
            '<div class="co-icon">' + labels[t].split(' ')[0] + '</div>' +
            '<div><div class="co-title">' + labels[t].substring(labels[t].indexOf(' ') + 1) + '</div></div></div>';
        });
        /* Replace At Location content temporarily */
        var el = document.getElementById('atloc-type-picker');
        if (el) { el.innerHTML = html; el.style.display = 'block' }
      },

      doChangeType: async function (newType) {
        this._outsideReason = newType;
        /* Update Firebase */
        if (_myAttId) {
          try { await F.up('attendance/' + _myAttId, { outsideReason: newType }) } catch (e) { }
        }
        /* Refresh At Location view */
        var rec = _att.find(function (a) { return a.id === _myAttId });
        if (rec) { rec.outsideReason = newType }
        var el = document.getElementById('atloc-type-picker');
        if (el) el.style.display = 'none';
        this.showAtLocation(rec || { time: _loginTime, inNear: false, outsideReason: newType, inLat: 0, inLng: 0 });
        U.toast('Changed to ' + newType, 'ok');
      },

      checkInAtLocation: async function () {
        var reason = this._outsideReason;
        if (reason === 'client' && !this._atlocSelected) { U.toast('Select a client', 'warn'); return }
        if (reason === 'lead' && !document.getElementById('atloc-lead-name').value.trim()) { U.toast('Enter lead name', 'warn'); return }
        if (reason === 'complaint' && !document.getElementById('atloc-comp-client').value.trim()) { U.toast('Enter client name', 'warn'); return }

        var purposes = [];
        document.querySelectorAll('#atloc-purpose .purp-chip.on').forEach(function (c) { purposes.push(c.textContent.trim()) });

        var clientName = reason === 'client' ? this._atlocSelected :
          reason === 'lead' ? document.getElementById('atloc-lead-name').value.trim() :
            document.getElementById('atloc-comp-client').value.trim();

        showLoad('Checking In', 'Saving client info...');
        try {
          /* Save to Firebase */
          var upd = { checkedInClient: clientName, clientType: reason, purposes: purposes, checkedInAt: U.time() };
          await F.up('attendance/' + _myAttId, upd);
          /* Refresh local data */
          _att = F.arr(await F.g('attendance'));
          S.p('ok');
          U.toast('✅ Checked in at ' + clientName, 'ok');
          var rec = _att.find(function (a) { return a.id === _myAttId });
          this.showAtOffice(rec || { time: _loginTime, inNear: false, outsideReason: reason, inOffice: clientName, checkedInClient: clientName });
        } catch (e) { U.toast('Error saving', 'err') }
        hideLoad();
      },

      /* ═══════════════════════════════════════
         SHOW "AT OFFICE" STATE
         ═══════════════════════════════════════ */
      showAtOffice: function (rec) {
        this.jgo('at_office');
        var isOutside = rec.inNear === false;
        var hasClient = rec.checkedInClient;
        var oName = hasClient ? '📍 ' + rec.checkedInClient :
          isOutside ? 'Outside Office (' + (rec.outsideReason || '—') + ')' : (rec.inOffice || 'Office');
        var isLate = (rec.time || '') > C.START_TIME;
        var badge = isLate ? '<span class="badge bg-amb">Late</span>' : '<span class="badge bg-grn">On Time</span>';
        if (isOutside && !hasClient) badge = '<span class="badge bg-amb">Unauthorized</span>';
        if (hasClient) badge = '<span class="badge bg-grn">At Client</span>';

        document.getElementById('office-name').textContent = oName;
        document.getElementById('office-detail').innerHTML = 'Since ' + rec.time + (rec.checkedInAt ? ' · Checked in ' + rec.checkedInAt : '') + ' · ' + badge;

        /* Render full day timeline */
        this.renderDayTimeline('tl-items');

        /* Start office timer */
        var self = this;
        if (_officeTimer) clearInterval(_officeTimer);
        _officeTimer = setInterval(function () { self._updateOfficeTime() }, 30000);
        this._updateOfficeTime();
      },

      /* ═══════════════════════════════════════
         RENDER DAY TIMELINE (all sessions)
         ═══════════════════════════════════════ */
      renderDayTimeline: function (targetId) {
        var today = U.today();
        var myToday = _att.filter(function (a) { return a.userId === ME.id && a.date === today })
          .sort(function (a, b) { return (a.time || '').localeCompare(b.time || '') });

        if (!myToday.length) { document.getElementById(targetId).innerHTML = '<div style="font-size:11px;color:var(--G5);padding:8px">No sessions today</div>'; return }

        var html = ''; var totalMin = 0; var sessions = myToday.length;

        myToday.forEach(function (s, i) {
          var isOutside = s.inNear === false;
          var icon = isOutside ? '⚠️' : '🟢';
          var place = isOutside ? 'Outside (' + (s.outsideReason || '—') + ')' : (s.inOffice || 'Office');
          var isLate = (s.time || '') > C.START_TIME;
          var statusBadge = isLate ? '<span class="badge bg-amb">Late</span>' : '<span class="badge bg-grn">On Time</span>';
          if (isOutside) statusBadge = '<span class="badge bg-amb">Unauthorized</span>';
          var sessionBadge = '<span class="badge bg-blu">Session ' + (i + 1) + '</span>';

          /* Calculate duration */
          var durText = '';
          if (s.out) {
            var inP = s.time.split(':'), outP = s.out.split(':');
            var mins = (parseInt(outP[0]) * 60 + parseInt(outP[1])) - (parseInt(inP[0]) * 60 + parseInt(inP[1]));
            if (mins < 0) mins = 0; totalMin += mins;
            var h = Math.floor(mins / 60), m = mins % 60;
            durText = ' (' + (h ? h + 'h ' : '') + (m < 10 ? '0' : '') + m + 'm)';
          }

          /* Has wire if not last item */
          var wire = (i < myToday.length - 1 || !s.out) ? '<div class="tl-wire"></div>' : '';
          var dotClr = s.out ? 'tl-dot-grn' : 'tl-dot-blu';

          html += '<div class="tl-item"><div class="tl-line"><div class="tl-dot ' + dotClr + '"></div>' + wire + '</div>';
          html += '<div class="tl-info"><div class="tl-place">' + icon + ' ' + place + '</div>';
          html += '<div class="tl-time">' + s.time + (s.out ? ' → ' + s.out + durText : ' · <span style="color:var(--grn);font-weight:700">Active</span>') + ' · ' + statusBadge + ' ' + sessionBadge + '</div>';

          /* Flags */
          var flagsHtml = '';
          if (s.flags && s.flags.length) {
            s.flags.forEach(function (f) {
              if (f === 'late') flagsHtml += '<span class="badge bg-amb">⏰ Late</span> ';
              else if (f === 'early') flagsHtml += '<span class="badge bg-blu">⚡ Early</span> ';
              else if (f === 'outside-login') flagsHtml += '<span class="badge bg-red">📍 Outside</span> ';
              else if (f === 'off-day') flagsHtml += '<span class="badge bg-amb">📅 Off-day</span> ';
            });
            if (flagsHtml) html += '<div style="margin-top:2px">' + flagsHtml + '</div>';
          }

          /* Logout location */
          if (s.out && s.outStatus) {
            var locBadge = s.outNear ? '<span class="badge bg-grn">' + s.outStatus + '</span>' : '<span class="badge bg-red">' + s.outStatus + '</span>';
            html += '<div style="margin-top:2px">Checkout: ' + locBadge + '</div>';
          }

          html += '</div></div>';
        });

        /* Day summary strip */
        var totalH = Math.floor(totalMin / 60), totalM = totalMin % 60;
        var summaryHtml = '<div style="margin-top:8px;padding:8px;background:var(--G9);border-radius:8px;font-size:10px;color:var(--G5);display:flex;gap:12px;flex-wrap:wrap">';
        summaryHtml += '<span><strong>' + sessions + '</strong> session' + (sessions > 1 ? 's' : '') + '</span>';
        summaryHtml += '<span><strong>' + (totalH ? totalH + 'h ' : '') + (totalM < 10 ? '0' : '') + totalM + 'm</strong> total</span>';
        var activeSess = myToday.find(function (s) { return !s.out });
        if (activeSess) summaryHtml += '<span style="color:var(--grn);font-weight:700">● Active now</span>';
        summaryHtml += '</div>';

        document.getElementById(targetId).innerHTML = html + summaryHtml;
      },

      _updateOfficeTime: function () {
        if (!_loginTime) return;
        var now = new Date(); var p = _loginTime.split(':');
        var loginMin = parseInt(p[0]) * 60 + parseInt(p[1]);
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var diff = nowMin - loginMin; if (diff < 0) diff = 0;
        var h = Math.floor(diff / 60), m = diff % 60;
        document.getElementById('ls-time').textContent = (h ? h + 'h' : '') + (m < 10 ? '0' : '') + m + 'm';
      },

      /* ═══════════════════════════════════════
         GOING HOME (CHECKOUT)
         ═══════════════════════════════════════ */
      /* ═══════════════════════════════════════
         VISIT FLOW — Leave → Travel → Arrive → Client → Checkout → Next
         ═══════════════════════════════════════ */
      _travelWatch: null,
      _travelKm: 0,
      _travelStart: null,
      _travelPoints: [],
      _currentVisit: null,
      _meetingTimer: null,
      _meetingStart: null,
      _visitPhotos: [],
      _dayVisits: 0,

      leaveForVisit: function () {
        S.p('click');
        this._travelKm = 0; this._travelPoints = []; this._travelStart = U.time();
        this.jgo('travelling');
        document.getElementById('travel-detail').textContent = 'Left at ' + this._travelStart;
        this.renderDayTimeline('tv-tl-items');
        /* Start GPS watch */
        var self = this;
        if (this._travelWatch) { navigator.geolocation.clearWatch(this._travelWatch); this._travelWatch = null }
        if (navigator.geolocation) {
          this._travelWatch = navigator.geolocation.watchPosition(function (pos) {
            var pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
            if (self._travelPoints.length) {
              var last = self._travelPoints[self._travelPoints.length - 1];
              var d = App._geoDist(last.lat, last.lng, pt.lat, pt.lng);
              if (d > 5) self._travelKm += (d / 1000); /* only add if moved >5m */
            }
            self._travelPoints.push(pt);
            self._updateTravelStats();
          }, function () { },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        }
        this._updateTravelStats();
      },

      _updateTravelStats: function () {
        var km = this._travelKm.toFixed(1);
        document.getElementById('tv-km').textContent = km;
        document.getElementById('tv-claim').textContent = 'Rs ' + Math.round(this._travelKm * C.KM_RATE);
        document.getElementById('tv-visits').textContent = this._dayVisits;
        var pts = this._travelPoints.length;
        document.getElementById('travel-gps').innerHTML = '📡 GPS: <span style="color:var(--grn);font-weight:800">' + (pts ? 'Active' : 'Waiting') + '</span> · ' + pts + ' pts';
        /* Travel time */
        if (this._travelStart) {
          var sp = this._travelStart.split(':');
          var now = new Date(); var mins = now.getHours() * 60 + now.getMinutes() - (parseInt(sp[0]) * 60 + parseInt(sp[1]));
          if (mins < 0) mins = 0;
          document.getElementById('tv-time').textContent = (mins >= 60 ? Math.floor(mins / 60) + 'h' : '') + (mins % 60) + 'm';
        }
      },

      arrivedAtClient: function () {
        S.p('click');
        /* Stop GPS watch */
        if (this._travelWatch) { navigator.geolocation.clearWatch(this._travelWatch); this._travelWatch = null }
        this.jgo('arrived');
        document.getElementById('arrived-detail').textContent = this._travelKm.toFixed(1) + ' km · ' + (this._travelPoints.length) + ' GPS pts';
        /* Reset forms */
        this._arrClientType = null; this._arrClientName = null;
        document.querySelectorAll('#s-arrived .client-opt').forEach(function (c) { c.classList.remove('client-opt-hi') });
        document.getElementById('arr-existing').style.display = 'none';
        document.getElementById('arr-lead').style.display = 'none';
        document.getElementById('arr-other').style.display = 'none';
        document.querySelectorAll('#arr-purpose .purp-chip').forEach(function (c) { c.classList.remove('on') });
        /* Load clients */
        this.loadArrClients();
      },

      _arrClientType: null,
      _arrClientName: null,

      pickArrClientType: function (type, el) {
        S.p('click');
        this._arrClientType = type;
        document.querySelectorAll('#s-arrived .client-opt').forEach(function (c) { c.classList.remove('client-opt-hi') });
        el.classList.add('client-opt-hi');
        document.getElementById('arr-existing').style.display = type === 'existing' ? 'block' : 'none';
        document.getElementById('arr-lead').style.display = type === 'lead' ? 'block' : 'none';
        document.getElementById('arr-other').style.display = type === 'other' ? 'block' : 'none';
      },

      loadArrClients: async function () {
        try {
          var all = (C.CLIENTS || []).slice();
          var custom = F.arr(await F.g('custom_clients'));
          custom.forEach(function (c) { if (c.name) all.push(c.name) });
          all.sort(); App._arrAllClients = all;
          var html = ''; all.forEach(function (n) { html += '<div class="cl-row" onclick="App.selArrClient(this)">' + n + '</div>' });
          document.getElementById('arr-client-list').innerHTML = html || '<div style="padding:8px;font-size:11px;color:var(--G5)">No clients</div>';
        } catch (e) { }
      },

      filterArrClients: function () {
        var q = (document.getElementById('arr-search').value || '').toLowerCase();
        document.querySelectorAll('#arr-client-list .cl-row').forEach(function (r) {
          r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? 'block' : 'none';
        });
      },

      selArrClient: function (el) {
        S.p('click');
        document.querySelectorAll('#arr-client-list .cl-row').forEach(function (r) { r.classList.remove('sel') });
        el.classList.add('sel');
        this._arrClientName = el.textContent.trim();
      },

      checkInFromArrived: function () {
        var type = this._arrClientType;
        if (!type) { U.toast('Select client type', 'warn'); return }
        if (type === 'existing' && !this._arrClientName) { U.toast('Select a client', 'warn'); return }
        if (type === 'lead' && !document.getElementById('arr-lead-name').value.trim()) { U.toast('Enter lead name', 'warn'); return }
        if (type === 'other' && !document.getElementById('arr-other-reason').value.trim()) { U.toast('Enter reason', 'warn'); return }

        var name = type === 'existing' ? this._arrClientName :
          type === 'lead' ? document.getElementById('arr-lead-name').value.trim() :
            document.getElementById('arr-other-reason').value.trim();

        var purposes = [];
        document.querySelectorAll('#arr-purpose .purp-chip.on').forEach(function (c) { purposes.push(c.textContent.trim()) });

        this._currentVisit = {
          clientName: name, clientType: type, purposes: purposes,
          inTime: U.time(), km: this._travelKm,
          inLat: this._travelPoints.length ? this._travelPoints[this._travelPoints.length - 1].lat : 0,
          inLng: this._travelPoints.length ? this._travelPoints[this._travelPoints.length - 1].lng : 0
        };

        S.p('att');
        this._dayVisits++;
        this.showAtClient();
      },

      showAtClient: function () {
        var v = this._currentVisit; if (!v) return;
        this.jgo('at_client');
        document.getElementById('mc-name').textContent = '📍 ' + v.clientName;
        document.getElementById('mc-detail').textContent = (v.clientType === 'lead' ? '🆕 New Lead' : '🏢 Existing') + ' · Since ' + v.inTime;
        document.getElementById('mc-purpose').textContent = v.purposes.length ? v.purposes.join(' · ') : '—';
        document.getElementById('mc-km').textContent = v.km.toFixed(1);
        document.getElementById('mc-claim').textContent = 'Rs ' + Math.round(v.km * C.KM_RATE);
        document.getElementById('mc-visits').textContent = this._dayVisits;

        /* Start meeting timer */
        this._meetingStart = Date.now();
        var self = this;
        if (this._meetingTimer) clearInterval(this._meetingTimer);
        this._meetingTimer = setInterval(function () {
          var sec = Math.floor((Date.now() - self._meetingStart) / 1000);
          var m = Math.floor(sec / 60), s = sec % 60;
          document.getElementById('meeting-timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
          /* Update total time */
          if (_loginTime) {
            var lp = _loginTime.split(':'); var now = new Date();
            var total = now.getHours() * 60 + now.getMinutes() - (parseInt(lp[0]) * 60 + parseInt(lp[1]));
            document.getElementById('mc-total').textContent = (total >= 60 ? Math.floor(total / 60) + 'h' : '') + (total % 60) + 'm';
          }
        }, 1000);
      },

      leaveClient: function () {
        S.p('click');
        if (this._meetingTimer) { clearInterval(this._meetingTimer); this._meetingTimer = null }
        var v = this._currentVisit;
        if (v) {
          var sec = Math.floor((Date.now() - this._meetingStart) / 1000);
          v.outTime = U.time(); v.duration = Math.floor(sec / 60);
        }
        this.jgo('checkout');
        document.getElementById('co-name').textContent = 'Leaving ' + (v ? v.clientName : '—');
        document.getElementById('co-detail').textContent = (v ? v.duration + 'm meeting · ' + v.purposes.join(', ') : '');
        /* Reset outcome */
        document.querySelectorAll('#co-outcomes .purp-chip').forEach(function (c) { c.classList.remove('on') });
        document.getElementById('co-notes').value = '';
        document.getElementById('co-photos').innerHTML = '';
        this._visitPhotos = [];
      },

      _selectedOutcome: null,
      selOutcome: function (el) {
        S.p('click');
        document.querySelectorAll('#co-outcomes .purp-chip').forEach(function (c) { c.classList.remove('on') });
        el.classList.add('on');
        this._selectedOutcome = el.textContent.trim();
      },

      addVisitPhoto: function (evt) {
        var files = evt.target.files; if (!files || !files.length) return;
        var self = this;
        Array.from(files).forEach(function (f) {
          if (self._visitPhotos.length >= 5) { U.toast('Max 5 photos', 'warn'); return }
          var reader = new FileReader();
          reader.onload = function (e) {
            self._visitPhotos.push(e.target.result);
            var ph = document.getElementById('co-photos');
            var img = document.createElement('div');
            img.style.cssText = 'width:50px;height:50px;border-radius:6px;overflow:hidden;border:1px solid var(--G8)';
            img.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover">';
            ph.appendChild(img);
          };
          reader.readAsDataURL(f);
        });
        evt.target.value = '';
      },

      clearCheckout: function () {
        S.p('click');
        document.querySelectorAll('#co-outcomes .purp-chip').forEach(function (c) { c.classList.remove('on') });
        document.getElementById('co-notes').value = '';
        document.getElementById('co-photos').innerHTML = '';
        this._visitPhotos = []; this._selectedOutcome = null;
      },

      submitCheckout: async function () {
        if (!this._selectedOutcome) { U.toast('Select an outcome', 'warn'); return }
        var v = this._currentVisit; if (!v) return;
        v.outcome = this._selectedOutcome;
        v.notes = document.getElementById('co-notes').value.trim();
        v.photos = this._visitPhotos.slice(0, 5);

        showLoad('Saving Visit', 'Updating journey...');
        try {
          /* Build stop entry */
          var stop = {
            type: 'client', clientName: v.clientName, clientType: v.clientType,
            in: v.inTime, out: v.outTime, duration: v.duration,
            purpose: v.purposes.join(', '), outcome: v.outcome,
            notes: v.notes, photoCount: v.photos.length,
            km: v.km.toFixed(1),
            inLat: v.inLat, inLng: v.inLng
          };
          /* Add travel + client stop to attendance record */
          var rec = _att.find(function (a) { return a.id === _myAttId });
          var stops = rec && rec.stops ? rec.stops : [];
          stops.push({ type: 'travel', km: parseFloat(v.km.toFixed(1)), from: this._travelStart, to: v.inTime });
          stops.push(stop);
          var totalKm = 0; stops.forEach(function (s) { if (s.km) totalKm += parseFloat(s.km) });
          await F.up('attendance/' + _myAttId, { stops: stops, totalKm: parseFloat(totalKm.toFixed(1)), lastVisit: v.clientName });
          _att = F.arr(await F.g('attendance'));
          S.p('ok');
          U.toast('✅ Visit saved — ' + v.clientName + ' · ' + v.outcome, 'ok');
          this.jgo('next');
          document.getElementById('next-detail').textContent = v.clientName + ' · ' + v.outcome + ' · ' + v.duration + 'm';
          this.renderDayTimeline('next-tl-items');
        } catch (e) { U.toast('Error saving', 'err') }
        hideLoad();
      },

      nextClient: function () {
        S.p('click');
        this._currentVisit = null; this._travelKm = 0; this._travelPoints = []; this._travelStart = U.time();
        this.jgo('travelling');
        document.getElementById('travel-detail').textContent = 'Left at ' + this._travelStart;
        this.renderDayTimeline('tv-tl-items');
        /* Restart GPS */
        var self = this;
        if (this._travelWatch) { navigator.geolocation.clearWatch(this._travelWatch); this._travelWatch = null }
        if (navigator.geolocation) {
          this._travelWatch = navigator.geolocation.watchPosition(function (pos) {
            var pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
            if (self._travelPoints.length) {
              var last = self._travelPoints[self._travelPoints.length - 1];
              var d = App._geoDist(last.lat, last.lng, pt.lat, pt.lng);
              if (d > 5) self._travelKm += (d / 1000);
            }
            self._travelPoints.push(pt); self._updateTravelStats();
          }, function () { }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        }
        this._updateTravelStats();
      },

      backToOffice: function () {
        S.p('click');
        if (this._travelWatch) { navigator.geolocation.clearWatch(this._travelWatch); this._travelWatch = null }
        if (this._meetingTimer) { clearInterval(this._meetingTimer); this._meetingTimer = null }
        /* Go back to At Office — can leave again */
        var rec = _att.find(function (a) { return a.id === _myAttId });
        this.showAtOffice(rec || { time: _loginTime, inNear: true, inOffice: 'Office' });
      },

      goHome: async function () {
        if (!_myAttId) { U.toast('No active session', 'err'); return }
        /* Cleanup any active tracking */
        if (this._travelWatch) { navigator.geolocation.clearWatch(this._travelWatch); this._travelWatch = null }
        if (this._meetingTimer) { clearInterval(this._meetingTimer); this._meetingTimer = null }
        showLoad('Checking Out', 'Recording location...');
        this._geoCheck(async function (geo) {
          try {
            var timeNow = U.time();
            var upd = { out: timeNow, outTs: new Date().toISOString() };
            if (geo) {
              upd.outLat = geo.lat; upd.outLng = geo.lng; upd.outDist = geo.dist; upd.outNear = geo.near;
              upd.outStatus = geo.near ? 'At Office' : 'Remote Logout'; upd.outOffice = geo.near ? geo.officeName : ''
            }
            else { upd.outStatus = 'No GPS' }
            var isEarly = timeNow < C.END_TIME;
            if (isEarly) {
              var flags = []; try { var rec = _att.find(function (a) { return a.id === _myAttId }); if (rec && rec.flags) flags = rec.flags } catch (e) { }
              if (flags.indexOf('early') === -1) flags.push('early');
              upd.flags = flags;
            }
            await F.up('attendance/' + _myAttId, upd);
            _att = F.arr(await F.g('attendance'));
            if (_officeTimer) clearInterval(_officeTimer);
            S.p('ok');
            U.toast('✅ Checked out at ' + timeNow + (isEarly ? ' (Early)' : ''), 'ok');
            App.jgo('done');
            document.getElementById('done-detail').textContent = _loginTime + ' → ' + timeNow + ' · ' + (geo && geo.near ? geo.officeName : 'Remote');
            App.renderDayTimeline('done-tl-items');
            App.renderDoneTotals();
          } catch (e) { U.toast('Error', 'err') }
          hideLoad();
        });
      },

      /* ═══════════════════════════════════════
         DONE TOTALS
         ═══════════════════════════════════════ */
      renderDoneTotals: function () {
        var today = U.today();
        var myToday = _att.filter(function (a) { return a.userId === ME.id && a.date === today });
        var totalMin = 0, sessions = myToday.length;
        var firstIn = '', lastOut = '';
        myToday.sort(function (a, b) { return (a.time || '').localeCompare(b.time || '') });
        myToday.forEach(function (s) {
          if (!firstIn || s.time < firstIn) firstIn = s.time;
          if (s.out && (!lastOut || s.out > lastOut)) lastOut = s.out;
          if (s.out && s.time) {
            var inP = s.time.split(':'), outP = s.out.split(':');
            var mins = (parseInt(outP[0]) * 60 + parseInt(outP[1])) - (parseInt(inP[0]) * 60 + parseInt(inP[1]));
            if (mins > 0) totalMin += mins;
          }
        });
        var h = Math.floor(totalMin / 60), m = totalMin % 60;
        var html = '';
        html += '<div class="ls"><div class="ls-n">' + sessions + '</div><div class="ls-l">Sessions</div></div>';
        html += '<div class="ls"><div class="ls-n">' + (h ? h + 'h' : '') + (m < 10 ? '0' : '') + m + 'm</div><div class="ls-l">Total Time</div></div>';
        html += '<div class="ls"><div class="ls-n">' + (firstIn || '—') + '</div><div class="ls-l">First In</div></div>';
        html += '<div class="ls"><div class="ls-n">' + (lastOut || '—') + '</div><div class="ls-l">Last Out</div></div>';
        document.getElementById('done-totals').innerHTML = html;
      },

      /* ═══════════════════════════════════════
         MY ATTENDANCE TAB
         ═══════════════════════════════════════ */
      _payrollCfg: null,
      _holidays: {},
      _offDays: {},
      _leaves: [],

      loadMyAtt: async function (period) {
        S.p('click');
        document.getElementById('att-f-week').classList.toggle('on', period === 'week');
        document.getElementById('att-f-month').classList.toggle('on', period === 'month');
        var now = new Date(); var start;
        if (period === 'week') { var day = now.getDay() || 7; var mon = new Date(now); mon.setDate(now.getDate() - (day - 1)); start = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0') }
        else { start = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01' }
        var todayStr = U.today();

        /* Load ALL config fresh every time */
        try {
          this._payrollCfg = await F.g('adminConfig/payroll') || { deductionMode: 'salary', monthlyLeaves: 2, flatLate: 200, flatAbsent: 500 };
          this._holidays = await F.g('adminConfig/holidays') || {};
          this._leaves = F.arr(await F.g('leaves'));
          this._offDays = await F.g('adminConfig/offDays') || {};
        } catch (e) { console.error('Config load:', e) }

        var cfg = this._payrollCfg;
        /* Get user salary */
        var salary = 0;
        try { var userData = await F.g('users/' + ME.id); if (userData && userData.salary) salary = userData.salary } catch (e) { }
        var dailyRate = salary ? Math.round(salary / 30) : 0;
        var hourlyRate = dailyRate ? Math.round(dailyRate / 8) : 0;

        /* Build leave lookup for me */
        var lvLookup = {};
        this._leaves.forEach(function (l) {
          if (l.status !== 'approved' || l.userId !== ME.id) return;
          var cur = new Date(l.date + 'T00:00:00'); var end = new Date((l.dateTo || l.date) + 'T00:00:00');
          while (cur <= end) { var ds = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0'); lvLookup[ds] = (lvLookup[ds] || 0) + (l.leaveDay === 'half' ? 0.5 : 1); cur.setDate(cur.getDate() + 1) }
        });

        var myA = (_att || []).filter(function (a) { return a.userId === ME.id && a.date >= start && a.date <= todayStr }).sort(function (a, b) { return b.date > a.date ? 1 : b.date < a.date ? -1 : 0 });
        var attByDate = {}; myA.forEach(function (a) { attByDate[a.date] = a });

        /* Calculate stats + deductions */
        var onTime = 0, late = 0, absentDays = 0, leaveDays = 0, holidayDays = 0, workingDays = 0;
        var absentDed = 0, lateDed = 0;
        var dedCut = U.dedCutoff();/* Exclude today if before 11 AM */
        var dc = new Date(start + 'T00:00:00'), de = new Date(dedCut + 'T00:00:00');
        while (dc <= de) {
          var ds = dc.getFullYear() + '-' + String(dc.getMonth() + 1).padStart(2, '0') + '-' + String(dc.getDate()).padStart(2, '0');
          var isSun = dc.getDay() === 0;
          var isHol = this._holidays[ds];
          var isOffDay = App._offDays[ds];
          if (!isSun && !isHol && !isOffDay) {
            workingDays++;
            var lvVal = lvLookup[ds] || 0;
            if (lvVal >= 1) { leaveDays++ }
            else if (lvVal === 0.5) {
              leaveDays += 0.5;
              /* Half day leave: check if they attended the other half */
              if (attByDate[ds]) {
                if ((attByDate[ds].time || '') > C.START_TIME) { late++; if (cfg.deductionMode === 'salary') lateDed += hourlyRate; else lateDed += cfg.flatLate || 200 }
                else onTime++;
              }
            }
            else if (attByDate[ds]) {
              if ((attByDate[ds].time || '') > C.START_TIME) { late++; if (cfg.deductionMode === 'salary') lateDed += hourlyRate; else lateDed += cfg.flatLate || 200 }
              else onTime++;
            } else {
              absentDays++;
              if (cfg.deductionMode === 'salary') absentDed += dailyRate; else absentDed += cfg.flatAbsent || 500;
            }
          }
          if (isHol && !isSun) holidayDays++;
          dc.setDate(dc.getDate() + 1);
        }
        var totalDed = absentDed + lateDed;

        /* Stats row */
        document.getElementById('my-att-stats').innerHTML =
          '<div class="ls"><div class="ls-n" style="color:var(--grn)">' + onTime + '</div><div class="ls-l">On Time</div></div>' +
          '<div class="ls"><div class="ls-n" style="color:var(--amb)">' + late + '</div><div class="ls-l">Late</div></div>' +
          '<div class="ls"><div class="ls-n" style="color:var(--R)">' + absentDays + '</div><div class="ls-l">Absent</div></div>' +
          '<div class="ls"><div class="ls-n" style="color:var(--blu)">' + leaveDays + '</div><div class="ls-l">Leave</div></div>';

        /* Deduction card */
        if (salary > 0) {
          document.getElementById('my-ded-card').style.display = 'block';
          var dh = '';
          dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span style="color:var(--G5)">Basic Salary</span><span style="font-weight:700">Rs ' + salary.toLocaleString() + '</span></div>';
          dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span style="color:var(--G5)">Daily Rate (÷30)</span><span style="font-weight:700">Rs ' + dailyRate.toLocaleString() + '</span></div>';
          dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span style="color:var(--G5)">Hourly Rate (÷8)</span><span style="font-weight:700">Rs ' + hourlyRate.toLocaleString() + '</span></div>';
          dh += '<div style="border-top:1px solid var(--G8);margin:4px 0"></div>';
          if (absentDays > 0) dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--R)">❌ Absent (' + absentDays + 'd × Rs ' + dailyRate + ')</span><span style="font-weight:800;color:var(--R)">Rs ' + absentDed.toLocaleString() + '</span></div>';
          if (late > 0) dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--amb)">⏰ Late (' + late + 'd × Rs ' + hourlyRate + ')</span><span style="font-weight:800;color:var(--amb)">Rs ' + lateDed.toLocaleString() + '</span></div>';
          if (leaveDays > 0) dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--blu)">📋 Approved Leave</span><span style="font-weight:700;color:var(--blu)">' + leaveDays + ' days (no deduction)</span></div>';
          if (holidayDays > 0) dh += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--G5)">🎉 Holidays</span><span style="font-weight:700">' + holidayDays + ' days</span></div>';
          document.getElementById('my-ded-rows').innerHTML = dh;
          document.getElementById('my-ded-total').textContent = 'Rs ' + totalDed.toLocaleString();
        } else {
          document.getElementById('my-ded-card').style.display = 'none';
        }

        /* Day list */
        var h = '';
        if (!myA.length && !absentDays) { h = '<div style="text-align:center;padding:20px;font-size:13px;color:var(--G5)">No attendance records</div>' }

        /* Build day-by-day list */
        var dc2 = new Date(todayStr + 'T00:00:00');
        var dStart = new Date(start + 'T00:00:00');
        while (dc2 >= dStart) {
          var ds2 = dc2.getFullYear() + '-' + String(dc2.getMonth() + 1).padStart(2, '0') + '-' + String(dc2.getDate()).padStart(2, '0');
          var isSun2 = dc2.getDay() === 0;
          var isHol2 = this._holidays[ds2];
          var isOffDay2 = App._offDays[ds2];
          var isLeave2 = lvLookup[ds2];
          var att2 = attByDate[ds2];
          var dateStr2 = dc2.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

          if (isSun2) {
            h += '<div style="background:var(--G9);border-radius:8px;padding:8px 12px;margin-bottom:3px;opacity:.5;display:flex;justify-content:space-between;font-size:11px"><span>' + dateStr2 + '</span><span style="color:var(--G5)">Sunday</span></div>';
          } else if (isHol2) {
            h += '<div style="background:var(--blu-bg);border:1px solid var(--blu);border-radius:8px;padding:8px 12px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:11px"><span>' + dateStr2 + '</span><span style="color:var(--blu);font-weight:700">🎉 ' + isHol2 + '</span></div>';
          } else if (isOffDay2) {
            h += '<div style="background:var(--G9);border:1px solid var(--G7);border-radius:8px;padding:8px 12px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:11px"><span>' + dateStr2 + '</span><span style="color:var(--G5);font-weight:700">🚫 ' + isOffDay2 + '</span></div>';
          } else if (isLeave2 >= 1) {
            h += '<div style="background:var(--blu-bg);border:1px solid var(--blu);border-left:3px solid var(--blu);border-radius:8px;padding:8px 12px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:11px"><span style="font-weight:700">' + dateStr2 + '</span><span style="color:var(--blu);font-weight:700">📋 Approved Leave</span></div>';
          } else if (isLeave2 === 0.5) {
            h += '<div style="background:#fefce8;border:1px solid #fbbf24;border-left:3px solid #fbbf24;border-radius:8px;padding:8px 12px;margin-bottom:3px;display:flex;justify-content:space-between;font-size:11px"><span style="font-weight:700">' + dateStr2 + '</span><span style="color:#d97706;font-weight:700">📋 ½ Day Leave</span></div>';
          } else if (att2) {
            var isLate2 = (att2.time || '') > C.START_TIME;
            var inLoc2 = att2.inNear === true ? '🏢 ' + (att2.inOffice || '') : '📍 Away';
            var outInfo2 = att2.out ? '→ ' + att2.out : '<span style="color:var(--amb)">Active</span>';
            var hrs2 = '';
            if (att2.time && att2.out) { var mins2 = ((parseInt(att2.out.split(':')[0]) * 60 + parseInt(att2.out.split(':')[1])) - (parseInt(att2.time.split(':')[0]) * 60 + parseInt(att2.time.split(':')[1]))); if (mins2 > 0) hrs2 = ' · ' + (mins2 / 60).toFixed(1) + 'h' }
            var dedText = isLate2 && hourlyRate ? ' · <span style="color:var(--R)">-Rs ' + hourlyRate + '</span>' : '';
            h += '<div style="background:var(--W);border:2px solid var(--G8);border-left:4px solid ' + (isLate2 ? 'var(--amb)' : 'var(--grn)') + ';border-radius:8px;padding:8px 12px;margin-bottom:3px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700">' + dateStr2 + '</span><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:' + (isLate2 ? 'var(--amb-bg)' : 'var(--grn-bg)') + ';color:' + (isLate2 ? 'var(--amb)' : 'var(--grn)') + '">' + (isLate2 ? '⏰ Late' : '✅') + '</span></div>';
            h += '<div style="font-size:11px;color:var(--G5);margin-top:3px">' + att2.time + ' ' + outInfo2 + hrs2 + dedText + '</div>';
            h += '<div style="font-size:10px;color:var(--G5);margin-top:1px">' + inLoc2 + '</div></div>';
          } else {
            var dedText2 = dailyRate ? ' · <span style="color:var(--R);font-weight:800">-Rs ' + dailyRate.toLocaleString() + '</span>' : '';
            h += '<div style="background:var(--Rbg);border:1px solid var(--R);border-left:4px solid var(--R);border-radius:8px;padding:8px 12px;margin-bottom:3px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700">' + dateStr2 + '</span><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--Rbg);color:var(--R)">❌ Absent</span></div>';
            h += '<div style="font-size:11px;color:var(--R);margin-top:3px">No attendance' + dedText2 + '</div></div>';
          }
          dc2.setDate(dc2.getDate() - 1);
        }
        document.getElementById('my-att-list').innerHTML = h;
        /* Load my leaves */
        this.loadMyLeaves();
      },

      /* ═══ LEAVE APPLICATION ═══ */
      applyLeave: async function () {
        var from = document.getElementById('lv-from').value;
        var to = document.getElementById('lv-to').value || from;
        var reason = document.getElementById('lv-reason').value.trim();
        var leaveDay = document.getElementById('lv-type').value || 'full';
        var halfType = leaveDay === 'half' ? document.getElementById('lv-half').value : '';
        if (!from) { U.toast('Select date', 'warn'); return }
        if (!reason) { U.toast('Enter reason', 'warn'); return }
        if (leaveDay === 'half') { to = from }
        var d1 = new Date(from + 'T00:00:00'), d2 = new Date(to + 'T00:00:00');
        var days = leaveDay === 'half' ? 0.5 : Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1; if (days < 0.5) days = 0.5;
        showLoad('Submitting', 'Applying for leave...');
        try {
          await F.push('leaves', {
            userId: ME.id, userName: ME.name, date: from, dateTo: to, days: days, leaveDay: leaveDay, halfType: halfType,
            reason: reason, status: 'pending', adminApproved: false,
            ts: new Date().toISOString()
          });
          U.toast('Leave application submitted — pending approval', 'ok'); S.p('ok');
          document.getElementById('lv-from').value = ''; document.getElementById('lv-to').value = ''; document.getElementById('lv-reason').value = ''; document.getElementById('lv-type').value = 'full'; document.getElementById('lv-half-wrap').style.display = 'none'; document.getElementById('lv-to').disabled = false;
          this._leaves = F.arr(await F.g('leaves'));
          this.loadMyLeaves();
        } catch (e) { U.toast('Error', 'err') }
        hideLoad();
      },

      loadMyLeaves: function () {
        var myLvs = (this._leaves || []).filter(function (l) { return l.userId === ME.id }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') });
        if (!myLvs.length) { document.getElementById('my-lv-list').innerHTML = '<div style="text-align:center;padding:12px;font-size:12px;color:var(--G5)">No leave records</div>'; return }
        var h = '';
        myLvs.forEach(function (l) {
          var stCls = l.status === 'approved' ? 'color:var(--grn)' : l.status === 'rejected' ? 'color:var(--R)' : 'color:var(--amb)';
          var stTxt = l.status === 'approved' ? '✅ Approved' : l.status === 'rejected' ? '❌ Rejected' : '⏳ Pending';
          var admin = l.adminApproved ? ' (Admin)' : '';
          var halfBadge = l.leaveDay === 'half' ? '<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#d97706;margin-left:4px">½ ' + (l.halfType === 'first' ? 'Morning' : 'Afternoon') + '</span>' : '';
          var daysTxt = l.leaveDay === 'half' ? '½d' : l.days + 'd';
          h += '<div style="background:var(--W);border:2px solid var(--G8);border-radius:8px;padding:10px 12px;margin-bottom:4px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700">' + l.date + (l.dateTo && l.dateTo !== l.date ? ' → ' + l.dateTo : '') + ' (' + daysTxt + ')' + halfBadge + '</span><span style="font-size:10px;font-weight:700;' + stCls + '">' + stTxt + admin + '</span></div>';
          h += '<div style="font-size:11px;color:var(--G5);margin-top:3px">' + (l.reason || '—') + '</div></div>';
        });
        document.getElementById('my-lv-list').innerHTML = h;
      },

      /* ═══════════════════════════════════════
         MY VISITS TAB
         ═══════════════════════════════════════ */
      loadMyVisits: function (period) {
        S.p('click');
        document.getElementById('vis-f-week').classList.toggle('on', period === 'week');
        document.getElementById('vis-f-month').classList.toggle('on', period === 'month');
        var now = new Date(); var start;
        if (period === 'week') { var day = now.getDay() || 7; var mon = new Date(now); mon.setDate(now.getDate() - (day - 1)); start = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0') }
        else { start = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01' }
        /* Visits from attendance stops */
        var myA = (_att || []).filter(function (a) { return a.userId === ME.id && a.date >= start && a.stops });
        var visits = [];
        myA.forEach(function (a) {
          if (!a.stops) return;
          a.stops.forEach(function (s) {
            if (s.type === 'client') visits.push({ date: a.date, client: s.clientName || '—', type: s.clientType || '', purpose: s.purpose || '', outcome: s.outcome || '', duration: s.duration || 0, km: s.km || 0, inTime: s.in || '', outTime: s.out || '' });
          });
        });
        /* Also from reports type=visit */
        var myVR = (_rpts || []).filter(function (r) { return r.userId === ME.id && r.type === 'visit' && r.date >= start });
        myVR.forEach(function (r) { visits.push({ date: r.date, client: r.client || '—', type: 'visit-report', purpose: '', outcome: r.outcome || '', duration: 0, km: parseFloat(r.km) || 0, inTime: r.time || '' }) });
        visits.sort(function (a, b) { return b.date > a.date ? 1 : b.date < a.date ? -1 : 0 });

        /* Stats */
        var totalKm = 0; visits.forEach(function (v) { totalKm += parseFloat(v.km) || 0 });
        var uniqueClients = {}; visits.forEach(function (v) { uniqueClients[v.client] = true });
        document.getElementById('my-vis-stats').innerHTML =
          '<div class="ls"><div class="ls-n">' + visits.length + '</div><div class="ls-l">Visits</div></div>' +
          '<div class="ls"><div class="ls-n">' + Object.keys(uniqueClients).length + '</div><div class="ls-l">Clients</div></div>' +
          '<div class="ls"><div class="ls-n">' + totalKm.toFixed(1) + '</div><div class="ls-l">KM</div></div>' +
          '<div class="ls"><div class="ls-n">Rs ' + Math.round(totalKm * C.KM_RATE) + '</div><div class="ls-l">Claim</div></div>';
        /* List */
        var h = '';
        if (!visits.length) { h = '<div style="text-align:center;padding:20px;font-size:13px;color:var(--G5)">No visits found</div>' }
        visits.forEach(function (v) {
          var dateStr = new Date(v.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          var outBadge = v.outcome ? '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--grn-bg);color:var(--grn)">' + v.outcome + '</span>' : '';
          h += '<div style="background:var(--W);border:2px solid var(--G8);border-left:4px solid var(--blu);border-radius:10px;padding:10px 12px;margin-bottom:4px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:800;color:var(--G2)">📍 ' + v.client + '</span>' + outBadge + '</div>';
          h += '<div style="font-size:11px;color:var(--G5);margin-top:4px">' + dateStr + (v.inTime ? ' · ' + v.inTime : '') + (v.outTime ? ' → ' + v.outTime : '') + (v.duration ? ' · ' + v.duration + 'm' : '') + '</div>';
          if (v.km) h += '<div style="font-size:10px;color:var(--G5);margin-top:2px">🚗 ' + v.km + ' km · Rs ' + Math.round(parseFloat(v.km) * C.KM_RATE) + '</div>';
          h += '</div>';
        });
        document.getElementById('my-vis-list').innerHTML = h;
      },

      /* ═══ HOME — QUICK LEAVE + RECENT ═══ */
      quickLeave: async function () {
        var from = document.getElementById('hlv-from').value;
        var to = document.getElementById('hlv-to').value || from;
        var reason = document.getElementById('hlv-reason').value.trim();
        var leaveDay = document.getElementById('hlv-type').value || 'full';
        var halfType = leaveDay === 'half' ? document.getElementById('hlv-half').value : '';
        if (!from) { U.toast('Select date', 'warn'); return }
        if (!reason) { U.toast('Enter reason', 'warn'); return }
        if (leaveDay === 'half') { to = from }
        var d1 = new Date(from + 'T00:00:00'), d2 = new Date(to + 'T00:00:00');
        var days = leaveDay === 'half' ? 0.5 : Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1; if (days < 0.5) days = 0.5;
        try {
          await F.push('leaves', { userId: ME.id, userName: ME.name, date: from, dateTo: to, days: days, leaveDay: leaveDay, halfType: halfType, reason: reason, status: 'pending', adminApproved: false, ts: new Date().toISOString() });
          U.toast('Leave submitted — pending approval ✅', 'ok'); S.p('ok');
          document.getElementById('hlv-from').value = ''; document.getElementById('hlv-to').value = ''; document.getElementById('hlv-reason').value = ''; document.getElementById('hlv-type').value = 'full'; document.getElementById('hlv-half-wrap').style.display = 'none'; document.getElementById('hlv-to').disabled = false;
          this._leaves = F.arr(await F.g('leaves'));
        } catch (e) { U.toast('Error', 'err') }
      },

      loadHomeRecent: function () {
        var recent = (_rpts || []).filter(function (r) { return r.userId === ME.id }).sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || '') }).slice(0, 5);
        var recentAtt = (_att || []).filter(function (a) { return a.userId === ME.id }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') }).slice(0, 3);
        if (!recent.length && !recentAtt.length) { document.getElementById('home-recent').innerHTML = '<div style="font-size:12px;color:var(--G5);text-align:center;padding:10px">No recent activity</div>'; return }
        var h = '';
        recentAtt.forEach(function (a) {
          var isLate = (a.time || '') > C.START_TIME;
          var dateStr = new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          h += '<div style="background:var(--W);border:1px solid var(--G8);border-left:3px solid ' + (isLate ? 'var(--amb)' : 'var(--grn)') + ';border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:11px">';
          h += '<span style="font-weight:700">' + (isLate ? '⏰' : '✅') + ' ' + dateStr + '</span> · ' + a.time + (a.out ? ' → ' + a.out : '') + '</div>';
        });
        recent.forEach(function (r) {
          var isAct = r.type === 'activity';
          var dateStr = new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          var preview = (r.message || r.client || '').substring(0, 60);
          h += '<div style="background:var(--W);border:1px solid var(--G8);border-left:3px solid ' + (isAct ? 'var(--grn)' : 'var(--blu)') + ';border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:11px">';
          h += '<span style="font-weight:700">' + (isAct ? '📝' : '📍') + ' ' + dateStr + '</span> · ' + preview + '</div>';
        });
        document.getElementById('home-recent').innerHTML = h;
      },

      /* ═══════════════════════════════════════
         ACTIVITY REPORT
         ═══════════════════════════════════════ */
      setDateMode: function (mode) {
        _dateMode = mode;
        document.getElementById('a-dm-today').classList.toggle('on', mode === 'today');
        document.getElementById('a-dm-old').classList.toggle('on', mode === 'old');
        document.getElementById('a-date-pick').style.display = mode === 'old' ? 'block' : 'none';
        if (mode === 'today') {
          document.getElementById('a-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        }
      },

      _getFormDate: function () {
        if (_dateMode === 'old') {
          var d = document.getElementById('a-old-date').value;
          if (!d) { U.toast('Select date', 'warn'); return null }
          if (d >= U.today()) { U.toast('Must be past date', 'warn'); return null }
          /* Find last working day (skip Sundays) */
          var lastWD = new Date();
          do { lastWD.setDate(lastWD.getDate() - 1) } while (lastWD.getDay() === 0);
          var lwdStr = lastWD.getFullYear() + '-' + String(lastWD.getMonth() + 1).padStart(2, '0') + '-' + String(lastWD.getDate()).padStart(2, '0');
          if (d < lwdStr) { U.toast('Only last working day allowed: ' + lwdStr, 'warn'); return null }
          return d;
        }
        return U.today();
      },

      _acalY: 0, _acalM: 0,

      initActPage: function () {
        this.setDateMode('today');
        this.initTags();
        this.loadDraft();
        document.getElementById('a-msg-wc').textContent = '0/' + C.MAX_WORDS;
        this.renderTodaySubmissions();
        this.render7Days();
        var now = new Date(); this._acalY = now.getFullYear(); this._acalM = now.getMonth();
        this.renderActCal();
      },

      renderTodaySubmissions: function () {
        var todayStr = U.today();
        var todayRpts = (_rpts || []).filter(function (r) { return r.userId === ME.id && r.type === 'activity' && r.date === todayStr })
          .sort(function (a, b) { return (a.ts || '').localeCompare(b.ts || '') });
        var count = todayRpts.length;
        var d = new Date();
        document.getElementById('a-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        if (count === 0) {
          document.getElementById('a-title').textContent = '📝 Daily Activity';
          document.getElementById('a-submitted').style.display = 'none';
          document.getElementById('a-maxed').style.display = 'none';
          document.getElementById('a-form-wrap').style.display = 'block';
          document.getElementById('a-btn').textContent = 'Submit ✓';
        } else if (count < 3) {
          var label = count === 1 ? '📝 Submit Update' : '📝 Submit Update #' + (count + 1);
          document.getElementById('a-title').textContent = label;
          document.getElementById('a-submitted').style.display = 'block';
          document.getElementById('a-maxed').style.display = 'none';
          document.getElementById('a-form-wrap').style.display = 'block';
          document.getElementById('a-btn').textContent = 'Submit Update #' + (count + 1) + ' ✓';
          this._renderSubmittedCards(todayRpts);
        } else {
          document.getElementById('a-title').textContent = '✅ Activity Complete';
          document.getElementById('a-submitted').style.display = 'block';
          document.getElementById('a-maxed').style.display = 'block';
          document.getElementById('a-form-wrap').style.display = 'none';
          var labels = todayRpts.map(function (r) { return r.reportLabel || 'Report' }).join(' + ');
          document.getElementById('a-maxed-sub').textContent = labels;
          this._renderSubmittedCards(todayRpts);
        }
      },

      _renderSubmittedCards: function (reports) {
        var h = '';
        reports.forEach(function (r, i) {
          var timeStr = r.time || '—';
          var tags = r.tags && r.tags.length ? r.tags.map(function (t) { return '<span style="font-size:9px;color:var(--R);font-weight:600">#' + t + '</span>' }).join(' ') : '';
          var lateBadge = r.lateReport ? ' <span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--amb-bg);color:var(--amb)">⏰ Late</span>' : '';
          var label = r.reportLabel || (i === 0 ? 'Activity Report' : 'Update #' + (i + 1));
          var preview = (r.message || '').substring(0, 100); if (preview.length >= 100) preview += '...';
          h += '<div style="background:var(--W);border:2px solid var(--grn);border-left:4px solid var(--grn);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="this.querySelector(\'.sub-full\').style.display=this.querySelector(\'.sub-full\').style.display===\'none\'?\'block\':\'none\'">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<span style="font-size:12px;font-weight:800;color:var(--grn)">✅ ' + label + '</span>';
          h += '<span style="font-size:10px;color:var(--G5)">' + timeStr + lateBadge + '</span></div>';
          h += '<div style="font-size:12px;color:var(--G3);margin-top:4px;line-height:1.4">' + preview + '</div>';
          if (tags) h += '<div style="margin-top:3px">' + tags + '</div>';
          h += '<div class="sub-full" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--G8);font-size:12px;color:var(--G2);line-height:1.5;white-space:pre-wrap">' + (r.message || '') + '</div>';
          h += '<div style="font-size:9px;color:var(--G7);margin-top:4px;text-align:center">tap to expand ↕</div></div>';
        });
        document.getElementById('a-submitted').innerHTML = h;
      },

      setActTitle: function () { this.renderTodaySubmissions() },

      /* ═══ LAST 7 DAYS VIEW ═══ */
      render7Days: function () {
        var myR = (_rpts || []).filter(function (r) { return r.userId === ME.id && r.type === 'activity' });
        var rByDate = {}; myR.forEach(function (r) { if (!rByDate[r.date]) rByDate[r.date] = []; rByDate[r.date].push(r) });
        var todayStr = U.today();
        /* Find last working day for "Submit Now" */
        var lastWD = new Date();
        do { lastWD.setDate(lastWD.getDate() - 1) } while (lastWD.getDay() === 0);
        var lwdStr = lastWD.getFullYear() + '-' + String(lastWD.getMonth() + 1).padStart(2, '0') + '-' + String(lastWD.getDate()).padStart(2, '0');

        var h = '';
        for (var i = 0; i < 7; i++) {
          var d = new Date(); d.setDate(d.getDate() - i);
          var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          var dayName = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          var isSun = d.getDay() === 0;
          var isFuture = ds > todayStr;
          var reports = rByDate[ds] || [];
          var isToday = ds === todayStr;

          if (isSun) {
            h += '<div style="background:var(--W);border:2px solid var(--G8);border-radius:10px;padding:10px 12px;margin-bottom:4px;opacity:.5;display:flex;justify-content:space-between;align-items:center">';
            h += '<span style="font-size:12px;font-weight:600;color:var(--G5)">' + dayName + '</span>';
            h += '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--G9);color:var(--G5)">⚪ Sunday</span>';
            h += '</div>';
          } else if (reports.length > 0) {
            var r = reports[reports.length - 1];
            var preview = (r.message || '').substring(0, 80); if (preview.length >= 80) preview += '...';
            var tags = r.tags && r.tags.length ? r.tags.slice(0, 4).map(function (t) { return '<span style="font-size:9px;color:var(--R);font-weight:600">#' + t + '</span>' }).join(' ') : '';
            var lateBadge = r.lateReport ? '<span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--amb-bg);color:var(--amb)">⏰ Late</span>' : '';
            var statusBadge = isToday ? '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--grn-bg);color:var(--grn)">✅ Today</span>' : '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--grn-bg);color:var(--grn)">✅ Done</span>';
            if (reports.length > 1) statusBadge += ' <span style="font-size:8px;color:var(--G5)">×' + reports.length + '</span>';
            h += '<div style="background:var(--W);border:2px solid var(--G8);border-left:4px solid var(--grn);border-radius:10px;padding:10px 12px;margin-bottom:4px;cursor:pointer" onclick="this.querySelector(\'.a7d\').style.display=this.querySelector(\'.a7d\').style.display===\'none\'?\'block\':\'none\'">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700;color:var(--G2)">' + dayName + '</span><span>' + statusBadge + ' ' + lateBadge + '</span></div>';
            h += '<div style="font-size:11px;color:var(--G5);margin-top:4px;line-height:1.4">' + preview + '</div>';
            if (tags) h += '<div style="margin-top:3px">' + tags + '</div>';
            h += '<div class="a7d" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--G8);font-size:12px;color:var(--G3);line-height:1.5;white-space:pre-wrap">';
            reports.forEach(function (rp, idx) {
              h += '<div style="' + (idx > 0 ? 'margin-top:8px;padding-top:8px;border-top:1px dashed var(--G8);' : '') + '">';
              h += '<div style="font-size:10px;color:var(--G5);margin-bottom:2px">' + (rp.reportLabel || 'Report') + ' · ' + rp.time + '</div>';
              h += (rp.message || '');
              h += '</div>';
            });
            h += '</div></div>';
          } else if (!isFuture) {
            /* Missing */
            var canSubmit = ds === lwdStr || ds === todayStr;
            h += '<div style="background:var(--W);border:2px solid var(--G8);border-left:4px solid var(--R);border-radius:10px;padding:10px 12px;margin-bottom:4px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700;color:var(--G2)">' + dayName + '</span>';
            h += '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--Rbg);color:var(--R)">❌ Missing</span></div>';
            h += '<div style="font-size:11px;color:var(--G5);margin-top:3px">No activity report submitted</div>';
            if (canSubmit && !isToday) {
              h += '<button class="jbtn jbtn-ghost" style="margin-top:6px;font-size:11px;padding:6px 12px;width:auto;color:var(--R);border-color:var(--Rl)" onclick="App.quickSubmitOld(\'' + ds + '\')">📝 Submit Now</button>';
            }
            h += '</div>';
          }
        }
        document.getElementById('a7-list').innerHTML = h;
      },

      quickSubmitOld: function (date) {
        S.p('click');
        this.setDateMode('old');
        document.getElementById('a-old-date').value = date;
        window.scrollTo(0, 0);
        document.getElementById('a-msg').focus();
        U.toast('Enter report for ' + date, 'info');
      },

      /* ═══ MONTHLY ACTIVITY CALENDAR ═══ */
      acalNav: function (dir) {
        this._acalM += dir;
        if (this._acalM < 0) { this._acalM = 11; this._acalY-- }
        if (this._acalM > 11) { this._acalM = 0; this._acalY++ }
        this.renderActCal();
      },

      renderActCal: function () {
        var y = this._acalY, m = this._acalM;
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('acal-title').textContent = months[m] + ' ' + y;

        var myR = (_rpts || []).filter(function (r) { return r.userId === ME.id && r.type === 'activity' });
        var rDates = {}; myR.forEach(function (r) { rDates[r.date] = true });

        var first = new Date(y, m, 1); var lastDay = new Date(y, m + 1, 0).getDate();
        var startDay = (first.getDay() + 6) % 7; /* Monday=0 */
        var todayStr = U.today();

        var h = ''; var submitted = 0, missing = 0, lateRpt = 0;

        /* Empty cells before first day */
        for (var e = 0; e < startDay; e++) h += '<div style="padding:6px"></div>';

        for (var d = 1; d <= lastDay; d++) {
          var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var dt = new Date(y, m, d);
          var isSun = dt.getDay() === 0;
          var isFuture = ds > todayStr;
          var isToday = ds === todayStr;
          var has = rDates[ds];

          var bg = 'var(--W)'; var clr = 'var(--G2)'; var border = '1px solid var(--G8)'; var dot = '';
          if (isSun) { clr = 'var(--G7)'; bg = 'var(--G9)' }
          else if (isFuture) { clr = 'var(--G7)' }
          else if (has) { bg = 'var(--grn-bg)'; border = '2px solid var(--grn)'; dot = '🟢'; submitted++ }
          else { bg = 'var(--Rbg)'; border = '2px solid var(--R)'; dot = '🔴'; missing++ }
          if (isToday) border = '2px solid var(--G2)';

          /* Check late reports */
          var dayRpts = myR.filter(function (r) { return r.date === ds && r.lateReport });
          if (dayRpts.length) lateRpt++;

          h += '<div style="padding:4px 2px;text-align:center;background:' + bg + ';border:' + border + ';border-radius:6px;font-size:12px;font-weight:700;color:' + clr + ';min-height:32px;display:flex;flex-direction:column;align-items:center;justify-content:center">';
          h += d;
          if (dot) h += '<div style="font-size:6px;line-height:1">' + dot + '</div>';
          h += '</div>';
        }

        document.getElementById('acal-grid').innerHTML = h;
        document.getElementById('acal-sum').textContent = months[m] + ': ✅ ' + submitted + ' submitted · ❌ ' + missing + ' missing' + (lateRpt ? ' · ⏰ ' + lateRpt + ' late' : '');
      },

      initTags: function () {
        document.getElementById('a-tags').innerHTML = C.TAGS.map(function (t) {
          return '<div class="purp-chip" style="font-size:10px;padding:4px 8px" onclick="App.togTag(this,\'' + t + '\')">#' + t + '</div>';
        }).join('');
      },

      togTag: function (el, tag) {
        el.classList.toggle('on');
        var ta = document.getElementById('a-msg');
        var ht = '#' + tag;
        if (el.classList.contains('on')) {
          if (ta.value.indexOf(ht) === -1) ta.value = ta.value.trim() + (ta.value.trim() ? ' ' : '') + ht;
        } else {
          ta.value = ta.value.replace(new RegExp('\\s*' + ht, 'g'), '').trim();
        }
        this.wordCheck(ta);
      },

      wordCheck: function (el) {
        var words = el.value.trim() ? el.value.trim().split(/\s+/).length : 0;
        var wc = document.getElementById('a-msg-wc');
        wc.textContent = words + '/' + C.MAX_WORDS;
        if (words > C.MAX_WORDS) {
          wc.style.color = 'var(--R)';
          el.value = el.value.trim().split(/\s+/).slice(0, C.MAX_WORDS).join(' ');
          wc.textContent = C.MAX_WORDS + '/' + C.MAX_WORDS;
        } else {
          wc.style.color = 'var(--G5)';
        }
      },

      saveDraft: async function () {
        try {
          var data = { msg: document.getElementById('a-msg').value, dateMode: _dateMode, oldDate: document.getElementById('a-old-date').value };
          await F.set('drafts/' + ME.id + '/a', data);
          document.getElementById('a-draft-badge').style.display = 'inline-block';
          U.toast('💾 Draft saved', 'ok'); S.p('click');
        } catch (e) { U.toast('Error saving draft', 'err') }
      },

      loadDraft: async function () {
        try {
          var d = await F.g('drafts/' + ME.id + '/a');
          if (!d || !d.msg) return;
          document.getElementById('a-msg').value = d.msg || '';
          if (d.dateMode === 'old') { this.setDateMode('old'); document.getElementById('a-old-date').value = d.oldDate || '' }
          document.getElementById('a-draft-badge').style.display = 'inline-block';
          /* Sync tag highlights */
          var msg = d.msg || '';
          document.querySelectorAll('#a-tags .purp-chip').forEach(function (c) {
            var tag = c.textContent;
            c.classList.toggle('on', msg.indexOf(tag) >= 0);
          });
        } catch (e) { }
      },

      clearActForm: function () {
        document.getElementById('a-msg').value = '';
        this.initTags();
        this.setDateMode('today');
        document.getElementById('a-msg-wc').textContent = '0/' + C.MAX_WORDS;
        document.getElementById('a-draft-badge').style.display = 'none';
        S.p('click');
      },

      fetchYesterday: async function () {
        try {
          showLoad('Fetching', 'Loading last report...');
          var rpts = (_rpts.length ? _rpts : F.arr(await F.g('reports'))).filter(function (x) {
            return x.userId === ME.id && x.type === 'activity'
          }).sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || '') });
          hideLoad();
          if (!rpts.length) { U.toast('No previous report found', 'warn'); return }
          var last = rpts[0];
          document.getElementById('a-msg').value = last.message || '';
          U.toast('📥 Fetched from ' + last.date, 'ok'); S.p('click');
          this.wordCheck(document.getElementById('a-msg'));
        } catch (e) { hideLoad(); U.toast('Error', 'err') }
      },

      extractTags: function (text) {
        var m = text.match(/#(\w+)/g);
        return m ? m.filter(function (v, i, a) { return a.indexOf(v) === i }).map(function (t) { return t.slice(1).toLowerCase() }) : [];
      },

      subAct: async function () {
        var msg = document.getElementById('a-msg').value.trim();
        if (!msg) { U.toast('Write report', 'warn'); return }
        var rptDate = this._getFormDate(); if (!rptDate) return;
        var tags = this.extractTags(msg);
        var isOld = rptDate < U.today();
        var existing = (_rpts || []).filter(function (x) { return x.userId === ME.id && x.type === 'activity' && x.date === rptDate });
        if (isOld && existing.length >= 1) { U.toast('❌ Only 1 back-dated report per day', 'err'); S.p('err'); return }
        if (!isOld && existing.length >= 3) { U.toast('❌ Max 3 reports per day', 'err'); S.p('err'); return }
        var seqNum = existing.length + 1;
        var label;
        if (isOld) { label = 'Old Report of ' + new Date(rptDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }
        else if (seqNum === 1) { label = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' Report' }
        else { label = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' Update #' + seqNum }

        var rid = (isOld ? 'OLD-' : '') + rptDate + '-' + (seqNum > 1 ? 'U' + seqNum : 'R1');
        var btn = document.getElementById('a-btn'); btn.innerHTML = '<div class="spinner"></div>'; btn.disabled = true;
        try {
          await F.push('reports', {
            type: 'activity', userId: ME.id, userName: ME.name,
            message: msg, tags: tags, reportId: rid, reportLabel: label,
            date: rptDate, time: U.time(),
            ts: new Date().toISOString(),
            lateReport: isOld, seqNum: seqNum
          });
          try { await F.del('drafts/' + ME.id + '/a') } catch (e) { }
          _rpts = F.arr(await F.g('reports'));
          S.p('ok'); U.toast(label + ' ✅', 'ok');
          this.clearActForm();
          this.renderTodaySubmissions();
          this.render7Days();
          this.renderActCal();
          this.loadStats();
          window.scrollTo(0, 0);
        } catch (e) { U.toast('Error submitting', 'err') }
        finally { btn.innerHTML = 'Submit ✓'; btn.disabled = false }
      },

      /* ═══════════════════════════════════════
         REPORTS TAB — view past reports
         ═══════════════════════════════════════ */
      _rptFilter: 'all',
      _rptOffset: 0,
      _rptFiltered: [],

      filterRpts: function (type, btn) {
        S.p('click');
        this._rptFilter = type; this._rptOffset = 0;
        document.querySelectorAll('#pg-reports .purp-chip').forEach(function (c) { c.classList.remove('on') });
        if (btn) btn.classList.add('on');
        this.renderRpts();
      },

      renderRpts: function () {
        var myR = (_rpts || []).filter(function (r) { return r.userId === ME.id }).sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || '') });
        if (this._rptFilter !== 'all') myR = myR.filter(function (r) { return r.type === App._rptFilter });
        this._rptFiltered = myR; this._rptOffset = 0;
        document.getElementById('rpt-cnt').textContent = myR.length;
        document.getElementById('rpt-list').innerHTML = '';
        if (!myR.length) { document.getElementById('rpt-list').innerHTML = '<div style="text-align:center;padding:20px;font-size:13px;color:var(--G5)">No reports found</div>'; document.getElementById('rpt-more').style.display = 'none'; return }
        this.moreRpts();
      },

      moreRpts: function () {
        var batch = this._rptFiltered.slice(this._rptOffset, this._rptOffset + 10);
        var h = '';
        batch.forEach(function (r) {
          var isAct = r.type === 'activity';
          var typeBadge = isAct ? '<span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--grn-bg);color:var(--grn)">📝 Activity</span>' :
            '<span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--blu-bg);color:var(--blu)">📍 Visit</span>';
          var lateBadge = r.lateReport ? '<span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--amb-bg);color:var(--amb)">⏰ Late</span>' : '';
          var dateStr = r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
          var preview = isAct ? (r.message || '').substring(0, 100) : (r.client || '—') + ' · ' + (r.outcome || '');
          if (preview.length > 100) preview = preview.substring(0, 100) + '...';
          var tags = '';
          if (r.tags && r.tags.length) { tags = r.tags.map(function (t) { return '<span style="font-size:9px;color:var(--R);font-weight:600">#' + t + '</span>' }).join(' ') }
          h += '<div style="background:var(--W);border:2px solid var(--G8);border-radius:12px;padding:12px;margin-bottom:6px;box-shadow:0 2px 0 var(--G7);cursor:pointer" onclick="this.querySelector(\'.rpt-detail\').style.display=this.querySelector(\'.rpt-detail\').style.display===\'none\'?\'block\':\'none\'">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' + typeBadge + ' ' + lateBadge + '</div>' +
            '<div style="font-size:10px;color:var(--G5);font-weight:600">' + dateStr + ' · ' + (r.time || '') + '</div>' +
            '</div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--G2);margin-top:6px;line-height:1.4">' + preview + '</div>' +
            (tags ? '<div style="margin-top:4px">' + tags + '</div>' : '') +
            '<div class="rpt-detail" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--G8);font-size:12px;color:var(--G5);line-height:1.5;white-space:pre-wrap">' + (r.message || r.description || 'No details') + '</div>' +
            '</div>';
        });
        document.getElementById('rpt-list').innerHTML += h;
        this._rptOffset += 10;
        document.getElementById('rpt-more').style.display = this._rptOffset < this._rptFiltered.length ? 'block' : 'none';
      },

      /* ═══════════════════════════════════════
         SUMMARY TAB — performance overview
         ═══════════════════════════════════════ */
      loadSummary: async function (period) {
        S.p('click');
        document.getElementById('sum-week').classList.toggle('on', period === 'week');
        document.getElementById('sum-month').classList.toggle('on', period === 'month');

        var now = new Date(); var start, label;
        if (period === 'week') {
          var day = now.getDay() || 7;
          var mon = new Date(now); mon.setDate(now.getDate() - (day - 1));
          start = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0');
          label = 'This Week';
        } else {
          start = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
          label = 'This Month';
        }

        var myR = (_rpts || []).filter(function (r) { return r.userId === ME.id && r.date >= start });
        var myA = (_att || []).filter(function (a) { return a.userId === ME.id && a.date >= start });
        var acts = myR.filter(function (r) { return r.type === 'activity' });
        var visits = myR.filter(function (r) { return r.type === 'visit' });

        /* Attendance stats */
        var onTime = 0, late = 0;
        myA.forEach(function (a) { if ((a.time || '') > C.START_TIME) late++; else onTime++ });

        /* Load config if not loaded */
        var hols = App._holidays || {}; var ods = App._offDays || {};
        try { if (!Object.keys(hols).length) hols = await F.g('adminConfig/holidays') || {} } catch (e) { }
        try { if (!Object.keys(ods).length) ods = await F.g('adminConfig/offDays') || {} } catch (e) { }
        /* Build leave lookup */
        var lvs = App._leaves || []; var slvLookup = {};
        lvs.forEach(function (l) {
          if (l.status !== 'approved' || l.userId !== ME.id) return;
          var c = new Date(l.date + 'T00:00:00'); var e2 = new Date((l.dateTo || l.date) + 'T00:00:00');
          while (c <= e2) { var dss = c.getFullYear() + '-' + String(c.getMonth() + 1).padStart(2, '0') + '-' + String(c.getDate()).padStart(2, '0'); slvLookup[dss] = true; c.setDate(c.getDate() + 1) }
        });

        /* Working days — use dedCutoff to exclude today if before 11 AM */
        var d = new Date(start + 'T00:00:00'), dedCutStr = U.dedCutoff(), workdays = 0, leaveDays = 0;
        while (d <= now) {
          var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          if (d.getDay() !== 0 && ds <= dedCutStr && !hols[ds] && !ods[ds]) {
            if (slvLookup[ds]) leaveDays++;
            else workdays++;
          }
          d.setDate(d.getDate() + 1);
        }
        var absent = workdays - onTime - late; if (absent < 0) absent = 0;

        /* KM */
        var totalKm = 0; myA.forEach(function (a) { if (a.totalKm) totalKm += parseFloat(a.totalKm) });

        /* Tags */
        var tagMap = {}; myR.forEach(function (r) { if (r.tags) r.tags.forEach(function (t) { tagMap[t] = (tagMap[t] || 0) + 1 }) });
        var topTags = Object.entries(tagMap).sort(function (a, b) { return b[1] - a[1] }).slice(0, 6);

        /* Build HTML */
        var h = '';

        /* Attendance card */
        var attPct = workdays ? Math.round((onTime + late) / workdays * 100) : 0;
        h += '<div class="jcard" style="padding:14px;margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--G5);margin-bottom:8px">📅 ATTENDANCE</div>';
        h += '<div class="live-stats"><div class="ls"><div class="ls-n" style="color:var(--grn)">' + onTime + '</div><div class="ls-l">On Time</div></div>';
        h += '<div class="ls"><div class="ls-n" style="color:var(--amb)">' + late + '</div><div class="ls-l">Late</div></div>';
        h += '<div class="ls"><div class="ls-n" style="color:var(--R)">' + absent + '</div><div class="ls-l">Absent</div></div>';
        h += '<div class="ls"><div class="ls-n">' + attPct + '%</div><div class="ls-l">Rate</div></div></div></div>';

        /* Reports card */
        h += '<div class="jcard" style="padding:14px;margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--G5);margin-bottom:8px">📝 REPORTS</div>';
        h += '<div class="live-stats"><div class="ls"><div class="ls-n">' + myR.length + '</div><div class="ls-l">Total</div></div>';
        h += '<div class="ls"><div class="ls-n">' + acts.length + '</div><div class="ls-l">Activity</div></div>';
        h += '<div class="ls"><div class="ls-n">' + visits.length + '</div><div class="ls-l">Visits</div></div>';
        var lateRpts = myR.filter(function (r) { return r.lateReport }).length;
        h += '<div class="ls"><div class="ls-n" style="color:var(--amb)">' + lateRpts + '</div><div class="ls-l">Late Rpt</div></div></div></div>';

        /* Financials — salary-based */
        var salary = 0;
        try { var ud = await F.g('users/' + ME.id); if (ud && ud.salary) salary = ud.salary } catch (e) { }
        var dailyR = salary ? Math.round(salary / 30) : 0;
        var hourlyR = dailyR ? Math.round(dailyR / 8) : 0;
        var cfg2 = App._payrollCfg || { deductionMode: 'salary', flatLate: 200, flatAbsent: 500 };
        var dedLate = cfg2.deductionMode === 'salary' ? late * hourlyR : late * (cfg2.flatLate || 200);
        var dedAbsent = cfg2.deductionMode === 'salary' ? absent * dailyR : absent * (cfg2.flatAbsent || 500);
        var dedTotal = dedLate + dedAbsent;
        var kmClaim = Math.round(totalKm * C.KM_RATE);
        h += '<div class="jcard" style="padding:14px;margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--G5);margin-bottom:8px">💰 FINANCIALS</div>';
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--G9)"><span style="font-size:12px;color:var(--G5)">KM Travelled</span><span style="font-size:13px;font-weight:800">' + totalKm.toFixed(1) + '</span></div>';
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--G9)"><span style="font-size:12px;color:var(--G5)">KM Claim</span><span style="font-size:13px;font-weight:800;color:var(--grn)">Rs ' + kmClaim + '</span></div>';
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--G9)"><span style="font-size:12px;color:var(--G5)">Late Deduction (' + late + 'd × Rs ' + hourlyR + ')</span><span style="font-size:13px;font-weight:800;color:var(--R)">Rs ' + dedLate.toLocaleString() + '</span></div>';
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--G9)"><span style="font-size:12px;color:var(--G5)">Absent Deduction (' + absent + 'd × Rs ' + dailyR + ')</span><span style="font-size:13px;font-weight:800;color:var(--R)">Rs ' + dedAbsent.toLocaleString() + '</span></div>';
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid var(--G8)"><span style="font-size:13px;font-weight:800">Total Deduction</span><span style="font-size:15px;font-weight:800;color:var(--R)">Rs ' + dedTotal + '</span></div>';
        h += '</div>';

        /* Top tags */
        if (topTags.length) {
          h += '<div class="jcard" style="padding:14px;margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--G5);margin-bottom:8px">#️⃣ TOP TAGS</div>';
          h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
          topTags.forEach(function (t) {
            h += '<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:var(--Rbg);color:var(--R)">#' + t[0] + ' <span style="font-weight:800">' + t[1] + '</span></span>';
          });
          h += '</div></div>';
        }

        document.getElementById('sum-content').innerHTML = h;
      },

      /* ═══════════════════════════════════════
         LOAD STATS
         ═══════════════════════════════════════ */
      loadStats: async function () {
        try {
          var now = new Date(); var moStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
          var todayStr = U.today();
          var myRpts = _rpts.filter(function (r) { return r.userId === ME.id && r.date >= moStart });
          var myVis = myRpts.filter(function (r) { return r.type === 'visit' });
          var myAtt = _att.filter(function (a) { return a.userId === ME.id && a.date >= moStart });
          var totalKm = 0; myAtt.forEach(function (a) { if (a.totalKm) totalKm += parseFloat(a.totalKm) });
          document.getElementById('ms-rpt').textContent = myRpts.length;
          document.getElementById('ms-vis').textContent = myVis.length;
          document.getElementById('ms-km').textContent = totalKm.toFixed(0);
          if (totalKm > 0) document.getElementById('ms-km-rs').textContent = 'Rs ' + Math.round(totalKm * C.KM_RATE);

          /* Salary-based deduction calc */
          var cfg = App._payrollCfg;
          if (!cfg) { try { cfg = await F.g('adminConfig/payroll') || {} } catch (e) { cfg = {} } }
          var holidays = App._holidays;
          if (!holidays || !Object.keys(holidays).length) { try { holidays = await F.g('adminConfig/holidays') || {} } catch (e) { holidays = {} } }
          var offDays = App._offDays;
          if (!offDays || !Object.keys(offDays).length) { try { offDays = await F.g('adminConfig/offDays') || {} } catch (e) { offDays = {} } }
          var salary = 0;
          try { var ud = await F.g('users/' + ME.id); if (ud && ud.salary) salary = ud.salary } catch (e) { }
          var daily = salary ? Math.round(salary / 30) : 0;
          var hourly = daily ? Math.round(daily / 8) : 0;
          var mode = cfg.deductionMode || 'salary';

          /* Build attendance + leave lookups */
          var attByDate = {}; myAtt.forEach(function (a) { attByDate[a.date] = a });
          var lvs = App._leaves || [];
          var lvLookup = {}; lvs.forEach(function (l) {
            if (l.status !== 'approved' || l.userId !== ME.id) return;
            var c = new Date(l.date + 'T00:00:00'); var e2 = new Date((l.dateTo || l.date) + 'T00:00:00');
            while (c <= e2) { var ds = c.getFullYear() + '-' + String(c.getMonth() + 1).padStart(2, '0') + '-' + String(c.getDate()).padStart(2, '0'); lvLookup[ds] = true; c.setDate(c.getDate() + 1) }
          });

          var absentDed = 0, lateDed = 0;
          var dedCut = U.dedCutoff();
          var dc = new Date(moStart + 'T00:00:00'), de = new Date(dedCut + 'T00:00:00');
          while (dc <= de) {
            var ds = dc.getFullYear() + '-' + String(dc.getMonth() + 1).padStart(2, '0') + '-' + String(dc.getDate()).padStart(2, '0');
            if (dc.getDay() !== 0 && !holidays[ds] && !offDays[ds]) {
              if (!lvLookup[ds]) {
                if (attByDate[ds]) {
                  if ((attByDate[ds].time || '') > C.START_TIME) { lateDed += mode === 'salary' ? hourly : (cfg.flatLate || 200) }
                } else {
                  absentDed += mode === 'salary' ? daily : (cfg.flatAbsent || 500);
                }
              }
            }
            dc.setDate(dc.getDate() + 1);
          }
          document.getElementById('ms-ded').textContent = 'Rs ' + (absentDed + lateDed).toLocaleString();
        } catch (e) { console.error('loadStats:', e) }
      }

    };/* end App */

    /* ═══════════════════════════════════════
       INIT
       ═══════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () { App.restore() });
    window.addEventListener('online', function () { document.getElementById('offline-bar').style.display = 'none' });
    window.addEventListener('offline', function () { document.getElementById('offline-bar').style.display = 'block' });