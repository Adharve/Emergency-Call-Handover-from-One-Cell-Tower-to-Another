import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Ambulance, BarChart3, BookOpen, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, Gauge, GitBranch, Info, MapPin, Menu, Pause, Phone,
  Play, RotateCcw, Settings2, Signal, Siren, TowerControl, X,
} from 'lucide-react'
import {
  DEFAULT_CONFIG, SCENARIOS, calculateRxQual, calculateSignal,
  createInitialState, formatClock, formatTime,
} from './simulation'
import './App.css'

const TABS = [
  { id: 'dashboard', label: 'Simulation Dashboard', icon: Activity },
  { id: 'architecture', label: 'Network Architecture', icon: GitBranch },
  { id: 'algorithm', label: 'Handover Algorithm', icon: BookOpen },
  { id: 'results', label: 'Simulation Results', icon: BarChart3 },
  { id: 'about', label: 'About the Project', icon: Info },
]

const EVENT_COLORS = { info: 'blue', success: 'green', warning: 'orange', danger: 'red' }
const SignalChart = lazy(() => import('./SignalChart.jsx'))

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [scenario, setScenario] = useState('normal')
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [state, setState] = useState(createInitialState)
  const [isRunning, setIsRunning] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const lastTick = useRef(null)
  const persistenceRef = useRef(0)
  const eventId = useRef(0)

  const signals = useMemo(() => ({
    A: calculateSignal(state.position, 'A', config, scenario),
    B: calculateSignal(state.position, 'B', config, scenario),
  }), [config, scenario, state.position])
  const rxQual = calculateRxQual(signals[state.serving])

  const addEvent = useCallback((message, tone = 'info') => {
    setState((current) => ({
      ...current,
      events: [{ id: eventId.current++, time: current.elapsed, message, tone }, ...current.events].slice(0, 40),
    }))
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    persistenceRef.current = 0
    setState(createInitialState())
  }, [])

  const start = () => {
    if (!state.connected) {
      setState((current) => ({
        ...current,
        connected: true,
        callStatus: 'Connected',
        status: 'running',
        events: [
          { id: eventId.current++, time: current.elapsed, message: 'Ambulance connected to BTS Tower A', tone: 'info' },
          { id: eventId.current++, time: current.elapsed, message: 'Emergency call established · 112', tone: 'success' },
          ...current.events,
        ].slice(0, 40),
      }))
    }
    setIsRunning(true)
  }

  const tick = useCallback((delta) => {
    setState((current) => {
      const nextElapsed = current.elapsed + delta
      const nextPosition = Math.min(82, current.position + (config.speed * delta) / 10)
      const nextSignals = {
        A: calculateSignal(nextPosition, 'A', config, scenario),
        B: calculateSignal(nextPosition, 'B', config, scenario),
      }
      let next = { ...current, elapsed: nextElapsed, position: nextPosition }
      const newEvents = []
      const queueEvent = (message, tone = 'info') => {
        newEvents.unshift({ id: eventId.current++, time: nextElapsed, message, tone })
      }

      if (current.handover) {
        const handoverElapsed = nextElapsed - current.handover.startedAt
        if (handoverElapsed >= 1.2) {
          const congested = scenario === 'congestion' && current.handover.target === 'B'
          if (congested) {
            next = {
              ...next, handover: null, failed: current.failed + 1,
              callStatus: nextSignals[current.serving] < config.handoverThreshold ? 'Disconnected' : 'Connected',
              drops: nextSignals[current.serving] < config.handoverThreshold ? current.drops + 1 : current.drops,
            }
            queueEvent('Handover failed · target BTS has no available radio channel', 'danger')
            if (next.callStatus === 'Disconnected') queueEvent('Emergency call dropped · serving signal unusable', 'danger')
          } else {
            next = {
              ...next, serving: current.handover.target, handover: null,
              successful: current.successful + 1, interruption: current.interruption + handoverElapsed,
              callStatus: 'Connected',
            }
            queueEvent(`Handover completed successfully · now connected to BTS Tower ${current.handover.target}`, 'success')
            queueEvent('Emergency call remains connected', 'success')
          }
          persistenceRef.current = 0
        }
      } else if (current.connected && current.callStatus !== 'Disconnected') {
        const target = current.serving === 'A' ? 'B' : 'A'
        const servingSignal = nextSignals[current.serving]
        const targetSignal = nextSignals[target]
        const condition = servingSignal <= config.handoverThreshold ||
          targetSignal > servingSignal + config.handoverMargin + config.hysteresis
        if (condition) persistenceRef.current += delta
        else persistenceRef.current = 0

        if (persistenceRef.current >= config.persistence) {
          next = {
            ...next, handover: { target, startedAt: nextElapsed },
            callStatus: 'Handover in Progress',
          }
          queueEvent(`Handover initiated · BTS ${current.serving} → BTS ${target}`, 'warning')
          queueEvent(`Target BTS ${target} channel allocation requested`, 'info')
          persistenceRef.current = 0
        }
      }
      const point = { time: nextElapsed, A: nextSignals.A, B: nextSignals.B }
      next.history = [...current.history, point].slice(-50)
      next.events = [...newEvents, ...current.events].slice(0, 40)
      return next
    })
  }, [config, scenario])

  useEffect(() => {
    if (!isRunning) return undefined
    lastTick.current = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min((now - lastTick.current) / 1000, 0.25)
      lastTick.current = now
      tick(delta)
    }, 100)
    return () => clearInterval(timer)
  }, [isRunning, tick])

  useEffect(() => {
    if (state.position >= 82 && isRunning) {
      const timer = setTimeout(() => {
        setIsRunning(false)
        addEvent('Route complete · simulation paused', 'info')
      }, 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [addEvent, isRunning, state.position])

  const manualMove = (value) => {
    setState((current) => ({ ...current, position: Number(value) }))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Siren size={20} /></div>
          <div><strong>WMC LAB</strong><span>Simulation suite</span></div>
        </div>
        <button className="mobile-menu" onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation"><Menu size={20} /></button>
        <div className="system-state"><span className="pulse-dot" /> SYSTEM ONLINE <span className="separator" /> GSM / 2G</div>
      </header>
      <div className="workspace">
        <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-label">Workspace</div>
          <nav>{TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeTab === id ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveTab(id); setMobileNav(false) }}>
              <Icon size={17} /><span>{label}</span>{activeTab === id && <ChevronRight className="nav-chevron" size={15} />}
            </button>
          ))}</nav>
          <div className="sidebar-footer"><div className="lab-card"><span className="eyebrow">LAB ENVIRONMENT</span><strong>GSM Handover Lab</strong><span>v1.0.0 · Local runtime</span></div></div>
        </aside>
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard state={state} signals={signals} rxQual={rxQual} config={config} scenario={scenario} isRunning={isRunning} setConfig={setConfig} setScenario={(value) => { setScenario(value); reset() }} onStart={start} onPause={() => setIsRunning(false)} onReset={reset} onManualMove={manualMove} />}
          {activeTab === 'architecture' && <Architecture />}
          {activeTab === 'algorithm' && <Algorithm config={config} />}
          {activeTab === 'results' && <Results state={state} />}
          {activeTab === 'about' && <About />}
        </main>
      </div>
    </div>
  )
}

function PageHeader({ eyebrow, title, description, children }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>
}

function Dashboard({ state, signals, rxQual, config, scenario, isRunning, setConfig, setScenario, onStart, onPause, onReset, onManualMove }) {
  return <div className="page">
    <PageHeader eyebrow="LIVE SIMULATION / GSM HANDOVER" title="Emergency Call Handover Simulation" description="GSM-based seamless emergency communication during ambulance mobility">
      <div className="scenario-select"><span>SCENARIO</span><select value={scenario} onChange={(e) => setScenario(e.target.value)}>{Object.entries(SCENARIOS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
    </PageHeader>
    <div className="status-strip"><div><span className="pulse-dot" /> SIMULATION {isRunning ? 'RUNNING' : 'PAUSED'}</div><div className="strip-divider" /><div>SCENARIO <b>{SCENARIOS[scenario].label.toUpperCase()}</b></div><div className="strip-spacer" /><div className="clock"><Clock3 size={14} /> {formatTime(state.elapsed)}</div></div>
    <section className="dashboard-grid">
      <div className="card map-card"><div className="card-heading"><div><span className="eyebrow">NETWORK TOPOLOGY</span><h2>Live network visualization</h2></div><span className={`tag ${state.handover ? 'orange' : 'green'}`}>{state.handover ? 'HANDOVER IN PROGRESS' : `SERVING BTS ${state.serving}`}</span></div><NetworkMap state={state} signals={signals} /></div>
      <div className="card call-card"><div className="card-heading"><span className="eyebrow">EMERGENCY CHANNEL</span><span className="call-live"><span className="pulse-dot" /> LIVE</span></div><div className="call-number"><div className="phone-icon"><Phone size={20} /></div><div><span>Emergency number</span><strong>112</strong></div></div><div className={`call-status ${state.callStatus === 'Disconnected' ? 'danger' : state.handover ? 'handover' : ''}`}><span className="status-dot" /> {state.callStatus}</div><div className="call-stats"><Stat label="Call duration" value={formatTime(state.connected ? state.elapsed : 0)} /><Stat label="Serving tower" value={`BTS ${state.serving}`} /><Stat label="Call drops" value={state.drops} /></div></div>
    </section>
    <section className="three-grid">
      <div className="card metrics-card"><CardTitle eyebrow="RADIO MEASUREMENTS" title="Signal monitoring" icon={Signal} /><div className="signal-rows"><SignalRow tower="A" value={signals.A} active={state.serving === 'A'} /><SignalRow tower="B" value={signals.B} active={state.serving === 'B'} /></div><div className="metric-pair"><Stat label="RxQual (0–7)" value={`${rxQual} / 7`} /><Stat label="Position" value={`${Math.round(state.position)}% route`} /></div></div>
      <div className="card chart-card"><CardTitle eyebrow="RADIO MEASUREMENTS" title="Signal strength history" icon={BarChart3} /><Suspense fallback={<div className="chart-wrap"><EmptyState text="Loading signal chart..." /></div>}><SignalChart history={state.history} /></Suspense></div>
      <div className="card controls-card"><CardTitle eyebrow="SIMULATION CONTROL" title="Ambulance movement" icon={Gauge} /><div className="movement-status"><Ambulance size={18} /><span>Route progress</span><b>{Math.round(state.position)}%</b></div><input aria-label="Manual movement" type="range" min="18" max="82" value={state.position} onChange={(e) => onManualMove(e.target.value)} /><div className="control-actions"><button className="button primary" onClick={isRunning ? () => {} : onStart} disabled={isRunning || state.callStatus === 'Disconnected'}><Play size={15} /> Start</button><button className="button" onClick={onPause} disabled={!isRunning}><Pause size={15} /> Pause</button><button className="icon-button" onClick={onReset} title="Reset simulation"><RotateCcw size={16} /></button></div><label className="speed-label">Movement speed <b>{config.speed} km/h</b></label><input type="range" min="4" max="20" value={config.speed} onChange={(e) => setConfig({ ...config, speed: Number(e.target.value) })} /></div>
    </section>
    <section className="bottom-grid"><div className="card events-card"><CardTitle eyebrow="SYSTEM ACTIVITY" title="Event log" icon={Activity} /><div className="event-list">{state.events.length === 0 ? <EmptyState text="Start the simulation to stream system events." /> : state.events.map((event) => <div className="event" key={event.id}><span className={`event-marker ${EVENT_COLORS[event.tone]}`} /><span className="event-time">{formatClock(event.time)}</span><span>{event.message}</span></div>)}</div></div><ConfigPanel config={config} setConfig={setConfig} /></section>
  </div>
}

function CardTitle({ eyebrow, title, icon: Icon }) { return <div className="card-heading compact"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><Icon size={18} className="heading-icon" /></div> }
function Stat({ label, value }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
function SignalRow({ tower, value, active }) { const percent = Math.max(4, Math.min(100, ((value + 118) / 73) * 100)); return <div className="signal-row"><div className={`tower-badge ${active ? 'active' : ''}`}>BTS {tower}</div><div className="signal-track"><span style={{ width: `${percent}%` }} className={active ? 'active' : ''} /></div><strong>{value} <small>dBm</small></strong></div> }
function EmptyState({ text }) { return <div className="empty-state"><Activity size={17} />{text}</div> }
function NetworkMap({ state, signals }) {
  const ambulanceX = 12 + (state.position / 100) * 76
  return <div className="network-map"><div className="map-legend"><span><i className="legend-dot green" /> Active serving</span><span><i className="legend-dot blue" /> Neighbour</span><span><i className="legend-dot orange" /> Handover</span></div><svg viewBox="0 0 760 270" role="img" aria-label="Cellular network map"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1b2a3e" strokeWidth="1" /></pattern></defs><rect width="760" height="270" fill="url(#grid)" /><path d="M45 218 C 240 190, 440 235, 715 205" fill="none" stroke="#293b50" strokeWidth="22" /><path d="M45 218 C 240 190, 440 235, 715 205" fill="none" stroke="#52657d" strokeWidth="2" strokeDasharray="10 10" /><circle cx="185" cy="125" r="115" className={state.serving === 'A' ? 'coverage active' : 'coverage'} /><circle cx="575" cy="125" r="115" className={state.serving === 'B' ? 'coverage active' : 'coverage'} /><line x1="185" y1="125" x2={`${ambulanceX * 7.6}`} y2="206" className={`signal-line ${state.handover ? 'handover' : ''}`} /><line x1="575" y1="125" x2={`${ambulanceX * 7.6}`} y2="206" className={`signal-line neighbour ${state.handover ? 'handover' : ''}`} /><TowerIcon x="185" y="125" label="A" active={state.serving === 'A'} /><TowerIcon x="575" y="125" label="B" active={state.serving === 'B'} /><g transform={`translate(${ambulanceX * 7.6 - 20}, 185)`}><circle r="23" cx="20" cy="22" fill={state.handover ? '#f0a14a' : '#46d6a0'} opacity=".13" className="ambulance-ring" /><rect x="4" y="12" width="32" height="18" rx="4" fill={state.handover ? '#f0a14a' : '#46d6a0'} /><path d="M10 12l5-8h11l5 8" fill="none" stroke="#0e1726" strokeWidth="2" /><rect x="18" y="6" width="8" height="6" fill="#d9efff" /><circle cx="12" cy="31" r="4" fill="#0b1320" /><circle cx="29" cy="31" r="4" fill="#0b1320" /><path d="M20 15v7m-4-3h8" stroke="#0e1726" strokeWidth="2" /></g><g transform="translate(604 35)"><rect width="125" height="38" rx="5" fill="#142235" stroke="#2b405b" /><text x="12" y="16" fill="#778da8" fontSize="9">EMERGENCY CONTROL</text><text x="12" y="29" fill="#dbe8f5" fontSize="11">CENTRE / MSC</text></g><text x="157" y="255" fill="#a5b7cd" fontSize="12">BTS TOWER A</text><text x="547" y="255" fill="#a5b7cd" fontSize="12">BTS TOWER B</text><text x={`${ambulanceX * 7.6 - 10}`} y="175" fill="#dbe8f5" fontSize="10">AMBULANCE</text></svg><div className="map-footer"><span><MapPin size={14} /> Route: Sector A → Sector B</span><span><Signal size={14} /> A {signals.A} dBm &nbsp;·&nbsp; B {signals.B} dBm</span></div></div>
}
function TowerIcon({ x, y, label, active }) { return <g transform={`translate(${x - 18},${y - 26})`}><circle cx="18" cy="26" r="29" fill={active ? '#46d6a0' : '#4a8dff'} opacity=".1" /><path d="M18 5v38M8 43h20M12 43l6-38 6 38M8 16h20M10 25h16" fill="none" stroke={active ? '#46d6a0' : '#4a8dff'} strokeWidth="2" /><circle cx="18" cy="4" r="4" fill={active ? '#46d6a0' : '#4a8dff'} /><text x="14" y="-8" fill="#dbe8f5" fontSize="12">{label}</text></g> }

function ConfigPanel({ config, setConfig }) { const fields = [['handoverThreshold', 'Handover threshold', 'dBm', -105, -75, 1], ['handoverMargin', 'Handover margin', 'dB', 0, 10, 1], ['hysteresis', 'Hysteresis', 'dB', 0, 8, 1], ['persistence', 'Measurement persistence', 'sec', 1, 5, 0.5], ['txPower', 'Tower transmission power', 'dBm', 30, 50, 1], ['channels', 'Available channels / BTS', '', 1, 16, 1]]; return <div className="card config-card"><CardTitle eyebrow="SYSTEM PARAMETERS" title="Configuration" icon={Settings2} /><div className="config-fields">{fields.map(([key, label, unit, min, max, step]) => <label key={key}><span>{label}<b>{config[key]} {unit}</b></span><input type="range" min={min} max={max} step={step} value={config[key]} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} /></label>)}</div><div className="config-note"><Info size={14} /> Changes apply to the live decision engine.</div></div> }

function Architecture() { const components = [['Mobile Station', 'Ambulance-mounted handset', Ambulance], ['BTS', 'Radio interface and signal measurements', TowerControl], ['BSC', 'Manages radio resources and handover control', GitBranch], ['MSC', 'Switching, mobility and call continuity', Phone], ['Emergency Control Centre', 'Receives the 112 emergency call', Siren]]; return <div className="page"><PageHeader eyebrow="SYSTEM DESIGN" title="Network Architecture" description="The simplified GSM path used by this software simulation." /><div className="architecture-flow">{components.map(([title, detail, Icon], index) => <div className="architecture-node" key={title}><div className="node-icon"><Icon size={22} /></div><strong>{title}</strong><span>{detail}</span>{index < components.length - 1 && <ChevronRight className="flow-arrow" />}</div>)}</div><div className="card prose-card"><span className="eyebrow">COMPONENT ROLES</span><h2>How the call moves through the network</h2><p>The ambulance is represented as a Mobile Station (MS). BTS 1 and BTS 2 provide overlapping radio coverage, while the BSC evaluates measurements and requests a target channel. The MSC maintains the switched emergency call toward the Emergency Control Centre.</p><div className="role-grid"><Role title="Radio access" text="BTS units calculate received signal levels and expose neighbour measurements." /><Role title="Mobility control" text="The BSC applies threshold, margin, hysteresis and persistence rules." /><Role title="Call continuity" text="The MSC keeps the application-level call connected across the hard handover interval." /></div></div></div> }
function Role({ title, text }) { return <div className="role"><CheckCircle2 size={16} /><div><strong>{title}</strong><p>{text}</p></div></div> }
function Algorithm({ config }) { return <div className="page"><PageHeader eyebrow="DECISION ENGINE" title="Handover Algorithm" description="A transparent, simplified GSM hard-handover decision model." /><div className="algorithm-layout"><div className="card flow-card"><span className="eyebrow">MEASUREMENT FLOW</span>{['Measure serving and neighbour RxLev', 'Check serving threshold OR target margin', `Persist condition for ${config.persistence} seconds`, 'Request and verify target radio channel', 'Execute hard handover interruption', 'Update serving BTS and preserve call'].map((step, index) => <div className="algorithm-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>{index < 5 && <div className="step-line" />}</div>)}</div><div className="card prose-card"><span className="eyebrow">CURRENT PARAMETERS</span><h2>Why hysteresis matters</h2><p>The engine does not switch simply because one tower is momentarily strongest. A handover condition must persist, and the neighbour must exceed the serving signal by the configured margin plus hysteresis. This reduces ping-pong handovers caused by fast fading.</p><div className="formula">RxLev = P<sub>ref</sub> − 10 × n × log<sub>10</sub>(d / d<sub>ref</sub>)</div><p>GSM uses a hard handover: the radio link briefly transitions from the serving BTS to the target BTS. The simulation records that interruption, while the emergency call remains connected after a successful target allocation.</p></div></div></div> }
function Results({ state }) { const total = state.successful + state.failed; const rate = total ? Math.round((state.successful / total) * 100) : 0; return <div className="page"><PageHeader eyebrow="SESSION ANALYTICS" title="Simulation Results" description="Derived metrics from the current simulation session." /><div className="result-grid"><ResultCard label="Total handovers" value={total} icon={GitBranch} /><ResultCard label="Successful handovers" value={state.successful} icon={CheckCircle2} tone="green" /><ResultCard label="Failed handovers" value={state.failed} icon={X} tone="orange" /><ResultCard label="Call drops" value={state.drops} icon={Phone} tone="red" /></div><div className="card results-detail"><div><span className="eyebrow">SESSION SUMMARY</span><h2>Handover performance</h2><p>These values update from actual engine events, not preset output.</p></div><div className="rate"><strong>{rate}%</strong><span>Handover success rate</span><div className="rate-bar"><i style={{ width: `${rate}%` }} /></div></div><div className="detail-stat"><span>Average interruption duration</span><strong>{state.successful ? `${(state.interruption / state.successful).toFixed(2)} sec` : '—'}</strong></div></div></div> }
function ResultCard({ label, value, icon: Icon, tone }) { return <div className="card result-card"><div className={`result-icon ${tone || ''}`}><Icon size={18} /></div><span>{label}</span><strong>{value}</strong></div> }
function About() { return <div className="page"><PageHeader eyebrow="PROJECT DOCUMENTATION" title="About the Project" description="A classroom-ready visualization of seamless emergency communication during mobility." /><div className="about-grid"><div className="card prose-card"><span className="eyebrow">ABSTRACT</span><h2>Emergency communication without a dropped call</h2><p>This project demonstrates how a GSM network can maintain an ongoing emergency voice call while an ambulance travels from one cell coverage area to another. It models signal propagation, measurement persistence, resource allocation, hard handover interruption and call continuity in a browser.</p><h3>Objectives</h3><ul><li>Visualize overlapping GSM cell coverage and mobile movement.</li><li>Make handover decisions explainable through live measurements and events.</li><li>Compare normal, weak-signal and target-congestion scenarios.</li></ul></div><div className="card stack-card"><span className="eyebrow">TECHNOLOGY</span>{[['Frontend', 'React + Vite'], ['Visualization', 'SVG + Recharts'], ['Interaction', 'Lucide React'], ['Runtime', 'Local browser only']].map(([label, value]) => <div className="about-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}<div className="disclaimer"><CircleHelp size={17} /><span>This is a software simulation. It does not connect to real GSM infrastructure or place actual emergency calls.</span></div></div></div></div> }

export default App
