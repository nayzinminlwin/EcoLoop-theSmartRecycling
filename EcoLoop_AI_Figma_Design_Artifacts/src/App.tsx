import { useState } from "react";

type IconName =
  | "leaf" | "home" | "scan" | "settings" | "bell" | "arrow" | "recycle"
  | "gift" | "history" | "book" | "check" | "bin" | "alert" | "grid"
  | "search" | "chart" | "shield" | "menu" | "close" | "plus" | "camera";

const paths: Record<IconName, React.ReactNode> = {
  leaf: <><path d="M20 4C12 4 5 8 5 15c0 2 1 4 3 5 0-6 4-10 9-12-4 3-6 7-6 12 6 1 10-3 10-9 0-3-1-5-1-7Z"/><path d="M4 21c2-5 6-9 13-12"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 12h8"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.5 1A8 8 0 0 0 14 5L13.5 2h-4L9 5a8 8 0 0 0-2.5 1.5l-2.5-1L2 9l2 1.5a7 7 0 0 0 0 3L2 15l2 3.5 2.5-1A8 8 0 0 0 9 19l.5 3h4l.5-3a8 8 0 0 0 2.5-1.5l2.5 1 2-3.5-2-1.5Z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  recycle: <><path d="m8 4 4-2 3 5M12 2l-2 6"/><path d="m20 13 1 4-4 3M21 17h-7"/><path d="m4 18-1-4 4-3M3 14l4 7"/></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H8a3 3 0 1 1 4-3v3Zm0 0h4a3 3 0 1 0-4-3v3Z"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  book: <><path d="M4 5a3 3 0 0 1 3-2h5v18H7a3 3 0 0 0-3 2V5ZM20 5a3 3 0 0 0-3-2h-5v18h5a3 3 0 0 1 3 2V5Z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  bin: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6"/></>,
  alert: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  shield: <><path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-5"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  camera: <><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="4"/><path d="m8 5 1-2h6l1 2"/></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Button({ children, onClick, variant = "primary", disabled = false }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean }) {
  return <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "gray" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Icon name="leaf" /></span><span>EcoLoop <b>AI</b></span></div>;
}

const transactions = [
  { date: "Today, 10:42 AM", bin: "BIN-004 · Cedar Residence", material: "PET plastic", weight: "0.4 kg", points: "+20", status: "Verified" },
  { date: "18 May, 4:16 PM", bin: "BIN-002 · Maple Lobby", material: "Aluminium", weight: "0.2 kg", points: "+16", status: "Verified" },
  { date: "16 May, 9:08 AM", bin: "BIN-007 · Town Square", material: "Paper", weight: "0.8 kg", points: "Pending", status: "Review" },
];

function ResidentApp({ switchRole, onDepositVerified }: { switchRole: () => void; onDepositVerified: () => void }) {
  const [page, setPage] = useState("home");
  const [points, setPoints] = useState(245);
  const [scanStep, setScanStep] = useState(0);
  const [redeemed, setRedeemed] = useState(false);

  const beginScan = () => { setScanStep(1); setPage("scan"); };
  const nextScan = () => {
    if (scanStep === 4) {
      setPoints((p) => p + 20);
      onDepositVerified();
    }
    setScanStep((s) => Math.min(s + 1, 5));
  };
  return <div className="resident-shell">
    <header className="mobile-top"><Brand/><button className="icon-btn notification" onClick={() => setPage("history")} aria-label="Notifications"><Icon name="bell"/><i /></button></header>
    <main className="mobile-content">
      {page === "home" && <ResidentHome points={points} beginScan={beginScan} go={setPage}/>}
      {page === "scan" && <ScanFlow step={scanStep} next={nextScan} reset={() => setScanStep(0)} home={() => setPage("home")}/>}
      {page === "guide" && <RecycleGuide back={() => setPage("home")}/>}
      {page === "rewards" && <Rewards points={points} redeemed={redeemed} redeem={() => { setRedeemed(true); setPoints((p) => p - 100); }}/>}
      {page === "history" && <History />}
      {page === "settings" && <ResidentSettings switchRole={switchRole}/>}
    </main>
    <nav className="bottom-nav">
      <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}><Icon name="home"/><span>Home</span></button>
      <button className="scan-nav" onClick={beginScan}><span><Icon name="scan" size={28}/></span><b>Scan</b></button>
      <button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}><Icon name="settings"/><span>Settings</span></button>
    </nav>
  </div>;
}

function ResidentHome({ points, beginScan, go }: { points: number; beginScan: () => void; go: (p: string) => void }) {
  return <div className="stack">
    <section className="greeting"><div><p className="eyebrow">MONDAY, 20 MAY</p><h1>Good morning, Faris</h1><p>Ready to make today a little greener?</p></div><div className="avatar">FR</div></section>
    <section className="points-card">
      <div><p>Available EcoPoints</p><strong>{points}</strong></div>
      <div className="leaf-orbit"><Icon name="leaf" size={34}/></div>
      <div className="progress-label"><span>55 points to your next reward</span><b>82%</b></div><div className="progress"><i /></div>
      <Button onClick={() => go("rewards")} variant="secondary">Browse rewards <Icon name="arrow"/></Button>
    </section>
    <button className="scan-cta" onClick={beginScan}><span className="scan-box"><Icon name="scan" size={30}/></span><span><b>Scan Recycling Bin</b><small>Scan the QR code to start</small></span><Icon name="arrow"/></button>
    <section className="stats"><div><b>12</b><span>Verified deposits</span></div><div><b>3.2 kg</b><span>Verified recycled</span></div></section>
    <section className="quick-grid">
      <button onClick={() => go("guide")}><span><Icon name="book"/></span><b>How to recycle</b><small>Quick guide</small></button>
      <button onClick={() => go("history")}><span><Icon name="history"/></span><b>Recycling history</b><small>View activity</small></button>
    </section>
    <section><div className="section-head"><div><p className="eyebrow">ACTIVITY</p><h2>Recent recycling</h2></div><button onClick={() => go("history")}>View all</button></div>
      <div className="activity-list">{transactions.slice(0,2).map((t) => <div className="activity" key={t.date}><span className="activity-icon"><Icon name="recycle"/></span><div><b>{t.material}</b><small>{t.bin}</small><small>{t.date}</small></div><div><strong>{t.points}</strong><Badge>Verified</Badge></div></div>)}</div>
    </section>
  </div>;
}

function ScanFlow({ step, next, reset, home }: { step: number; next: () => void; reset: () => void; home: () => void }) {
  const titles = ["Scan a smart bin", "Bin found", "Ready to recycle", "Item detected", "Identifying material", "Deposit verified"];
  const descriptions = [
    "Position the QR code inside the frame.",
    "Cedar Residence · Ground Floor",
    "Insert your recyclables, then press the red finish button on the physical machine.",
    "The internal bin camera has detected your deposit.",
    "Our simulated AI is checking material type and eligibility.",
    "0.4 kg PET plastic accepted. Your points have been credited.",
  ];
  return <div className="flow-page">
    <div className="page-title"><button onClick={home}>‹</button><div><p className="eyebrow">SMART BIN SESSION</p><h1>{titles[step]}</h1></div></div>
    <div className={`scanner ${step === 5 ? "success" : ""}`}>
      {step === 0 && <><div className="scan-frame"><i/><i/><i/><i/><Icon name="scan" size={42}/></div><span>Camera simulation</span></>}
      {step > 0 && step < 3 && <div className="bin-visual"><Icon name="bin" size={74}/><i>{step === 1 ? "65%" : "READY"}</i></div>}
      {step === 3 && <div className="pulse"><Icon name="camera" size={52}/></div>}
      {step === 4 && <div className="loader"><Icon name="recycle" size={48}/></div>}
      {step === 5 && <div className="success-ring"><Icon name="check" size={54}/></div>}
    </div>
    <section className="flow-info">
      <Badge tone={step === 5 ? "green" : step === 4 ? "amber" : "gray"}>{step === 5 ? "Verified" : step === 4 ? "Processing" : step === 0 ? "QR scanner" : "BIN-004"}</Badge>
      <h2>{titles[step]}</h2><p>{descriptions[step]}</p>
      {step === 1 && <div className="bin-details"><div><span>Accepts</span><b>Plastic · Cans</b></div><div><span>Capacity</span><b className="warning">65% · Warning</b></div></div>}
      {step === 5 && <div className="credit"><span>EcoPoints earned</span><strong>+20</strong></div>}
      {(step === 4 || step === 5) && <small>Your EcoPoints will usually be updated within 3 minutes after your deposit is verified.</small>}
    </section>
    {step < 5 ? <Button onClick={next}>{["Simulate QR scan", "Confirm session", "I pressed the finish button", "Continue", "Complete verification"][step]}</Button> : <Button onClick={() => { reset(); home(); }}>Back to home</Button>}
    {step === 0 && <Button variant="ghost" onClick={() => { reset(); home(); }}>Cancel</Button>}
  </div>;
}

function RecycleGuide({ back }: { back: () => void }) {
  const items = [["Plastic bottles", "Empty & rinse"], ["Glass bottles", "Remove lids"], ["Metal cans", "Clean & dry"], ["Paper & cardboard", "Flatten first"]];
  return <div className="stack page">
    <div className="page-title"><button onClick={back}>‹</button><div><p className="eyebrow">LEARN</p><h1>How to recycle</h1></div></div>
    <section className="guide-hero"><span><Icon name="recycle" size={46}/></span><h2>Small steps, meaningful impact.</h2><p>Accepted materials depend on the selected smart bin.</p></section>
    <section><h2>What can I recycle?</h2><div className="material-grid">{items.map((x,i)=><div key={x[0]}><span className={`material m${i}`}><Icon name={i===3?"book":"recycle"}/></span><b>{x[0]}</b><small>{x[1]}</small></div>)}</div></section>
    <section className="dos"><div><h3><Icon name="check"/> To-do</h3><p>Empty containers</p><p>Rinse when appropriate</p><p>Separate materials correctly</p></div><div><h3><Icon name="close"/> To-avoid</h3><p>Food-filled containers</p><p>General or hazardous waste</p><p>Unaccepted materials</p></div></section>
    <section><h2>Using the smart bin</h2><div className="steps">{["Scan the bin QR code","Insert recyclable materials","Press the red finish button","Wait for verification","Receive EcoPoints"].map((x,i)=><div key={x}><i>{i+1}</i><span>{x}</span></div>)}</div></section>
    <section><h2>Illustrative EcoPoints</h2><div className="rates"><div><b>Material</b><b>Demo rate</b><b>Example</b></div><div><span>Plastic</span><span>50 pts/kg</span><span>20 pts</span></div><div><span>Aluminium</span><span>80 pts/kg</span><span>16 pts</span></div><div><span>Paper</span><span>25 pts/kg</span><span>20 pts</span></div></div><p className="fine">Final points depend on verified classification, configured reward rules, and accepted deposits. Demo rates are adjustable by admins.</p></section>
  </div>;
}

function Rewards({ points, redeemed, redeem }: { points: number; redeemed: boolean; redeem: () => void }) {
  const rewards = [{name:"Vending snack",cost:100,tag:"Popular"},{name:"RM5 café voucher",cost:200,tag:"Food & drink"},{name:"Meal voucher",cost:350,tag:"Dining"},{name:"RM10 shopping voucher",cost:500,tag:"Shopping"}];
  return <div className="stack page"><div className="page-title"><div><p className="eyebrow">MARKETPLACE</p><h1>Rewards</h1></div><div className="point-pill"><Icon name="leaf"/>{points}</div></div>
    {redeemed && <div className="success-banner"><Icon name="check"/><div><b>Reward redeemed</b><span>Your voucher is ready in My Vouchers.</span></div></div>}
    <div className="category-row"><Badge>All rewards</Badge><Badge tone="gray">Food</Badge><Badge tone="gray">Shopping</Badge></div>
    <div className="reward-grid">{rewards.map((r,i)=><article className="reward-card" key={r.name}><div className={`reward-art art${i}`}><Icon name="gift" size={36}/><Badge>{r.tag}</Badge></div><div><h3>{r.name}</h3><p>Illustrative demo reward · Expires 30 Jun</p><strong>{r.cost} <small>points</small></strong><Button disabled={points<r.cost || (redeemed&&i===0)} onClick={i===0?redeem:undefined}>{redeemed&&i===0?"Redeemed":points<r.cost?"Not enough points":"Redeem"}</Button></div></article>)}</div>
    <section><div className="section-head"><h2>My vouchers</h2><button>View all</button></div><div className="voucher"><Icon name="gift"/><div><b>{redeemed?"Vending snack":"RM3 Welcome voucher"}</b><small>{redeemed?"Ready to use · One redemption":"Expires 31 May · Demo merchant"}</small></div><Icon name="arrow"/></div></section>
  </div>;
}

function History() {
  return <div className="stack page"><div><p className="eyebrow">YOUR IMPACT</p><h1>Recycling history</h1></div><div className="filter-row"><button>All dates⌄</button><button>All statuses⌄</button></div><div className="activity-list">{transactions.map(t=><div className="history-item" key={t.date}><span className="activity-icon"><Icon name="recycle"/></span><div><b>{t.material}</b><small>{t.bin}</small><small>{t.date} · {t.weight}</small></div><div><strong>{t.points}</strong><Badge tone={t.status==="Review"?"amber":"green"}>{t.status}</Badge></div></div>)}</div><div className="demo-note"><Icon name="shield"/><p>All figures are illustrative prototype data. Pending deposits do not receive points until verified.</p></div></div>;
}

function ResidentSettings({ switchRole }: { switchRole: () => void }) {
  const rows = [["settings","Profile & personal details"],["shield","Account security"],["bell","Notifications"]];
  const [active, setActive] = useState("");
  const details: Record<string, { title: string; copy: string; action: string }> = {
    "Profile & personal details": {
      title: "Profile & personal details",
      copy: "Faris Rezza · rezza@example.com",
      action: "Edit profile",
    },
    "Account security": {
      title: "Account security",
      copy: "Password last updated 30 days ago. Your account is protected.",
      action: "Change password",
    },
    "Notifications": {
      title: "Notifications",
      copy: "Recycling updates, points credits, and reward reminders are enabled.",
      action: "Manage preferences",
    },
  };
  if (active) {
    const detail = details[active];
    return <div className="stack page">
      <div className="page-title"><button onClick={() => setActive("")}>‹</button><div><p className="eyebrow">SETTINGS</p><h1>{detail.title}</h1></div></div>
      <section className="profile"><Icon name={active === "Account security" ? "shield" : active === "Notifications" ? "bell" : "settings"}/><div><h2>{detail.title}</h2><p>{detail.copy}</p></div></section>
      <Button>{detail.action}</Button>
    </div>;
  }
  return <div className="stack page"><div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1></div><section className="profile"><div className="avatar large">AN</div><div><h2>Faris Rezza</h2><p>rezza@example.com</p></div></section><div className="settings-list">{rows.map(([i,t])=><button key={t} onClick={() => setActive(t)}><Icon name={i as IconName}/><span>{t}</span><Icon name="arrow"/></button>)}</div><Button variant="secondary" onClick={switchRole}>Open admin demo</Button><Button variant="ghost">Sign out</Button></div>;
}

const adminNav: [IconName,string,string][] = [["grid","Overview","overview"],["bin","Smart Bins","bins"],["alert","Capacity Alerts","alerts"],["camera","Deposit Verification","verification"],["gift","Rewards & Vouchers","vouchers"],["settings","Settings","settings"]];

function AdminApp({ switchRole, capacity, setCapacity }: { switchRole: () => void; capacity: number; setCapacity: (capacity: number) => void }) {
  const [page,setPage]=useState("overview"); const [collection,setCollection]=useState(capacity>=85?"Pending":"Not scheduled"); const [resolved,setResolved]=useState(false); const [reviewed,setReviewed]=useState(""); const [menuOpen,setMenuOpen]=useState(false); const [threshold,setThreshold]=useState(80);
  const simulate=()=>{setCapacity(85);setResolved(false);setCollection("Pending")};
  const collect=()=>{setCapacity(10);setCollection("Collected")};
  const resolve=()=>setResolved(true);
  const hasAlert=!resolved&&(capacity>=threshold||collection==="Collected");
  const go=(id:string)=>{setPage(id);setMenuOpen(false)};
  return <div className={`admin-shell ${menuOpen?"menu-open":""}`}><aside><div className="side-top"><Brand/><button className="mobile-close" onClick={()=>setMenuOpen(false)} aria-label="Close menu"><Icon name="close"/></button></div><nav>{adminNav.map(([i,label,id])=><button key={id} className={page===id?"active":""} onClick={()=>go(id)}><Icon name={i}/><span>{label}</span>{id==="alerts"&&hasAlert?<i>1</i>:null}</button>)}</nav><div className="admin-user"><div className="avatar">JL</div><div><b>Jamie Lee</b><small>Platform admin</small></div><button onClick={switchRole} aria-label="Open resident app">↗</button></div></aside>
    {menuOpen&&<button className="sidebar-backdrop" onClick={()=>setMenuOpen(false)} aria-label="Close menu"/>}
    <main className="admin-main"><header><button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Open menu"><Icon name="menu"/></button><div className="search"><Icon name="search"/><input placeholder="Search bins, deposits, residents…" /></div><button className="icon-btn notification" onClick={()=>go("alerts")} aria-label="Capacity alerts"><Icon name="bell"/>{hasAlert&&<i/>}</button><Button variant="secondary" onClick={switchRole}>Resident app</Button></header>
      {page==="overview"&&<Overview capacity={capacity} collection={collection} resolved={resolved} threshold={threshold} simulate={simulate} openAlerts={()=>go("alerts")}/>}
      {page==="bins"&&<Bins capacity={capacity} collection={collection} simulate={simulate} />}
      {page==="alerts"&&<Alerts capacity={capacity} collection={collection} resolved={resolved} threshold={threshold} simulate={simulate} schedule={()=>setCollection("Scheduled")} collect={collect} resolve={resolve}/>}
      {page==="verification"&&<Verification reviewed={reviewed} setReviewed={setReviewed}/>}
      {page==="vouchers"&&<AdminVouchers/>}
      {page==="settings"&&<AdminSettings threshold={threshold} setThreshold={setThreshold}/>}
    </main>
  </div>;
}

function AdminTitle({ eyebrow, title, children }: {eyebrow:string;title:string;children?:React.ReactNode}) { return <div className="admin-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>Simulated university hackathon data · Last updated just now</p></div><div>{children}</div></div> }

function Overview({capacity,collection,resolved,threshold,simulate,openAlerts}:{capacity:number;collection:string;resolved:boolean;threshold:number;simulate:()=>void;openAlerts:()=>void}) {
  const activeAlert=!resolved&&(capacity>=threshold||collection==="Collected");
  const metrics=[["bin","24","Registered bins","Township network"],["alert",activeAlert?"1":"0","Active alerts",activeAlert?(collection==="Collected"?"Ready to resolve":"Action needed"):"All clear"],["recycle","1,284","Verified deposits","Illustrative total"],["leaf","18,450","EcoPoints issued","Illustrative total"]];
  return <div className="admin-page"><AdminTitle eyebrow="ADMIN CONSOLE" title="Township overview"><Button onClick={simulate}><Icon name="plus"/> Simulate BIN-004 to 85%</Button></AdminTitle>
    {capacity>=threshold&&!resolved&&<button className="alert-banner" onClick={openAlerts}><span><Icon name="alert"/></span><div><b>Critical capacity alert</b><p>BIN-004 Cedar Residence is {capacity}% full. Collection is recommended.</p></div><Badge tone="red">Critical</Badge><Icon name="arrow"/></button>}
    <div className="metric-grid">{metrics.map(([i,n,l,d])=><section className="metric" key={l}><span><Icon name={i as IconName}/></span><div><small>{l}</small><strong>{n}</strong><p>{d}</p></div></section>)}</div>
    <div className="dashboard-grid"><section className="panel wide"><div className="panel-head"><div><h2>Recycling activity</h2><p>Verified deposits · Last 7 days</p></div><Badge tone="gray">7 days⌄</Badge></div><div className="chart"><div className="y-labels"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div><div className="bars">{[52,68,44,76,62,88,73].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span></div>)}</div></div></section>
      <section className="panel"><div className="panel-head"><div><h2>Material mix</h2><p>Verified weight</p></div></div><div className="donut"><div><b>328</b><span>kg total</span></div></div><div className="legend"><span><i className="plastic"/>Plastic <b>42%</b></span><span><i className="metal"/>Metal <b>28%</b></span><span><i className="paper"/>Paper <b>21%</b></span><span><i className="glass"/>Glass <b>9%</b></span></div></section></div>
    <section className="panel"><div className="panel-head"><div><h2>Bins requiring attention</h2><p>Capacity warnings and operational issues</p></div><button onClick={openAlerts}>View all alerts</button></div><BinTable capacity={capacity} collection={collection}/></section>
  </div>;
}

function BinTable({capacity,collection}:{capacity:number;collection:string}) { const bins=[["BIN-004","Cedar Residence · Ground Floor",capacity,collection],["BIN-011","Town Square · West Entrance",78,"Not scheduled"],["BIN-008","Maple Apartments · Lobby",62,"Scheduled"],["BIN-002","Community Hall · Car Park",34,"Collected"]]; return <div className="table-wrap"><table><thead><tr><th>Bin ID</th><th>Location</th><th>Capacity</th><th>Status</th><th>Collection status</th></tr></thead><tbody>{bins.map(([id,location,fill,status])=><tr key={id as string}><td><b>{id}</b></td><td>{location}</td><td><div className="capacity"><span><i className={Number(fill)>=80?"critical":Number(fill)>=60?"warning":""} style={{width:`${fill}%`}}/></span><b>{fill}%</b></div></td><td><Badge tone={Number(fill)>=80?"red":Number(fill)>=60?"amber":"green"}>{Number(fill)>=80?"Critical":Number(fill)>=60?"Warning":"Normal"}</Badge></td><td>{status}</td></tr>)}</tbody></table></div> }

function Bins({capacity,collection,simulate}:{capacity:number;collection:string;simulate:()=>void}) {return <div className="admin-page"><AdminTitle eyebrow="FLEET MANAGEMENT" title="Smart bins"><Button onClick={simulate}><Icon name="alert"/> Simulate BIN-004 to 85%</Button></AdminTitle><div className="toolbar"><div className="search"><Icon name="search"/><input placeholder="Search by bin ID or location"/></div></div><section className="panel"><BinTable capacity={capacity} collection={collection}/></section></div>}

function Alerts({capacity,collection,resolved,threshold,simulate,schedule,collect,resolve}:{capacity:number;collection:string;resolved:boolean;threshold:number;simulate:()=>void;schedule:()=>void;collect:()=>void;resolve:()=>void}) {
  const [view,setView]=useState<"active"|"resolved">("active");
  const finish=()=>{resolve();setView("resolved")};
  const showDetail=(view==="active"&&!resolved&&(capacity>=threshold||collection==="Collected"))||(view==="resolved"&&resolved);
  return <div className="admin-page"><AdminTitle eyebrow="PRIORITY WORKFLOW" title="Capacity alerts"><Button onClick={simulate}>Simulate BIN-004 to 85%</Button></AdminTitle><div className="workflow"><div className={capacity>=85||collection==="Collected"?"done":""}><i>1</i><span>Reach 85%</span></div><div className={capacity>=85||collection==="Collected"?"done":""}><i>2</i><span>Alert created</span></div><div className={collection==="Scheduled"||collection==="Collected"?"done":""}><i>3</i><span>Schedule</span></div><div className={collection==="Collected"?"done":""}><i>4</i><span>Collect & reset</span></div><div className={resolved?"done":""}><i>5</i><span>Resolve</span></div></div>
  <div className="tabs"><button className={view==="active"?"active":""} onClick={()=>setView("active")}>Active alerts {!resolved&&(capacity>=threshold||collection==="Collected")?"1":"0"}</button><button className={view==="resolved"?"active":""} onClick={()=>setView("resolved")}>Resolved {resolved?"1":"0"}</button></div>
  {!showDetail?<section className="empty panel"><Icon name="shield" size={42}/><h2>{view==="resolved"?"No resolved alerts":"No critical alerts"}</h2><p>{view==="resolved"?"Resolved collection alerts will appear here.":`BIN-004 is at ${capacity}%. Increase it to demonstrate the workflow.`}</p>{view==="active"&&<Button onClick={simulate}>Simulate 85% capacity</Button>}</section>:
  <section className={`alert-detail panel ${resolved?"resolved":""}`}><div className="alert-detail-top"><span><Icon name={resolved?"check":"alert"} size={28}/></span><div><Badge tone={resolved?"green":collection==="Collected"?"amber":"red"}>{resolved?"Resolved":collection==="Collected"?"Ready to resolve":"Critical · collection required"}</Badge><h2>BIN-004 · Cedar Residence</h2><p>Ground Floor, Recycling Corner</p></div><div className="capacity-big"><strong>{capacity}%</strong><small>Current capacity</small></div></div><div className="alert-facts"><div><span>Time triggered</span><b>Today, 10:48 AM</b></div><div><span>Last capacity update</span><b>Just now</b></div><div><span>Collection status</span><Badge tone={collection==="Collected"?"green":collection==="Scheduled"?"amber":"gray"}>{collection}</Badge></div><div><span>Alert threshold</span><b>{threshold}%</b></div></div><div className="alert-actions">{!resolved&&collection!=="Scheduled"&&collection!=="Collected"&&<Button onClick={schedule}>Schedule collection</Button>}{collection==="Scheduled"&&!resolved&&<Button onClick={collect}><Icon name="check"/> Mark collected & reset bin</Button>}{collection==="Collected"&&!resolved&&<Button onClick={finish}>Resolve alert</Button>}</div>{resolved&&<div className="resolution"><Icon name="check"/><span>Collection completed, capacity reset to 10%, and alert resolved.</span></div>}</section>}
  <p className="simulation-note"><Icon name="alert"/> Capacity sensors and collection operations are simulated for this prototype. Duplicate active alerts are prevented.</p></div>
}

function Verification({reviewed,setReviewed}:{reviewed:string;setReviewed:(s:string)=>void}) {return <div className="admin-page"><AdminTitle eyebrow="AI REVIEW QUEUE" title="Deposit verification"><Badge tone="amber">2 need review</Badge></AdminTitle><div className="review-layout"><section className="panel review-list"><h2>Review queue</h2><button className="active"><span className="capture"><Icon name="camera"/></span><div><b>DEP-1087</b><small>BIN-007 · 11:24 AM</small><Badge tone="amber">Uncertain</Badge></div><b>62%</b></button><button><span className="capture"><Icon name="camera"/></span><div><b>DEP-1081</b><small>BIN-004 · 9:46 AM</small><Badge tone="red">Possible contaminant</Badge></div><b>48%</b></button></section><section className="panel review-detail"><div className="camera-shot"><Icon name="camera" size={48}/><b>Captured item: flattened drink carton</b><span>Simulated internal camera capture</span></div><div className="review-heading"><div><p className="eyebrow">DEPOSIT DEP-1087</p><h2>AI classification review</h2></div><Badge tone={reviewed==="Approved"?"green":reviewed==="Rejected"?"red":"amber"}>{reviewed||"Awaiting review"}</Badge></div><div className="classification"><div><span>Predicted material</span><b>Paper / mixed packaging</b></div><div><span>AI confidence</span><strong>62%</strong></div><div><span>Resident reference</span><b>RES-•••842</b></div><div><span>Points status</span><b>{reviewed==="Approved"?"20 points credited":reviewed==="Rejected"?"Not eligible":"On hold · no points issued"}</b></div></div><div className="alert-actions"><Button variant="danger" onClick={()=>setReviewed("Rejected")}>Reject deposit</Button><Button onClick={()=>setReviewed("Approved")}><Icon name="check"/> Approve deposit</Button></div><p className="fine">Uncertain deposits never receive EcoPoints automatically. Points are issued only after an admin approves an eligible item.</p></section></div></div>}

type Voucher = { name: string; points: number; expiry: string; status: "Active" | "Draft" };
function AdminVouchers(){
  const [vouchers,setVouchers]=useState<Voucher[]>([{name:"RM5 café voucher",points:200,expiry:"30 Jun 2025",status:"Active"},{name:"Vending snack",points:100,expiry:"31 Jul 2025",status:"Active"},{name:"Township tote bag",points:350,expiry:"31 Aug 2025",status:"Draft"}]);
  const [editing,setEditing]=useState<number|null>(null); const [creating,setCreating]=useState(false);
  const toggle=(index:number)=>setVouchers(vouchers.map((voucher,i)=>i===index?{...voucher,status:voucher.status==="Active"?"Draft":"Active"}:voucher));
  const create=()=>{setVouchers([...vouchers,{name:"Campus meal voucher",points:300,expiry:"30 Sep 2025",status:"Draft"}]);setCreating(false)};
  return <div className="admin-page"><AdminTitle eyebrow="REWARDS PROGRAM" title="Rewards & vouchers"><Button onClick={()=>setCreating(true)}><Icon name="plus"/> Create voucher</Button></AdminTitle>{creating&&<section className="panel voucher-form"><div><h2>Create demo voucher</h2><p>A realistic draft will be added to the voucher table.</p></div><div className="alert-actions"><Button variant="ghost" onClick={()=>setCreating(false)}>Cancel</Button><Button onClick={create}>Create draft voucher</Button></div></section>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Voucher name</th><th>Points required</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>{vouchers.map((voucher,index)=><tr key={voucher.name}><td><b>{voucher.name}</b></td><td>{voucher.points} pts</td><td>{voucher.expiry}</td><td><Badge tone={voucher.status==="Active"?"green":"gray"}>{voucher.status}</Badge></td><td><button className="table-action" onClick={()=>setEditing(editing===index?null:index)}>{editing===index?"Done":"Edit"}</button>{editing===index&&<button className="table-action" onClick={()=>toggle(index)}>Set {voucher.status==="Active"?"draft":"active"}</button>}</td></tr>)}</tbody></table></div></section></div>
}

function AdminSettings({threshold,setThreshold}:{threshold:number;setThreshold:(value:number)=>void}){
  const materials=["Plastic","Metal","Paper","Glass"]; const [accepted,setAccepted]=useState(materials); const [rates,setRates]=useState({Plastic:50,Metal:80,Paper:25,Glass:40}); const [saved,setSaved]=useState(false);
  const toggleMaterial=(material:string)=>setAccepted(accepted.includes(material)?accepted.filter((item)=>item!==material):[...accepted,material]);
  const save=()=>{setSaved(true);window.setTimeout(()=>setSaved(false),1800)};
  return <div className="admin-page"><AdminTitle eyebrow="SYSTEM CONFIGURATION" title="Settings"><Button onClick={save}><Icon name="check"/> Save settings</Button></AdminTitle>{saved&&<div className="success-banner"><Icon name="check"/><div><b>Settings saved</b><span>Demo rules are now active.</span></div></div>}<div className="settings-stack"><section className="panel setting-section"><div><Icon name="alert"/><h2>Capacity alert threshold</h2><p>Create a critical alert when a smart bin reaches this capacity.</p></div><label>Threshold <select value={threshold} onChange={(event)=>setThreshold(Number(event.target.value))}><option value="75">75%</option><option value="80">80%</option><option value="85">85%</option></select></label></section><section className="panel setting-section"><div><Icon name="recycle"/><h2>Accepted material categories</h2><p>Choose which verified materials are eligible for rewards.</p></div><div className="material-options">{materials.map((material)=><label key={material}><input type="checkbox" checked={accepted.includes(material)} onChange={()=>toggleMaterial(material)}/><span>{material}</span></label>)}</div></section><section className="panel setting-section"><div><Icon name="leaf"/><h2>EcoPoints calculation rules</h2><p>Illustrative points awarded per verified kilogram.</p></div><div className="rate-options">{materials.map((material)=><label key={material}><span>{material}</span><input type="number" min="0" value={rates[material as keyof typeof rates]} onChange={(event)=>setRates({...rates,[material]:Number(event.target.value)})}/><small>pts/kg</small></label>)}</div></section></div></div>
}

export default function App() {
  const [role,setRole]=useState<"resident"|"admin">("resident");
  const [capacity,setCapacity]=useState(65);
  return role==="resident"?<ResidentApp switchRole={()=>setRole("admin")} onDepositVerified={()=>setCapacity(85)}/>:<AdminApp switchRole={()=>setRole("resident")} capacity={capacity} setCapacity={setCapacity}/>;
}
