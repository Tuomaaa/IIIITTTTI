// Data model for data/plan.json. Keep in sync with data/schema.json.

/** Calendar date, `YYYY-MM-DD`. */
export type ISODate = string
/** Wall-clock time, `HH:MM` (24h). `24:00` is allowed as an end time. */
export type HHMM = string

export interface Plan {
  $schema?: string
  version: 1
  meta: Meta
  tracks: Track[]
  tasks: Task[]
  milestones: Milestone[]
  todos: Todo[]
  blocks: Block[]
}

export interface Meta {
  title?: string
  /** IANA time zone the agent / CLI uses to decide what "today" is. The web UI uses the device clock. */
  tz?: string
  /** Day view range. */
  dayStart?: HHMM
  dayEnd?: HHMM
  /** More focus tasks than this on one day is shown as overload. */
  maxParallel?: number
  /** An unfinished todo this many days past its first planned date becomes stale. */
  staleAfterDays?: number
  /** Default size of a single push, in days. */
  maxPushDays?: number
  /** True while the file only holds sample data. */
  demo?: boolean
  /** ISO timestamp of the last write. */
  updatedAt?: string
}

export interface Track {
  id: string
  name: string
  /** Hex color, e.g. `#3b82f6`. */
  color: string
  /** Optional grouping, e.g. several SURF tracks. */
  group?: string
  paused?: boolean
  archived?: boolean
  note?: string
}

export interface Slip {
  /** Day the push was decided. */
  at: ISODate
  from: ISODate
  to: ISODate
  reason?: string
  by?: 'user' | 'agent' | 'auto'
}

export interface Task {
  id: string
  trackId: string
  title: string
  /** Window in which the task is expected to happen (inclusive). */
  start: ISODate
  end: ISODate
  /** Days actually planned for working on it. Rendered as solid cells inside the window. */
  focus?: ISODate[]
  /** 0..1. When omitted, progress comes from linked todos. */
  progress?: number
  /** `end` is a hard deadline: it can never be pushed. */
  hard?: boolean
  milestoneId?: string
  /** Original `end`, recorded on the first push. */
  baseline?: ISODate
  slips?: Slip[]
  done?: boolean
  doneAt?: ISODate
  parked?: boolean
  note?: string
}

export interface Milestone {
  id: string
  trackId: string
  title: string
  date: ISODate
  /** Hard deadline (red diamond) rather than a soft checkpoint. */
  hard?: boolean
  done?: boolean
  note?: string
}

export interface Todo {
  id: string
  title: string
  /** Planned day. Omitted = backlog. */
  date?: ISODate
  /** First planned day, kept when a todo is rolled over. */
  origDate?: ISODate
  trackId?: string
  taskId?: string
  done?: boolean
  doneAt?: ISODate
  /** Estimate in minutes. */
  est?: number
  note?: string
}

export interface Block {
  id: string
  date: ISODate
  start: HHMM
  end: HHMM
  title: string
  trackId?: string
  taskId?: string
  todoId?: string
  /** `event` = fixed appointment, `focus` = planned work, `routine` = habits / meals etc. */
  kind?: 'focus' | 'event' | 'routine'
}
