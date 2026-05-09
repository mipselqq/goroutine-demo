export type BoardDragPayload =
  | { kind: 'column'; columnId: string; title: string; sub: string }
  | { kind: 'task'; sourceColumnId: string; taskId: string; title: string; sub: string }

export type TaskDropPreview = { columnId: string; insertIndex: number }

export type BoardDragState =
  | null
  | ({
    phase: 'pending'
    pointerId: number
    originX: number
    originY: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  } & BoardDragPayload)
  | ({
    phase: 'dragging'
    pointerId: number
    offsetX: number
    offsetY: number
    width: number
    height: number
    clientX: number
    clientY: number
    columnDropSlot: number
  } & Extract<BoardDragPayload, { kind: 'column' }>)
  | ({
    phase: 'dragging'
    pointerId: number
    offsetX: number
    offsetY: number
    width: number
    height: number
    clientX: number
    clientY: number
    taskDrop: TaskDropPreview | null
  } & Extract<BoardDragPayload, { kind: 'task' }>)
