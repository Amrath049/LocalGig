import { useEffect, useState, useRef, FormEvent } from "react";
import {
  Search,
  MapPin,
  CheckCircle,
  X,
  Phone,
  User,
  ArrowRight,
  Edit2,
  Check,
  Plus,
  ChevronRight,
  LogOut,
  Clock,
  SlidersHorizontal,
  Briefcase,
  ChevronDown,
  Menu,
  Settings,
} from "lucide-react";
import { login, register, verifyEmailOtp, getMe, getJobs, applyJob, getMyApplications, getEmployerJobs, updateProfile, createJob, updateApplicationStatus } from "../lib/api";
import type { ApiUserProfile } from "../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type View = "home" | "login" | "worker" | "employer" | "jobs" | "profile";
type JobFilter = "All" | "Full-time" | "Part-time" | "Gig";
type WorkerTab = "browse" | "applications";
type EmployerTab = "listings" | "post";
type PayType = "Fixed" | "Range" | "Open to discuss";
type AppStatus = "Applied" | "Seen" | "Shortlisted" | "Hired";
type ApplicantStatus = "Applied" | "Seen" | "Shortlisted" | "Hired" | "NOT_SELECTED" | "Declined";
type SortOption = "newest" | "oldest";

interface Job {
  id: string | number;
  title: string;
  employer: string;
  verified: boolean;
  type: string;
  pay: string;
  payValue: number; // for filtering; 0 = open to discuss
  skills: string[];
  posted: string;
  postedDays: number; // 0 = today
  location: string;
}

function apiJobToUiJob(job: any): Job {
  const typeMap = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    GIG: "Gig",
    full_time: "Full-time",
    part_time: "Part-time",
    gig: "Gig",
  };

  const pay = (job.payType === "FIXED" || job.payType === "fixed")
    ? `₹${job.payAmount ?? 0} / month`
    : (job.payType === "RANGE" || job.payType === "range")
    ? `₹${job.payMin ?? 0}–${job.payMax ?? 0}`
    : job.payCustom || "Open to discuss";

  return {
    id: String(job.id),
    title: job.title,
    employer: job.employer?.email ?? "Local employer",
    verified: true,
    type: typeMap[job.type as string] ?? "Gig",
    pay,
    payValue: job.payAmount ?? job.payMin ?? 0,
    skills: [],
    posted: new Date(job.createdAt).toLocaleDateString(),
    postedDays: 0,
    location: job.location ?? "Nearby",
  };
}

function apiStatusToUiStatus(status: string): AppStatus {
  const statusMap: Record<string, AppStatus> = {
    applied: "Applied",
    seen: "Seen",
    shortlisted: "Shortlisted",
    hired: "Hired",
    APPLIED: "Applied",
    SEEN: "Seen",
    SHORTLISTED: "Shortlisted",
    HIRED: "Hired",
  };

  return statusMap[status] ?? statusMap[status.toLowerCase()] ?? "Applied";
}

function apiApplicationToUiApplication(application: any): MyApplication {
  return {
    id: String(application.id),
    title: application.job?.title ?? "",
    employer: application.job?.employer?.email ?? "Local employer",
    appliedDate: new Date(application.createdAt).toLocaleDateString(),
    status: apiStatusToUiStatus(application.status),
  };
}

function apiJobToListing(job: any): Listing {
  const typeMap: Record<string, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    GIG: "Gig",
    full_time: "Full-time",
    part_time: "Part-time",
    gig: "Gig",
  };

  const pay = (job.payType === "FIXED" || job.payType === "fixed")
    ? `₹${job.payAmount ?? 0} / month`
    : (job.payType === "RANGE" || job.payType === "range")
    ? `₹${job.payMin ?? 0}–${job.payMax ?? 0}`
    : job.payCustom || "Open to discuss";

  return {
    id: String(job.id),
    title: job.title,
    type: typeMap[job.type as string] ?? "Gig",
    pay,
    posted: new Date(job.createdAt).toLocaleDateString(),
    applicants: (job.applications ?? []).map((app: any) => ({
      id: String(app.id),
      name: app.worker?.workerProfile?.name ?? app.worker?.email ?? "Worker",
      phone: app.worker?.workerProfile?.phone ?? "-",
      skills: app.worker?.workerProfile?.skillTags ?? [],
      status: app.status as ApplicantStatus,
    })),
  };
}

interface MyApplication {
  id: string;
  title: string;
  employer: string;
  appliedDate: string;
  status: AppStatus;
}

interface Applicant {
  id: string | number;
  name: string;
  phone: string;
  skills: string[];
  status: ApplicantStatus;
}

interface Listing {
  id: string | number;
  title: string;
  type: string;
  pay: string;
  posted: string;
  applicants: Applicant[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

const CITY = "Udupi";

function getUniqueSkills(jobs: Job[]) {
  return Array.from(new Set(jobs.flatMap((job) => job.skills))).sort();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeStyle(type: string) {
  if (type === "Full-time") return "bg-[#EBF0E8] text-[#3D6B4F]";
  if (type === "Part-time") return "bg-[#F5EDE0] text-[#8C5A20]";
  return "bg-[#EEE8F5] text-[#5E3D8A]";
}

function statusStyle(status: string) {
  if (status === "Hired")     return "bg-[#E6F2E8] text-[#2D6B3D]";
  if (status === "Shortlisted") return "bg-[#FFF0D6] text-[#8C5A10]";
  if (status === "Seen")      return "bg-[#F0EBE3] text-[#7C4A2D]";
  if (status === "Declined" || status === "Not Selected") return "bg-[#FDE8E5] text-[#C0503A]";
  return "bg-[#EDE6DC] text-[#8C7B6E]";
}

const STATUS_FLOW: AppStatus[] = ["Applied", "Seen", "Shortlisted", "Hired"];

// ─── Paper Texture ────────────────────────────────────────────────────────────

function PaperTexture() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
        opacity: 0.028,
      }}
    />
  );
}

// ─── Neighbourhood SVG ────────────────────────────────────────────────────────

function NeighbourhoodIllustration() {
  return (
    <svg viewBox="0 0 480 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-[0.13]" aria-hidden="true">
      <rect x="20" y="55" width="72" height="245" rx="3" stroke="#7C4A2D" strokeWidth="1.5" />
      <rect x="32" y="70" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="62" y="70" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="32" y="98" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="62" y="98" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="32" y="126" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="62" y="126" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="32" y="154" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="62" y="154" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="32" y="182" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="62" y="182" width="18" height="14" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="42" y="258" width="28" height="42" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="114" y="140" width="88" height="160" rx="3" stroke="#7C4A2D" strokeWidth="1.5" />
      <path d="M112 142 L158 100 L204 142" stroke="#7C4A2D" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="170" y="88" width="12" height="22" rx="1" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="126" y="158" width="22" height="18" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="168" y="158" width="22" height="18" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="126" y="192" width="22" height="18" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="168" y="192" width="22" height="18" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="143" y="258" width="30" height="42" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="224" y="170" width="104" height="130" rx="3" stroke="#7C4A2D" strokeWidth="1.5" />
      <path d="M222 172 L276 136 L330 172" stroke="#7C4A2D" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M224 188 Q276 178 328 188" stroke="#7C4A2D" strokeWidth="1.5" />
      <rect x="236" y="192" width="36" height="30" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="280" y="192" width="36" height="30" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="236" y="240" width="80" height="14" rx="3" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="252" y="263" width="24" height="37" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="276" y="263" width="24" height="37" rx="2" stroke="#7C4A2D" strokeWidth="1" />
      <rect x="348" y="148" width="52" height="60" rx="4" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="374" y1="208" x2="374" y2="262" stroke="#7C4A2D" strokeWidth="2" />
      <circle cx="356" cy="155" r="3.5" stroke="#7C4A2D" strokeWidth="1" />
      <circle cx="392" cy="155" r="3.5" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="358" y1="165" x2="390" y2="165" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="358" y1="174" x2="390" y2="174" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="358" y1="183" x2="386" y2="183" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="358" y1="192" x2="382" y2="192" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="358" y1="201" x2="378" y2="201" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="430" y1="300" x2="430" y2="195" stroke="#7C4A2D" strokeWidth="2" />
      <ellipse cx="430" cy="178" rx="28" ry="24" stroke="#7C4A2D" strokeWidth="1.5" />
      <ellipse cx="414" cy="190" rx="17" ry="14" stroke="#7C4A2D" strokeWidth="1" />
      <ellipse cx="446" cy="190" rx="17" ry="14" stroke="#7C4A2D" strokeWidth="1" />
      <circle cx="350" cy="272" r="20" stroke="#7C4A2D" strokeWidth="1.5" />
      <circle cx="394" cy="272" r="20" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="350" y1="272" x2="372" y2="252" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="372" y1="252" x2="394" y2="272" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="372" y1="252" x2="372" y2="240" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="364" y1="240" x2="380" y2="240" stroke="#7C4A2D" strokeWidth="2" />
      <line x1="350" y1="272" x2="372" y2="272" stroke="#7C4A2D" strokeWidth="1.5" />
      <line x1="456" y1="300" x2="456" y2="220" stroke="#7C4A2D" strokeWidth="1.5" />
      <path d="M456 220 Q456 210 466 210" stroke="#7C4A2D" strokeWidth="1.5" />
      <circle cx="468" cy="210" r="4" stroke="#7C4A2D" strokeWidth="1" />
      <line x1="10" y1="300" x2="470" y2="300" stroke="#7C4A2D" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function SkillTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider bg-[#A3B899]/20 text-[#3D6858]">
      {label}
    </span>
  );
}

function TypeTag({ label }: { label: string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider ${typeStyle(label)}`}>
      {label}
    </span>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job;
  applied?: boolean;
  onApply?: () => void;
  showApplyButton?: boolean;
  applicantBadge?: number;
  onViewApplicants?: () => void;
}

function JobCard({ job, applied, onApply, showApplyButton = false, applicantBadge, onViewApplicants }: JobCardProps) {
  return (
    <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-5 flex flex-col gap-4 shadow-[0_2px_12px_rgba(44,26,14,0.07)] hover:shadow-[0_4px_20px_rgba(44,26,14,0.12)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-['Fraunces'] font-bold text-[17px] text-[#7C4A2D] leading-snug">{job.title}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-sm text-[#8C7B6E]">{job.employer}</span>
            {job.verified && <CheckCircle className="w-3.5 h-3.5 text-[#6A9E78] flex-shrink-0" />}
            {"location" in job && (
              <span className="text-xs text-[#8C7B6E] flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {(job as Job).location}
              </span>
            )}
          </div>
        </div>
        {applicantBadge !== undefined && (
          <span className="flex-shrink-0 bg-[#E07B39] text-[#FFFDF9] text-xs font-semibold px-2.5 py-1 rounded-full">
            {applicantBadge} applied
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <TypeTag label={job.type} />
        {job.skills.map((s) => <SkillTag key={s} label={s} />)}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#E8DDD4]/70">
        <div>
          <p className="font-semibold text-[#2C1A0E] text-sm">{job.pay}</p>
          <p className="text-[11px] text-[#8C7B6E] flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {job.posted}
          </p>
        </div>
        <div className="flex gap-2">
          {showApplyButton && (
            <button
              onClick={onApply}
              disabled={applied}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                applied
                  ? "bg-[#E6F2E8] text-[#2D6B3D] cursor-default"
                  : "bg-[#E07B39] text-[#FFFDF9] hover:bg-[#CA6A28] active:scale-95"
              }`}
            >
              {applied ? <><Check className="w-3.5 h-3.5" /> Applied</> : <>Apply Now <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          )}
          {onViewApplicants && (
            <button onClick={onViewApplicants} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#F0EBE3] text-[#7C4A2D] border border-[#E8DDD4] hover:bg-[#E8DDD4] transition-colors">
              View <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {!showApplyButton && !onViewApplicants && (
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#E07B39] text-[#FFFDF9] hover:bg-[#CA6A28] active:scale-95 transition-all duration-150">
              Apply Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter Panel (reusable) ──────────────────────────────────────────────────

interface FilterState {
  jobType: JobFilter;
  posted: string;
  skills: string[];
  sort: SortOption;
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  resultCount: number;
  skills: string[];
}

const POSTED_OPTIONS = ["Any time", "Today", "Last 3 days", "This week"];
const JOB_TYPES: JobFilter[] = ["All", "Full-time", "Part-time", "Gig"];

function FilterPanel({ filters, onChange, onReset, resultCount, skills }: FilterPanelProps) {
  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...filters, [key]: val });
  }

  function toggleSkill(skill: string) {
    const has = filters.skills.includes(skill);
    set("skills", has ? filters.skills.filter((s) => s !== skill) : [...filters.skills, skill]);
  }

  const hasActive =
    filters.jobType !== "All" ||
    filters.posted !== "Any time" ||
    filters.skills.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-[#8C7B6E]">Filters</p>
        {hasActive && (
          <button onClick={onReset} className="text-xs font-medium text-[#E07B39] hover:text-[#CA6A28] transition-colors">
            Reset all
          </button>
        )}
      </div>

      {/* Job type */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2C1A0E] mb-3">Job type</p>
        <div className="flex flex-col gap-1.5">
          {JOB_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => set("jobType", t)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-all text-left ${
                filters.jobType === t
                  ? "bg-[#7C4A2D] text-[#FAF7F2] font-medium"
                  : "text-[#2C1A0E] hover:bg-[#F0EBE3]"
              }`}
            >
              {t}
              {filters.jobType === t && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Posted */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2C1A0E] mb-3">Date posted</p>
        <div className="flex flex-col gap-1.5">
          {POSTED_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => set("posted", p)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-all text-left ${
                filters.posted === p
                  ? "bg-[#7C4A2D] text-[#FAF7F2] font-medium"
                  : "text-[#2C1A0E] hover:bg-[#F0EBE3]"
              }`}
            >
              {p}
              {filters.posted === p && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2C1A0E] mb-3">Skills</p>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => {
            const active = filters.skills.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSkill(s)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[#A3B899] text-white"
                    : "bg-[#A3B899]/20 text-[#3D6858] hover:bg-[#A3B899]/40"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count (desktop only) */}
      <div className="pt-3 border-t border-[#E8DDD4]">
        <p className="text-sm text-[#8C7B6E]">
          <span className="font-semibold text-[#2C1A0E]">{resultCount}</span> {resultCount === 1 ? "job" : "jobs"} found
        </p>
      </div>
    </div>
  );
}

// ─── Jobs Page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  jobType: "All",
  posted: "Any time",
  skills: [],
  sort: "newest",
};

function JobsPage({
  jobs,
  isLoading,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onResetFilters,
  skills,
  appliedIds,
  onApply,
  userRole,
  hasMore,
  onLoadMore,
  isFetchingMore,
  totalJobs,
}: {
  jobs: Job[];
  isLoading: boolean;
  search: string;
  onSearchChange: (query: string) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onResetFilters: () => void;
  skills: string[];
  appliedIds: Set<string>;
  onApply: (jobId: string) => void;
  userRole: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetchingMore: boolean;
  totalJobs: number;
}) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || isLoading || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTargetRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, isLoading, isFetchingMore, onLoadMore]);

  const results = jobs;

  const activeFilterCount =
    (filters.jobType !== "All" ? 1 : 0) +
    (filters.posted !== "Any time" ? 1 : 0) +
    filters.skills.length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-['Fraunces'] text-3xl sm:text-4xl font-bold text-[#7C4A2D]">
          Jobs in <em className="font-normal">{CITY}</em>
        </h1>
        <p className="text-[#8C7B6E] mt-1 text-sm">{isLoading ? 'Loading jobs…' : `${totalJobs} live listings — updated daily`}</p>
      </div>

      {/* Search + sort bar */}
      <div className="flex gap-2 mb-6 flex-wrap sm:flex-nowrap">
        <div className="flex-1 flex items-center gap-2 bg-[#FFFDF9] border border-[#E8DDD4] rounded-xl px-4 py-2.5 shadow-sm min-w-0">
          <Search className="w-4 h-4 text-[#8C7B6E] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by title, skill, employer, or area…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none min-w-0"
          />
          {search && (
            <button onClick={() => onSearchChange("")} className="text-[#8C7B6E] hover:text-[#2C1A0E] flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as SortOption })}
            className="appearance-none bg-[#FFFDF9] border border-[#E8DDD4] rounded-xl px-4 py-2.5 pr-8 text-sm text-[#2C1A0E] outline-none cursor-pointer hover:border-[#7C4A2D] transition-colors shadow-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8C7B6E] pointer-events-none" />
        </div>

        {/* Mobile filter button */}
        <button
          onClick={() => setShowMobileFilters(true)}
          className="lg:hidden flex items-center gap-2 bg-[#FFFDF9] border border-[#E8DDD4] rounded-xl px-4 py-2.5 text-sm font-medium text-[#2C1A0E] hover:border-[#7C4A2D] transition-colors shadow-sm relative"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#E07B39] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips (mobile) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 lg:hidden">
          {filters.jobType !== "All" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7C4A2D] text-[#FAF7F2] rounded-full text-xs font-medium">
              {filters.jobType}
              <button onClick={() => onFiltersChange({ ...filters, jobType: "All" })}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.posted !== "Any time" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7C4A2D] text-[#FAF7F2] rounded-full text-xs font-medium">
              {filters.posted}
              <button onClick={() => onFiltersChange({ ...filters, posted: "Any time" })}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A3B899] text-white rounded-full text-xs font-medium">
              {s}
              <button onClick={() => onFiltersChange({ ...filters, skills: filters.skills.filter((x) => x !== s) })}><X className="w-3 h-3" /></button>
            </span>
          ))}
          <button onClick={onResetFilters} className="text-xs font-medium text-[#8C7B6E] hover:text-[#2C1A0E] px-2 py-1.5 transition-colors">
            Clear all
          </button>
        </div>
      )}

      {/* Layout: sidebar + cards */}
      <div className="flex gap-8 items-start">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24">
          <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-5 shadow-sm">
            <FilterPanel
              filters={filters}
              onChange={onFiltersChange}
              onReset={onResetFilters}
              resultCount={totalJobs}
              skills={skills}
            />
          </div>
        </aside>

        {/* Job cards */}
        <div className="flex-1 min-w-0">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-[#8C7B6E] mb-4 lg:hidden">
                <span className="font-semibold text-[#2C1A0E]">{totalJobs}</span> {totalJobs === 1 ? "job" : "jobs"} found
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((job) => (
                  <JobCard
                     key={job.id}
                     job={job}
                     showApplyButton={userRole !== "EMPLOYER"}
                     applied={appliedIds.has(String(job.id))}
                     onApply={() => onApply(String(job.id))}
                  />
                ))}
              </div>
              {/* Intersection Observer target for scroll loading */}
              {hasMore && (
                <div ref={observerTargetRef} className="h-16 flex items-center justify-center mt-6">
                  {isFetchingMore ? (
                    <div className="flex items-center gap-2 text-sm text-[#8C7B6E] animate-pulse">
                      <span className="w-2 h-2 bg-[#E07B39] rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-[#E07B39] rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 bg-[#E07B39] rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span>Loading more jobs...</span>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 bg-[#F0EBE3] rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-[#8C7B6E]" />
              </div>
              <p className="font-['Fraunces'] text-2xl text-[#7C4A2D] mb-2">No jobs match this.</p>
              <p className="text-sm text-[#8C7B6E] mb-4">Try loosening the filters or searching something different.</p>
              <button onClick={onResetFilters} className="text-sm font-medium text-[#E07B39] hover:text-[#CA6A28] transition-colors">
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#2C1A0E]/40 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#FAF7F2] rounded-t-3xl max-h-[85vh] flex flex-col shadow-[0_-8px_40px_rgba(44,26,14,0.18)]">
            {/* Handle */}
            <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#E8DDD4] rounded-full" />
            </div>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#E8DDD4]">
              <h3 className="font-['Fraunces'] text-xl font-bold text-[#7C4A2D]">Filter Jobs</h3>
              <button onClick={() => setShowMobileFilters(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F0EBE3] text-[#8C7B6E] hover:text-[#2C1A0E] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FilterPanel
                filters={filters}
                onChange={onFiltersChange}
                onReset={onResetFilters}
                resultCount={results.length}
                skills={skills}
              />
            </div>
            {/* Apply button */}
            <div className="flex-shrink-0 p-5 border-t border-[#E8DDD4] bg-[#FAF7F2]">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-[#E07B39] text-[#FFFDF9] py-3.5 rounded-xl text-sm font-semibold hover:bg-[#CA6A28] transition-colors"
              >
                Show {results.length} {results.length === 1 ? "job" : "jobs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

interface NavbarProps {
  view: View;
  onHome: () => void;
  onJobs: () => void;
  onLogin: (mode: "login" | "register", role: "worker" | "employer") => void;
  onDashboard: () => void;
  onProfileClick: () => void;
  userType: "worker" | "employer" | null;
  profile: ApiUserProfile | null;
}

function Navbar({ view, onHome, onJobs, onLogin, onDashboard, onProfileClick, userType, profile }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoggedIn = profile !== null;
  const displayName =
    profile?.workerProfile?.name ||
    profile?.employerProfile?.businessName ||
    profile?.email ||
    (userType === "worker" ? "Worker" : "Employer");

  return (
    <nav className="sticky top-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-sm border-b border-[#E8DDD4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button onClick={onHome} className="font-['Fraunces'] text-2xl font-bold text-[#7C4A2D] tracking-tight hover:opacity-75 transition-opacity flex-shrink-0">
            LocalGig
          </button>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onJobs}
            className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors ${
              view === "jobs" ? "text-[#7C4A2D]" : "text-[#8C7B6E] hover:text-[#2C1A0E]"
            }`}
          >
            <Briefcase className="w-4 h-4" /> Browse Jobs
          </button>

          {isLoggedIn && (
            <button
              onClick={onDashboard}
              className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors ${
                view === "worker" || view === "employer" ? "text-[#7C4A2D]" : "text-[#8C7B6E] hover:text-[#2C1A0E]"
              }`}
            >
              <User className="w-4 h-4" /> Dashboard
            </button>
          )}

          {!isLoggedIn ? (
            <>
              <button onClick={() => onLogin("login", "worker")} className="hidden sm:block text-sm font-medium text-[#2C1A0E] hover:text-[#7C4A2D] transition-colors px-3 py-2">
                Log in
              </button>
              <button onClick={() => onLogin("register", "employer")} className="flex items-center gap-1.5 bg-[#E07B39] text-[#FFFDF9] text-sm font-medium px-3 sm:px-4 py-2.5 rounded-full hover:bg-[#CA6A28] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Post a Job</span>
                <span className="sm:hidden">Post</span>
              </button>
            </>
          ) : (
            <button
              onClick={onProfileClick}
              className={`hidden sm:flex text-sm font-medium hover:text-[#7C4A2D] transition-colors px-3 py-2 items-center gap-1.5 ${
                view === "profile" ? "text-[#7C4A2D] underline underline-offset-4 font-semibold" : "text-[#8C7B6E]"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#6A9E78] inline-block" />
              {displayName}
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden text-[#8C7B6E] hover:text-[#2C1A0E] p-2 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#E8DDD4] bg-[#FAF7F2] px-4 py-3 flex flex-col gap-2.5 shadow-md">
          <button
            onClick={() => { onJobs(); setMobileMenuOpen(false); }}
            className={`flex items-center gap-2 text-sm font-medium py-2 ${
              view === "jobs" ? "text-[#7C4A2D]" : "text-[#8C7B6E]"
            }`}
          >
            <Briefcase className="w-4.5 h-4.5" /> Browse Jobs
          </button>
          {isLoggedIn ? (
            <>
              <button
                onClick={() => { onDashboard(); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 text-sm font-medium py-2 ${
                  view === "worker" || view === "employer" ? "text-[#7C4A2D]" : "text-[#8C7B6E]"
                }`}
              >
                <User className="w-4.5 h-4.5" /> Dashboard
              </button>
              <button
                onClick={() => { onProfileClick(); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 text-sm font-medium py-2 ${
                  view === "profile" ? "text-[#7C4A2D]" : "text-[#8C7B6E]"
                }`}
              >
                <Settings className="w-4.5 h-4.5" /> Profile ({displayName})
              </button>
            </>
          ) : (
            <button
              onClick={() => { onLogin("login", "worker"); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 text-sm font-medium py-2 text-[#8C7B6E]"
            >
              <User className="w-4.5 h-4.5" /> Log in
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

// ─── Homepage ─────────────────────────────────────────────────────────────────

function HomePage({
  onLogin,
  onJobs,
  onSearch,
  jobs,
  appliedIds,
  onApply,
  userRole,
}: {
  onLogin: (mode: "login" | "register", role: "worker" | "employer") => void;
  onJobs: () => void;
  onSearch: (query: string) => void;
  jobs: Job[];
  appliedIds: Set<string>;
  onApply: (jobId: string) => void;
  userRole: string | null;
}) {
  const [filter, setFilter] = useState<JobFilter>("All");
  const [search, setSearch] = useState("");
  const filters: JobFilter[] = ["All", "Full-time", "Part-time", "Gig"];

  const filtered = jobs.filter((j) => {
    const matchType = filter === "All" || j.type === filter;
    return matchType;
  });

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#E8DDD4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#A3B899]/25 text-[#3D6858] text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <MapPin className="w-3.5 h-3.5" /> {CITY} &amp; surrounding areas
            </div>
            <h1 className="font-['Fraunces'] text-4xl sm:text-5xl lg:text-[56px] font-bold text-[#7C4A2D] leading-[1.1] mb-5">
              Work is waiting.<br />
              <em className="font-normal">Right here in {CITY}.</em>
            </h1>
            <p className="text-[#8C7B6E] text-lg leading-relaxed mb-8 max-w-[420px]">
              Find honest work close to home. Connect with local businesses that need you — no middlemen, no nonsense.
            </p>
            <div className="flex gap-2 bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-2 shadow-[0_2px_12px_rgba(44,26,14,0.08)] max-w-md">
              <div className="flex-1 flex items-center gap-2 px-3 min-w-0">
                <Search className="w-4 h-4 text-[#8C7B6E] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search jobs, skills, employers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none min-w-0"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-[#8C7B6E] hover:text-[#2C1A0E] transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button className="bg-[#E07B39] text-[#FFFDF9] px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#CA6A28] transition-colors flex-shrink-0" onClick={() => {
                onSearch(search.trim());
                onJobs();
              }}>
                Search
              </button>
            </div>
          </div>
          <div className="hidden lg:flex h-64 xl:h-72 items-end justify-center">
            <NeighbourhoodIllustration />
          </div>
        </div>
      </section>

      {/* Filters + Listings */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all duration-150 ${
                  filter === f
                    ? "bg-[#7C4A2D] text-[#FAF7F2] shadow-sm"
                    : "bg-[#FFFDF9] border border-[#E8DDD4] text-[#8C7B6E] hover:border-[#7C4A2D] hover:text-[#7C4A2D]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8C7B6E]">{filtered.length} openings</span>
            <button onClick={onJobs} className="text-sm font-medium text-[#E07B39] hover:text-[#CA6A28] transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.slice(0, 6).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                showApplyButton={userRole !== "EMPLOYER"}
                applied={appliedIds.has(String(job.id))}
                onApply={() => onApply(String(job.id))}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="font-['Fraunces'] text-2xl text-[#7C4A2D] mb-2">Nothing found here.</p>
            <p className="text-sm text-[#8C7B6E]">Try a different search or clear the filter.</p>
          </div>
        )}

        {filtered.length > 6 && (
          <div className="text-center mt-8">
            <button onClick={onJobs} className="inline-flex items-center gap-2 bg-[#FFFDF9] border border-[#E8DDD4] text-[#7C4A2D] font-medium text-sm px-6 py-3 rounded-full hover:bg-[#F0EBE3] hover:border-[#7C4A2D] transition-all shadow-sm">
              Browse all {jobs.length} jobs <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E8DDD4] bg-[#FFFDF9] mt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-['Fraunces'] text-xl text-[#7C4A2D] italic">
            Serving {CITY}, one job at a time.
          </p>
          <div className="flex gap-6 text-sm text-[#8C7B6E]">
            <button onClick={() => onLogin("register", "employer")} className="hover:text-[#2C1A0E] transition-colors">Post a Job</button>
            <button onClick={onJobs} className="hover:text-[#2C1A0E] transition-colors">Browse Jobs</button>
            <span className="hover:text-[#2C1A0E] transition-colors cursor-pointer">Contact</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── Login / Register ─────────────────────────────────────────────────────────

function LoginPage({
  onSuccess,
  authError,
  setAuthError,
  initialMode = "login",
  initialRole = "worker",
}: {
  onSuccess: (type: "worker" | "employer", accessToken: string) => void;
  authError: string | null;
  setAuthError: (value: string | null) => void;
  initialMode?: "login" | "register";
  initialRole?: "worker" | "employer";
}) {
  const [role, setRole] = useState<"worker" | "employer">(initialRole);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [verificationPending, setVerificationPending] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [employerPhone, setEmployerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setAuthError(null);
  }, [initialMode, setAuthError]);

  useEffect(() => {
    setRole(initialRole);
    setAuthError(null);
  }, [initialRole, setAuthError]);

  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => {
        setAuthError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [authError, setAuthError]);

  useEffect(() => {
    setAuthError(null);
  }, [email, password, otp, name, phone, businessName, employerPhone, mode, role, setAuthError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    try {
      if (mode === "register") {
        await register({
          email,
          password,
          role: role === "worker" ? "WORKER" : "EMPLOYER",
          name: role === "worker" ? name : undefined,
          phone: role === "worker" ? phone : undefined,
          skillTags: role === "worker" ? ["Local work"] : undefined,
          businessName: role === "employer" ? businessName : undefined,
          employerPhone: role === "employer" ? employerPhone : undefined,
        });
        setVerificationPending(true);
        setAuthError(null);
        return;
      }

      const result = await login(email, password);
      setDone(true);
      onSuccess(role, result.accessToken);
    } catch (error: any) {
      setAuthError(error?.message || "Unable to authenticate");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    try {
      await verifyEmailOtp(email, otp);
      const result = await login(email, password);
      setDone(true);
      onSuccess(role, result.accessToken);
    } catch (error: any) {
      setAuthError(error?.message || "Unable to verify OTP");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        {done ? (
          <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-12 text-center shadow-[0_4px_24px_rgba(44,26,14,0.1)]">
            <div className="w-16 h-16 bg-[#E6F2E8] rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-[#2D6B3D]" />
            </div>
            <h2 className="font-['Fraunces'] text-3xl font-bold text-[#7C4A2D] mb-2">
              Welcome to the neighbourhood.
            </h2>
            <p className="text-[#8C7B6E] text-sm">Taking you to your dashboard…</p>
          </div>
        ) : verificationPending ? (
          <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-8 shadow-[0_4px_24px_rgba(44,26,14,0.1)]">
            <div className="w-14 h-14 bg-[#F5EDE0] rounded-2xl flex items-center justify-center mx-auto mb-5 border border-[#E8DDD4]">
              <CheckCircle className="w-7 h-7 text-[#7C4A2D]" />
            </div>
            <h2 className="font-['Fraunces'] text-3xl font-bold text-[#7C4A2D] mb-1 text-center">
              Check your email
            </h2>
            <p className="text-[#8C7B6E] text-sm text-center mb-7">
              We sent a 6-digit LocalGig code to {email}.
            </p>
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-center text-2xl tracking-[0.4em] font-semibold text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                />
              </div>
              {authError ? (
                <div className="rounded-2xl bg-[#FDE8E5] border border-[#F4C0B6] px-4 py-3 text-sm text-[#C0503A]">
                  {authError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full bg-[#E07B39] text-[#FFFDF9] py-3.5 rounded-xl text-sm font-semibold hover:bg-[#CA6A28] transition-colors mt-1 disabled:opacity-70 disabled:pointer-events-none"
              >
                {submitting ? "Verifying..." : "Verify and continue"}
              </button>
            </form>
            <p className="text-center text-sm text-[#8C7B6E] mt-5">
              Wrong email?{" "}
              <button onClick={() => { setVerificationPending(false); setOtp(""); setAuthError(null); }} className="text-[#7C4A2D] font-medium hover:underline underline-offset-2">
                Edit signup details
              </button>
            </p>
          </div>
        ) : (
          <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-8 shadow-[0_4px_24px_rgba(44,26,14,0.1)]">
            <h2 className="font-['Fraunces'] text-3xl font-bold text-[#7C4A2D] mb-1 text-center">
              {mode === "register" ? "Join LocalGig" : "Welcome back"}
            </h2>
            <p className="text-[#8C7B6E] text-sm text-center mb-7">
              {mode === "register" ? "Find work or find people — it starts here." : "Good to see you again."}
            </p>
            <div className="flex bg-[#F0EBE3] rounded-xl p-1 mb-6">
              {(["worker", "employer"] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${role === r ? "bg-[#FFFDF9] text-[#7C4A2D] shadow-sm border border-[#E8DDD4]" : "text-[#8C7B6E] hover:text-[#2C1A0E]"}`}>
                  {r === "worker" ? "I need work" : "I'm hiring"}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@localgig.com"
                  className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                />
              </div>
              {role === "worker" && mode === "register" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Full name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Raju Sharma"
                      className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Phone number</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                    />
                  </div>
                </>
              )}
              {role === "employer" && mode === "register" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Business name</label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Sunrise Dhaba"
                      className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Business phone</label>
                    <input
                      type="tel"
                      required
                      value={employerPhone}
                      onChange={(e) => setEmployerPhone(e.target.value)}
                      placeholder="+91 80000 00000"
                      className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                    />
                  </div>
                </>
              )}
              {authError ? (
                <div className="rounded-2xl bg-[#FDE8E5] border border-[#F4C0B6] px-4 py-3 text-sm text-[#C0503A]">
                  {authError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#E07B39] text-[#FFFDF9] py-3.5 rounded-xl text-sm font-semibold hover:bg-[#CA6A28] transition-colors mt-1 disabled:opacity-70 disabled:pointer-events-none"
              >
                {mode === "register" ? "Create account" : "Log in"}
              </button>
            </form>
            <p className="text-center text-sm text-[#8C7B6E] mt-5">
              {mode === "register" ? "Already on LocalGig?" : "New here?"}{" "}
              <button onClick={() => setMode(mode === "register" ? "login" : "register")} className="text-[#7C4A2D] font-medium hover:underline underline-offset-2">
                {mode === "register" ? "Log in" : "Create account"}
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Worker Dashboard ─────────────────────────────────────────────────────────

function WorkerDashboard({
  onBrowseJobs,
  jobs,
  token,
  profile,
  appliedIds,
  onApply,
  applications,
  isLoadingApplications,
  onJobTypeFilterChange,
}: {
  onBrowseJobs: () => void;
  jobs: Job[];
  token: string | null;
  profile: ApiUserProfile | null;
  appliedIds: Set<string>;
  onApply: (jobId: string) => void;
  applications: MyApplication[];
  isLoadingApplications: boolean;
  onJobTypeFilterChange: (type?: string) => void;
}) {
  const [tab, setTab] = useState<WorkerTab>("browse");
  const [filter, setFilter] = useState<JobFilter>("All");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.workerProfile?.name || profile?.email || "there").trim().split(" ")[0];
  const filtered = filter === "All" ? jobs : jobs.filter((j) => j.type === filter);

  const TABS: { key: WorkerTab; label: string }[] = [
    { key: "browse", label: "Browse Jobs" },
    { key: "applications", label: "My Applications" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-['Fraunces'] text-3xl sm:text-4xl font-bold text-[#7C4A2D] leading-snug">
          {greeting}, {firstName}.{" "}
          <em className="font-normal">{"Here's what's available today."}</em>
        </h1>
        <p className="text-[#8C7B6E] mt-1.5">{filtered.length} jobs open in {CITY}</p>
      </div>

      <div className="flex gap-1 bg-[#F0EBE3] rounded-xl p-1 mb-8 w-fit overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
              tab === key ? "bg-[#FFFDF9] text-[#7C4A2D] shadow-sm border border-[#E8DDD4]" : "text-[#8C7B6E] hover:text-[#2C1A0E]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Browse */}
      {tab === "browse" && (
        <>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex flex-wrap gap-2">
              {(["All", "Full-time", "Part-time", "Gig"] as JobFilter[]).map((f) => (
                <button key={f} onClick={() => {
                  setFilter(f);
                  onJobTypeFilterChange(
                    f === 'All'
                      ? undefined
                      : f === 'Full-time'
                      ? 'FULL_TIME'
                      : f === 'Part-time'
                      ? 'PART_TIME'
                      : 'GIG',
                  );
                }}
                  className={`px-4 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all ${
                    filter === f ? "bg-[#7C4A2D] text-[#FAF7F2] shadow-sm" : "bg-[#FFFDF9] border border-[#E8DDD4] text-[#8C7B6E] hover:border-[#7C4A2D] hover:text-[#7C4A2D]"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={onBrowseJobs} className="text-sm font-medium text-[#E07B39] hover:text-[#CA6A28] transition-colors flex items-center gap-1">
              Full search <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} applied={appliedIds.has(String(job.id))} onApply={() => onApply(String(job.id))} showApplyButton />
            ))}
          </div>
        </>
      )}

      {/* Applications */}
      {tab === "applications" && (
        <div className="flex flex-col gap-4 max-w-2xl">
          {isLoadingApplications ? (
            <div className="text-[#8C7B6E]">Loading your applications…</div>
          ) : applications.length === 0 ? (
            <div className="rounded-2xl bg-[#FFFDF9] border border-[#E8DDD4] p-8 text-[#8C7B6E]">No applications yet. Start browsing jobs to apply.</div>
          ) : applications.map((app) => {
            const stepIdx = STATUS_FLOW.indexOf(app.status);
            return (
              <div key={app.id} className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
                  <div>
                    <h3 className="font-['Fraunces'] font-bold text-lg text-[#7C4A2D]">{app.title}</h3>
                    <p className="text-sm text-[#8C7B6E] mt-0.5">{app.employer} &middot; Applied {app.appliedDate}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full uppercase tracking-wider ${statusStyle(app.status)}`}>
                    {app.status}
                  </span>
                </div>
                <div className="flex items-start overflow-x-auto pb-1">
                  {STATUS_FLOW.map((step, i) => {
                    const done = i <= stepIdx;
                    const current = i === stepIdx;
                    return (
                      <div key={step} className="flex items-start flex-1 min-w-[60px]">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${done ? "border-[#6A9E78] bg-[#6A9E78]" : "border-[#E8DDD4] bg-[#FAF7F2]"} ${current ? "ring-2 ring-offset-1 ring-[#6A9E78]/40" : ""}`}>
                            {done && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-[10px] font-medium mt-1.5 text-center leading-tight max-w-[52px] ${done ? "text-[#3D6B4F]" : "text-[#8C7B6E]"}`}>{step}</span>
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div className={`flex-1 h-0.5 mt-3 mx-1 transition-all duration-300 min-w-[20px] ${i < stepIdx ? "bg-[#6A9E78]" : "bg-[#E8DDD4]"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ─── Employer Dashboard ───────────────────────────────────────────────────────

function EmployerDashboard({ token, profile }: { token: string | null; profile: ApiUserProfile | null; }) {
  const [tab, setTab] = useState<EmployerTab>("listings");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [payType, setPayType] = useState<PayType>("Fixed");
  const [postedSuccess, setPostedSuccess] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postJobType, setPostJobType] = useState<"FULL_TIME" | "PART_TIME" | "GIG">("FULL_TIME");
  const [postPayAmount, setPostPayAmount] = useState("");
  const [postPayMin, setPostPayMin] = useState("");
  const [postPayMax, setPostPayMax] = useState("");
  const [postPayCustom, setPostPayCustom] = useState("");
  const [postSkills, setPostSkills] = useState("");
  const [postNotes, setPostNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    async function loadListings() {
      setIsLoadingListings(true);
      try {
        const jobs = await getEmployerJobs(token);
        setListings(jobs.map(apiJobToListing));
      } catch (error) {
        console.error("Failed to load employer jobs", error);
      } finally {
        setIsLoadingListings(false);
      }
    }

    loadListings();
  }, [token]);

  async function updateStatus(listingId: string, applicantId: string, status: ApplicantStatus) {
    if (!token) return;
    try {
      await updateApplicationStatus(token, applicantId, status);
      setListings((prev) => prev.map((l) => {
        if (l.id !== listingId) return l;
        return {
          ...l,
          applicants: l.applicants.map((a) => a.id === applicantId ? { ...a, status } : a),
        };
      }));
      setStatusMessage("Application status updated.");
    } catch (error) {
      console.error("Failed to update application status", error);
      setStatusMessage("Unable to update status.");
    }
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const extraDetails = [postSkills, postNotes].filter(Boolean).join("\n\n");
    const payload = {
      title: postTitle,
      description: `${postDescription}${extraDetails ? "\n\n" + extraDetails : ""}`,
      type: postJobType,
      location: postLocation || undefined,
      payType: payType === "Fixed" ? "FIXED" : payType === "Range" ? "RANGE" : "CUSTOM",
      payAmount: payType === "Fixed" ? Number(postPayAmount) : undefined,
      payMin: payType === "Range" ? Number(postPayMin) : undefined,
      payMax: payType === "Range" ? Number(postPayMax) : undefined,
      payCustom: payType === "Open to discuss" ? postPayCustom || "Open to discuss" : undefined,
    };

    try {
      await createJob(token, payload);
      setPostedSuccess(true);
      setTab("listings");
      setPostTitle("");
      setPostDescription("");
      setPostLocation("");
      setPostPayAmount("");
      setPostPayMin("");
      setPostPayMax("");
      setPostPayCustom("");
      setPostSkills("");
      setPostNotes("");
      setStatusMessage(null);

      const jobs = await getEmployerJobs(token);
      setListings(jobs.map(apiJobToListing));
    } catch (error) {
      console.error("Failed to post job", error);
      setStatusMessage("Unable to post the job.");
    } finally {
      setTimeout(() => setPostedSuccess(false), 1500);
    }
  }

  const activeListing = selectedId !== null ? listings.find((l) => l.id === selectedId) : null;
  const ACTIONS: { label: string; target: ApplicantStatus }[] = [
    { label: "Seen", target: "Seen" },
    { label: "Shortlist", target: "Shortlisted" },
    { label: "Hire", target: "Hired" },
    { label: "Decline", target: "NOT_SELECTED" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-['Fraunces'] text-3xl sm:text-4xl font-bold text-[#7C4A2D]">Your listings</h1>
          <p className="text-[#8C7B6E] mt-1">Greenfield Housing Society &middot; {CITY}</p>
          {statusMessage ? <p className="text-sm text-[#8C7B6E] mt-2">{statusMessage}</p> : null}
        </div>
        <button onClick={() => { setTab("post"); setSelectedId(null); }} className="flex items-center gap-1.5 bg-[#E07B39] text-[#FFFDF9] px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#CA6A28] transition-colors">
          <Plus className="w-4 h-4" /> Post a Job
        </button>
      </div>

      <div className="flex gap-1 bg-[#F0EBE3] rounded-xl p-1 mb-8 w-fit">
        {(["listings", "post"] as EmployerTab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedId(null); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${tab === t ? "bg-[#FFFDF9] text-[#7C4A2D] shadow-sm border border-[#E8DDD4]" : "text-[#8C7B6E] hover:text-[#2C1A0E]"}`}>
            {t === "listings" ? "Your Listings" : "Post a Job"}
          </button>
        ))}
      </div>

      {tab === "listings" && !activeListing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {listings.map((l) => (
            <button key={l.id} onClick={() => setSelectedId(l.id)} className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-5 shadow-sm hover:shadow-[0_4px_20px_rgba(44,26,14,0.12)] hover:-translate-y-0.5 transition-all duration-200 text-left w-full">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-['Fraunces'] font-bold text-[17px] text-[#7C4A2D] leading-snug">{l.title}</h3>
                  <p className="text-sm text-[#8C7B6E] mt-0.5">{l.pay} &middot; {l.posted}</p>
                </div>
                <span className="flex-shrink-0 bg-[#E07B39] text-[#FFFDF9] text-xs font-semibold px-2.5 py-1 rounded-full">{l.applicants.length} applied</span>
              </div>
              <div className="flex items-center justify-between">
                <TypeTag label={l.type} />
                <span className="text-xs text-[#8C7B6E] flex items-center gap-1 font-medium">View applicants <ChevronRight className="w-3.5 h-3.5" /></span>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "listings" && activeListing && (
        <div>
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-[#8C7B6E] hover:text-[#2C1A0E] mb-6 transition-colors font-medium">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to listings
          </button>
          <div className="mb-6">
            <h2 className="font-['Fraunces'] text-2xl font-bold text-[#7C4A2D]">{activeListing.title}</h2>
            <p className="text-[#8C7B6E] text-sm mt-1">{activeListing.applicants.length} {activeListing.applicants.length === 1 ? "person" : "people"} applied</p>
          </div>
          <div className="flex flex-col gap-3">
            {activeListing.applicants.map((a) => (
              <div key={a.id} className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="w-9 h-9 bg-[#F0EBE3] rounded-full flex items-center justify-center flex-shrink-0 border border-[#E8DDD4]">
                        <User className="w-4 h-4 text-[#8C7B6E]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#2C1A0E] text-sm">{a.name}</p>
                        <p className="text-xs text-[#8C7B6E] flex items-center gap-1"><Phone className="w-3 h-3" /> {a.phone}</p>
                      </div>
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wider ${statusStyle(a.status)}`}>{a.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-12">{a.skills.map((s) => <SkillTag key={s} label={s} />)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ACTIONS.map(({ label, target }) => {
                      const isActive = a.status === target;
                      const isHire = label === "Hire";
                      const isDecline = label === "Decline";
                      return (
                        <button key={label} onClick={() => updateStatus(activeListing.id, a.id, target)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                            isHire ? (isActive ? "bg-[#2D6B3D] text-white" : "bg-[#E6F2E8] text-[#2D6B3D] hover:bg-[#2D6B3D] hover:text-white")
                            : isDecline ? (isActive ? "bg-[#C0503A] text-white" : "bg-[#FDE8E5] text-[#C0503A] hover:bg-[#C0503A] hover:text-white")
                            : isActive ? "bg-[#7C4A2D] text-[#FAF7F2]"
                            : "bg-[#F0EBE3] text-[#2C1A0E] border border-[#E8DDD4] hover:bg-[#E8DDD4]"
                          }`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "post" && (
        <div className="max-w-xl">
          {postedSuccess ? (
            <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-[#E6F2E8] rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-[#2D6B3D]" />
              </div>
              <h2 className="font-['Fraunces'] text-3xl font-bold text-[#7C4A2D] mb-1">Job posted!</h2>
              <p className="text-[#8C7B6E] text-sm">Your listing is now live in {CITY}.</p>
            </div>
          ) : (
            <div className="bg-[#FFFDF9] border border-[#E8DDD4] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="font-['Fraunces'] text-2xl font-bold text-[#7C4A2D] mb-1">Tell us about the work</h2>
              <p className="text-[#8C7B6E] text-sm mb-7">Keep it plain and honest — workers appreciate clarity.</p>
              <form onSubmit={handlePost} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">What kind of help do you need?</label>
                  <input
                    required
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="e.g. Cook for morning shift, Delivery rider, Plumber"
                    className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Tell workers what the job involves</label>
                  <textarea
                    required
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    rows={3}
                    placeholder="A few details about the shift, duties and schedule"
                    className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Location</label>
                  <input
                    value={postLocation}
                    onChange={(e) => setPostLocation(e.target.value)}
                    placeholder="e.g. Shivajinagar, Kothrud, Hadapsar"
                    className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-2">Full-time, part-time, or a one-off gig?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["FULL_TIME", "PART_TIME", "GIG"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPostJobType(t)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${postJobType === t ? "border-[#7C4A2D] text-[#7C4A2D] bg-[#F5EDE0]" : "border-[#E8DDD4] text-[#8C7B6E] hover:border-[#7C4A2D] hover:text-[#7C4A2D] hover:bg-[#F5EDE0]"}`}>
                        {t === "FULL_TIME" ? "Full-time" : t === "PART_TIME" ? "Part-time" : "Gig"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-2">{"What will you pay?"}</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(["Fixed", "Range", "Open to discuss"] as PayType[]).map((p) => (
                      <button key={p} type="button" onClick={() => setPayType(p)}
                        className={`py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all ${payType === p ? "border-[#7C4A2D] text-[#7C4A2D] bg-[#F5EDE0]" : "border-[#E8DDD4] text-[#8C7B6E] hover:border-[#7C4A2D] hover:text-[#7C4A2D]"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {payType !== "Open to discuss" && (
                    <div className="flex gap-2">
                      <input
                        value={postPayAmount}
                        onChange={(e) => setPostPayAmount(e.target.value)}
                        placeholder={payType === "Range" ? "Min (e.g. ₹500)" : "Amount (e.g. ₹18,000)"}
                        className="flex-1 px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                      />
                      {payType === "Range" && (
                        <input
                          value={postPayMax}
                          onChange={(e) => setPostPayMax(e.target.value)}
                          placeholder="Max (e.g. ₹800)"
                          className="flex-1 px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                        />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">What skills or experience matters?</label>
                  <input
                    value={postSkills}
                    onChange={(e) => setPostSkills(e.target.value)}
                    placeholder="e.g. Cooking, Driving licence, Heavy lifting"
                    className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C1A0E] mb-1.5">Anything else to know?</label>
                  <textarea
                    rows={3}
                    value={postNotes}
                    onChange={(e) => setPostNotes(e.target.value)}
                    placeholder="Working hours, location, anything specific…"
                    className="w-full px-4 py-3 bg-[#F0EBE3] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] transition-colors resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-[#E07B39] text-[#FFFDF9] py-3.5 rounded-xl text-sm font-semibold hover:bg-[#CA6A28] transition-colors mt-1">
                  Post this job
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function ProfilePage({
  token,
  profile,
  onLogout,
  onProfileUpdate,
}: {
  token: string | null;
  profile: ApiUserProfile | null;
  onLogout: () => void;
  onProfileUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.workerProfile?.name || profile.employerProfile?.businessName || "");
      setPhone(profile.workerProfile?.phone || profile.employerProfile?.phone || "");
      setSkills(profile.workerProfile?.skillTags ?? []);
    }
  }, [profile]);

  async function handleSaveProfile() {
    if (!token) return;
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      await updateProfile(token, {
        name: profile?.role === "WORKER" ? name : undefined,
        businessName: profile?.role === "EMPLOYER" ? name : undefined,
        phone,
        skillTags: profile?.role === "WORKER" ? skills : undefined,
      });
      setProfileMessage("Profile updated successfully.");
      setEditing(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Failed to update profile", error);
      setProfileMessage("Unable to save your changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  function addSkill() {
    const t = newSkill.trim();
    if (t && !skills.includes(t)) setSkills((p) => [...p, t]);
    setNewSkill("");
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between border-b border-[#E8DDD4] pb-6 mb-8">
        <div>
          <h1 className="font-['Fraunces'] text-4xl font-bold text-[#7C4A2D]">
            {profile?.role === "WORKER" ? "My Profile" : "Employer Profile"}
          </h1>
          <p className="text-sm text-[#8C7B6E] mt-1">{profile?.email}</p>
        </div>
        <button
          onClick={() => {
            if (editing) {
              handleSaveProfile();
            } else {
              setEditing(true);
            }
          }}
          disabled={savingProfile}
          className="flex items-center gap-1.5 bg-[#FFFDF9] border border-[#E8DDD4] hover:bg-[#F0EBE3] px-4 py-2.5 rounded-full text-sm font-medium text-[#7C4A2D] transition-colors cursor-pointer"
        >
          {savingProfile ? "Saving..." : editing ? <><Check className="w-4 h-4" /> Save changes</> : <><Edit2 className="w-4 h-4" /> Edit profile</>}
        </button>
      </div>

      {profileMessage && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${profileMessage.includes("success") ? "bg-[#E6F2E8] text-[#2D6B3D] border border-[#6A9E78]/30" : "bg-[#FDE8E5] text-[#C0503A] border border-[#F4C0B6]/30"}`}>
          {profileMessage}
        </div>
      )}

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-[#E8DDD4]/50 pb-6">
          <span className="text-sm font-semibold uppercase tracking-wider text-[#8C7B6E]">Full Name / Business Name</span>
          <div className="col-span-2">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-md px-4 py-3 bg-[#FFFDF9] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] outline-none focus:border-[#7C4A2D] transition-colors"
              />
            ) : (
              <p className="text-lg font-medium text-[#2C1A0E]">{name || "Not set"}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-[#E8DDD4]/50 pb-6">
          <span className="text-sm font-semibold uppercase tracking-wider text-[#8C7B6E]">Phone Number</span>
          <div className="col-span-2">
            {editing ? (
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full max-w-md px-4 py-3 bg-[#FFFDF9] border border-[#E8DDD4] rounded-xl text-sm text-[#2C1A0E] outline-none focus:border-[#7C4A2D] transition-colors"
              />
            ) : (
              <p className="text-lg font-medium text-[#2C1A0E] flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#8C7B6E]" /> {phone || "Not set"}
              </p>
            )}
          </div>
        </div>

        {profile?.role === "WORKER" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-[#E8DDD4]/50 pb-6">
            <span className="text-sm font-semibold uppercase tracking-wider text-[#8C7B6E]">Skill Tags</span>
            <div className="col-span-2">
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#A3B899]/20 text-[#3D6858]"
                  >
                    {s}
                    {editing && (
                      <button
                        onClick={() => setSkills((p) => p.filter((x) => x !== s))}
                        className="hover:text-[#C0503A] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
                {editing && (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add skill…"
                      className="px-3 py-1.5 bg-[#FFFDF9] border border-dashed border-[#A3B899] rounded-full text-xs text-[#2C1A0E] placeholder:text-[#8C7B6E] outline-none focus:border-[#7C4A2D] w-32"
                    />
                    <button
                      onClick={addSkill}
                      className="w-7 h-7 bg-[#E07B39] text-[#FFFDF9] rounded-full flex items-center justify-center hover:bg-[#CA6A28] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-[#E8DDD4] flex justify-between items-center flex-wrap gap-4">
        <p className="text-xs text-[#8C7B6E]">
          Logged in as {profile?.email} ({profile?.role === "WORKER" ? "Worker account" : "Employer account"})
        </p>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 bg-[#FDE8E5] text-[#C0503A] hover:bg-[#C0503A] hover:text-white border border-[#F4C0B6]/50 px-5 py-3 rounded-full text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Sign out from LocalGig
        </button>
      </div>
    </main>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("home");
  const [userType, setUserType] = useState<"worker" | "employer" | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("localgig_token"));
  const [profile, setProfile] = useState<ApiUserProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobsFilters, setJobsFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [loginRole, setLoginRole] = useState<"worker" | "employer">("worker");

  // Pagination states
  const [jobsPage, setJobsPage] = useState<number>(1);
  const [hasMoreJobs, setHasMoreJobs] = useState<boolean>(true);
  const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
  const [totalJobs, setTotalJobs] = useState<number>(0);

  useEffect(() => {
    // Reset page and list when filters or search change
    setJobsPage(1);
    setHasMoreJobs(true);
  }, [jobsFilters, jobSearchQuery]);

  useEffect(() => {
    let active = true;
    async function loadJobs() {
      if (jobsPage === 1) {
        setIsLoadingJobs(true);
      } else {
        setIsFetchingMore(true);
      }
      try {
        const typeParam = jobsFilters.jobType === "All" ? undefined : (
          jobsFilters.jobType === "Full-time" ? "FULL_TIME" :
          jobsFilters.jobType === "Part-time" ? "PART_TIME" :
          "GIG"
        );
        const postedParam = jobsFilters.posted === "Any time" ? undefined : jobsFilters.posted;
        const skillsParam = jobsFilters.skills.length > 0 ? jobsFilters.skills.join(",") : undefined;
        const sortParam = jobsFilters.sort;

        const response = await getJobs(
          jobSearchQuery,
          typeParam,
          postedParam,
          skillsParam,
          sortParam,
          jobsPage,
          10, // limit
        );

        if (!active) return;

        setTotalJobs(response.total);

        const mapped = response.jobs.map(apiJobToUiJob);
        if (jobsPage === 1) {
          setJobs(mapped);
        } else {
          setJobs((prev) => [...prev, ...mapped]);
        }

        if (response.jobs.length < 10) {
          setHasMoreJobs(false);
        } else {
          setHasMoreJobs(true);
        }
      } catch (error) {
        console.error("Failed to load jobs", error);
      } finally {
        if (active) {
          setIsLoadingJobs(false);
          setIsFetchingMore(false);
        }
      }
    }
    loadJobs();
    return () => {
      active = false;
    };
  }, [jobsFilters, jobSearchQuery, jobsPage]);

  useEffect(() => {
    async function loadInitialSkills() {
      try {
        const response = await getJobs();
        setAllSkills(getUniqueSkills(response.jobs.map(apiJobToUiJob)));
      } catch (error) {
        console.error("Failed to load initial skills", error);
      }
    }
    loadInitialSkills();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!token) return;
      try {
        const profile = await getMe(token);
        setProfile(profile);
        setUserType(profile.role === "WORKER" ? "worker" : "employer");
      } catch (error) {
        console.error("Failed to load profile", error);
        setToken(null);
        setUserType(null);
        setProfile(null);
        localStorage.removeItem("localgig_token");
      }
    }
    loadProfile();
  }, [token]);

  useEffect(() => {
    async function loadApplications() {
      if (!token || !profile || profile.role !== "WORKER") {
        setApplications([]);
        setAppliedIds(new Set());
        return;
      }
      setIsLoadingApplications(true);
      try {
        const apiApps = await getMyApplications(token);
        setApplications(apiApps.map(apiApplicationToUiApplication));
        setAppliedIds(new Set(apiApps.map((app) => String(app.job?.id ?? "")).filter(Boolean)));
      } catch (error) {
        console.error("Failed to load applications", error);
      } finally {
        setIsLoadingApplications(false);
      }
    }
    loadApplications();
  }, [token, profile]);

  async function handleApply(jobId: string) {
    if (!token) {
      setView("login");
      return;
    }
    if (profile?.role !== "WORKER") {
      alert("Only worker accounts can apply for jobs.");
      return;
    }
    try {
      const application = await applyJob(token, jobId);
      setAppliedIds((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });
      setApplications((prev) => [apiApplicationToUiApplication(application), ...prev]);
    } catch (error: any) {
      console.error("Failed to apply to job", error);
      alert(error?.message || "Failed to apply to job");
    }
  }

  async function handleLoginSuccess(type: "worker" | "employer", accessToken: string) {
    setToken(accessToken);
    localStorage.setItem("localgig_token", accessToken);
    setView(type === "worker" ? "worker" : "employer");
  }

  function handleJobSearchChange(search: string) {
    setJobSearchQuery(search.trim());
  }

  function handleJobTypeFilterChange(type?: string) {
    const jobTypeMap: Record<string, JobFilter> = {
      FULL_TIME: "Full-time",
      PART_TIME: "Part-time",
      GIG: "Gig",
    };
    setJobsFilters((prev) => ({
      ...prev,
      jobType: type ? (jobTypeMap[type] ?? "All") : "All",
    }));
  }

  async function handleLogout() {
    setToken(null);
    setUserType(null);
    setProfile(null);
    localStorage.removeItem("localgig_token");
    setView("home");
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C1A0E]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <PaperTexture />
      <div className="relative z-10">
        <Navbar
          view={view}
          onHome={() => { setAuthError(null); setView("home"); }}
          onJobs={() => { setAuthError(null); setView("jobs"); }}
          onLogin={(mode, role) => {
            setLoginMode(mode);
            setLoginRole(role);
            setAuthError(null);
            setView("login");
          }}
          onLogout={handleLogout}
          onDashboard={() => { setAuthError(null); setView(userType === "worker" ? "worker" : "employer"); }}
          onProfileClick={() => { setAuthError(null); setView("profile"); }}
          userType={userType}
          profile={profile}
        />
        {view === "home"     && (
          <HomePage
            onLogin={(mode, role) => {
              setLoginMode(mode);
              setLoginRole(role);
              setAuthError(null);
              setView("login");
            }}
            onJobs={() => { setAuthError(null); setView("jobs"); }}
            onSearch={handleJobSearchChange}
            jobs={jobs}
            appliedIds={appliedIds}
            onApply={handleApply}
            userRole={profile?.role ?? null}
          />
        )}
        {view === "jobs"     && (
          <JobsPage
            jobs={jobs}
            isLoading={isLoadingJobs}
            search={jobSearchQuery}
            onSearchChange={handleJobSearchChange}
            filters={jobsFilters}
            onFiltersChange={setJobsFilters}
            onResetFilters={() => setJobsFilters(DEFAULT_FILTERS)}
            skills={allSkills}
            appliedIds={appliedIds}
            onApply={handleApply}
            userRole={profile?.role ?? null}
            hasMore={hasMoreJobs}
            onLoadMore={() => setJobsPage((prev) => prev + 1)}
            isFetchingMore={isFetchingMore}
            totalJobs={totalJobs}
          />
        )}
        {view === "login"    && <LoginPage onSuccess={handleLoginSuccess} authError={authError} setAuthError={setAuthError} initialMode={loginMode} initialRole={loginRole} />}
        {view === "worker"   && <WorkerDashboard onBrowseJobs={() => { setAuthError(null); setView("jobs"); }} jobs={jobs} token={token} profile={profile} appliedIds={appliedIds} onApply={handleApply} applications={applications} isLoadingApplications={isLoadingApplications} onJobTypeFilterChange={handleJobTypeFilterChange} />}
        {view === "employer" && <EmployerDashboard token={token} profile={profile} />}
        {view === "profile"  && (
          <ProfilePage
            token={token}
            profile={profile}
            onLogout={handleLogout}
            onProfileUpdate={async () => {
              if (token) {
                const updatedProfile = await getMe(token);
                setProfile(updatedProfile);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
