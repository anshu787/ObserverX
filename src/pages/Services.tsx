import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GitBranch, Activity, Database, Shield, Globe, Server as ServerIcon, Layers, Cpu } from "lucide-react";
import { motion } from "framer-motion";

interface Service {
  id: string;
  name: string;
  type: string;
  status: string;
  health_score: number;
}

interface Dep {
  source_service_id: string;
  target_service_id: string;
}

const statusColor: Record<string, string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  critical: "#ef4444",
  offline: "#6b7280",
};

const typeIcons: Record<string, any> = {
  frontend: Globe, gateway: Layers, api: Cpu, auth: Shield,
  database: Database, cache: ServerIcon, queue: ServerIcon, worker: ServerIcon,
};

const defaultPositions: Record<string, { x: number; y: number }> = {
  frontend: { x: 80, y: 180 },
  gateway: { x: 280, y: 180 },
  api: { x: 480, y: 120 },
  auth: { x: 480, y: 260 },
  database: { x: 680, y: 120 },
  cache: { x: 680, y: 260 },
  queue: { x: 280, y: 60 },
  worker: { x: 280, y: 320 },
};

const NODE_W = 140;
const NODE_H = 56;

export default function ServiceMap() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Service | null>(null);
  const [serviceMetrics, setServiceMetrics] = useState<any[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [sRes, dRes] = await Promise.all([
        supabase.from("services").select("id, name, type, status, health_score").eq("user_id", user.id),
        supabase.from("service_dependencies").select("source_service_id, target_service_id").eq("user_id", user.id),
      ]);
      if (sRes.data) {
        setServices(sRes.data);
        const pos: Record<string, { x: number; y: number }> = {};
        const typeCount: Record<string, number> = {};
        sRes.data.forEach((s) => {
          typeCount[s.type] = (typeCount[s.type] || 0);
          const base = defaultPositions[s.type] ?? { x: 400, y: 200 };
          pos[s.id] = { x: base.x, y: base.y + typeCount[s.type] * 80 };
          typeCount[s.type]++;
        });
        setPositions(pos);
      }
      if (dRes.data) setDeps(dRes.data);
    };
    fetchData();
  }, [user]);

  const handleMouseDown = useCallback((e: React.MouseEvent, svcId: string) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const pos = positions[svcId] ?? { x: 0, y: 0 };
    setDragOffset({ x: svgP.x - pos.x, y: svgP.y - pos.y });
    setDragging(svcId);
  }, [positions]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    setPositions((prev) => ({ ...prev, [dragging]: { x: svgP.x - dragOffset.x, y: svgP.y - dragOffset.y } }));
  }, [dragging, dragOffset]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const handleNodeClick = useCallback(async (svc: Service) => {
    if (dragging) return;
    setSelected(svc);
    // Fetch recent metrics for this service's server
    const { data } = await supabase
      .from("metrics")
      .select("metric_type, value, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(12);
    setServiceMetrics(data ?? []);
  }, [dragging]);

  const getEdgePath = useCallback((fromId: string, toId: string) => {
    const from = positions[fromId] ?? { x: 0, y: 0 };
    const to = positions[toId] ?? { x: 0, y: 0 };
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }, [positions]);

  // Compute dependency stats
  const incomingCount = (svcId: string) => deps.filter((d) => d.target_service_id === svcId).length;
  const outgoingCount = (svcId: string) => deps.filter((d) => d.source_service_id === svcId).length;
  const degradedServices = services.filter((s) => s.status !== "healthy");
  const affectedByDegraded = new Set<string>();
  degradedServices.forEach((ds) => {
    deps.filter((d) => d.target_service_id === ds.id).forEach((d) => affectedByDegraded.add(d.source_service_id));
    deps.filter((d) => d.source_service_id === ds.id).forEach((d) => affectedByDegraded.add(d.target_service_id));
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Map</h1>
        <p className="text-sm text-muted-foreground">Drag nodes to rearrange • Click to view details</p>
      </div>

      {/* Dependency Overview */}
      {services.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Services</p>
              <p className="text-2xl font-bold">{services.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Connections</p>
              <p className="text-2xl font-bold">{deps.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Healthy</p>
              <p className="text-2xl font-bold text-chart-2">{services.filter((s) => s.status === "healthy").length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Degraded</p>
              <p className="text-2xl font-bold text-warning">{degradedServices.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Propagation Visualization */}
      {degradedServices.some((s) => s.status === "critical") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-destructive mb-3">🔴 Error Propagation Path</p>
            <div className="space-y-2">
              {degradedServices
                .filter((s) => s.status === "critical")
                .map((criticalSvc) => {
                  // Build propagation chain
                  const chain: string[] = [criticalSvc.name];
                  let currentId = criticalSvc.id;
                  const visited = new Set([currentId]);
                  for (let step = 0; step < 5; step++) {
                    const upstream = deps.find((d) => d.target_service_id === currentId && !visited.has(d.source_service_id));
                    if (!upstream) break;
                    const svc = services.find((s) => s.id === upstream.source_service_id);
                    if (svc) {
                      chain.unshift(svc.name);
                      visited.add(svc.id);
                      currentId = svc.id;
                    }
                  }
                  // Add downstream
                  currentId = criticalSvc.id;
                  for (let step = 0; step < 5; step++) {
                    const downstream = deps.find((d) => d.source_service_id === currentId && !visited.has(d.target_service_id));
                    if (!downstream) break;
                    const svc = services.find((s) => s.id === downstream.target_service_id);
                    if (svc) {
                      chain.push(svc.name);
                      visited.add(svc.id);
                      currentId = svc.id;
                    }
                  }
                  return (
                    <motion.div
                      key={criticalSvc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-1 flex-wrap font-mono text-xs"
                    >
                      {chain.map((name, j) => {
                        const isCritical = name === criticalSvc.name;
                        return (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && <span className="text-destructive font-bold">→</span>}
                            <span className={`px-2 py-1 rounded ${isCritical ? "bg-destructive text-destructive-foreground font-bold" : "bg-destructive/10 text-destructive"}`}>
                              {name} {isCritical ? "❌" : "⚠️"}
                            </span>
                          </span>
                        );
                      })}
                    </motion.div>
                  );
                })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 italic">
              Failure propagates through service dependency chain — upstream services affected
            </p>
          </CardContent>
        </Card>
      )}

      {/* Impact Analysis */}
      {degradedServices.length > 0 && !degradedServices.some((s) => s.status === "critical") && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-warning mb-2">⚠️ Dependency Impact</p>
            <div className="space-y-1">
              {degradedServices.map((ds) => {
                const affected = deps
                  .filter((d) => d.target_service_id === ds.id)
                  .map((d) => services.find((s) => s.id === d.source_service_id)?.name)
                  .filter(Boolean);
                return (
                  <p key={ds.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{ds.name}</span> ({ds.status}) — {affected.length > 0 ? `affects ${affected.join(", ")}` : "no upstream dependents"}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {services.length > 0 ? (
            <>
              <svg
                ref={svgRef}
                width="100%"
                viewBox="0 0 900 420"
                className="overflow-visible cursor-default select-none"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--muted-foreground))" opacity="0.5" />
                  </marker>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Animated connections */}
                {deps.map((dep) => {
                  const fromSvc = services.find((s) => s.id === dep.source_service_id);
                  const toSvc = services.find((s) => s.id === dep.target_service_id);
                  const color = toSvc?.status === "critical" ? statusColor.critical : toSvc?.status === "degraded" ? statusColor.degraded : statusColor.healthy;
                  return (
                    <g key={`${dep.source_service_id}-${dep.target_service_id}`}>
                      <path d={getEdgePath(dep.source_service_id, dep.target_service_id)} fill="none" stroke={color} strokeWidth={2} opacity={0.3} markerEnd="url(#arrow)" />
                      <path d={getEdgePath(dep.source_service_id, dep.target_service_id)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="8 12" markerEnd="url(#arrow)">
                        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
                      </path>
                    </g>
                  );
                })}

                {/* Nodes */}
                {services.map((svc) => {
                  const pos = positions[svc.id] ?? { x: 0, y: 0 };
                  const color = statusColor[svc.status] ?? statusColor.offline;
                  return (
                    <g
                      key={svc.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onMouseDown={(e) => handleMouseDown(e, svc.id)}
                      onClick={() => handleNodeClick(svc)}
                      className={`cursor-grab ${dragging === svc.id ? "cursor-grabbing" : ""}`}
                      filter={svc.status === "critical" ? "url(#glow)" : undefined}
                    >
                      <rect width={NODE_W} height={NODE_H} rx="10" fill="hsl(var(--card))" stroke={color} strokeWidth={2.5} className="transition-all" />
                      <circle cx="18" cy={NODE_H / 2} r="5" fill={color}>
                        {svc.status !== "healthy" && <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />}
                      </circle>
                      <text x="32" y={NODE_H / 2 - 4} fontSize="11" fontWeight="600" fill="hsl(var(--foreground))" fontFamily="Inter">{svc.name}</text>
                      <text x="32" y={NODE_H / 2 + 12} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="Inter">{svc.type} • {svc.health_score}%</text>
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 py-3 border-t border-border/30">
                {Object.entries(statusColor).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-muted-foreground capitalize">{status}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 border-t-2 border-dashed border-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Data flow</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-20 text-center">
              <GitBranch className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">No services configured</h3>
              <p className="mt-1 text-sm text-muted-foreground">Generate demo data to see the service map.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[400px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full`} style={{ backgroundColor: statusColor[selected.status] }} />
                  {selected.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{selected.type}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Health</p>
                      <p className="font-mono font-bold" style={{ color: statusColor[selected.status] }}>{selected.health_score}%</p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor[selected.status], color: statusColor[selected.status] }}>
                      {selected.status}
                    </Badge>
                  </CardContent>
                </Card>
                {serviceMetrics.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Metrics</p>
                    <div className="space-y-2">
                      {serviceMetrics.slice(0, 6).map((m, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                          <span className="capitalize text-muted-foreground">{m.metric_type.replace("_", " ")}</span>
                          <span className="font-mono font-medium">{Math.round(m.value * 10) / 10}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Depends On (outgoing)</p>
                  <div className="space-y-1">
                    {deps.filter((d) => d.source_service_id === selected.id).map((d) => {
                      const target = services.find((s) => s.id === d.target_service_id);
                      return target ? (
                        <div key={d.target_service_id} className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor[target.status] }} />
                          <span>{target.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{target.health_score}%</span>
                        </div>
                      ) : null;
                    })}
                    {deps.filter((d) => d.source_service_id === selected.id).length === 0 && (
                      <p className="text-xs text-muted-foreground">No outgoing dependencies</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Depended On By (incoming)</p>
                  <div className="space-y-1">
                    {deps.filter((d) => d.target_service_id === selected.id).map((d) => {
                      const source = services.find((s) => s.id === d.source_service_id);
                      return source ? (
                        <div key={d.source_service_id} className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor[source.status] }} />
                          <span>{source.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{source.health_score}%</span>
                        </div>
                      ) : null;
                    })}
                    {deps.filter((d) => d.target_service_id === selected.id).length === 0 && (
                      <p className="text-xs text-muted-foreground">No incoming dependencies</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
