import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LINEUP_DAYS } from "./lib/contexts.js";
import "./Pipeline.css";
import "./Admin.css";

const TOKEN_KEY = "yom_admin_token";

function when(value) {
  if (!value) return "—";
  const at = new Date(value);
  if (Number.isNaN(at.valueOf())) return "—";
  return at.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ago(value) {
  const at = value ? new Date(value) : null;
  if (!at || Number.isNaN(at.valueOf())) return "—";
  const mins = Math.round((Date.now() - at.valueOf()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** A heading over an empty box is noise; a section with nothing in it hides. */
function Section({ title, note, children, show = true }) {
  if (!show) return null;
  return (
    <section className="yom-admin-section">
      <h2 className="yom-admin-h">{title}</h2>
      {note && <p className="yom-admin-note">{note}</p>}
      {children}
    </section>
  );
}

function Chips({ data, extra }) {
  const entries = Object.entries(data || {}).filter(([, count]) => count);
  if (!entries.length && !extra) return null;
  return (
    <div className="yom-admin-campaigns">
      {entries.map(([name, count]) => (
        <span key={name}>
          {name} <b>{count}</b>
        </span>
      ))}
      {extra}
    </div>
  );
}

/**
 * One issue, however many times it happened. Resolving is about this fault
 * rather than this occurrence, so the count and who it hit sit on the same row.
 */
function IssueRow({ issue, busy, onAction }) {
  return (
    <li className={issue.resolved ? "is-done" : ""}>
      <div className="yom-issue-main">
        <b>{issue.message}</b>
        <span>
          {[
            issue.kind,
            issue.status ? `status ${issue.status}` : "",
            issue.path,
            `${issue.count}×`,
            issue.people ? `${issue.people} ${issue.people === 1 ? "person" : "people"}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="yom-issue-when">
          {issue.resolved
            ? `Resolved by ${issue.resolved_by || "someone"} · last seen ${ago(issue.last_at)}`
            : `Last ${ago(issue.last_at)} · first ${ago(issue.first_at)}`}
        </span>
      </div>
      <button type="button" onClick={onAction} disabled={busy}>
        {busy ? "…" : issue.resolved ? "Reopen" : "Resolve"}
      </button>
    </li>
  );
}

/** The gap between two steps is the thing worth fixing, so show the gap. */
function Funnel({ steps }) {
  const top = steps[0]?.people || 0;
  return (
    <div className="yom-funnel">
      {steps.map((step, i) => (
        <div className="yom-funnel-row" key={step.step}>
          <span className="yom-funnel-label">{step.step}</span>
          <b className="yom-funnel-count">{step.people}</b>
          <span className="yom-funnel-bar">
            {/* No fill at all at zero — a coloured stub reads as "some". */}
            {step.people > 0 && (
              <i style={{ width: `${Math.max(2, Math.round((step.people / (top || 1)) * 100))}%` }} />
            )}
          </span>
          <span className="yom-funnel-meta">
            {step.pct == null ? "" : step.lost ? `${step.pct}% · ${step.lost} dropped` : `${step.pct}% carried on`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showInternal, setShowInternal] = useState(false);
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [working, setWorking] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (creds) => {
      const bearer = creds?.token ?? token;
      if (!bearer) return;
      setBusy(true);
      setErr("");
      try {
        const withInternal = creds?.internal ?? showInternal;
        const win = creds?.range ?? range;
        const qs = `?window=${encodeURIComponent(win)}${withInternal ? "&internal=1" : ""}`;
        const res = await fetch(`/api/admin${qs}`, {
          headers: { authorization: `Bearer ${bearer}` },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setErr(res.status === 401 ? "That login didn’t work." : body?.error || "Could not load.");
          setData(null);
          if (res.status === 401) {
            setToken("");
            try {
              sessionStorage.removeItem(TOKEN_KEY);
            } catch {
              /* ignore */
            }
          }
        } else {
          setData(body);
          try {
            sessionStorage.setItem(TOKEN_KEY, bearer);
          } catch {
            /* ignore */
          }
        }
      } catch {
        setErr("Could not reach the API.");
      }
      setBusy(false);
    },
    [token, showInternal, range]
  );

  const logIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok || !res.access_token) {
      setErr(res?.error || "Could not log in.");
      return;
    }
    setPassword("");
    setToken(res.access_token);
    load({ token: res.access_token });
  };

  useEffect(() => {
    if (token) load({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = data?.totals;
  const rangeLabel = { "24h": "last 24h", "7d": "last 7 days", all: "all time" }[range] || "all time";
  const some = (obj) => Object.values(obj || {}).some(Boolean);
  const hasInputs = some(data?.by_input) || data?.avg_score != null;
  const hasRounds = some(data?.by_round);
  const hasCampaigns = some(data?.by_campaign);
  const hasLeft = some(data?.left_from) || some(data?.left_by);
  const stuckTotal =
    (data?.stuck?.no_scan?.length || 0) +
    (data?.stuck?.scanned_no_lineup?.length || 0) +
    (data?.stuck?.lineup_not_shared?.length || 0);
  const person = open ? (data?.people || []).find((p) => p.email === open) : null;

  const openPerson = async (email) => {
    if (!email || open === email) {
      setOpen(null);
      setDetail(null);
      return;
    }
    setOpen(email);
    setDetail(null);
    setDetailBusy(true);
    const res = await fetch(`/api/admin?person=${encodeURIComponent(email)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .catch(() => null);
    setDetailBusy(false);
    if (res?.ok) setDetail(res.person);
  };
  const issues = data?.issues || [];
  const openIssues = issues.filter((i) => !i.resolved);
  const resolvedIssues = issues.filter((i) => i.resolved);

  const act = async (issue, action) => {
    setWorking(issue.key);
    await fetch("/api/admin-issues", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, kind: issue.kind, message: issue.message }),
    }).catch(() => null);
    setWorking("");
    load();
  };

  const downloadCsv = async () => {
    const res = await fetch(`/api/admin?csv=1&window=${range}${showInternal ? "&internal=1" : ""}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yom-people.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="yom-admin">
      <header className="yom-admin-head">
        <Link to="/looks" className="pnm-back">
          ← App
        </Link>
        <b>yom admin</b>
        {data && (
          <button type="button" onClick={downloadCsv}>
            Export CSV
          </button>
        )}
        <button type="button" onClick={() => load()} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </button>
      </header>

      {!data && (
        <form className="yom-admin-gate" onSubmit={logIn}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Log in"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
        </form>
      )}

      {totals && (
        <>
          <nav className="yom-admin-tabs">
            {[
              ["overview", "Overview"],
              ["people", `People · ${totals.people}`],
              ["activity", "Activity"],
              ["issues", `Issues${data.errors_recent ? ` · ${data.errors_recent}` : ""}`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "on" : ""}
                onClick={() => {
                  setTab(id);
                  setOpen(null);
                }}
              >
                {label}
              </button>
            ))}
            <span className="yom-admin-range">
              {[
                ["24h", "Last 24h"],
                ["7d", "Last 7 days"],
                ["all", "All time"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={range === id ? "on" : ""}
                  onClick={() => {
                    setRange(id);
                    load({ range: id });
                  }}
                >
                  {label}
                </button>
              ))}
            </span>
            <button
              type="button"
              className="yom-admin-toggle"
              onClick={() => {
                const next = !showInternal;
                setShowInternal(next);
                load({ internal: next });
              }}
            >
              {showInternal
                ? "Hide internal"
                : `Real signups${totals.internal_hidden ? ` · ${totals.internal_hidden} hidden` : ""}`}
            </button>
          </nav>

          {err && <p className="yom-admin-err">{err}</p>}

          {tab === "overview" && (
            <>
              <div className="yom-admin-tiles">
                <article>
                  <b>{totals.people}</b>
                  <span>People (all time)</span>
                </article>
                <article>
                  <b>{totals.people_in_window}</b>
                  <span>Signed up · {rangeLabel}</span>
                </article>
                <article>
                  <b>{totals.opened_no_email}</b>
                  <span>Opened, no email · {rangeLabel}</span>
                </article>
                <article>
                  <b>{totals.with_lineup}</b>
                  <span>Built a lineup</span>
                </article>
                <article>
                  <b>{totals.public_lineups}</b>
                  <span>Shared a lineup</span>
                </article>
                <article>
                  <b>{totals.looks_total}</b>
                  <span>Looks scanned</span>
                </article>
              </div>

              <Section title={`Funnel · ${rangeLabel}`} show={(data.funnel || []).some((f) => f.people)}>
                <Funnel steps={data.funnel || []} />
              </Section>

              <div className="yom-admin-split">
                <Section title="Stuck" show={stuckTotal > 0}>
                  <ul className="yom-admin-stuck">
                    {data.stuck?.no_scan?.length ? (
                      <li>
                        <b>{data.stuck.no_scan.length}</b> gave an email, never scanned
                      </li>
                    ) : null}
                    {data.stuck?.scanned_no_lineup?.length ? (
                      <li>
                        <b>{data.stuck.scanned_no_lineup.length}</b> scanned, no lineup
                      </li>
                    ) : null}
                    {data.stuck?.lineup_not_shared?.length ? (
                      <li>
                        <b>{data.stuck.lineup_not_shared.length}</b> have a lineup, not shared
                      </li>
                    ) : null}
                  </ul>
                </Section>

                <Section title="Input method" show={hasInputs}>
                  <Chips
                    data={data.by_input}
                    extra={
                      data.avg_score != null ? (
                        <span key="avg">
                          Avg score <b>{data.avg_score}</b>
                        </span>
                      ) : null
                    }
                  />
                </Section>

                <Section title="Rounds" show={hasRounds}>
                  <Chips data={data.by_round} />
                </Section>

                <Section title="Campaign" show={hasCampaigns}>
                  <Chips data={data.by_campaign} />
                </Section>

                <Section title="Opened, never gave an email" show={hasLeft}>
                  <Chips data={data.left_from} />
                  <Chips data={data.left_by} />
                </Section>
              </div>

              {!totals.looks_total && (
                <p className="yom-admin-note">
                  Nobody has scanned a look yet, so there is nothing to break down by input method or round.
                </p>
              )}
            </>
          )}

          {tab === "people" && !(data.people || []).length && (
            <p className="yom-admin-empty">
              No one has given an email yet{showInternal ? "." : ", or everyone so far is internal."}
            </p>
          )}

          {tab === "people" && !!(data.people || []).length && (
            <div className="yom-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Campaign</th>
                    <th>First seen</th>
                    <th>Looks</th>
                    <th>Lineup</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.people || []).map((p) => (
                    <tr
                      key={p.email}
                      className={`is-clickable${open === p.email ? " is-open" : ""}`}
                      onClick={() => openPerson(p.email)}
                    >
                      <td>{p.email}</td>
                      <td>{p.name || "—"}</td>
                      <td>{p.campaign || "—"}</td>
                      <td>{when(p.first_seen)}</td>
                      <td>{p.looks || 0}</td>
                      <td>{p.is_public ? "Public" : p.in_lineup ? `${p.in_lineup}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "activity" && totals.checks_missing && (
            <p className="yom-admin-empty">
              Only saved looks appear here. Run supabase/shares.sql and every check will be recorded — including
              the ones she looked at and walked away from.
            </p>
          )}

          {tab === "activity" && !(data.activity || []).length && !totals.checks_missing && (
            <p className="yom-admin-empty">No scans yet. Every look anyone checks will appear here.</p>
          )}

          {tab === "activity" && !!(data.activity || []).length && (
            <div className="yom-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Scanned</th>
                    <th>yom said</th>
                    <th>Input</th>
                    <th>Round</th>
                    <th>Score</th>
                    <th>Kept</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.activity || []).map((a, i) => (
                    <tr key={`${a.at}-${i}`}>
                      <td>{ago(a.at)}</td>
                      <td>{a.email || "—"}</td>
                      <td>{[a.brand, a.title].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="is-wide">{a.verdict || "—"}</td>
                      <td>{a.input || "—"}</td>
                      <td>{a.round || "—"}</td>
                      <td>{a.score ?? "—"}</td>
                      <td>{a.in_lineup ? "Kept" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "issues" && (
            <>
              {data.error_log_missing && (
                <p className="yom-admin-empty">
                  The error log table does not exist yet — run supabase/errors.sql and failures will appear here.
                </p>
              )}

              {!data.error_log_missing && !openIssues.length && !resolvedIssues.length && (
                <p className="yom-admin-empty">
                  Nothing has failed since the log was switched on. Failed scans, API errors and page crashes
                  land here with the person who hit them.
                </p>
              )}

              {!!openIssues.length && (
                <>
                  <Chips data={data.errors_by_kind} />
                  <ul className="yom-issues">
                    {openIssues.map((issue) => (
                      <IssueRow
                        key={issue.key}
                        issue={issue}
                        busy={working === issue.key}
                        onAction={() => act(issue, "resolve")}
                      />
                    ))}
                  </ul>
                </>
              )}

              {!openIssues.length && !!resolvedIssues.length && !data.error_log_missing && (
                <p className="yom-admin-empty">Nothing open. {resolvedIssues.length} resolved.</p>
              )}

              {!!resolvedIssues.length && (
                <Section title={`Resolved · ${resolvedIssues.length}`}>
                  <button
                    type="button"
                    className="yom-admin-toggle"
                    onClick={() => setShowResolved(!showResolved)}
                  >
                    {showResolved ? "Hide" : "Show"}
                  </button>
                  {showResolved && (
                    <ul className="yom-issues is-resolved">
                      {resolvedIssues.map((issue) => (
                        <IssueRow
                          key={issue.key}
                          issue={issue}
                          busy={working === issue.key}
                          onAction={() => act(issue, "reopen")}
                        />
                      ))}
                    </ul>
                  )}
                </Section>
              )}
            </>
          )}
        </>
      )}

      {person && (
        <aside className="yom-admin-drawer">
          <header>
            <div>
              <b>{person.name || person.email}</b>
              <span>{person.email}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                setDetail(null);
              }}
              aria-label="close"
            >
              ×
            </button>
          </header>
          <div className="yom-admin-campaigns">
            <span>
              First seen <b>{when(person.first_seen)}</b>
            </span>
            <span>
              Last seen <b>{ago(person.last_seen || person.first_seen)}</b>
            </span>
            <span>
              Checks <b>{detail?.checks ?? person.checks ?? 0}</b>
            </span>
            <span>
              Devices <b>{person.anon_ids?.length || 0}</b>
            </span>
            <span>
              Scans <b>{detail?.scans?.length ?? person.scans?.length ?? 0}</b>
            </span>
            <span>
              Kept <b>{person.in_lineup || 0}</b>
            </span>
            <span>
              Lineup <b>{person.is_public ? "Public" : "Private"}</b>
            </span>
          </div>
          {detailBusy && <p className="yom-admin-note">Loading her record…</p>}

          {detail?.lineup?.some((day) => day.pieces.length) && (
            <div className="yom-lineup">
              <h3 className="yom-admin-h">Her lineup</h3>
              <div className="yom-lineup-days">
                {LINEUP_DAYS.map((day) => {
                  const row = detail.lineup.find((d) => d.day === day.id);
                  return (
                    <div className="yom-lineup-day" key={day.id}>
                      <span>{day.chip}</span>
                      <div className="yom-lineup-pieces">
                        {row?.pieces.length ? (
                          row.pieces.map((piece, i) => (
                            <figure key={`${piece.title}-${i}`}>
                              {piece.image ? (
                                <img src={piece.image} alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="yom-thumb-empty" />
                              )}
                              <figcaption>{piece.slot}</figcaption>
                            </figure>
                          ))
                        ) : (
                          <div className="yom-thumb-empty is-blank" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(detail?.scans?.length || person.scans?.length) ? (
            <ol className="yom-admin-scans">
              {(detail?.scans?.length ? detail.scans : person.scans).map((scan) => (
                <li key={scan.id}>
                  <div className="yom-scan-row">
                    {scan.image ? (
                      <img className="yom-scan-photo" src={scan.image} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="yom-scan-photo is-empty" />
                    )}
                    <div className="yom-scan-text">
                      <div className="yom-scan-head">
                        <span className="yom-scan-when">{when(scan.at)}</span>
                        {scan.kept && <span className="yom-scan-kept">Kept</span>}
                      </div>
                      <b className="yom-scan-title">
                        {[scan.brand, scan.title].filter(Boolean).join(" · ") || "a look"}
                      </b>
                      <span className="yom-scan-meta">
                        {[
                          scan.input,
                          scan.category,
                          scan.color,
                          scan.price ? `$${scan.price}` : "",
                          scan.round,
                          scan.score != null ? `${scan.score}/10` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>

                  {scan.verdict_title && <p className="yom-scan-verdict">“{scan.verdict_title}”</p>}
                  {scan.verdict_body && <p className="yom-scan-body">{scan.verdict_body}</p>}
                  {scan.why && (
                    <p className="yom-scan-line">
                      <em>Why</em> {scan.why}
                    </p>
                  )}
                  {scan.change && (
                    <p className="yom-scan-line">
                      <em>Change</em> {scan.change}
                    </p>
                  )}
                  {scan.berkeley && (
                    <p className="yom-scan-line">
                      <em>Berkeley</em> {scan.berkeley}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            !detailBusy && <p className="yom-admin-empty">Gave an email, has not scanned anything.</p>
          )}
        </aside>
      )}
    </div>
  );
}
