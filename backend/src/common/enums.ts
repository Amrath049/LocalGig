export enum JobStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  REMOVED = 'removed',
}

export enum PayType {
  FIXED = 'fixed',
  RANGE = 'range',
  CUSTOM = 'custom',
}

export enum ApplicationStatus {
  APPLIED = 'applied',
  SEEN = 'seen',
  SHORTLISTED = 'shortlisted',
  HIRED = 'hired',
  NOT_SELECTED = 'not_selected',
}

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  GIG = 'gig',
}
