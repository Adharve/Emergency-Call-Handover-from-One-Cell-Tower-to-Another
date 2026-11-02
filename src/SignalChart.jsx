import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatClock, formatTime } from './simulation'

function SignalChart({ history }) {
  return <div className="chart-wrap">{history.length < 2 ? <div className="empty-state">Signal samples will appear as the ambulance moves.</div> : <ResponsiveContainer width="100%" height={170}><AreaChart data={history}><defs><linearGradient id="aFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#46d6a0" stopOpacity=".25" /><stop offset="100%" stopColor="#46d6a0" stopOpacity="0" /></linearGradient><linearGradient id="bFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a8dff" stopOpacity=".2" /><stop offset="100%" stopColor="#4a8dff" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#243449" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tickFormatter={formatTime} stroke="#60738b" tick={{ fontSize: 10 }} /><YAxis domain={[-120, -40]} stroke="#60738b" tick={{ fontSize: 10 }} width={35} /><Tooltip contentStyle={{ background: '#142033', border: '1px solid #2b3e56', borderRadius: 6 }} labelFormatter={(value) => formatClock(value)} /><Area type="monotone" dataKey="A" stroke="#46d6a0" fill="url(#aFill)" strokeWidth={2} dot={false} /><Area type="monotone" dataKey="B" stroke="#4a8dff" fill="url(#bFill)" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer>}</div>
}

export default SignalChart
