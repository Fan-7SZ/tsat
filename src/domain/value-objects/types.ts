export type ID = string

export type GoalID = ID
export type TaskID = ID

export type ISODateTimeString = string
export type ISODateString = string

export interface Step {
  id: string
  title: string
}
export type Steps = Step[]

/** Factory for a new step; generates the stable id once at creation. */
export function createStep(title: string): Step {
  return { id: crypto.randomUUID(), title }
}

export type DurationInMinutes = number

export type DependencyEntityID = ID
export type TagID = ID
export type Index = number
export type ActivityID = ID
export type TaskRuntimeID = ID
