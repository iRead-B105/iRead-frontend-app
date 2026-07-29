import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type TobiiGazeFrame = {
  type?: string
  source?: string
  valid?: boolean
  screenX?: number
  screenY?: number
  trackingLeft?: number
  trackingTop?: number
  trackingWidth?: number
  trackingHeight?: number
  clientX?: number
  clientY?: number
  x?: number
  y?: number
  headPoseValid?: boolean
  headYawDeg?: number
  headPitchDeg?: number
  headRollDeg?: number
  headX?: number
  headY?: number
  headZ?: number
  headTimestampUs?: number
}

type GazeTransform = {
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
}

type GazePoint = {
  clientX: number
  clientY: number
}

type HeadPose = {
  yaw: number
  pitch: number
  roll: number
  x: number | null
  y: number | null
  z: number | null
}

type HeadPoseDelta = {
  yaw: number
  pitch: number
  roll: number
  x: number
  y: number
  z: number
  unstable: boolean
  reason: 'head-stable' | 'head-moved'
}

type GazeAnchor = {
  name: string
  raw: GazePoint
  target: GazePoint
  sampleCount: number
  capturedAt: number
}

type GazeAnchorTarget = string | Element | { x: number; y: number } | { clientX: number; clientY: number }

type GazeBridgeControls = {
  getOffset: () => { x: number; y: number }
  setOffset: (x: number, y: number) => GazeTransform
  nudgeOffset: (dx: number, dy: number) => GazeTransform
  getTransform: () => GazeTransform
  setTransform: (next: Partial<GazeTransform>) => GazeTransform
  nudgeScale: (dx: number, dy?: number) => GazeTransform
  getLastPoint: () => { raw: GazePoint | null; adjusted: GazePoint | null }
  clearRecentSamples: () => void
  sampleAnchor: (name: string, target: GazeAnchorTarget, durationMs?: number) => Promise<GazeAnchor>
  getAnchors: () => Record<string, GazeAnchor>
  fitAnchors: (xStartName: string, xEndName: string, yStartName?: string, yEndName?: string) => GazeTransform
  clearAnchors: () => Record<string, never>
  resetOffset: () => GazeTransform
  resetTransform: () => GazeTransform
  resetHeadPoseBaseline: () => void
  getHeadPoseState: () => { baseline: HeadPose | null; delta: HeadPoseDelta | null }
}

declare global {
  interface Window {
    __ireadTobiiGazeBridge?: GazeBridgeControls
  }
}

const GAZE_WS_URL = 'ws://127.0.0.1:8765/gaze'
const GAZE_MODE_URL = 'http://127.0.0.1:8765/api/mode'
const RECONNECT_DELAY_MS = 1200
const GAZE_EMIT_INTERVAL_MS = 11
const TRANSFORM_STORAGE_KEY = 'iread-tobii-gaze-transform-v2'
const LEGACY_OFFSET_STORAGE_KEY = 'iread-tobii-gaze-offset-v1'
const ANCHORS_STORAGE_KEY = 'iread-tobii-gaze-anchors-v1'
const HEAD_ROTATION_LIMIT_DEG = 15
const HEAD_POSITION_LIMIT = 0.35
const HEAD_POSITION_COMPARABLE_RANGE = 8
const GAZE_SMOOTHING_ALPHA = 0.48
const GAZE_REPLAY_MAX_MS = 220
const ANCHOR_FALLBACK_MAX_AGE_MS = 450

const connected = ref(false)
const connecting = ref(false)
const status = computed<'connected' | 'connecting' | 'disconnected'>(() =>
  connected.value ? 'connected' : connecting.value ? 'connecting' : 'disconnected',
)
let socket: WebSocket | null = null
let userStopped = false
let reconnectTimer: number | undefined
let animationFrame: number | undefined
let pendingFrame: TobiiGazeFrame | null = null
let pendingFrameSequence = 0
let emittedFrameSequence = 0
let lastEmitAt = 0
let lastFreshFrameAt = 0
let transform: GazeTransform = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
let anchors: Record<string, GazeAnchor> = {}
let recentRawSamples: Array<GazePoint & { at: number }> = []
let lastRawPoint: GazePoint | null = null
let lastRawPointAt = 0
let lastAdjustedPoint: GazePoint | null = null
let smoothedPoint: GazePoint | null = null
let headPoseBaseline: HeadPose | null = null
let lastHeadPoseDelta: HeadPoseDelta | null = null

let consumers = 0

function clearReconnectTimer() {
  if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
  reconnectTimer = undefined
}

function readStoredTransform() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TRANSFORM_STORAGE_KEY) ?? '{}') as Partial<GazeTransform>
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_OFFSET_STORAGE_KEY) ?? '{}') as Partial<{ x: number; y: number }>
    const maxOffsetX = Math.max(240, window.innerWidth * 0.45)
    const maxOffsetY = Math.max(180, window.innerHeight * 0.45)
    transform = {
      offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, Number.isFinite(saved.offsetX) ? Number(saved.offsetX) : Number.isFinite(legacy.x) ? Number(legacy.x) : 0)),
      offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, Number.isFinite(saved.offsetY) ? Number(saved.offsetY) : Number.isFinite(legacy.y) ? Number(legacy.y) : 0)),
      scaleX: Math.min(1.35, Math.max(0.7, Number.isFinite(saved.scaleX) ? Number(saved.scaleX) : 1)),
      scaleY: Math.min(1.35, Math.max(0.7, Number.isFinite(saved.scaleY) ? Number(saved.scaleY) : 1)),
    }
    saveTransform()
  } catch {
    transform = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
  }
}

function saveTransform() {
  window.localStorage.setItem(TRANSFORM_STORAGE_KEY, JSON.stringify(transform))
}

function readStoredAnchors() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ANCHORS_STORAGE_KEY) ?? '{}') as Record<string, GazeAnchor>
    anchors = Object.fromEntries(
      Object.entries(saved).filter(([, anchor]) => (
        typeof anchor?.name === 'string'
        && Number.isFinite(anchor.raw?.clientX)
        && Number.isFinite(anchor.raw?.clientY)
        && Number.isFinite(anchor.target?.clientX)
        && Number.isFinite(anchor.target?.clientY)
      )),
    )
  } catch {
    anchors = {}
  }
}

function saveAnchors() {
  window.localStorage.setItem(ANCHORS_STORAGE_KEY, JSON.stringify(anchors))
}

function setTransform(next: Partial<GazeTransform>) {
  const scaleX = Number.isFinite(next.scaleX) ? Number(next.scaleX) : transform.scaleX
  const scaleY = Number.isFinite(next.scaleY) ? Number(next.scaleY) : transform.scaleY
  const maxOffsetX = Math.max(240, window.innerWidth * 0.45)
  const maxOffsetY = Math.max(180, window.innerHeight * 0.45)

  transform = {
    offsetX: Number.isFinite(next.offsetX) ? Math.round(Math.min(maxOffsetX, Math.max(-maxOffsetX, Number(next.offsetX)))) : transform.offsetX,
    offsetY: Number.isFinite(next.offsetY) ? Math.round(Math.min(maxOffsetY, Math.max(-maxOffsetY, Number(next.offsetY)))) : transform.offsetY,
    scaleX: Math.min(1.35, Math.max(0.7, Number(scaleX.toFixed(4)))),
    scaleY: Math.min(1.35, Math.max(0.7, Number(scaleY.toFixed(4)))),
  }
  saveTransform()
  return { ...transform }
}

function applyTransform(point: GazePoint) {
  const centerX = window.innerWidth / 2
  const centerY = window.innerHeight / 2

  return {
    clientX: centerX + (point.clientX - centerX) * transform.scaleX + transform.offsetX,
    clientY: centerY + (point.clientY - centerY) * transform.scaleY + transform.offsetY,
  }
}

function setOffset(x: number, y: number) {
  return setTransform({ offsetX: x, offsetY: y })
}

function nudgeOffset(dx: number, dy: number) {
  return setOffset(transform.offsetX + dx, transform.offsetY + dy)
}

function nudgeScale(dx: number, dy = 0) {
  return setTransform({
    scaleX: transform.scaleX + dx,
    scaleY: transform.scaleY + dy,
  })
}

function resetTransform() {
  return setTransform({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 })
}

function resetHeadPoseBaseline() {
  headPoseBaseline = null
  lastHeadPoseDelta = null
}

async function requestNativeMode() {
  const response = await window.fetch(GAZE_MODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'native' }),
  })

  if (!response.ok) throw new Error(`Tobii native mode failed: HTTP ${response.status}`)
  const result = await response.json().catch(() => ({})) as { mode?: string; detail?: string }
  if (result.mode !== 'native') {
    throw new Error(result.detail ?? 'Tobii native mode was not enabled.')
  }
}

function resolveAnchorTarget(target: GazeAnchorTarget): GazePoint | null {
  if (typeof target === 'string') {
    return resolveAnchorTarget(document.querySelector(target) ?? undefinedTarget())
  }

  if (target instanceof Element) {
    const rect = target.getBoundingClientRect()
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
  }

  if ('clientX' in target && 'clientY' in target) {
    return { clientX: target.clientX, clientY: target.clientY }
  }

  if ('x' in target && 'y' in target) {
    return { clientX: target.x, clientY: target.y }
  }

  return null
}

function undefinedTarget(): never {
  throw new Error('Anchor target element was not found.')
}

function rememberRawPoint(point: GazePoint) {
  const at = performance.now()
  lastRawPoint = point
  lastRawPointAt = at
  recentRawSamples.push({ ...point, at })
  recentRawSamples = recentRawSamples.filter((sample) => at - sample.at <= 2200)
}

function clearRecentSamples() {
  recentRawSamples = []
  lastRawPoint = null
  lastRawPointAt = 0
  lastAdjustedPoint = null
  smoothedPoint = null
}

function averageRawPoint(since: number, until = Infinity) {
  const samples = recentRawSamples.filter((sample) => sample.at >= since && sample.at <= until)
  if (samples.length === 0) return lastRawPoint

  return {
    clientX: samples.reduce((sum, sample) => sum + sample.clientX, 0) / samples.length,
    clientY: samples.reduce((sum, sample) => sum + sample.clientY, 0) / samples.length,
  }
}

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs))
}

async function sampleAnchor(name: string, target: GazeAnchorTarget, durationMs = 800) {
  const targetPoint = resolveAnchorTarget(target)
  if (!targetPoint) throw new Error('Anchor target is invalid.')

  const startedAt = performance.now()
  await wait(Math.max(120, durationMs))
  const samples = recentRawSamples.filter((sample) => sample.at >= startedAt)

  const now = performance.now()
  const hasRecentFallbackPoint = lastRawPoint && lastRawPointAt >= startedAt - ANCHOR_FALLBACK_MAX_AGE_MS && now - lastRawPointAt <= ANCHOR_FALLBACK_MAX_AGE_MS
  if (samples.length < 2 && !hasRecentFallbackPoint) throw new Error('Not enough Tobii gaze samples were received.')

  const rawPoint = samples.length >= 2
    ? averageRawPoint(samples[0]?.at ?? startedAt)
    : lastRawPoint
  if (!rawPoint) throw new Error('No Tobii gaze samples were received.')

  const anchor: GazeAnchor = {
    name,
    raw: rawPoint,
    target: targetPoint,
    sampleCount: Math.max(samples.length, 1),
    capturedAt: Date.now(),
  }
  anchors[name] = anchor
  saveAnchors()
  return anchor
}

function fitAxis(start: GazeAnchor, end: GazeAnchor, axis: 'x' | 'y') {
  const rawStart = axis === 'x' ? start.raw.clientX : start.raw.clientY
  const rawEnd = axis === 'x' ? end.raw.clientX : end.raw.clientY
  const targetStart = axis === 'x' ? start.target.clientX : start.target.clientY
  const targetEnd = axis === 'x' ? end.target.clientX : end.target.clientY
  const center = axis === 'x' ? window.innerWidth / 2 : window.innerHeight / 2

  if (rawEnd <= rawStart || Math.abs(rawEnd - rawStart) < 80) {
    throw new Error(`Invalid ${axis.toUpperCase()} gaze calibration samples.`)
  }

  const measuredScale = (targetEnd - targetStart) / (rawEnd - rawStart)
  if (!Number.isFinite(measuredScale) || measuredScale < 0.7 || measuredScale > 1.35) {
    throw new Error(`${axis.toUpperCase()} gaze calibration is outside the safe range.`)
  }
  const scale = measuredScale
  const offset = targetStart - (center + (rawStart - center) * scale)
  return { scale, offset }
}

function fitAnchors(xStartName: string, xEndName: string, yStartName = xStartName, yEndName = xEndName) {
  const xStart = anchors[xStartName]
  const xEnd = anchors[xEndName]
  const yStart = anchors[yStartName]
  const yEnd = anchors[yEndName]

  if (!xStart || !xEnd || !yStart || !yEnd) throw new Error('Missing gaze anchor.')

  const xFit = fitAxis(xStart, xEnd, 'x')
  const yFit = fitAxis(yStart, yEnd, 'y')

  return setTransform({
    scaleX: xFit?.scale,
    offsetX: xFit?.offset,
    scaleY: yFit?.scale,
    offsetY: yFit?.offset,
  })
}

function getHeadPose(frame: TobiiGazeFrame): HeadPose | null {
  if (frame.headPoseValid === false) return null
  if (
    !Number.isFinite(frame.headYawDeg)
    || !Number.isFinite(frame.headPitchDeg)
    || !Number.isFinite(frame.headRollDeg)
  ) return null

  return {
    yaw: Number(frame.headYawDeg),
    pitch: Number(frame.headPitchDeg),
    roll: Number(frame.headRollDeg),
    x: Number.isFinite(frame.headX) ? Number(frame.headX) : null,
    y: Number.isFinite(frame.headY) ? Number(frame.headY) : null,
    z: Number.isFinite(frame.headZ) ? Number(frame.headZ) : null,
  }
}

function hasComparableHeadPosition(current: HeadPose, baseline: HeadPose) {
  if (current.x === null || current.y === null || current.z === null) return false
  if (baseline.x === null || baseline.y === null || baseline.z === null) return false

  return (
    Math.abs(current.x - baseline.x) <= HEAD_POSITION_COMPARABLE_RANGE
    && Math.abs(current.y - baseline.y) <= HEAD_POSITION_COMPARABLE_RANGE
    && Math.abs(current.z - baseline.z) <= HEAD_POSITION_COMPARABLE_RANGE
  )
}

function updateHeadPoseState(frame: TobiiGazeFrame) {
  const current = getHeadPose(frame)
  if (!current) return null

  if (!headPoseBaseline) {
    headPoseBaseline = current
    lastHeadPoseDelta = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      x: 0,
      y: 0,
      z: 0,
      unstable: false,
      reason: 'head-stable',
    }
    return lastHeadPoseDelta
  }

  const positionComparable = hasComparableHeadPosition(current, headPoseBaseline)
  const delta: HeadPoseDelta = {
    yaw: current.yaw - headPoseBaseline.yaw,
    pitch: current.pitch - headPoseBaseline.pitch,
    roll: current.roll - headPoseBaseline.roll,
    x: positionComparable ? Number(current.x) - Number(headPoseBaseline.x) : 0,
    y: positionComparable ? Number(current.y) - Number(headPoseBaseline.y) : 0,
    z: positionComparable ? Number(current.z) - Number(headPoseBaseline.z) : 0,
    unstable: false,
    reason: 'head-stable',
  }

  delta.unstable = (
    Math.abs(delta.yaw) > HEAD_ROTATION_LIMIT_DEG
    || Math.abs(delta.pitch) > HEAD_ROTATION_LIMIT_DEG
    || Math.abs(delta.roll) > HEAD_ROTATION_LIMIT_DEG
    || (positionComparable && (
      Math.abs(delta.x) > HEAD_POSITION_LIMIT
      || Math.abs(delta.y) > HEAD_POSITION_LIMIT
      || Math.abs(delta.z) > HEAD_POSITION_LIMIT
    ))
  )
  delta.reason = delta.unstable ? 'head-moved' : 'head-stable'
  lastHeadPoseDelta = delta
  return delta
}

function installControls() {
  window.__ireadTobiiGazeBridge = {
    getOffset: () => ({ x: transform.offsetX, y: transform.offsetY }),
    setOffset,
    nudgeOffset,
    getTransform: () => ({ ...transform }),
    setTransform,
    nudgeScale,
    getLastPoint: () => ({
      raw: lastRawPoint ? { ...lastRawPoint } : null,
      adjusted: lastAdjustedPoint ? { ...lastAdjustedPoint } : null,
    }),
    clearRecentSamples,
    sampleAnchor,
    getAnchors: () => structuredClone(anchors),
    fitAnchors,
    clearAnchors: () => {
      anchors = {}
      saveAnchors()
      return {}
    },
    resetOffset: () => setOffset(0, 0),
    resetTransform,
    resetHeadPoseBaseline,
    getHeadPoseState: () => ({
      baseline: headPoseBaseline ? { ...headPoseBaseline } : null,
      delta: lastHeadPoseDelta ? { ...lastHeadPoseDelta } : null,
    }),
  }
  window.addEventListener('keydown', onKeyDown)
}

function uninstallControls() {
  window.removeEventListener('keydown', onKeyDown)
}

function onKeyDown(event: KeyboardEvent) {
  if (!event.altKey || !event.shiftKey) return

  const keyHandled = event.key.startsWith('Arrow') || ['[', ']', ';', "'"].includes(event.key)
  if (!keyHandled) return

  event.preventDefault()
  const offsetStep = event.ctrlKey ? 20 : 5
  if (event.key === 'ArrowLeft') nudgeOffset(-offsetStep, 0)
  if (event.key === 'ArrowRight') nudgeOffset(offsetStep, 0)
  if (event.key === 'ArrowUp') nudgeOffset(0, -offsetStep)
  if (event.key === 'ArrowDown') nudgeOffset(0, offsetStep)
  if (event.key === '[') nudgeScale(-0.01, 0)
  if (event.key === ']') nudgeScale(0.01, 0)
  if (event.key === ';') nudgeScale(0, -0.01)
  if (event.key === "'") nudgeScale(0, 0.01)
}

function toClientPoint(frame: TobiiGazeFrame) {
  if (typeof frame.clientX === 'number' && typeof frame.clientY === 'number') {
    return { clientX: frame.clientX, clientY: frame.clientY }
  }

  if (typeof frame.screenX === 'number' && typeof frame.screenY === 'number') {
    const cssScreenWidth = window.screen.width
    const cssScreenHeight = window.screen.height
    const nativeScreenWidth = Number.isFinite(frame.trackingWidth) ? Number(frame.trackingWidth) : 0
    const nativeScreenHeight = Number.isFinite(frame.trackingHeight) ? Number(frame.trackingHeight) : 0
    const nativeLeft = Number.isFinite(frame.trackingLeft) ? Number(frame.trackingLeft) : 0
    const nativeTop = Number.isFinite(frame.trackingTop) ? Number(frame.trackingTop) : 0
    const scaleX = nativeScreenWidth > 0 && cssScreenWidth > 0
      ? nativeScreenWidth / cssScreenWidth
      : window.devicePixelRatio
    const scaleY = nativeScreenHeight > 0 && cssScreenHeight > 0
      ? nativeScreenHeight / cssScreenHeight
      : window.devicePixelRatio
    const cssScreenX = scaleX > 0 ? (frame.screenX - nativeLeft) / scaleX + nativeLeft / scaleX : frame.screenX
    const cssScreenY = scaleY > 0 ? (frame.screenY - nativeTop) / scaleY + nativeTop / scaleY : frame.screenY
    const chromeLeft = window.screenX + Math.max(0, (window.outerWidth - window.innerWidth) / 2)
    const chromeTop = window.screenY + Math.max(0, window.outerHeight - window.innerHeight)

    return {
      clientX: cssScreenX - chromeLeft,
      clientY: cssScreenY - chromeTop,
    }
  }

  if (typeof frame.x === 'number' && typeof frame.y === 'number') {
    const normalized = frame.x >= 0 && frame.x <= 1 && frame.y >= 0 && frame.y <= 1
    return normalized
      ? { clientX: frame.x * window.innerWidth, clientY: frame.y * window.innerHeight }
      : { clientX: frame.x, clientY: frame.y }
  }

  return null
}

function smoothPoint(target: GazePoint) {
  if (!smoothedPoint) {
    smoothedPoint = target
    return smoothedPoint
  }

  smoothedPoint = {
    clientX: smoothedPoint.clientX + (target.clientX - smoothedPoint.clientX) * GAZE_SMOOTHING_ALPHA,
    clientY: smoothedPoint.clientY + (target.clientY - smoothedPoint.clientY) * GAZE_SMOOTHING_ALPHA,
  }
  return smoothedPoint
}

function emitGaze(frame: TobiiGazeFrame, freshFrame: boolean) {
  if (frame.type && frame.type !== 'gaze') return
  if (frame.source && frame.source !== 'tobii') return
  if (frame.valid === false) return

  const rawPoint = toClientPoint(frame)
  if (!rawPoint) return

  if (freshFrame) {
    rememberRawPoint(rawPoint)
    updateHeadPoseState(frame)
  }

  const point = smoothPoint(applyTransform(rawPoint))
  lastAdjustedPoint = point

  window.dispatchEvent(new CustomEvent('iread:gaze', {
    detail: {
      ...point,
      x: point.clientX,
      y: point.clientY,
      rawClientX: rawPoint.clientX,
      rawClientY: rawPoint.clientY,
      source: 'tobii',
      transform: { ...transform },
      headPose: getHeadPose(frame),
      headPoseDelta: lastHeadPoseDelta ? { ...lastHeadPoseDelta } : null,
      headPoseStable: !(lastHeadPoseDelta?.unstable ?? false),
      raw: frame,
    },
  }))
}

function scheduleEmit(frame: TobiiGazeFrame) {
  pendingFrame = frame
  pendingFrameSequence += 1
  lastFreshFrameAt = performance.now()
  if (animationFrame !== undefined) return

  animationFrame = window.requestAnimationFrame(pumpGaze)
}

function pumpGaze(now: number) {
  animationFrame = undefined
  if (!pendingFrame) return

  if (now - lastEmitAt >= GAZE_EMIT_INTERVAL_MS) {
    const freshFrame = pendingFrameSequence !== emittedFrameSequence
    emittedFrameSequence = pendingFrameSequence
    lastEmitAt = now
    emitGaze(pendingFrame, freshFrame)
  }

  const canReplay = performance.now() - lastFreshFrameAt <= GAZE_REPLAY_MAX_MS
  if (socket?.readyState === WebSocket.OPEN && pendingFrame && canReplay) {
    animationFrame = window.requestAnimationFrame(pumpGaze)
  }
}

function scheduleReconnect() {
  if (consumers <= 0 || reconnectTimer !== undefined || userStopped) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined
    connect()
  }, RECONNECT_DELAY_MS)
}

function connect() {
  if (userStopped) return
  if (
    socket
    && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
  ) return

  connecting.value = true
  emitState()
  let nextSocket: WebSocket
  try {
    nextSocket = new WebSocket(GAZE_WS_URL)
    socket = nextSocket
  } catch {
    connecting.value = false
    connected.value = false
    emitState()
    scheduleReconnect()
    return
  }

  nextSocket.addEventListener('open', () => {
    if (socket !== nextSocket || userStopped) {
      nextSocket.close()
      return
    }
    void requestNativeMode()
      .then(() => {
        if (socket !== nextSocket || userStopped) return
        connecting.value = false
        connected.value = true
        emitState()
      })
      .catch(() => {
        if (socket !== nextSocket) return
        connecting.value = false
        connected.value = false
        emitState()
        nextSocket.close()
      })
  })
  nextSocket.addEventListener('message', (event) => {
    if (socket !== nextSocket || !connected.value) return
    try {
      scheduleEmit(JSON.parse(String(event.data)) as TobiiGazeFrame)
    } catch {
      // Ignore malformed frames from a partially restarted bridge.
    }
  })
  nextSocket.addEventListener('close', () => {
    if (socket !== nextSocket) return
    connecting.value = false
    connected.value = false
    emitState()
    socket = null
    scheduleReconnect()
  })
  nextSocket.addEventListener('error', () => {
    if (socket !== nextSocket) return
    connecting.value = false
    connected.value = false
    emitState()
    nextSocket.close()
  })
}

function disconnect() {
  userStopped = true
  clearReconnectTimer()
  if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
  animationFrame = undefined
  pendingFrame = null
  pendingFrameSequence = 0
  emittedFrameSequence = 0
  lastFreshFrameAt = 0
  smoothedPoint = null
  connecting.value = false
  connected.value = false
  emitState()
  const activeSocket = socket
  socket = null
  activeSocket?.close()
  resetHeadPoseBaseline()
}

// 사용자가 "재연결"을 눌렀을 때 — 재연결 루프를 다시 허용하고 연결 시도.
function reconnect() {
  userStopped = false
  clearReconnectTimer()
  if (
    socket
    && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
  ) return
  connect()
}

// 헤더 아이콘/메뉴가 상태를 반영하도록 iread:eye-tracker-state 이벤트로 알림.
function emitState() {
  window.dispatchEvent(
    new CustomEvent('iread:eye-tracker-state', {
      detail: { connected: connected.value, connecting: connecting.value },
    }),
  )
}

export function useTobiiGazeBridge() {
  onMounted(() => {
    consumers += 1
    if (consumers > 1) {
      emitState()
      return
    }
    userStopped = false
    readStoredTransform()
    readStoredAnchors()
    installControls()
    connect()
  })

  onBeforeUnmount(() => {
    consumers = Math.max(0, consumers - 1)
    if (consumers === 0) {
      uninstallControls()
      disconnect()
    }
  })

  return { connected, connecting, status, connect, disconnect, reconnect }
}
