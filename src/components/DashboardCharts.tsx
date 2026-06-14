import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'

// Palette hex par nom de couleur de zone (cohérent avec ZoneConfig.color).
const ZONE_HEX: Record<string, string> = {
  blue: '#3B82F6',
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  gray: '#94A3B8',
}

interface HourPoint {
  hour: string
  entrees: number
}
interface ZoneSlice {
  name: string
  value: number
  color: string
}

const tooltipStyle = {
  background: '#1E293B',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#fff',
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="rounded-xl border border-white/10 bg-ardoise p-5 shadow-card">
      <h2 className="font-display font-semibold text-sm">{title}</h2>
      <div className="mt-4 h-64">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-lg">📊</span>
            <p className="mt-2 text-xs text-slate-500">Aucune donnée pour le moment</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export default function DashboardCharts() {
  const { settings } = useSettings()
  const [hourly, setHourly] = useState<HourPoint[]>([])
  const [zones, setZones] = useState<ZoneSlice[]>([])
  const [presence, setPresence] = useState<{ presents: number; absents: number }>({ presents: 0, absents: 0 })
  const channelRef = useRef(`charts_${Math.random().toString(36).slice(2)}`)

  const load = useCallback(async () => {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const [todayRes, onSiteRes, empRes, pointRes] = await Promise.all([
      supabase
        .from('access_logs')
        .select('checked_in_at')
        .gte('checked_in_at', dayStart.toISOString()),
      supabase.from('access_logs').select('zone').eq('checkout_status', 'present'),
      supabase.from('employees').select('id').eq('statut', 'actif'),
      supabase
        .from('pointages')
        .select('employee_id, type, heure')
        .gte('heure', dayStart.toISOString())
        .order('heure', { ascending: true }),
    ])

    // 1. Affluence par heure (0h-23h)
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, entrees: 0 }))
    for (const r of (todayRes.data ?? []) as { checked_in_at: string }[]) {
      const h = new Date(r.checked_in_at).getHours()
      buckets[h].entrees++
    }
    setHourly(buckets)

    // 2. Répartition par zone (personnes actuellement sur site)
    const zoneCount = new Map<string, number>()
    for (const r of (onSiteRes.data ?? []) as { zone: string }[]) {
      zoneCount.set(r.zone, (zoneCount.get(r.zone) ?? 0) + 1)
    }
    const slices: ZoneSlice[] = Array.from(zoneCount.entries()).map(([name, value]) => {
      const conf = settings.zones.find((z) => z.name === name)
      return { name, value, color: ZONE_HEX[conf?.color ?? 'gray'] ?? ZONE_HEX.gray }
    })
    setZones(slices)

    // 3. Présence employés (présents vs absents aujourd'hui)
    const employees = (empRes.data ?? []) as { id: string }[]
    const pointages = (pointRes.data ?? []) as { employee_id: string; type: 'entree' | 'sortie'; heure: string }[]
    const lastByEmp = new Map<string, 'entree' | 'sortie'>()
    for (const p of pointages) lastByEmp.set(p.employee_id, p.type)
    let presents = 0
    for (const e of employees) if (lastByEmp.get(e.id) === 'entree') presents++
    setPresence({ presents, absents: employees.length - presents })
  }, [settings.zones])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [load])

  const totalEntries = hourly.reduce((a, b) => a + b.entrees, 0)
  const presenceData = [
    { name: 'Présents', value: presence.presents, color: '#22C55E' },
    { name: 'Absents', value: presence.absents, color: '#64748B' },
  ]
  const hasEmployees = presence.presents + presence.absents > 0

  return (
    <div className="mt-8 space-y-6">
      {/* Graphique 1 — Affluence par heure (pleine largeur) */}
      <ChartCard title="Affluence par heure — aujourd'hui" empty={totalEntries === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hourly} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="hour" stroke="#64748B" fontSize={11} interval={1} tickLine={false} />
            <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Line
              type="monotone"
              dataKey="entrees"
              name="Entrées"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Graphiques 2 & 3 — côte à côte sur desktop, empilés sur mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Répartition par zone — sur site" empty={zones.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={zones}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={45}
                paddingAngle={2}
              >
                {zones.map((z) => (
                  <Cell key={z.name} fill={z.color} stroke="#1E293B" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Présence employés — aujourd'hui" empty={!hasEmployees}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={presenceData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="value" name="Employés" radius={[6, 6, 0, 0]} maxBarSize={90}>
                {presenceData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
