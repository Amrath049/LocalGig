const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type RegisterPayload = {
  email: string;
  password: string;
  role: "WORKER" | "EMPLOYER";
  name?: string;
  phone?: string;
  skillTags?: string[];
  businessName?: string;
  employerPhone?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: "WORKER" | "EMPLOYER";
  };
};

export type ApiJob = {
  id: string;
  title: string;
  description: string;
  type: "FULL_TIME" | "PART_TIME" | "GIG";
  location?: string | null;
  payType?: "FIXED" | "RANGE" | "CUSTOM" | null;
  payAmount?: number | null;
  payMin?: number | null;
  payMax?: number | null;
  payCustom?: string | null;
  status: string;
  employer: {
    id: string;
    email: string;
  };
  applications?: Array<{ id: string }>; // employer jobs include applications
  createdAt: string;
  skills?: string[];
  highlightedTitle?: string;
  highlightedDescription?: string;
};

export type ApiUserProfile = {
  id: string;
  email: string;
  role: "WORKER" | "EMPLOYER";
  workerProfile?: {
    name: string;
    phone: string;
    skillTags: string[];
  };
  employerProfile?: {
    businessName: string;
    phone: string;
  };
};

export type ApiApplication = {
  id: string;
  status: string;
  message?: string | null;
  job: ApiJob;
  worker?: {
    id: string;
    email: string;
  };
  createdAt: string;
};

function getHeaders(token?: string, json = true) {
  const base: Record<string, string> = {};
  if (json) {
    base["Content-Type"] = "application/json";
  }
  if (token) {
    base["Authorization"] = `Bearer ${token}`;
  }
  return base;
}

async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.message) {
        if (Array.isArray(parsed.message)) {
          errorMessage = parsed.message.join(", ");
        } else {
          errorMessage = parsed.message;
        }
      }
    } catch {
      // Fallback to raw text error
    }
    throw new Error(errorMessage);
  }
  return (await response.json()) as T;
}

export async function login(email: string, password: string, role?: "WORKER" | "EMPLOYER") {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: getHeaders(undefined, true),
    body: JSON.stringify({ email, password, role }),
  });
}

export async function register(payload: RegisterPayload) {
  return apiFetch<{ message: string }>("/auth/register", {
    method: "POST",
    headers: getHeaders(undefined, true),
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailOtp(email: string, otp: string) {
  return apiFetch<{ message: string }>("/auth/verify", {
    method: "POST",
    headers: getHeaders(undefined, true),
    body: JSON.stringify({ email, otp }),
  });
}

export async function getMe(token: string) {
  return apiFetch<ApiUserProfile>("/users/me", {
    method: "GET",
    headers: getHeaders(token, false),
  });
}

export type GetJobsResponse = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  jobs: ApiJob[];
  facets?: {
    skills?: Array<{ key: string; doc_count: number }>;
    types?: Array<{ key: string; doc_count: number }>;
    locations?: Array<{ key: string; doc_count: number }>;
  };
};

export async function getJobs(
  search?: string,
  type?: string,
  posted?: string,
  skills?: string,
  sort?: string,
  page?: number,
  limit?: number,
  workerSkills?: string,
  skillMatch?: string,
) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (type) query.set("type", type.toLowerCase());
  if (posted) query.set("posted", posted);
  if (skills) query.set("skills", skills);
  if (sort) query.set("sort", sort);
  if (page !== undefined) query.set("page", String(page));
  if (limit !== undefined) query.set("limit", String(limit));
  if (workerSkills) query.set("workerSkills", workerSkills);
  if (skillMatch) query.set("skillMatch", skillMatch);
  const queryString = query.toString();
  return apiFetch<GetJobsResponse>(`/jobs${queryString ? `?${queryString}` : ""}`);
}

export async function suggestSkills(query: string) {
  return apiFetch<{ skills: Array<{ slug: string; name: string }> }>(`/skills/suggest?q=${encodeURIComponent(query)}`);
}

export async function resolveSkill(input: string, forceCreate = false) {
  return apiFetch<{ id: string; name: string; slug: string; aliases: string[] }>("/skills/resolve", {
    method: "POST",
    headers: getHeaders(undefined, true),
    body: JSON.stringify({ input, forceCreate }),
  });
}

export async function getJobSuggestions(query: string) {
  return apiFetch<string[]>(`/jobs/suggest?query=${encodeURIComponent(query)}`);
}

export async function getSimilarJobs(jobId: string) {
  return apiFetch<ApiJob[]>(`/jobs/${jobId}/similar`);
}

export async function getMyApplications(token: string) {
  return apiFetch<ApiApplication[]>("/applications/me", {
    method: "GET",
    headers: getHeaders(token, false),
  });
}

export async function getEmployerJobs(token: string) {
  return apiFetch<ApiJob[]>("/jobs/mine", {
    method: "GET",
    headers: getHeaders(token, false),
  });
}

export async function applyJob(token: string, jobId: string, message?: string) {
  return apiFetch<ApiApplication>("/applications", {
    method: "POST",
    headers: getHeaders(token, true),
    body: JSON.stringify({ jobId, message }),
  });
}

export async function updateApplicationStatus(
  token: string,
  applicationId: string,
  status: string,
) {
  const backendStatusMap: Record<string, string> = {
    Applied: "applied",
    Seen: "seen",
    Shortlisted: "shortlisted",
    Hired: "hired",
    NOT_SELECTED: "not_selected",
    Declined: "not_selected",
    applied: "applied",
    seen: "seen",
    shortlisted: "shortlisted",
    hired: "hired",
    not_selected: "not_selected",
  };
  const mappedStatus = backendStatusMap[status] ?? status.toLowerCase();

  return apiFetch<ApiApplication>(`/applications/${applicationId}/status`, {
    method: "PATCH",
    headers: getHeaders(token, true),
    body: JSON.stringify({ status: mappedStatus }),
  });
}

export async function createJob(
  token: string,
  payload: {
    title: string;
    description: string;
    type: "FULL_TIME" | "PART_TIME" | "GIG";
    location?: string;
    payType?: "FIXED" | "RANGE" | "CUSTOM";
    payAmount?: number;
    payMin?: number;
    payMax?: number;
    payCustom?: string;
  },
) {
  const backendPayType = payload.payType ? payload.payType.toLowerCase() : undefined;
  const backendJobType = payload.type ? payload.type.toLowerCase() : undefined;
  return apiFetch<ApiJob>("/jobs", {
    method: "POST",
    headers: getHeaders(token, true),
    body: JSON.stringify({
      ...payload,
      type: backendJobType,
      payType: backendPayType,
    }),
  });
}

export async function updateProfile(
  token: string,
  data: Record<string, unknown>,
) {
  return apiFetch<any>("/users/me", {
    method: "PATCH",
    headers: getHeaders(token, true),
    body: JSON.stringify(data),
  });
}

export async function closeJob(token: string, jobId: string) {
  return apiFetch<any>(`/jobs/${jobId}/close`, {
    method: "PATCH",
    headers: getHeaders(token, false),
  });
}

export async function removeJob(token: string, jobId: string) {
  return apiFetch<any>(`/jobs/${jobId}/remove`, {
    method: "PATCH",
    headers: getHeaders(token, false),
  });
}
