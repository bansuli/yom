/**
 * yom Cohort 1 — Google Apps Script webhook
 *
 * Setup (you):
 * 1. Create a blank Google Sheet named "yom cohort 1"
 * 2. Extensions → Apps Script → paste THIS FILE → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the URL → Vercel env SHEET_WEBHOOK_URL → Redeploy
 *
 * After updates: paste again → Save → Deploy → Manage deployments → Edit → New version
 * First run with images: approve Drive permission when prompted.
 *
 * Optional: set SECRET below and SHEET_WEBHOOK_SECRET on Vercel to the same value.
 */

const SECRET = ""; // optional
const PHOTO_FOLDER = "yom-scan-photos";

const TABLES = {
  leads: [
    "at",
    "email",
    "name",
    "channel",
    "source",
    "campaign",
    "surface",
    "path",
    "anon_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer_user_id",
    "metadata",
  ],
  scan_visitors: [
    "at",
    "anon_id",
    "email",
    "source",
    "campaign",
    "surface",
    "path",
    "checks_count",
    "metadata",
  ],
  scan_checks: [
    "at",
    "anon_id",
    "email",
    "product_name",
    "brand",
    "price",
    "decision",
    "input_method",
    "verdict_title",
    "campaign",
    "source",
    "surface",
    "image",
    "image_url",
    "product_json",
    "verdict_json",
  ],
  shares: [
    "at",
    "share_id",
    "sender_email",
    "sender_anon_id",
    "sender_user_id",
    "decision",
    "campaign",
    "source",
    "image",
    "image_url",
    "product_json",
    "verdict_json",
    "opens_count",
    "votes_count",
  ],
  share_votes: ["at", "share_id", "vote", "reason", "voter_name", "voter_email", "voter_anon_id"],
};

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function authorize_(secret) {
  if (SECRET && secret !== SECRET) return false;
  return true;
}

function getVotesForShare_(shareId) {
  var sh = ensureSheet_("share_votes");
  if (!sh || !shareId) return [];
  var data = sh.getDataRange().getValues();
  if (!data.length) return [];
  var headers = data[0].map(String);
  var shareCol = headers.indexOf("share_id");
  var voteCol = headers.indexOf("vote");
  var reasonCol = headers.indexOf("reason");
  var nameCol = headers.indexOf("voter_name");
  var emailCol = headers.indexOf("voter_email");
  var atCol = headers.indexOf("at");
  var votes = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][shareCol]) !== String(shareId)) continue;
    votes.push({
      vote: voteCol >= 0 ? String(data[i][voteCol] || "") : "",
      reason: reasonCol >= 0 ? String(data[i][reasonCol] || "") || null : null,
      voter_name: nameCol >= 0 ? String(data[i][nameCol] || "") || null : null,
      voter_email: emailCol >= 0 ? String(data[i][emailCol] || "") || null : null,
      created_at: atCol >= 0 ? data[i][atCol] : null,
    });
  }
  votes.sort(function (a, b) {
    var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return votes.slice(0, 40);
}

function getPhotoFolder_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty("PHOTO_FOLDER_ID");
    if (id) {
      try {
        return DriveApp.getFolderById(id);
      } catch (e) {
        /* recreate below */
      }
    }
    var folder = DriveApp.createFolder(PHOTO_FOLDER);
    props.setProperty("PHOTO_FOLDER_ID", folder.getId());
    return folder;
  } catch (err) {
    // Drive not authorized — Run setupYomSheets in the editor and accept Drive access.
    return null;
  }
}

/** Save data-URL / raw base64 JPEG to Drive; return view URL or "". */
function saveScanImage_(imageData) {
  if (!imageData) return "";
  var raw = String(imageData);
  var media = "image/jpeg";
  var b64 = raw;
  var m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (m) {
    media = m[1];
    b64 = m[2];
  } else if (raw.indexOf("base64,") >= 0) {
    b64 = raw.split("base64,").pop();
  }
  // Keep Apps Script under size/time limits
  if (b64.length > 2500000) return "";
  try {
    var folder = getPhotoFolder_();
    if (!folder) return "";
    var bytes = Utilities.base64Decode(b64);
    var blob = Utilities.newBlob(bytes, media, "scan-" + Date.now() + ".jpg");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (err) {
    return "";
  }
}

function ensureSheet_(name) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  var wanted = TABLES[name];
  if (!wanted) return null;
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
    sh.setFrozenRows(1);
    return sh;
  }
  // Add any new columns at the end (e.g. image / image_url)
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  wanted.forEach(function (h) {
    if (existing.indexOf(h) < 0) {
      existing.push(h);
      sh.getRange(1, existing.length).setValue(h);
    }
  });
  sh.setFrozenRows(1);
  return sh;
}

function sheetHeaders_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

/** Run once from the Apps Script editor: select setupYomSheets → Run → Approve Drive */
function setupYomSheets() {
  Object.keys(TABLES).forEach(ensureSheet_);
  var folder = getPhotoFolder_();
  if (!folder) {
    throw new Error("Approve Drive access when prompted, then run setupYomSheets again.");
  }
  var ss = SpreadsheetApp.getActive();
  var def = ss.getSheetByName("Sheet1");
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) {
    ss.deleteSheet(def);
  }
}

function doGet(e) {
  e = e || { parameter: {} };
  if (!authorize_(e.parameter.secret || "")) return ok({ ok: false, error: "unauthorized" });

  var action = e.parameter.action;
  if (action === "get_share") {
    var id = e.parameter.id;
    var sh = ensureSheet_("shares");
    if (!sh || !id) return ok({ ok: false, error: "not found" });
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(String);
    var idCol = headers.indexOf("share_id");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(id)) {
        var row = {};
        headers.forEach(function (h, j) {
          row[h] = data[i][j];
        });
        try {
          row.product = JSON.parse(row.product_json || "{}");
          row.verdict = JSON.parse(row.verdict_json || "{}");
        } catch (_) {}
        var opensCol = headers.indexOf("opens_count");
        if (opensCol >= 0) {
          var n = Number(row.opens_count) || 0;
          sh.getRange(i + 1, opensCol + 1).setValue(n + 1);
          row.opens_count = n + 1;
        }
        return ok({ ok: true, share: row, votes: getVotesForShare_(id) });
      }
    }
    return ok({ ok: false, error: "share not found" });
  }

  if (action === "ping" || !action) {
    Object.keys(TABLES).forEach(ensureSheet_);
    var driveOk = Boolean(getPhotoFolder_());
    return ok({ ok: true, ping: true, tables: Object.keys(TABLES), drive: driveOk });
  }

  return ok({ ok: true, ping: true });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (_) {
    return ok({ ok: false, error: "bad json" });
  }
  if (!authorize_(body.secret || "")) return ok({ ok: false, error: "unauthorized" });

  var table = body.table || "leads";
  var sh = ensureSheet_(table);
  if (!sh) return ok({ ok: false, error: "unknown table " + table });

  var rows = Array.isArray(body.rows) && body.rows.length ? body.rows : [body.row || {}];
  var lastImage = false;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || {};
    lastImage = appendTableRow_(sh, table, row) || lastImage;
  }
  return ok({ ok: true, table: table, count: rows.length, image: lastImage });
}

function appendTableRow_(sh, table, row) {
  var headers = sheetHeaders_(sh);
  var imageUrl = "";
  if ((table === "scan_checks" || table === "shares") && (row.image_data || row.image)) {
    if (row.image_data) {
      imageUrl = saveScanImage_(row.image_data);
    } else if (String(row.image || "").indexOf("http") === 0) {
      imageUrl = String(row.image);
    }
  }
  if (imageUrl) {
    row.image_url = imageUrl;
  }

  var values = headers.map(function (h) {
    if (h === "image") return ""; // set formula after append
    if (h === "image_data") return "";
    var v = row[h];
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });
  sh.appendRow(values);
  var lastRow = sh.getLastRow();

  if (imageUrl) {
    var imageCol = headers.indexOf("image");
    var urlCol = headers.indexOf("image_url");
    if (imageCol >= 0) {
      sh.getRange(lastRow, imageCol + 1).setFormula('=IMAGE("' + imageUrl + '")');
      sh.setRowHeight(lastRow, 80);
      sh.setColumnWidth(imageCol + 1, 80);
    }
    if (urlCol >= 0) {
      sh.getRange(lastRow, urlCol + 1).setValue(imageUrl);
    }
  }

  return Boolean(imageUrl);
}
