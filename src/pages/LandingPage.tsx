import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, Bell, GitBranch, Shield, Zap, ChevronRight,
  Server, Target, BookOpen, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import dashboardPreview from "@/assets/dashboard-preview.png";
import incidentPreview from "@/assets/incident-preview.png";

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Metrics",
    desc: "CPU, memory, disk, and network — live-updating charts with selectable time ranges from 1 hour to 7 days.",
  },
  {
    icon: Zap,
    title: "AI Incident Analysis",
    desc: "One-click root cause analysis powered by AI. Get plain-English summaries, affected services, and suggested fixes.",
  },
  {
    icon: GitBranch,
    title: "Service Dependency Map",
    desc: "Interactive graph showing how your services connect. Color-coded health status with drill-down into any node.",
  },
  {
    icon: Bell,
    title: "Smart Alerting",
    desc: "Correlated alert rules with AI-enhanced descriptions. No more noisy raw threshold notifications.",
  },
  {
    icon: Target,
    title: "SLO Tracking",
    desc: "Define availability and latency objectives per service. Track error budgets and burn rates in real time.",
  },
  {
    icon: BookOpen,
    title: "Automated Runbooks",
    desc: "Create step-by-step remediation procedures that trigger automatically when incidents match your conditions.",
  },
];

const stats = [
  { value: "99.99%", label: "Uptime SLA" },
  { value: "<200ms", label: "Metric Latency" },
  { value: "50+", label: "Integrations" },
  { value: "24/7", label: "On-Call Support" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">ObserveX</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 md:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Shield className="h-3.5 w-3.5" />
              AI-Powered Cloud Observability
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Monitor everything.
              <br />
              <span className="text-primary">Fix faster.</span>
            </h1>
            <p className="mt-4 text-base font-medium text-foreground/80 italic">
              The AI Reliability Engineer that explains incidents before users notice them.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Full-stack observability with AI-driven incident analysis, real-time metrics,
              service dependency mapping, and smart alerting — all in one platform.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-base">
                  Start Free <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="text-base">
                  See Features
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mx-auto mt-16 max-w-5xl"
          >
            <div className="overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-primary/5">
              <img
                src={dashboardPreview}
                alt="ObserveX monitoring dashboard showing real-time server metrics, CPU and memory charts, incident timeline, and service dependency map"
                className="w-full"
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-card/50">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-primary">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to stay on top
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From metrics to incident response, ObserveX covers your entire observability stack.
          </p>
        </motion.div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="group rounded-xl border border-border/50 bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* AI Showcase */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="h-3 w-3" /> AI-Powered
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Understand incidents in seconds, not hours
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Our AI engine analyzes your metrics, logs, and traces to give you a plain-English
              root cause analysis. See affected services, severity impact, and step-by-step
              remediation — instantly.
            </p>
            <ul className="mt-6 space-y-3">
              {["Root cause in plain English", "Affected service mapping", "Suggested fix steps", "SLA impact calculation"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                    <ChevronRight className="h-3 w-3 text-primary" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/auth" className="mt-8 inline-block">
              <Button className="gap-2">
                Try AI Analysis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-xl border border-border/50 shadow-xl"
          >
            <img
              src={incidentPreview}
              alt="AI-powered incident root cause analysis showing affected services and suggested fixes"
              className="w-full"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-8 py-16 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.1),transparent_70%)]" />
          <div className="relative">
            <Server className="mx-auto mb-6 h-10 w-10 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to observe everything?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Set up in minutes. Monitor servers, services, and incidents with AI-powered insights from day one.
            </p>
            <Link to="/auth" className="mt-8 inline-block">
              <Button size="lg" className="gap-2 text-base">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">ObserveX</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ObserveX. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
