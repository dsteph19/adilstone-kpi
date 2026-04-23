import { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

const PROXY = "/.netlify/functions/supabase-proxy";

async function sbGet(table, qs) {
  const params = "table=" + table + (qs ? "&qs=" + encodeURIComponent(qs) : "");
  const res = await fetch(PROXY + "?" + params);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(PROXY + "?table=" + table + "&qs=select=*", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => null);
}

async function sbPatch(table, qs, body) {
  const res = await fetch(PROXY + "?table=" + table + "&qs=" + encodeURIComponent(qs), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}



const B = {
  darkBlue:"#003763", lightBlue:"#42B4E3", black:"#010006",
  darkBlueLight:"#e8f0f7", darkBlueBorder:"#b3cce0",
  lightBlueLight:"#eaf7fd", lightBlueBorder:"#a8dfF4",
  green:"#16a34a", greenLight:"#f0fdf4", greenBorder:"#bbf7d0",
  amber:"#d97706", amberLight:"#fffbeb", amberBorder:"#fde68a",
  red:"#dc2626", redLight:"#fef2f2", redBorder:"#fecaca",
  muted:"#64748b", border:"#e2e8f0", surface:"#f8fafc",
};

const REVENUE_GOAL = 850000;
const PLACEMENT_GOAL = 32;
const INTENTIONAL_GOAL = 14;
const WEEK_START = "2026-04-20";

function fmtDollar(n) { return "$" + Number(n || 0).toLocaleString(); }
function fmtPct(n, d) { return d ? Math.round((n / d) * 100) + "%" : "0%"; }
function getBadge(s) {
  if (s >= 8) return { label: "Gold", color: B.amber };
  if (s >= 4) return { label: "Silver", color: B.muted };
  if (s >= 2) return { label: "Bronze", color: "#b45309" };
  return { label: "—", color: "#9ca3af" };
}

const statusMap = {
  "Open": { bg: B.darkBlueLight, text: B.darkBlue },
  "On Hold": { bg: B.amberLight, text: B.amber },
  "Filled": { bg: B.greenLight, text: B.green },
  "Cancelled": { bg: B.redLight, text: B.red },
};
function getStatusStyle(s) { return statusMap[s] || { bg: B.surface, text: B.muted }; }

function SLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: B.lightBlue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color, light, border }) {
  return (
    <div style={{ background: light || B.surface, border: "1px solid " + (border || B.border), borderRadius: 10, padding: "13px 15px" }}>
      <div style={{ fontSize: 11, color: B.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || B.black }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PBar({ value, max, color }) {
  const p = Math.min(100, Math.round(((value || 0) / max) * 100));
  return (
    <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{ width: p + "%", background: color || B.darkBlue, height: "100%", borderRadius: 99 }} />
    </div>
  );
}

function Pill({ children, color, bg, border }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, color: color || B.darkBlue, background: bg || B.darkBlueLight, border: "1px solid " + (border || B.darkBlueBorder) }}>
      {children}
    </span>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "9px 18px", border: "none", cursor: "pointer", fontWeight: active ? 600 : 400, borderBottom: active ? "2px solid " + B.darkBlue : "2px solid transparent", background: "transparent", color: active ? B.darkBlue : B.muted, fontSize: 14, whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}

function TH({ children }) {
  return <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 500, color: "#fff", fontSize: 12, whiteSpace: "nowrap" }}>{children}</th>;
}

function TD({ children, style }) {
  return <td style={{ padding: "9px 12px", ...style }}>{children}</td>;
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 28, height: 28, border: "3px solid " + B.darkBlueBorder, borderTopColor: B.darkBlue, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

function ErrBanner({ msg }) {
  return (
    <div style={{ background: B.redLight, border: "1px solid " + B.redBorder, borderRadius: 8, padding: "10px 14px", color: B.red, fontSize: 13, marginBottom: 12 }}>
      {msg}
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard() {
  const [placements, setPlacements] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [goals, setGoals] = useState({ revenue_goal: 0, placement_goal: 0, intentional_goal: 0 });
  const [suppRevenue, setSuppRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(function() {
    Promise.all([
      sbGet("placements"),
      sbGet("job_orders"),
      sbGet("settings"),
      sbGet("supplemental_revenue"),
    ])
      .then(function(results) {
        setPlacements(results[0]);
        setJobOrders(results[1]);
        var g = {};
        results[2].forEach(function(row) { g[row.key] = Number(row.value); });
        setGoals(g);
        setSuppRevenue(results[3]);
      })
      .catch(function(e) { setErr("Could not load dashboard: " + e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBanner msg={err} />;

  var REVENUE_GOAL = goals.revenue_goal || 0;
  var PLACEMENT_GOAL = goals.placement_goal || 0;
  var INTENTIONAL_GOAL = goals.intentional_goal || 0;

  const ytdPlacements = placements.filter(function(p) { return p.year === 2026; }).reduce(function(s, p) { return s + (p.fee || 0); }, 0);
  const suppTotal = suppRevenue.filter(function(r) { return r.year === 2026; }).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
  const engagementFeeTotal = jobOrders.filter(function(j) { return j.engagement_fee_year === 2026; }).reduce(function(s, j) { return s + (j.engagement_fee || 0); }, 0);
  const ytd = ytdPlacements + suppTotal + engagementFeeTotal;
  const totalPlaced = placements.length;
  const totalInt = placements.filter(function(p) { return p.intentional; }).length;
  const openJOs = jobOrders.filter(function(j) { return j.status === "Open"; }).length;
  const totalSubs = jobOrders.reduce(function(s, j) { return s + (j.total_submits || 0); }, 0);
  const totalFRI = jobOrders.reduce(function(s, j) { return s + (j.total_fri || 0); }, 0);
  const totalPlacements = jobOrders.reduce(function(s, j) { return s + (j.total_placements || 0); }, 0);
  const convRate = totalFRI ? Math.round((totalPlacements / totalFRI) * 100) : 0;

  const qGoals = { Q1: goals.q1_goal || REVENUE_GOAL/4, Q2: goals.q2_goal || REVENUE_GOAL/4, Q3: goals.q3_goal || REVENUE_GOAL/4, Q4: goals.q4_goal || REVENUE_GOAL/4 };
  const quarters = ["Q1", "Q2", "Q3", "Q4"].map(function(q) {
    var placementLanded = placements.filter(function(p) { return p.quarter === q && p.year === 2026; }).reduce(function(s, p) { return s + (p.fee || 0); }, 0);
    var suppLanded = suppRevenue.filter(function(r) { return r.quarter === q && r.year === 2026; }).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
    var engagementLanded = jobOrders.filter(function(j) { return j.engagement_fee_quarter === q && j.engagement_fee_year === 2026; }).reduce(function(s, j) { return s + (j.engagement_fee || 0); }, 0);
    return { q: q, landed: placementLanded + suppLanded + engagementLanded, goal: qGoals[q] };
  });

  const regions = ["Americas", "EMEA", "APAC"].map(function(r) {
    var suppRegion = suppRevenue.filter(function(s) { return s.region === r && s.year === 2026; }).reduce(function(acc, s) { return acc + (s.amount || 0); }, 0);
    var engagementRegion = jobOrders.filter(function(j) { return j.region === r && j.engagement_fee_year === 2026; }).reduce(function(s, j) { return s + (j.engagement_fee || 0); }, 0);
    return {
      r: r,
      count: placements.filter(function(p) { return p.region === r; }).length,
      intentional: placements.filter(function(p) { return p.region === r && p.intentional; }).length,
      revenue: placements.filter(function(p) { return p.region === r; }).reduce(function(s, p) { return s + (p.fee || 0); }, 0) + suppRegion + engagementRegion,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <SLabel>Financial</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(135px,1fr))", gap: 10, marginBottom: 10 }}>
          <StatCard label="Revenue Goal" value={fmtDollar(REVENUE_GOAL)} />
          <StatCard label="YTD Landed" value={fmtDollar(ytd)} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
          <StatCard label="Engagement Fees" value={fmtDollar(engagementFeeTotal)} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} sub="upfront fees collected" />
          <StatCard label="Supplemental" value={fmtDollar(suppTotal)} color={B.muted} sub="non-placement revenue" />
          <StatCard label="% of Goal" value={fmtPct(ytd, REVENUE_GOAL)} sub={fmtDollar(ytd) + " / " + fmtDollar(REVENUE_GOAL)} color={B.lightBlue} light={B.lightBlueLight} border={B.lightBlueBorder} />
        </div>
        <PBar value={ytd} max={REVENUE_GOAL} color={B.darkBlue} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          <span>{fmtDollar(ytd)} total revenue</span>
          <span>{fmtDollar(REVENUE_GOAL - ytd)} remaining</span>
        </div>
      </div>
      <div>
        <SLabel>Quarterly breakdown</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {quarters.map(function(item) {
            return (
              <div key={item.q} style={{ background: B.surface, border: "1px solid " + B.border, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.q}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: B.darkBlue, margin: "4px 0" }}>{fmtDollar(item.landed)}</div>
                <PBar value={item.landed} max={item.goal} color={B.lightBlue} />
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{fmtPct(item.landed, item.goal)} of target</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <SLabel>Placements</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(135px,1fr))", gap: 10 }}>
          <StatCard label="Goal" value={PLACEMENT_GOAL} />
          <StatCard label="Total Placed" value={totalPlaced} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
          <StatCard label="% of Goal" value={fmtPct(totalPlaced, PLACEMENT_GOAL)} color={B.lightBlue} light={B.lightBlueLight} border={B.lightBlueBorder} />
          <StatCard label="Intentional Goal" value={INTENTIONAL_GOAL} />
          <StatCard label="Total Intentional" value={totalInt} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
          <StatCard label="% Intentional" value={fmtPct(totalInt, totalPlaced)} color={B.muted} />
        </div>
      </div>
      <div>
        <SLabel>Pipeline conversion</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(135px,1fr))", gap: 10 }}>
          <StatCard label="Open Job Orders" value={openJOs} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
          <StatCard label="Total Submits" value={totalSubs} />
          <StatCard label="Total FRI" value={totalFRI} />
          <StatCard label="Submit to FRI" value={fmtPct(totalFRI, totalSubs)} color={B.lightBlue} light={B.lightBlueLight} border={B.lightBlueBorder} />
          <StatCard label="FRI to Placed" value={convRate + "%"} color={B.green} light={B.greenLight} border={B.greenBorder} sub="conversion rate" />
        </div>
      </div>
      <div>
        <SLabel>Regional performance</SLabel>
        <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: B.darkBlue }}>
                <TH>Region</TH><TH>Placements</TH><TH>% of Total</TH><TH>Revenue</TH><TH>Intentional</TH>
              </tr>
            </thead>
            <tbody>
              {regions.map(function(row) {
                return (
                  <tr key={row.r} style={{ borderBottom: "1px solid " + B.border }}>
                    <TD style={{ fontWeight: 600 }}>{row.r}</TD>
                    <TD>{row.count}</TD>
                    <TD>{fmtPct(row.count, totalPlaced)}</TD>
                    <TD>{fmtDollar(row.revenue)}</TD>
                    <TD>{row.intentional}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── WEEKLY ENTRY ───────────────────────────────────────────────────────────
function WeeklyEntry() {
  const [recruiters, setRecruiters] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [recId, setRecId] = useState("");
  const [rows, setRows] = useState({});
  const [numPlacements, setNumPlacements] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [formErr, setFormErr] = useState("");

  useEffect(function() {
    Promise.all([
      sbGet("recruiters", "active=eq.true"),
      sbGet("job_orders", "status=in.(\"Open\",\"On Hold\")"),
      sbGet("weekly_kpi_entries", "week_start=eq." + WEEK_START),
    ])
      .then(function(results) { setRecruiters(results[0]); setJobOrders(results[1]); setEntries(results[2]); })
      .catch(function(e) { setErr("Could not load data: " + e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBanner msg={err} />;

  const rec = recruiters.find(function(r) { return r.id === recId; });
  const myJOs = jobOrders;
  const submittedSet = new Set(entries.map(function(e) { return e.recruiter_id; }));
  const missing = recruiters.filter(function(r) { return !submittedSet.has(r.id); });

  function addCandidate(joId) {
    setRows(function(prev) {
      const existing = prev[joId] || [];
      return Object.assign({}, prev, { [joId]: existing.concat([{ id: Date.now(), name: "", submitted: false, hadFRI: false, placed: false }]) });
    });
  }

  function updateCand(joId, candId, field, val) {
    setRows(function(prev) {
      const updated = (prev[joId] || []).map(function(c) {
        if (c.id !== candId) return c;
        const changes = { [field]: val };
        if (field === "hadFRI" && val) changes.submitted = true;
        if (field === "placed" && val) { changes.submitted = true; changes.hadFRI = true; }
        return Object.assign({}, c, changes);
      });
      return Object.assign({}, prev, { [joId]: updated });
    });
  }

  function removeCand(joId, candId) {
    setRows(function(prev) {
      return Object.assign({}, prev, { [joId]: (prev[joId] || []).filter(function(c) { return c.id !== candId; }) });
    });
  }

  var totalSubmits = 0, totalFRI = 0;
  Object.values(rows).forEach(function(cands) {
    cands.forEach(function(c) {
      if (c.submitted && c.name.trim()) totalSubmits++;
      if (c.hadFRI && c.name.trim()) totalFRI++;
    });
  });

  function calcPoints() {
    var pts = 0;
    var rules = [];
    pts += 5; rules.push("On-time submission +5");
    pts += 3; rules.push("Complete submission +3");
    if (totalSubmits >= (rec ? rec.weekly_submits_target || 2 : 2)) { pts += 5; rules.push("Submits target hit +5"); }
    if (totalFRI >= (rec ? rec.weekly_fri_target || 1 : 1)) { pts += 5; rules.push("FRI target hit +5"); }
    if (numPlacements > 0) { pts += 10; rules.push("Placement logged +10"); }
    var prevStreak = entries.filter(function(e) { return e.recruiter_id === recId && e.submitted_on_time; }).length;
    var streak = prevStreak + 1;
    if (streak >= 4) { pts += 7; rules.push("4-week streak bonus +7"); }
    else if (streak >= 2) { pts += 3; rules.push("2-week streak bonus +3"); }
    return { pts: pts, rules: rules, streak: streak };
  }

  async function handleSubmit() {
    setFormErr("");
    if (!recId) { setFormErr("Please select a recruiter."); return; }
    if (submittedSet.has(recId)) { setFormErr("This recruiter already submitted for this week."); return; }
    setSubmitting(true);
    try {
      var scored = calcPoints();
      await sbPost("weekly_kpi_entries", {
        week_start: WEEK_START, recruiter_id: recId,
        weekly_submits: totalSubmits, weekly_fri: totalFRI, weekly_placements: numPlacements,
        submitted_on_time: true, notes: notes,
        total_points: scored.pts, streak_count: scored.streak,
      });
      var candInserts = [];
      for (var joId in rows) {
        var named = (rows[joId] || []).filter(function(c) { return c.name.trim(); });
        if (!named.length) continue;
        named.forEach(function(c) {
          candInserts.push({ job_order_id: joId, candidate_name: c.name.trim(), week: WEEK_START, recruiter_id: recId, submitted: c.submitted, had_fri: c.hadFRI, placed: c.placed });
        });
        var jo = jobOrders.find(function(j) { return j.id === joId; });
        if (jo) {
          await sbPatch("job_orders", "id=eq." + joId, {
            total_submits: (jo.total_submits || 0) + named.filter(function(c) { return c.submitted; }).length,
            total_fri: (jo.total_fri || 0) + named.filter(function(c) { return c.hadFRI; }).length,
            total_placements: (jo.total_placements || 0) + named.filter(function(c) { return c.placed; }).length,
          });
        }
      }
      if (candInserts.length) await sbPost("candidates", candInserts);
      setSuccess({ rec: rec, pts: scored.pts, rules: scored.rules, streak: scored.streak, submits: totalSubmits, fri: totalFRI, placements: numPlacements });
      setRecId(""); setRows({}); setNumPlacements(0); setNotes("");
    } catch (e) {
      setFormErr("Submission failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    var badge = getBadge(success.streak);
    return (
      <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: B.darkBlueLight, border: "1px solid " + B.darkBlueBorder, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: B.darkBlue, marginBottom: 4 }}>Submitted successfully</div>
          <div style={{ fontSize: 13 }}>{success.rec.recruiter_name} — week of {WEEK_START}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 13 }}>
            <span><b>{success.submits}</b> submits</span>
            <span><b>{success.fri}</b> FRI</span>
            <span><b>{success.placements}</b> placements</span>
          </div>
        </div>
        <div style={{ background: B.surface, border: "1px solid " + B.border, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: B.darkBlue }}>{success.pts} pts</div>
          <div style={{ fontSize: 12, color: B.muted, marginBottom: 10 }}>Points earned this week</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13 }}>Streak: <b>{success.streak}wk</b></span>
            {badge.label !== "—" && <Pill color={badge.color} bg={badge.color + "11"} border={badge.color + "44"}>{badge.label}</Pill>}
          </div>
          {success.rules.map(function(r, i) {
            return (
              <div key={i} style={{ fontSize: 12, color: B.muted, display: "flex", gap: 6, marginBottom: 3 }}>
                <span style={{ color: B.green }}>✓</span>{r}
              </div>
            );
          })}
        </div>
        <button onClick={function() { setSuccess(null); }} style={{ background: B.darkBlue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "flex-start" }}>Submit another</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 340px", minWidth: 300 }}>
        <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <SLabel>Week of</SLabel>
            <div style={{ background: B.surface, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: B.muted }}>{WEEK_START}</div>
          </div>
          <div>
            <SLabel>Recruiter *</SLabel>
            <select value={recId} onChange={function(e) { setRecId(e.target.value); setRows({}); }}
              style={{ width: "100%", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none" }}>
              <option value="">Select recruiter…</option>
              {recruiters.filter(function(r) { return !submittedSet.has(r.id); }).map(function(r) {
                return <option key={r.id} value={r.id}>{r.recruiter_name} ({r.regional_office})</option>;
              })}
            </select>
          </div>

          {recId && (
            <div>
              <SLabel>Candidate activity by job order</SLabel>
              {myJOs.length === 0
                ? <div style={{ fontSize: 13, color: B.muted, fontStyle: "italic" }}>No open job orders assigned.</div>
                : myJOs.map(function(jo) {
                  var cands = rows[jo.id] || [];
                  var joS = cands.filter(function(c) { return c.submitted && c.name.trim(); }).length;
                  var joF = cands.filter(function(c) { return c.hadFRI && c.name.trim(); }).length;
                  var joP = cands.filter(function(c) { return c.placed && c.name.trim(); }).length;
                  return (
                    <div key={jo.id} style={{ background: B.surface, border: "1px solid " + B.border, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: B.darkBlue }}>{jo.role}</div>
                          <div style={{ fontSize: 11, color: B.muted }}>{jo.client} · {jo.region} · {jo.type}{jo.intentional_role ? " · Intentional" : ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {joS > 0 && <Pill>{joS}S</Pill>}
                          {joF > 0 && <Pill color={B.green} bg={B.greenLight} border={B.greenBorder}>{joF}F</Pill>}
                          {joP > 0 && <Pill color={B.amber} bg={B.amberLight} border={B.amberBorder}>{joP}P</Pill>}
                        </div>
                      </div>
                      {cands.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 24px", gap: 6, marginBottom: 4, fontSize: 10, color: B.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            <span>Candidate</span><span style={{ textAlign: "center" }}>Sub</span><span style={{ textAlign: "center" }}>FRI</span><span style={{ textAlign: "center" }}>Placed</span><span />
                          </div>
                          {cands.map(function(c) {
                            return (
                              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 24px", gap: 6, alignItems: "center", marginBottom: 5 }}>
                                <input value={c.name} onChange={function(e) { updateCand(jo.id, c.id, "name", e.target.value); }} placeholder="Full name"
                                  style={{ border: "1px solid " + B.border, borderRadius: 6, padding: "5px 8px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }} />
                                {["submitted", "hadFRI", "placed"].map(function(f) {
                                  return (
                                    <div key={f} style={{ display: "flex", justifyContent: "center" }}>
                                      <input type="checkbox" checked={c[f]} onChange={function(e) { updateCand(jo.id, c.id, f, e.target.checked); }}
                                        style={{ width: 16, height: 16, accentColor: B.darkBlue, cursor: "pointer" }} />
                                    </div>
                                  );
                                })}
                                <button onClick={function() { removeCand(jo.id, c.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 15, padding: 0 }}>×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button onClick={function() { addCandidate(jo.id); }} style={{ fontSize: 12, color: B.darkBlue, background: "none", border: "1px dashed " + B.darkBlueBorder, borderRadius: 6, padding: "5px 10px", cursor: "pointer", width: "100%" }}>+ Add candidate</button>
                    </div>
                  );
                })
              }
            </div>
          )}

          {recId && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[["Submits", totalSubmits, rec ? rec.weekly_submits_target : 2], ["FRI", totalFRI, rec ? rec.weekly_fri_target : 1], ["Placements", numPlacements, null]].map(function(item) {
                var label = item[0], val = item[1], target = item[2];
                return (
                  <div key={label} style={{ background: target && val >= target ? B.darkBlueLight : B.surface, border: "1px solid " + (target && val >= target ? B.darkBlueBorder : B.border), borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: B.muted }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: target && val >= target ? B.darkBlue : B.black }}>{val}</div>
                    {target && <div style={{ fontSize: 10, color: B.muted }}>Target: {target}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {recId && (
            <div>
              <SLabel>Placements this week</SLabel>
              <input type="number" min="0" value={numPlacements || ""} placeholder="0"
                onChange={function(e) { setNumPlacements(parseInt(e.target.value) || 0); }}
                style={{ width: "100%", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          <div>
            <SLabel>Notes</SLabel>
            <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} placeholder="Optional…"
              style={{ width: "100%", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", minHeight: 56, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          {formErr && <ErrBanner msg={formErr} />}
          <button onClick={handleSubmit} disabled={submitting}
            style={{ background: B.darkBlue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: submitting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Submitting…" : "Submit weekly KPIs"}
          </button>
        </div>
      </div>

      <div style={{ flex: "0 0 190px", minWidth: 170 }}>
        <SLabel>{"Pending (" + missing.length + ")"}</SLabel>
        {missing.length === 0
          ? <div style={{ color: B.green, fontSize: 13 }}>All submitted ✓</div>
          : missing.map(function(r) {
            return (
              <div key={r.id} style={{ background: B.amberLight, border: "1px solid " + B.amberBorder, borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{r.recruiter_name}</div>
                <div style={{ color: "#92400e", fontSize: 11 }}>{r.regional_office} · {r.manager_name}</div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

// ── JOB ORDERS ─────────────────────────────────────────────────────────────
function JobOrders() {
  const [jobOrders, setJobOrders] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null);

  useEffect(function() {
    Promise.all([sbGet("job_orders"), sbGet("recruiters"), sbGet("candidates")])
      .then(function(results) { setJobOrders(results[0]); setRecruiters(results[1]); setCandidates(results[2]); })
      .catch(function(e) { setErr("Could not load job orders: " + e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBanner msg={err} />;

  if (detail) {
    var jo = jobOrders.find(function(j) { return j.id === detail; });
    var rec = recruiters.find(function(r) { return r.id === jo.recruiter_id; });
    var joCands = candidates.filter(function(c) { return c.job_order_id === detail; });
    var friRate = jo.total_submits ? Math.round(((jo.total_fri || 0) / jo.total_submits) * 100) : 0;
    var placeRate = jo.total_fri ? Math.round(((jo.total_placements || 0) / jo.total_fri) * 100) : 0;
    var sc = getStatusStyle(jo.status);

    const stageColors = { Placed: B.green, FRI: B.lightBlue, Submitted: B.darkBlue, "—": B.muted };
    const stageBgs = { Placed: B.greenLight, FRI: B.lightBlueLight, Submitted: B.darkBlueLight, "—": B.surface };

    return (
      <div>
        <button onClick={function() { setDetail(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: B.darkBlue, fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}>← Back</button>
        <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: B.darkBlue }}>{jo.role}</div>
              <div style={{ fontSize: 13, color: B.muted, marginTop: 2 }}>{jo.client} · {rec ? rec.recruiter_name : ""} · {jo.region}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {jo.intentional_role && <Pill>Intentional</Pill>}
              <span style={{ background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{jo.status}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
            <StatCard label="Total Submits" value={jo.total_submits || 0} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
            <StatCard label="Total FRI" value={jo.total_fri || 0} color={B.darkBlue} light={B.darkBlueLight} border={B.darkBlueBorder} />
            <StatCard label="Placements" value={jo.total_placements || 0} color={(jo.total_placements || 0) > 0 ? B.green : B.black} light={(jo.total_placements || 0) > 0 ? B.greenLight : B.surface} border={(jo.total_placements || 0) > 0 ? B.greenBorder : B.border} />
            <StatCard label="Submit to FRI" value={friRate + "%"} color={B.lightBlue} light={B.lightBlueLight} border={B.lightBlueBorder} />
            <StatCard label="FRI to Placed" value={placeRate + "%"} color={placeRate > 0 ? B.green : B.muted} />
            <StatCard label="Days Open" value={(jo.days_open || 0) + "d"} color={(jo.days_open || 0) > 30 ? B.red : B.green} />
            <StatCard label="Fee" value={fmtDollar(jo.fee)} />
          </div>
        </div>

        <SLabel>Candidate pipeline</SLabel>
        {joCands.length === 0
          ? <div style={{ fontSize: 13, color: B.muted, fontStyle: "italic" }}>No candidates logged yet.</div>
          : (
            <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: B.darkBlue }}>
                    <TH>Candidate</TH><TH>Week</TH><TH>Submitted</TH><TH>FRI</TH><TH>Placed</TH><TH>Stage</TH>
                  </tr>
                </thead>
                <tbody>
                  {joCands.map(function(c, i) {
                    var stage = c.placed ? "Placed" : c.had_fri ? "FRI" : c.submitted ? "Submitted" : "—";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid " + B.border }}>
                        <TD style={{ fontWeight: 600 }}>{c.candidate_name}</TD>
                        <TD style={{ color: B.muted }}>{c.week}</TD>
                        <TD><span style={{ color: c.submitted ? B.green : "#94a3b8" }}>{c.submitted ? "✓" : "—"}</span></TD>
                        <TD><span style={{ color: c.had_fri ? B.green : "#94a3b8" }}>{c.had_fri ? "✓" : "—"}</span></TD>
                        <TD><span style={{ color: c.placed ? B.green : "#94a3b8" }}>{c.placed ? "✓" : "—"}</span></TD>
                        <TD><span style={{ background: stageBgs[stage], color: stageColors[stage], fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{stage}</span></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }

        {joCands.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SLabel>Conversion funnel</SLabel>
            <div style={{ display: "flex", background: B.surface, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
              {[["Submitted", jo.total_submits || 0, B.darkBlue], ["to FRI", jo.total_fri || 0, B.lightBlue], ["to Placed", jo.total_placements || 0, B.green]].map(function(item, i) {
                var label = item[0], val = item[1], color = item[2];
                var denom = i === 1 ? (jo.total_submits || 0) : (jo.total_fri || 0);
                return (
                  <div key={i} style={{ flex: 1, padding: "14px 16px", textAlign: "center", borderRight: i < 2 ? "1px solid " + B.border : "none" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: color }}>{val}</div>
                    <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{label}</div>
                    {i > 0 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{fmtPct(val, denom)} rate</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const statuses = ["All", "Open", "On Hold", "Filled", "Cancelled"];
  const filtered = filter === "All" ? jobOrders : jobOrders.filter(function(j) { return j.status === filter; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {statuses.map(function(s) {
          return (
            <button key={s} onClick={function() { setFilter(s); }}
              style={{ padding: "5px 14px", borderRadius: 99, border: "1px solid", cursor: "pointer", fontSize: 13, background: filter === s ? B.darkBlue : "#fff", color: filter === s ? "#fff" : B.muted, borderColor: filter === s ? B.darkBlue : B.border }}>
              {s}
            </button>
          );
        })}
      </div>
      <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: B.darkBlue }}>
              <TH>Role</TH><TH>Client</TH><TH>Recruiter</TH><TH>Submits</TH><TH>FRI</TH><TH>Sub to FRI</TH><TH>FRI to Placed</TH><TH>Days Open</TH><TH>Status</TH><TH></TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map(function(j) {
              var r = recruiters.find(function(x) { return x.id === j.recruiter_id; });
              var fr = j.total_submits ? Math.round(((j.total_fri || 0) / j.total_submits) * 100) : 0;
              var pr = j.total_fri ? Math.round(((j.total_placements || 0) / j.total_fri) * 100) : 0;
              var sc = getStatusStyle(j.status);
              return (
                <tr key={j.id} style={{ borderBottom: "1px solid " + B.border }}>
                  <TD style={{ fontWeight: 600, color: B.darkBlue }}>
                    {j.role}
                    {j.intentional_role && <span style={{ marginLeft: 6, fontSize: 10, background: B.lightBlueLight, color: B.darkBlue, padding: "1px 5px", borderRadius: 99, border: "1px solid " + B.lightBlueBorder }}>INT</span>}
                  </TD>
                  <TD style={{ color: B.muted }}>{j.client}</TD>
                  <TD>{r ? r.recruiter_name : ""}</TD>
                  <TD>{j.total_submits || 0}</TD>
                  <TD>{j.total_fri || 0}</TD>
                  <TD><span style={{ color: fr >= 50 ? B.green : fr > 0 ? B.amber : B.muted, fontWeight: 600 }}>{fr}%</span></TD>
                  <TD><span style={{ color: pr > 0 ? B.green : B.muted, fontWeight: 600 }}>{pr}%</span></TD>
                  <TD><span style={{ color: (j.days_open || 0) > 30 ? B.red : B.green, fontWeight: 600 }}>{j.days_open || 0}d</span></TD>
                  <TD><span style={{ background: sc.bg, color: sc.text, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>{j.status}</span></TD>
                  <TD><button onClick={function() { setDetail(j.id); }} style={{ background: B.darkBlue, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>View →</button></TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LEADERBOARD ────────────────────────────────────────────────────────────
function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(function() {
    Promise.all([sbGet("recruiters", "active=eq.true"), sbGet("weekly_kpi_entries")])
      .then(function(results) {
        var recruiters = results[0];
        var entries = results[1];
        var s = recruiters.map(function(rec) {
          var mine = entries.filter(function(e) { return e.recruiter_id === rec.id; });
          return {
            rec: rec,
            totalPts: mine.reduce(function(s, e) { return s + (e.total_points || 0); }, 0),
            streak: mine.length ? Math.max.apply(null, mine.map(function(e) { return e.streak_count || 0; })) : 0,
            onTimePct: mine.length ? Math.round((mine.filter(function(e) { return e.submitted_on_time; }).length / mine.length) * 100) : 0,
            totalSubmits: mine.reduce(function(s, e) { return s + (e.weekly_submits || 0); }, 0),
            totalFRI: mine.reduce(function(s, e) { return s + (e.weekly_fri || 0); }, 0),
            totalPlacements: mine.reduce(function(s, e) { return s + (e.weekly_placements || 0); }, 0),
          };
        }).sort(function(a, b) { return b.totalPts - a.totalPts; });
        setScores(s);
      })
      .catch(function(e) { setErr("Could not load leaderboard: " + e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) return <Spinner />;
  if (err) return <ErrBanner msg={err} />;

  function rankColor(i) {
    if (i === 0) return B.amber;
    if (i === 1) return B.muted;
    if (i === 2) return "#b45309";
    return "#94a3b8";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {scores.slice(0, 3).map(function(item, i) {
          var badge = getBadge(item.streak);
          return (
            <div key={item.rec.id} style={{ background: "#fff", border: "2px solid " + rankColor(i), borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: rankColor(i), marginBottom: 4 }}>{"#" + (i + 1)}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: B.darkBlue, marginBottom: 2 }}>{item.rec.recruiter_name}</div>
              <div style={{ fontSize: 12, color: B.muted, marginBottom: 10 }}>{item.rec.regional_office}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: B.darkBlue }}>{item.totalPts}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>points</div>
              {badge.label !== "—" && <Pill color={badge.color} bg={badge.color + "11"} border={badge.color + "44"}>{badge.label}</Pill>}
              <div style={{ fontSize: 11, color: B.muted, marginTop: 6 }}>{item.onTimePct}% on-time · {item.streak}wk streak</div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: B.darkBlue }}>
              <TH>Rank</TH><TH>Recruiter</TH><TH>Region</TH><TH>Points</TH><TH>Streak</TH><TH>Badge</TH><TH>Submits</TH><TH>FRI</TH><TH>Placements</TH><TH>On-time %</TH>
            </tr>
          </thead>
          <tbody>
            {scores.map(function(item, i) {
              var badge = getBadge(item.streak);
              return (
                <tr key={item.rec.id} style={{ borderBottom: "1px solid " + B.border }}>
                  <TD style={{ fontWeight: 700, color: rankColor(i) }}>{"#" + (i + 1)}</TD>
                  <TD style={{ fontWeight: 600, color: B.darkBlue }}>{item.rec.recruiter_name}</TD>
                  <TD style={{ color: B.muted }}>{item.rec.regional_office}</TD>
                  <TD style={{ fontWeight: 700, color: B.darkBlue }}>{item.totalPts}</TD>
                  <TD>{item.streak}wk</TD>
                  <TD>{badge.label !== "—" && <Pill color={badge.color} bg={badge.color + "11"} border={badge.color + "44"}>{badge.label}</Pill>}</TD>
                  <TD>{item.totalSubmits}</TD>
                  <TD>{item.totalFRI}</TD>
                  <TD>{item.totalPlacements}</TD>
                  <TD><span style={{ color: item.onTimePct >= 80 ? B.green : item.onTimePct >= 50 ? B.amber : B.red, fontWeight: 600 }}>{item.onTimePct}%</span></TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── GUIDE ──────────────────────────────────────────────────────────────────
function Guide() {
  const [section, setSection] = useState("dashboard");
  const sections = [
    { id: "dashboard", label: "Dashboard" },
    { id: "weekly", label: "Weekly Entry" },
    { id: "joborders", label: "Job Orders" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "admin", label: "Admin Guide" },
    { id: "glossary", label: "Definitions" },
  ];

  function NavBtn({ id, label }) {
    return (
      <button onClick={function() { setSection(id); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 13, fontWeight: section === id ? 600 : 400, background: section === id ? B.darkBlue : "#fff", color: section === id ? "#fff" : B.muted, borderColor: section === id ? B.darkBlue : B.border, whiteSpace: "nowrap" }}>
        {label}
      </button>
    );
  }

  function Block({ title, children }) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: B.lightBlue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    );
  }

  function GTable({ headers, rows }) {
    return (
      <div style={{ background: "#fff", border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: B.darkBlue }}>{headers.map(function(h) { return <TH key={h}>{h}</TH>; })}</tr></thead>
          <tbody>{rows.map(function(row, i) {
            return (
              <tr key={i} style={{ borderBottom: "1px solid " + B.border, background: i % 2 === 0 ? "#fff" : B.surface }}>
                {row.map(function(cell, j) { return <TD key={j} style={j === 0 ? { fontWeight: 600, color: B.darkBlue, whiteSpace: "nowrap" } : {}}>{cell}</TD>; })}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  function Callout({ children, type }) {
    var bg = type === "warn" ? B.amberLight : B.lightBlueLight;
    var border = type === "warn" ? B.amberBorder : B.lightBlueBorder;
    var color = type === "warn" ? "#92400e" : B.darkBlue;
    return <div style={{ background: bg, border: "1px solid " + border, borderRadius: 8, padding: "12px 16px", fontSize: 13, color: color, lineHeight: 1.6, marginBottom: 16 }}>{children}</div>;
  }

  function Step({ n, children }) {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: B.darkBlue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, paddingTop: 2 }}>{children}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      {/* Nav */}
      <div style={{ flex: "0 0 150px", display: "flex", flexDirection: "column", gap: 6 }}>
        {sections.map(function(s) { return <NavBtn key={s.id} id={s.id} label={s.label} />; })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {section === "dashboard" && (
          <div>
            <Block title="Financial cards">
              <GTable headers={["Card", "What it means"]} rows={[
                ["Revenue Goal", "Annual revenue target set by leadership"],
                ["YTD Landed", "Total revenue this year — placement fees + engagement fees + supplemental combined"],
                ["Engagement Fees", "Upfront fees collected when an engaged role is signed, regardless of placement status"],
                ["Supplemental", "Revenue not tied to a placement — retainers, consulting, referrals"],
                ["% of Goal", "YTD Landed divided by Revenue Goal"],
              ]} />
            </Block>
            <Block title="Quarterly breakdown">
              <Callout>Each quarter shows total revenue landed against that quarter's individual target. Targets can differ across quarters and are updated by admin in Supabase — no code changes needed.</Callout>
            </Block>
            <Block title="Placements">
              <GTable headers={["Card", "What it means"]} rows={[
                ["Goal", "Annual placement count target"],
                ["Total Placed", "Number of placements logged this year"],
                ["% of Goal", "Total placed divided by placement goal"],
                ["Intentional Goal", "Annual target for intentional placements"],
                ["Total Intentional", "Placements flagged as intentional by admin"],
                ["% Intentional", "Intentional placements as a share of all placements"],
              ]} />
            </Block>
            <Block title="Pipeline conversion">
              <GTable headers={["Card", "What it means"]} rows={[
                ["Open Job Orders", "Roles currently with Open status"],
                ["Total Submits", "Cumulative submissions across all job orders"],
                ["Total FRI", "Cumulative first round interviews across all job orders"],
                ["Submit to FRI", "Percentage of submissions that progressed to an FRI"],
                ["FRI to Placed", "Percentage of FRIs that resulted in a placement"],
              ]} />
            </Block>
            <Block title="Regional performance">
              <p style={{ fontSize: 13, color: "#374151" }}>Shows Americas, EMEA, and APAC broken down by placement count, share of total placements, total revenue (all three streams), and intentional placement count. All figures update automatically.</p>
            </Block>
          </div>
        )}

        {section === "weekly" && (
          <div>
            <Callout><b>Submit once per week.</b> The system accepts one submission per recruiter per week. Missing submissions are flagged automatically and visible to leadership.</Callout>
            <Block title="How to submit">
              <Step n="1">Go to the <b>Weekly Entry</b> tab.</Step>
              <Step n="2">Select your name from the <b>Recruiter</b> dropdown. Only recruiters who have not yet submitted for the current week appear.</Step>
              <Step n="3">The current week is shown automatically — you cannot change it.</Step>
              <Step n="4">For each job order you worked on, click <b>+ Add candidate</b> and enter the candidate's full name.</Step>
              <Step n="5">Check the relevant boxes — <b>Sub</b> (submitted to client), <b>FRI</b> (first round interview held), <b>Placed</b> (placement confirmed). Checking FRI auto-checks Submitted. Checking Placed auto-checks both.</Step>
              <Step n="6">Add multiple candidates per job order as needed. Remove any with the × button.</Step>
              <Step n="7">Enter the number of <b>Placements</b> at the bottom and any optional notes.</Step>
              <Step n="8">Click <b>Submit weekly KPIs</b>. You will see your points earned and current streak.</Step>
            </Block>
            <Block title="All job orders are visible">
              <p style={{ fontSize: 13, color: "#374151" }}>Every open and on-hold job order appears in the form — not just roles assigned to you. This allows multiple recruiters to log activity against the same role when collaborating. Your candidate entries are always tagged with your name.</p>
            </Block>
            <Block title="Weekly targets">
              <GTable headers={["Metric", "Default target"]} rows={[
                ["Weekly Submits", "2 per week"],
                ["Weekly FRI", "1 per week"],
              ]} />
              <p style={{ fontSize: 13, color: "#374151" }}>Targets turn dark blue in the summary cards when you have hit them for the week. Individual targets can be adjusted by your manager in Supabase.</p>
            </Block>
          </div>
        )}

        {section === "joborders" && (
          <div>
            <Block title="Column reference">
              <GTable headers={["Column", "What it means"]} rows={[
                ["Role", "Job title being recruited for"],
                ["Client", "Hiring organization"],
                ["Recruiter", "Primary owner of the role"],
                ["Submits", "Total candidate submissions logged to date"],
                ["FRI", "Total first round interviews logged to date"],
                ["Sub to FRI", "Submission to FRI conversion rate — green above 50%, amber above 0%"],
                ["FRI to Placed", "FRI to placement conversion rate"],
                ["Days Open", "How long the role has been open — red when over 30 days"],
                ["Status", "Open, On Hold, Filled, or Cancelled"],
                ["INT badge", "Marks roles flagged as Intentional"],
              ]} />
            </Block>
            <Block title="Detail view">
              <p style={{ fontSize: 13, color: "#374151" }}>Click <b>View →</b> on any role to open a detailed view showing all role metrics, the full candidate pipeline with stage badges (Submitted / FRI / Placed), and a conversion funnel with rates for that role.</p>
            </Block>
            <Block title="Filtering">
              <p style={{ fontSize: 13, color: "#374151" }}>Use the status filter buttons at the top to view only Open, On Hold, Filled, or Cancelled roles.</p>
            </Block>
          </div>
        )}

        {section === "leaderboard" && (
          <div>
            <Callout>The leaderboard recognizes consistency and effort — not just outcomes. Points are earned for submitting on time, hitting activity targets, and maintaining streaks over time.</Callout>
            <Block title="How points are earned">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[["On-time submission","+5"],["Complete submission","+3"],["Submits target hit","+5"],["FRI target hit","+5"],["Placement logged","+10"],["2-week streak bonus","+3"],["4-week streak bonus","+7"],["8-week streak bonus","+15"]].map(function(item) {
                  return (
                    <div key={item[0]} style={{ display: "flex", justifyContent: "space-between", background: B.surface, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px" }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>{item[0]}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: B.darkBlue }}>{item[1]}</span>
                    </div>
                  );
                })}
              </div>
            </Block>
            <Block title="Badges">
              <GTable headers={["Badge", "Requirement"]} rows={[
                ["🥉 Bronze", "2 consecutive on-time weeks"],
                ["🥈 Silver", "4 consecutive on-time weeks"],
                ["🥇 Gold", "8 consecutive on-time weeks"],
              ]} />
            </Block>
            <Block title="Leaderboard columns">
              <GTable headers={["Column", "What it means"]} rows={[
                ["Points", "Cumulative points earned all-time"],
                ["Streak", "Longest consecutive on-time submission streak"],
                ["Submits / FRI / Placements", "Cumulative activity totals"],
                ["On-time %", "Percentage of submissions made on time"],
              ]} />
            </Block>
          </div>
        )}

        {section === "admin" && (
          <div>
            <Callout><b>All data is managed in Supabase.</b> Go to supabase.com → sign in → adilstone-kpi project → Table Editor. Changes appear in the app immediately on the next page load.</Callout>
            <Block title="Recruiters table">
              <GTable headers={["Task", "What to do"]} rows={[
                ["Add a recruiter", "Insert a new row and fill in all fields"],
                ["Deactivate a recruiter", "Set active to false — history is kept but they disappear from the entry form"],
                ["Update weekly targets", "Edit weekly_submits_target or weekly_fri_target"],
              ]} />
            </Block>
            <Block title="Job orders table">
              <GTable headers={["Task", "What to do"]} rows={[
                ["Add a job order", "Insert a new row — fill in role, client, region, recruiter_id, status, type, fee, date_received"],
                ["Mark as filled", "Change status to Filled"],
                ["Put on hold", "Change status to On Hold"],
                ["Record engagement fee", "Fill in engagement_fee, engagement_fee_date, engagement_fee_quarter, engagement_fee_year"],
                ["Update days open", "Edit days_open — update weekly for open roles"],
              ]} />
            </Block>
            <Block title="Placements table">
              <GTable headers={["Task", "What to do"]} rows={[
                ["Add a placement", "Insert a new row — required: candidate_name, recruiter_id, start_date, fee, placement_type, quarter, year, region"],
                ["Mark as intentional", "Set intentional to true"],
                ["Link to a job order", "Enter the job order UUID in job_order_id"],
              ]} />
            </Block>
            <Block title="Supplemental revenue table">
              <GTable headers={["Field", "What to enter"]} rows={[
                ["description", "Brief note e.g. Q2 retainer — FinCo"],
                ["amount", "Number only — no $ sign or commas"],
                ["region", "Americas, EMEA, or APAC"],
                ["date", "YYYY-MM-DD format"],
                ["quarter", "Q1, Q2, Q3, or Q4"],
                ["year", "e.g. 2026"],
                ["category", "Retainer, Consulting, Referral, etc."],
              ]} />
            </Block>
            <Block title="Settings table — updating goals">
              <GTable headers={["Key", "What it controls"]} rows={[
                ["revenue_goal", "Annual revenue target"],
                ["placement_goal", "Annual placement count target"],
                ["intentional_goal", "Annual intentional placement target"],
                ["q1_goal through q4_goal", "Individual quarterly revenue targets"],
              ]} />
            </Block>
            <Block title="Pushing app updates">
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>When code changes are made in VS Code, run these in Terminal:</p>
              <div style={{ background: B.black, color: "#e2e8f0", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, lineHeight: 2 }}>
                git add .<br />
                git commit -m "Description of change"<br />
                git push
              </div>
            </Block>
          </div>
        )}

        {section === "glossary" && (
          <div>
            <Block title="Key definitions">
              <GTable headers={["Term", "Definition"]} rows={[
                ["Submit", "A candidate formally submitted to a client for consideration on a specific role"],
                ["FRI", "First Round Interview — a candidate who has progressed to a first interview with the client"],
                ["Intentional placement", "A placement that meets your organization's internal criteria for an intentional hire"],
                ["Engaged role", "A job order where the client has paid an upfront engagement fee to retain Adilstone's services"],
                ["Contingent role", "A job order where Adilstone's fee is contingent on a successful placement only"],
                ["Engagement fee", "Upfront fee collected when a new engaged role is signed — counts toward YTD revenue immediately"],
                ["Supplemental revenue", "Revenue not tied to a placement — retainers, consulting fees, referral income"],
                ["YTD Landed", "Year-to-date total revenue — placement fees + engagement fees + supplemental revenue"],
                ["Streak", "Number of consecutive weeks a recruiter has submitted on time"],
                ["On-time submission", "A weekly KPI entry submitted before the weekly deadline"],
              ]} />
            </Block>
          </div>
        )}

      </div>
    </div>
  );
}

// ── SETUP GUIDE ────────────────────────────────────────────────────────────
const SQL_SCRIPT = [
  "-- Run this in Supabase → SQL Editor",
  "",
  "create table recruiters (",
  "  id uuid primary key default gen_random_uuid(),",
  "  recruiter_id text unique not null,",
  "  recruiter_name text not null,",
  "  email text,",
  "  regional_office text,",
  "  active boolean default true,",
  "  weekly_submits_target int default 2,",
  "  weekly_fri_target int default 1,",
  "  monthly_revenue_target numeric,",
  "  manager_name text",
  ");",
  "",
  "create table job_orders (",
  "  id uuid primary key default gen_random_uuid(),",
  "  job_order_id text unique not null,",
  "  role text not null,",
  "  type text,",
  "  client text,",
  "  region text,",
  "  regional_office text,",
  "  recruiter_id uuid references recruiters(id),",
  "  date_received date,",
  "  status text default 'Open',",
  "  fee numeric,",
  "  days_open int,",
  "  intentional_role boolean default false,",
  "  total_submits int default 0,",
  "  total_fri int default 0,",
  "  total_placements int default 0,",
  "  notes text",
  ");",
  "",
  "create table placements (",
  "  id uuid primary key default gen_random_uuid(),",
  "  placement_id text unique not null,",
  "  candidate_name text not null,",
  "  title text, client text, region text,",
  "  recruiter_id uuid references recruiters(id),",
  "  start_date date,",
  "  intentional boolean default false,",
  "  fee numeric,",
  "  placement_type text,",
  "  quarter text, year int,",
  "  job_order_id uuid references job_orders(id),",
  "  landed_revenue numeric, notes text",
  ");",
  "",
  "create table weekly_kpi_entries (",
  "  id uuid primary key default gen_random_uuid(),",
  "  week_start date not null,",
  "  recruiter_id uuid references recruiters(id),",
  "  weekly_submits int default 0,",
  "  weekly_fri int default 0,",
  "  weekly_placements int default 0,",
  "  submitted_on_time boolean default true,",
  "  notes text,",
  "  total_points int default 0,",
  "  streak_count int default 0,",
  "  submitted_at timestamptz default now(),",
  "  unique(week_start, recruiter_id)",
  ");",
  "",
  "create table candidates (",
  "  id uuid primary key default gen_random_uuid(),",
  "  job_order_id uuid references job_orders(id),",
  "  candidate_name text not null,",
  "  week date,",
  "  recruiter_id uuid references recruiters(id),",
  "  submitted boolean default false,",
  "  had_fri boolean default false,",
  "  placed boolean default false,",
  "  created_at timestamptz default now()",
  ");",
  "",
  "-- Enable RLS and allow anon access",
  "alter table recruiters enable row level security;",
  "alter table job_orders enable row level security;",
  "alter table placements enable row level security;",
  "alter table weekly_kpi_entries enable row level security;",
  "alter table candidates enable row level security;",
  "",
  "create policy \"allow_all\" on recruiters for all using (true);",
  "create policy \"allow_all\" on job_orders for all using (true);",
  "create policy \"allow_all\" on placements for all using (true);",
  "create policy \"allow_all\" on weekly_kpi_entries for all using (true);",
  "create policy \"allow_all\" on candidates for all using (true);",
].join("\n");

function SetupGuide() {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2000);
  }

  var steps = [
    ["1", "Create a Supabase project", "Go to supabase.com → New project. Choose a name (e.g. adilstone-kpi), set a database password, and pick the region closest to your team."],
    ["2", "Run the SQL below", "In your Supabase dashboard, go to SQL Editor → New query. Paste the SQL block below and click Run. This creates all 5 tables with the correct columns and permissions."],
    ["3", "Add your credentials", "In this app, replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY at the top of the code with your values from: Supabase Dashboard → Project Settings → API."],
    ["4", "Import your data", "Go to each table in Supabase → Table Editor and use the CSV import button to load your existing recruiter, job order, and placement data."],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <div style={{ background: B.darkBlue, borderRadius: 12, padding: 20, color: "#fff" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Get started in 4 steps</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Follow these steps to connect this app to your real data.</div>
      </div>
      {steps.map(function(step) {
        return (
          <div key={step[0]} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: B.darkBlue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{step[0]}</div>
            <div>
              <div style={{ fontWeight: 600, color: B.darkBlue, marginBottom: 4 }}>{step[1]}</div>
              <div style={{ fontSize: 13, color: B.muted, lineHeight: 1.6 }}>{step[2]}</div>
            </div>
          </div>
        );
      })}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <SLabel>SQL — paste into Supabase SQL Editor</SLabel>
          <button onClick={copy} style={{ fontSize: 12, background: copied ? B.greenLight : "#fff", color: copied ? B.green : B.darkBlue, border: "1px solid " + (copied ? B.greenBorder : B.darkBlueBorder), borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
            {copied ? "Copied ✓" : "Copy SQL"}
          </button>
        </div>
        <pre style={{ background: B.black, color: "#e2e8f0", borderRadius: 10, padding: 18, fontSize: 11, overflowX: "auto", lineHeight: 1.7, margin: 0 }}>{SQL_SCRIPT}</pre>
      </div>
      <div style={{ background: B.amberLight, border: "1px solid " + B.amberBorder, borderRadius: 10, padding: 14, fontSize: 13, color: "#92400e" }}>
        <b>CSV column names must match exactly.</b> When importing your existing data, make sure column headers in your CSV match the column names in the SQL above (e.g. recruiter_name, not Recruiter Name). Supabase is case-sensitive.
      </div>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
const isConfigured = true;

export default function App() {
  const [tab, setTab] = useState(isConfigured ? "Dashboard" : "Setup");
  const tabs = ["Dashboard", "Weekly Entry", "Job Orders", "Leaderboard", "Guide", "Setup"];

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", color: B.black, maxWidth: 1000, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ background: B.darkBlue, borderRadius: 12, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>ADILSTONE GROUP</div>
          <div style={{ fontSize: 12, color: B.lightBlue, marginTop: 2 }}>Recruiting KPI System · Week of Apr 20, 2026</div>
        </div>
        <div style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: isConfigured ? B.greenLight : B.amberLight, color: isConfigured ? B.green : B.amber, fontWeight: 600 }}>
          {isConfigured ? "Connected" : "Not connected"}
        </div>
      </div>
      {!isConfigured && tab !== "Setup" && (
        <div style={{ background: B.amberLight, border: "1px solid " + B.amberBorder, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: 16 }}>
          Supabase credentials not set — add your URL and anon key to the top of the code to connect live data.
        </div>
      )}
      <div style={{ borderBottom: "1px solid " + B.border, marginBottom: 22, display: "flex", gap: 4, overflowX: "auto" }}>
        {tabs.map(function(t) { return <TabBtn key={t} label={t} active={tab === t} onClick={function() { setTab(t); }} />; })}
      </div>
      {tab === "Dashboard" && <Dashboard />}
      {tab === "Weekly Entry" && <WeeklyEntry />}
      {tab === "Job Orders" && <JobOrders />}
      {tab === "Leaderboard" && <Leaderboard />}
      {tab === "Guide" && <Guide />}
      {tab === "Setup" && <SetupGuide />}
    </div>
  );
}const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
