export const DEFAULT_CONFIG = {
  handoverThreshold: -92,
  handoverMargin: 3,
  hysteresis: 2,
  persistence: 2,
  speed: 10,
  txPower: 43,
  channels: 8,
}

export const SCENARIOS = {
  normal: { label: 'Normal Handover', description: 'Balanced coverage with available target capacity.' },
  weak: { label: 'Weak Signal', description: 'A lower-power route exposes the ambulance to degraded coverage.' },
  congestion: { label: 'Target Congestion', description: 'BTS 2 is full; the call may drop if BTS 1 becomes unusable.' },
}

export const INITIAL_POSITION = 18

export function calculateSignal(position, tower, config, scenario = 'normal') {
  const towerPosition = tower === 'A' ? 23 : 77
  const distance = Math.max(Math.abs(position - towerPosition), 2)
  const scenarioLoss = scenario === 'weak' ? 9 : 0
  const power = config.txPower - 100 - 10 * 2.7 * Math.log10(distance / 2) - scenarioLoss
  return Math.max(-118, Math.min(-45, Math.round(power * 10) / 10))
}

export function calculateRxQual(signal) {
  return Math.max(0, Math.min(7, Math.round((-signal - 45) / 11)))
}

export function createInitialState() {
  return {
    position: INITIAL_POSITION,
    elapsed: 0,
    serving: 'A',
    status: 'idle',
    callStatus: 'Ready',
    handover: null,
    successful: 0,
    failed: 0,
    drops: 0,
    interruption: 0,
    connected: false,
    events: [],
    history: [],
  }
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

export function formatClock(seconds) {
  return `[${formatTime(seconds)}]`
}
