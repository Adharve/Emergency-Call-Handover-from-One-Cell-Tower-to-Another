# Emergency Call Handover Simulation

An interactive React/Vite simulation of a GSM ambulance emergency call moving from BTS Tower A to BTS Tower B.

## Abstract

The application models overlapping GSM coverage, path-loss-based received signal strength, RxQual, handover threshold and margin, hysteresis, measurement persistence, target channel allocation, hard-handover interruption, call continuity, and failure/call-drop behavior.

This is a software simulation. It does not connect to real GSM infrastructure or place actual emergency calls.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Build for production with `npm run build`.

## Scenarios

- **Normal Handover**: the ambulance moves from BTS A to BTS B with available capacity.
- **Weak Signal**: propagation loss exposes the route to degraded coverage.
- **Target Congestion**: BTS B has no available channel, so a handover can fail and the call can drop when the serving link becomes unusable.

## Model

Received power follows `P = P_ref - 10 × n × log10(d / d_ref)`. The decision engine requires the serving signal to cross the configured threshold or the neighbour to exceed it by margin plus hysteresis for the configured persistence time. The successful GSM hard handover records its radio interruption while keeping the application-level emergency call connected.

## Project structure

- `src/simulation.js` - propagation, state, formatting, and simulation constants.
- `src/App.jsx` - dashboard, pages, controls, event processing, and visual components.
- `src/App.css` - responsive dark telecommunications dashboard styling.
