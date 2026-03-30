'use strict';

/**
 * db.js — CNC Electric Pakistan · Single source of truth
 *
 * Contains:
 *   1. CONFIG       — Firebase URL, admin credentials
 *   2. F            — Firebase REST helper (GET/POST/PUT/PATCH/DELETE)
 *   3. Local store  — MongoDB-style CRUD backed by localStorage
 *   4. Domain helpers — Attendance, Plans, Reports, Leaves, Users, AdminRequests
 *   5. seed()       — idempotent admin-user seeder (run once on app boot)
 *
 * Collections:  attendance | reports | plans | users | leaves |
 *               instructions | admin_requests | drafts |
 *               custom_clients | meetings | adminConfig |
 *               itinerary | reportSummaries | aiAnalysis |
 *               ai_config | clientVisits | ai_reports
 *
 * Usage (Firebase):
 *   await DB.F.g('attendance')                        // GET collection
 *   await DB.F.push('attendance', { ... })            // POST new record
 *   await DB.F.up('attendance/id', { out:'18:00' })   // PATCH record
 *   await DB.F.del('attendance/id')                   // DELETE record
 *   DB.F.arr(rawFirebaseObj)                          // object → array with .id
 *
 * Usage (local store):
 *   DB.findOne('attendance', { userId:'u1', date:'2026-03-29' })
 *   DB.updateOne('attendance', { id:'abc' }, { out:'18:02' })
 *   DB.find('attendance', { date:'2026-03-29' })
 *   DB.save('attendance', { id:'abc', userId:'u1', ... })
 *
 * Seeder:
 *   await DB.seed()   // creates admin in Firebase if missing
 */

const DB = (() => {

  /* ─────────────────────────────────────────────
     CONFIG  (edit here — never in app.js / activity.js)
  ───────────────────────────────────────────── */

  const _config = {
    // Firebase Realtime Database
    DB:          'https://cs-activity-e7d01-default-rtdb.asia-southeast1.firebasedatabase.app',
    // Admin account  ← change ADMIN_P / ADMIN_EMAIL to your preferences
    ADMIN_U:     'admin',
    ADMIN_P:     'admin@cs2026',
    ADMIN_N:     'Muddasir',
    ADMIN_EMAIL: 'admin@cncelectric.pk',
  };

  /* ─────────────────────────────────────────────
     FIREBASE REST HELPER  (F)
     · All GET calls auto-cache result in local store
     · All write calls mirror to local store
     · Exposed on window as window.F for app.js / activity.js
  ───────────────────────────────────────────── */

  const _F = {

    /* core XHR */
    r(m, p, d) {
      return new Promise(function (ok, no) {
        var x = new XMLHttpRequest();
        x.open(m, _config.DB + '/' + p + '.json', true);
        x.setRequestHeader('Content-Type', 'application/json');
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)) } catch (e) { ok(null) } }
          else no(new Error('HTTP ' + x.status));
        };
        x.onerror = function () { no(new Error('Network')) };
        x.send(d !== undefined ? JSON.stringify(d) : null);
      });
    },

    /* path helpers */
    _col(p) { return p.split('/')[0]; },
    _id(p)  { var s = p.split('/'); return s.length > 1 ? s.slice(1).join('_') : null; },

    /* auto-sync Firebase result → local store (silent) */
    _sync(col, id, data) {
      try {
        if (data === null || data === undefined) return;
        if (id) {
          save(col, Object.assign({}, typeof data === 'object' ? data : { value: data }, { id: id }));
        } else {
          _F.arr(data).forEach(function (doc) { save(col, doc); });
        }
      } catch (e) { }
    },

    /* GET → cache */
    g(p) {
      return this.r('GET', p).then(function (res) { _F._sync(_F._col(p), _F._id(p), res); return res; });
    },

    /* POST → create + cache */
    push(p, d) {
      return this.r('POST', p, d).then(function (r) {
        var id = r ? r.name : null;
        try { if (id) insertOne(_F._col(p), Object.assign({}, d, { id: id })); } catch (e) { }
        return id;
      });
    },

    /* PUT → replace + cache */
    set(p, d) {
      return this.r('PUT', p, d).then(function (res) {
        try { save(_F._col(p), Object.assign({}, d || {}, { id: _F._id(p) || _F._col(p) })); } catch (e) { }
        return res;
      });
    },

    /* PATCH → update + cache */
    up(p, d) {
      return this.r('PATCH', p, d).then(function (res) {
        try { var id = _F._id(p); if (id) updateOne(_F._col(p), { id: id }, d); } catch (e) { }
        return res;
      });
    },

    /* DELETE → remove from cache */
    del(p) {
      return this.r('DELETE', p).then(function (res) {
        try { var id = _F._id(p); if (id) deleteOne(_F._col(p), { id: id }); } catch (e) { }
        return res;
      });
    },

    /* Firebase object → flat array with .id field */
    arr(o) {
      if (!o) return [];
      return Object.entries(o).map(function (e) {
        var k = e[0], v = e[1];
        return typeof v === 'object' && v ? Object.assign({}, v, { id: k }) : { id: k };
      });
    },
  };

  /* ─────────────────────────────────────────────
     SCHEMAS  (for reference & auto-default fill)
  ───────────────────────────────────────────── */

  const SCHEMAS = {

    /** attendance/{id} — daily check-in/out record */
    attendance: {
      id:               null,   // string  — auto-generated
      userId:           '',     // string  — employee user id
      userName:         '',     // string  — employee display name
      date:             '',     // 'YYYY-MM-DD'
      time:             '',     // 'HH:MM'  (check-in time)
      ts:               '',     // ISO timestamp of check-in
      session:          1,      // number  — session index (1, 2, 3…)
      // ── check-in location ──
      inLat:            null,
      inLng:            null,
      inDist:           null,   // metres from office
      inNear:           false,  // within GEO_RADIUS (50 m)
      inStatus:         '',     // e.g. 'At Office (Lahore HO)'
      inOffice:         '',     // office name
      // ── late arrival ──
      lateArrival:      false,
      lateCountMonth:   0,
      lateDelayMinutes: 0,
      // ── check-out (populated later) ──
      out:              null,   // 'HH:MM'
      outTs:            null,
      outLat:           null,
      outLng:           null,
      outDist:          null,
      outNear:          false,
      outStatus:        '',
      outOffice:        '',
      earlyCheckout:    false,
      autoClose:        false,
      autoCloseAt:      null,
    },

    /** reports/{id} — visit or activity report */
    reports: {
      id:          null,
      type:        'visit',   // 'visit' | 'activity'
      userId:      '',
      userName:    '',
      reportId:    '',        // 'V01-290326' or '20260329-R1'
      reportLabel: '',
      date:        '',        // 'YYYY-MM-DD'
      time:        '',        // 'HH:MM'
      ts:          '',
      visitNum:    null,      // sequential visit number today (visit type only)
      // ── visit fields ──
      client:      '',
      message:     '',
      outcome:     '',        // intro | demo | proposal | follow | recovery | closed | complaint | notavail | cold | other
      address:     '',
      tags:        [],        // extracted hashtags
      lat:         null,
      lng:         null,
      photos:      [],        // base64 JPEG data-URLs (max 5)
      planned:     false,
      planId:      null,
      // ── activity fields ──
      lateReport:  false,
      seqNum:      1,         // 1 = first report, 2+ = update
    },

    /** plans/{id} — planned client visit */
    plans: {
      id:            null,
      userId:        '',
      userName:      '',
      date:          '',     // planned visit date 'YYYY-MM-DD'
      client:        '',
      city:          '',
      address:       '',
      note:          '',
      status:        'pending',  // 'pending' | 'completed' | 'missed'
      ts:            '',
      linkedVisitId: null,
      completedOn:   null,
      missedOn:      null,
    },

    /** users/{id} — employee account */
    users: {
      id:          null,
      name:        '',
      username:    '',       // unique lowercase
      email:       '',       // unique lowercase — required
      password:    '',       // SHA-256 hex hash
      wa:          '',       // WhatsApp number
      deviceId:    '',
      approved:    false,
      blocked:     false,
      role:        'employee',  // 'employee' | 'admin'
      createdAt:   '',
      salary:      null,
      department:  '',
      blockedAt:   null,
    },

    /** leaves/{id} — leave request */
    leaves: {
      id:           null,
      userId:       '',
      userName:     '',
      date:         '',      // first day 'YYYY-MM-DD'
      dateTo:       '',      // last day  'YYYY-MM-DD'
      days:         1,       // 0.5 | 1 | 2 …
      leaveDay:     'full',  // 'full' | 'half'
      halfType:     null,    // 'morning' | 'afternoon'
      reason:       '',
      status:       'pending',  // 'pending' | 'approved' | 'rejected'
      ts:           '',
      approvedBy:   null,
      approvedAt:   null,
      rejectedBy:   null,
      rejectedAt:   null,
      adminCreated: false,
      adminApproved:false,
    },

    /** instructions/{id} — admin message to employee */
    instructions: {
      id:       null,
      toId:     '',     // userId or 'all'
      toName:   '',
      body:     '',
      priority: 'routine',  // 'urgent' | 'important' | 'routine' | 'good'
      fromName: '',
      ts:       '',
      // read flags stored as r_{userId}: true
    },

    /** admin_requests/{id} — employee → admin request */
    admin_requests: {
      id:          null,
      type:        '',    // 'sdl' | 'undo' | 'meeting'
      userId:      '',
      userName:    '',
      // sdl fields
      sdlType:     null,  // 'early_leave' | 'late_arrival'
      // undo fields
      attId:       null,
      originalOut: null,
      // meeting fields
      mtgTitle:    null,
      mtgNotes:    null,
      // common
      reason:      '',
      date:        '',
      time:        '',
      status:      'pending',  // 'pending' | 'approved' | 'rejected'
      createdAt:   '',
    },

    /** drafts/{userId}/{type} — unsaved form draft */
    drafts: {
      id:       null,   // composite: '{userId}_{type}'
      userId:   '',
      type:     'v',    // 'v' (visit) | 'a' (activity)
      // visit draft
      client:   '',
      desc:     '',
      outcome:  '',
      photos:   [],
      lat:      null,
      lng:      null,
      addr:     '',
      // activity draft
      msg:      '',
      dateMode: 'today',
      oldDate:  null,
    },

    /** custom_clients/{userId}_{name} — per-user client */
    custom_clients: {
      id:       null,
      userId:   '',
      name:     '',
      addedBy:  '',
      ts:       '',
    },

    /** meetings/{id} — tracked meeting */
    meetings: {
      id:        null,
      userId:    '',
      userName:  '',
      title:     '',
      notes:     '',
      startTime: '',
      endTime:   null,
      duration:  null,    // minutes
      approved:  false,
      date:      '',
      ts:        '',
    },

    /** adminConfig/{section} — system settings */
    adminConfig: {
      id:      null,  // section key: 'payroll' | 'offDays' | 'holidays' | 'aiActivity'
      // payroll
      dedMode:         'perOccurrence',
      monthlyLeaves:   2,
      flatRate:        null,
      // offDays
      offDays:         [],
      // holidays
      holidays:        [],
    },

    /** itinerary/{userId}_{date} — employee daily journey / route */
    itinerary: {
      id:                null,  // '{userId}_{YYYY-MM-DD}'
      startPlace:        '',
      startTime:         '',
      startLat:          null,
      startLng:          null,
      legs:              [],    // [{ client, planned, arriveTime, leaveTime, meetingMins, travelFromPrevKm, outcome, notes }]
      totalKm:           0,
      totalMeetingMins:  0,
      totalTravelMins:   0,
      endPlace:          null,
      endTime:           null,
      endLat:            null,
      endLng:            null,
    },

    /** reportSummaries/{reportId} — AI-generated summary cache */
    reportSummaries: {
      id:          null,  // reportId
      summary:     '',    // AI-generated text
      generatedAt: '',
    },

    /** aiAnalysis/{key} — generated AI analysis reports */
    aiAnalysis: {
      id:          null,  // e.g. '20260329_individual_userId' or '20260329_team'
      type:        '',    // 'individual' | 'team'
      employee:    null,
      employeeId:  null,
      from:        '',
      to:          '',
      result:      '',    // AI-generated analysis text
      generatedAt: '',
    },

    /** ai_config/{key} — AI configuration (global + per-employee) */
    ai_config: {
      id:          null,  // 'global' or employee userId
      model:       '',
      prompt:      '',
      enabled:     false,
    },

    /** clientVisits/{clientKey} — aggregated visit history per client */
    clientVisits: {
      id:          null,  // sanitised client name key
      client:      '',
      visits:      [],    // array of visit summaries
      lastVisit:   '',
      totalVisits: 0,
    },

    /** ai_reports/{id} — saved AI report summaries */
    ai_reports: {
      id:          null,
      type:        '',
      from:        '',
      to:          '',
      result:      '',
      generatedAt: '',
    },
  };

  /* ─────────────────────────────────────────────
     STORAGE  (localStorage wrapper)
  ───────────────────────────────────────────── */

  const STORAGE_PREFIX = 'cs_db_';

  function storageKey(collection) {
    return STORAGE_PREFIX + collection;
  }

  function loadCollection(collection) {
    try {
      const raw = localStorage.getItem(storageKey(collection));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[DB] load error for', collection, e);
      return {};
    }
  }

  function persistCollection(collection, data) {
    try {
      localStorage.setItem(storageKey(collection), JSON.stringify(data));
    } catch (e) {
      console.warn('[DB] persist error for', collection, e);
    }
  }

  /* ─────────────────────────────────────────────
     IN-MEMORY STORE
  ───────────────────────────────────────────── */

  // { collection: { id: document, ... } }
  const _store = {};

  function ensureCollection(collection) {
    if (!_store[collection]) {
      _store[collection] = loadCollection(collection);
    }
  }

  function save_to_store(collection, data) {
    _store[collection] = data;
    persistCollection(collection, data);
  }

  /* ─────────────────────────────────────────────
     ID GENERATION
  ───────────────────────────────────────────── */

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ─────────────────────────────────────────────
     QUERY MATCHING
     Supports: exact match, $gt, $gte, $lt, $lte, $ne, $in, $regex
  ───────────────────────────────────────────── */

  function matchesQuery(doc, query) {
    if (!query || Object.keys(query).length === 0) return true;
    for (const [key, condition] of Object.entries(query)) {
      const val = doc[key];
      if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
        // operator object
        for (const [op, operand] of Object.entries(condition)) {
          switch (op) {
            case '$gt':    if (!(val >  operand)) return false; break;
            case '$gte':   if (!(val >= operand)) return false; break;
            case '$lt':    if (!(val <  operand)) return false; break;
            case '$lte':   if (!(val <= operand)) return false; break;
            case '$ne':    if ( val === operand)  return false; break;
            case '$in':    if (!operand.includes(val)) return false; break;
            case '$nin':   if (operand.includes(val))  return false; break;
            case '$regex': if (!new RegExp(operand, 'i').test(String(val ?? ''))) return false; break;
            default:       break;
          }
        }
      } else {
        // exact match
        if (val !== condition) return false;
      }
    }
    return true;
  }

  /* ─────────────────────────────────────────────
     APPLY UPDATE  ($set, $unset, $push, $pull, or plain merge)
  ───────────────────────────────────────────── */

  function applyUpdate(doc, update) {
    const result = Object.assign({}, doc);

    // Plain object (no operators) — shallow merge
    const hasOps = Object.keys(update).some(k => k.startsWith('$'));
    if (!hasOps) {
      return Object.assign(result, update);
    }

    if (update.$set) {
      Object.assign(result, update.$set);
    }
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        delete result[key];
      }
    }
    if (update.$push) {
      for (const [key, val] of Object.entries(update.$push)) {
        if (!Array.isArray(result[key])) result[key] = [];
        result[key] = [...result[key], val];
      }
    }
    if (update.$pull) {
      for (const [key, val] of Object.entries(update.$pull)) {
        if (Array.isArray(result[key])) {
          result[key] = result[key].filter(item => item !== val);
        }
      }
    }
    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        result[key] = (result[key] || 0) + val;
      }
    }
    return result;
  }

  /* ─────────────────────────────────────────────
     SORT  (simple single-field sort)
  ───────────────────────────────────────────── */

  function sortDocs(docs, sort) {
    if (!sort) return docs;
    const [field, dir] = Array.isArray(sort) ? sort : [sort, 1];
    const d = dir === -1 || dir === 'desc' ? -1 : 1;
    return [...docs].sort((a, b) => {
      if (a[field] < b[field]) return -1 * d;
      if (a[field] > b[field]) return  1 * d;
      return 0;
    });
  }

  /* ─────────────────────────────────────────────
     CORE CRUD API
  ───────────────────────────────────────────── */

  /**
   * insertOne(collection, doc) → inserted doc with generated id
   */
  function insertOne(collection, doc) {
    ensureCollection(collection);
    const data = _store[collection];
    const id = doc.id || genId();
    const defaults = SCHEMAS[collection] ? Object.assign({}, SCHEMAS[collection]) : {};
    const record = Object.assign(defaults, doc, { id });
    data[id] = record;
    save_to_store(collection, data);
    return Object.assign({}, record);
  }

  /**
   * insertMany(collection, docs) → array of inserted docs
   */
  function insertMany(collection, docs) {
    return docs.map(d => insertOne(collection, d));
  }

  /**
   * findOne(collection, query) → first matching doc or null
   */
  function findOne(collection, query) {
    ensureCollection(collection);
    const docs = Object.values(_store[collection]);
    return docs.find(d => matchesQuery(d, query)) ?? null;
  }

  /**
   * findById(collection, id) → doc or null
   */
  function findById(collection, id) {
    ensureCollection(collection);
    return _store[collection][id] ?? null;
  }

  /**
   * find(collection, query?, options?) → array of matching docs
   * options: { sort, limit, skip }
   */
  function find(collection, query = {}, options = {}) {
    ensureCollection(collection);
    let docs = Object.values(_store[collection]).filter(d => matchesQuery(d, query));
    if (options.sort)  docs = sortDocs(docs, options.sort);
    if (options.skip)  docs = docs.slice(options.skip);
    if (options.limit) docs = docs.slice(0, options.limit);
    return docs.map(d => Object.assign({}, d));
  }

  /**
   * updateOne(collection, query, update) → { matched, modified, doc }
   */
  function updateOne(collection, query, update) {
    ensureCollection(collection);
    const data = _store[collection];
    for (const [id, doc] of Object.entries(data)) {
      if (matchesQuery(doc, query)) {
        const updated = applyUpdate(doc, update);
        updated.id = id;
        data[id] = updated;
        save_to_store(collection, data);
        return { matched: 1, modified: 1, doc: Object.assign({}, updated) };
      }
    }
    return { matched: 0, modified: 0, doc: null };
  }

  /**
   * updateMany(collection, query, update) → { matched, modified }
   */
  function updateMany(collection, query, update) {
    ensureCollection(collection);
    const data = _store[collection];
    let matched = 0, modified = 0;
    for (const [id, doc] of Object.entries(data)) {
      if (matchesQuery(doc, query)) {
        const updated = applyUpdate(doc, update);
        updated.id = id;
        data[id] = updated;
        matched++;
        modified++;
      }
    }
    if (modified > 0) save_to_store(collection, data);
    return { matched, modified };
  }

  /**
   * save(collection, doc) → upsert by doc.id; inserts if id missing
   */
  function save(collection, doc) {
    if (!doc.id) return insertOne(collection, doc);
    ensureCollection(collection);
    const data = _store[collection];
    const existing = data[doc.id] || {};
    const merged = Object.assign({}, existing, doc);
    data[doc.id] = merged;
    save_to_store(collection, data);
    return Object.assign({}, merged);
  }

  /**
   * deleteOne(collection, query) → { deleted } count
   */
  function deleteOne(collection, query) {
    ensureCollection(collection);
    const data = _store[collection];
    for (const [id, doc] of Object.entries(data)) {
      if (matchesQuery(doc, query)) {
        delete data[id];
        save_to_store(collection, data);
        return { deleted: 1 };
      }
    }
    return { deleted: 0 };
  }

  /**
   * deleteMany(collection, query) → { deleted } count
   */
  function deleteMany(collection, query) {
    ensureCollection(collection);
    const data = _store[collection];
    let deleted = 0;
    for (const [id, doc] of Object.entries(data)) {
      if (matchesQuery(doc, query)) {
        delete data[id];
        deleted++;
      }
    }
    if (deleted > 0) save_to_store(collection, data);
    return { deleted };
  }

  /**
   * count(collection, query?) → number
   */
  function count(collection, query = {}) {
    ensureCollection(collection);
    return Object.values(_store[collection]).filter(d => matchesQuery(d, query)).length;
  }

  /**
   * exists(collection, query) → boolean
   */
  function exists(collection, query) {
    return findOne(collection, query) !== null;
  }

  /**
   * clear(collection) — remove all docs from a collection
   */
  function clear(collection) {
    _store[collection] = {};
    persistCollection(collection, {});
  }

  /* ─────────────────────────────────────────────
     ATTENDANCE-SPECIFIC HELPERS
  ───────────────────────────────────────────── */

  const Attendance = {

    /**
     * getTodayRecord(userId) — active check-in for today (no checkout yet)
     */
    getTodayRecord(userId) {
      const today = _today();
      return findOne('attendance', { userId, date: today, out: null });
    },

    /**
     * getByDate(userId, date) — all records for a user on a date
     */
    getByDate(userId, date) {
      return find('attendance', { userId, date }, { sort: ['time', 1] });
    },

    /**
     * getRange(userId, fromDate, toDate) — records in date range
     */
    getRange(userId, fromDate, toDate) {
      ensureCollection('attendance');
      return Object.values(_store['attendance'])
        .filter(r => r.userId === userId && r.date >= fromDate && r.date <= toDate)
        .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    },

    /**
     * getMonthRecords(userId, year, month) — month string: '2026-03'
     */
    getMonthRecords(userId, yearMonth) {
      ensureCollection('attendance');
      return Object.values(_store['attendance'])
        .filter(r => r.userId === userId && r.date.startsWith(yearMonth))
        .sort((a, b) => a.date < b.date ? -1 : 1);
    },

    /**
     * getAllByDate(date) — all employees' records for a given date
     */
    getAllByDate(date) {
      return find('attendance', { date }, { sort: ['time', 1] });
    },

    /**
     * getLateCountThisMonth(userId) — count of lateArrival records this month
     */
    getLateCountThisMonth(userId) {
      const ym = _today().slice(0, 7);
      ensureCollection('attendance');
      return Object.values(_store['attendance'])
        .filter(r => r.userId === userId && r.date.startsWith(ym) && r.lateArrival === true)
        .length;
    },

    /**
     * checkIn(userId, userName, inData) — create a new check-in record
     * inData: { time, ts, inLat, inLng, inDist, inNear, inStatus, inOffice, lateArrival, lateCountMonth, lateDelayMinutes }
     */
    checkIn(userId, userName, inData) {
      const today = _today();
      // guard: if session already open, return the existing record (app handles UI)
      const active = this.getTodayRecord(userId);
      if (active) return null;
      const sessionDone = find('attendance', { userId, date: today });
      const session = sessionDone.length + 1;
      return insertOne('attendance', Object.assign({
        userId, userName,
        date: today,
        session,
        out: null,
      }, inData));
    },

    /**
     * checkOut(recordId, outData) — update a check-in record with checkout info
     * outData: { out, outTs, outLat, outLng, outDist, outNear, outStatus, outOffice, earlyCheckout }
     */
    checkOut(recordId, outData) {
      const result = updateOne('attendance', { id: recordId }, outData);
      return result.doc;  // null if record not found — caller should check
    },

    /**
     * classify(time) — return status info for a check-in time string 'HH:MM'
     * Returns: { status, label, deduction, color }
     */
    classify(time) {
      if (!time) return { status: 'absent', label: 'Absent', deduction: 500, color: '#b91c1c' };
      if (time <= '10:00') return { status: 'ontime',  label: 'On Time',     deduction: 0,   color: '#16a34a' };
      if (time <= '10:15') return { status: 'grace',   label: 'Grace',       deduction: 0,   color: '#d97706' };
      return               { status: 'late',    label: 'Late',        deduction: 200, color: '#dc2626' };
    },

    /**
     * getSummary(userId, yearMonth) — monthly summary object
     * Returns: { present, late, absent, ontime, grace, totalDeduction, records }
     */
    getSummary(userId, yearMonth) {
      const records = this.getMonthRecords(userId, yearMonth);
      let present = 0, late = 0, ontime = 0, grace = 0, totalDeduction = 0;
      for (const r of records) {
        present++;
        const cls = this.classify(r.time);
        if (cls.status === 'late')   { late++;   totalDeduction += 200; }
        if (cls.status === 'ontime') ontime++;
        if (cls.status === 'grace')  grace++;
      }
      return { present, late, ontime, grace, absent: 0, totalDeduction, records };
    },
  };

  /* ─────────────────────────────────────────────
     PLANS HELPERS
  ───────────────────────────────────────────── */

  const Plans = {

    getByUser(userId) {
      return find('plans', { userId }, { sort: ['date', 1] });
    },

    getPending(userId) {
      const q = { status: 'pending' };
      if (userId) q.userId = userId;
      return find('plans', q, { sort: ['date', 1] });
    },

    complete(planId, linkedVisitId) {
      return updateOne('plans', { id: planId }, {
        status: 'completed',
        linkedVisitId,
        completedOn: _today(),
      });
    },

    markMissed(planId) {
      return updateOne('plans', { id: planId }, { status: 'missed', missedOn: _today() });
    },
  };

  /* ─────────────────────────────────────────────
     REPORTS HELPERS
  ───────────────────────────────────────────── */

  const Reports = {

    getByUser(userId, options = {}) {
      return find('reports', { userId }, { sort: ['ts', -1], ...options });
    },

    getByDate(date) {
      return find('reports', { date }, { sort: ['time', 1] });
    },

    getVisits(userId, date) {
      return find('reports', { userId, date, type: 'visit' }, { sort: ['time', 1] });
    },

    getActivities(userId, date) {
      return find('reports', { userId, date, type: 'activity' }, { sort: ['time', 1] });
    },

    countVisitsToday(userId) {
      return count('reports', { userId, date: _today(), type: 'visit' });
    },
  };

  /* ─────────────────────────────────────────────
     LEAVES HELPERS
  ───────────────────────────────────────────── */

  const Leaves = {

    getPending() {
      return find('leaves', { status: 'pending' }, { sort: ['ts', 1] });
    },

    getByUser(userId) {
      return find('leaves', { userId }, { sort: ['date', -1] });
    },

    approve(leaveId, approvedBy) {
      return updateOne('leaves', { id: leaveId }, { status: 'approved', approvedBy, approvedAt: new Date().toISOString() });
    },

    reject(leaveId, rejectedBy) {
      return updateOne('leaves', { id: leaveId }, { status: 'rejected', rejectedBy, rejectedAt: new Date().toISOString() });
    },

    countApprovedThisMonth(userId) {
      const ym = _today().slice(0, 7);
      ensureCollection('leaves');
      return Object.values(_store['leaves'])
        .filter(l => l.userId === userId && l.status === 'approved' && l.date.startsWith(ym))
        .reduce((sum, l) => sum + (l.days || 1), 0);
    },
  };

  /* ─────────────────────────────────────────────
     USERS HELPERS
  ───────────────────────────────────────────── */

  const Users = {

    getActive() {
      return find('users', { approved: true, blocked: false });
    },

    findByUsername(username) {
      return findOne('users', { username: username.toLowerCase() });
    },

    block(userId) {
      return updateOne('users', { id: userId }, { blocked: true, blockedAt: _today() });
    },

    unblock(userId) {
      return updateOne('users', { id: userId }, { blocked: false, blockedAt: null });
    },

    approve(userId) {
      return updateOne('users', { id: userId }, { approved: true });
    },
  };

  /* ─────────────────────────────────────────────
     ADMIN REQUESTS HELPERS
  ───────────────────────────────────────────── */

  const AdminRequests = {

    getPending(type) {
      const q = { status: 'pending' };
      if (type) q.type = type;
      return find('admin_requests', q, { sort: ['createdAt', 1] });
    },

    approve(reqId, adminName) {
      return updateOne('admin_requests', { id: reqId }, { status: 'approved', resolvedBy: adminName, resolvedAt: new Date().toISOString() });
    },

    reject(reqId, adminName) {
      return updateOne('admin_requests', { id: reqId }, { status: 'rejected', resolvedBy: adminName, resolvedAt: new Date().toISOString() });
    },
  };

  /* ─────────────────────────────────────────────
     IMPORT / EXPORT
  ───────────────────────────────────────────── */

  /**
   * exportAll() → JSON string of entire database
   */
  function exportAll() {
    const snapshot = {};
    for (const col of Object.keys(SCHEMAS)) {
      ensureCollection(col);
      snapshot[col] = Object.assign({}, _store[col]);
    }
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * importAll(jsonString) — replace entire database with JSON snapshot
   */
  function importAll(jsonString) {
    const snapshot = JSON.parse(jsonString);
    for (const [col, data] of Object.entries(snapshot)) {
      _store[col] = data;
      persistCollection(col, data);
    }
  }

  /**
   * exportCollection(collection) → JSON string of one collection
   */
  function exportCollection(collection) {
    ensureCollection(collection);
    return JSON.stringify(Object.values(_store[collection]), null, 2);
  }

  /**
   * importCollection(collection, jsonString) — replace one collection
   * Accepts JSON array or object keyed by id
   */
  function importCollection(collection, jsonString) {
    const raw = JSON.parse(jsonString);
    const data = Array.isArray(raw)
      ? raw.reduce((acc, doc) => { acc[doc.id] = doc; return acc; }, {})
      : raw;
    _store[collection] = data;
    persistCollection(collection, data);
  }

  /* ─────────────────────────────────────────────
     FIREBASE SYNC  (pull Firebase → local store)
  ───────────────────────────────────────────── */

  /**
   * syncFromFirebase(collection) — fetch one collection from Firebase
   * and replace the local store with the result.
   * F._sync() already runs on every g() call, so this is mainly
   * useful for a forced full refresh.
   */
  async function syncFromFirebase(collection) {
    const raw = await _F.g(collection);          // _F.g auto-syncs each doc
    const data = raw
      ? _F.arr(raw).reduce((acc, d) => { acc[d.id] = d; return acc; }, {})
      : {};
    _store[collection] = data;
    persistCollection(collection, data);
    return Object.values(data);
  }

  /**
   * syncAllFromFirebase() — pull every known collection from Firebase.
   */
  async function syncAllFromFirebase() {
    const results = {};
    for (const col of Object.keys(SCHEMAS)) {
      try { results[col] = await syncFromFirebase(col); }
      catch (e) { console.warn('[DB] sync failed for', col, e); results[col] = []; }
    }
    return results;
  }

  /* ─────────────────────────────────────────────
     PASSWORD HASHING  (SHA-256 via Web Crypto API)
  ───────────────────────────────────────────── */

  /**
   * hashPassword(plain) → Promise<string>
   * Returns lowercase hex SHA-256 digest.
   * Usage: const hash = await DB.hashPassword('mypassword')
   */
  async function hashPassword(plain) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(plain)));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ─────────────────────────────────────────────
     EMAIL VALIDATION
  ───────────────────────────────────────────── */

  /**
   * isValidEmail(email) → boolean
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  /* ─────────────────────────────────────────────
     SEEDER
     Creates the admin user in Firebase if missing.
     Safe to call every boot — idempotent.
  ───────────────────────────────────────────── */

  /**
   * seed() — ensure admin user exists in Firebase `users` collection.
   * Stores a hashed password.  Called automatically on page load.
   */
  async function seed() {
    try {
      const raw   = await _F.g('users');
      const users = _F.arr(raw);
      const exists = users.some(function (u) {
        return (u.username || '').toLowerCase() === _config.ADMIN_U && u.role === 'admin';
      });
      if (!exists) {
        const hashed = await hashPassword(_config.ADMIN_P);
        await _F.push('users', {
          name:      _config.ADMIN_N,
          username:  _config.ADMIN_U,
          email:     _config.ADMIN_EMAIL,
          password:  hashed,
          role:      'admin',
          approved:  true,
          blocked:   false,
          createdAt: new Date().toISOString(),
        });
        console.log('[DB] Admin user seeded ✅');
      } else {
        console.log('[DB] Admin already exists — seed skipped');
      }
    } catch (e) {
      console.warn('[DB] seed() failed:', e.message);
    }
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */

  /**
   * init() — pre-load all collections from localStorage into memory
   */
  function init() {
    for (const col of Object.keys(SCHEMAS)) {
      ensureCollection(col);
    }
    console.log('[DB] Initialized. Collections:', Object.keys(SCHEMAS).join(', '));
  }

  /* ─────────────────────────────────────────────
     INTERNAL UTILS
  ───────────────────────────────────────────── */

  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */

  return {
    // Lifecycle
    init,

    // Core CRUD
    insertOne,
    insertMany,
    findOne,
    findById,
    find,
    updateOne,
    updateMany,
    save,
    deleteOne,
    deleteMany,
    count,
    exists,
    clear,

    // Domain helpers
    Attendance,
    Plans,
    Reports,
    Leaves,
    Users,
    AdminRequests,

    // Import / Export
    exportAll,
    importAll,
    exportCollection,
    importCollection,

    // Firebase REST helper
    F: _F,

    // Config (read-only reference)
    config: _config,

    // Seeder
    seed,

    // Utilities
    hashPassword,
    isValidEmail,

    // Firebase sync
    syncFromFirebase,
    syncAllFromFirebase,

    // Expose schemas for reference
    SCHEMAS,
  };

})();

// Expose F globally so app.js and activity.js work without changes
window.F = DB.F;

// Auto-init local store + run seeder
DB.init();
DB.seed();
