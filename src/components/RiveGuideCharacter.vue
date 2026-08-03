<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas'
import bunnyUrl from '../assets/24876-46460-interactive-bunny-character.riv?url'
import type { MainMapMenuItem } from '../data/mainMapMenu'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = withDefaults(
  defineProps<{
    // 메인 섬 화면에서 전달되는 활성 메뉴(기존 동작 그대로 유지)
    activeMenu?: MainMapMenuItem['id'] | null
    // 학습 화면(컴패니언 모드)에서 토끼가 말풍선으로 띄울 응원/피드백 메시지.
    // 이 값을 넘기면 activeMenu 기반 로직 대신 이 메시지를 그대로 보여줍니다.
    message?: string
    // 컴패니언 모드 동작. reading은 책 읽는 자세, cheer는 손을 흔드는 환호 동작입니다.
    mood?: 'idle' | 'reading' | 'cheer'
    showBubble?: boolean
    speakMessage?: boolean
  }>(),
  { activeMenu: null, mood: 'idle', showBubble: true, speakMessage: false },
)

// message 를 넘긴 경우 = 학습 화면 컴패니언 모드. 아니면 메인 섬 화면 모드.
const isCompanion = computed(() => props.message !== undefined)
const studentName = getCachedStudent().name
const audio = useAudioPlayer()

const source = ref<HTMLCanvasElement | null>(null)
const output = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
const hovered = ref(false)
let rive: Rive | null = null
let renderFrame = 0
let compositorStarted = false
let waveTimer: ReturnType<typeof setInterval> | undefined
let waveResetTimer: ReturnType<typeof setTimeout> | undefined
let poseTimer: ReturnType<typeof setTimeout> | undefined

const menuMessages: Record<MainMapMenuItem['id'], string> = {
  growth: '얼마나 열심히 했는지\n확인하러 가볼까?',
  game: '재미있는 이야기를\n만나러 가볼까?',
  letter: '오늘도 열심히\n연습해보자!',
  challenge: '얼마나 잘해졌나\n확인해보자!',
}

const bubbleMessage = computed(() => {
  // 학습 화면: 상위가 넘겨준 메시지를 응원/피드백으로 그대로 표시
  if (isCompanion.value) return props.message ?? '힘내요!'
  if (hovered.value) return '안녕~~'
  if (props.activeMenu) return menuMessages[props.activeMenu]
  return `${studentName}아!\n오늘도 화이팅!`
})

type BunnyAnimation = 'Idle Loop' | 'WALK' | '01 Wave 2' | 'idle to Pose 1' | 'Pose 1 loop'

const loadAnimation = (name: BunnyAnimation) => {
  if (!source.value) return
  clearTimeout(poseTimer)
  rive?.cleanup()
  const instance = new Rive({
    src: bunnyUrl,
    canvas: source.value,
    artboard: 'Artboard',
    animations: name,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => {
      if (rive !== instance) return
      ready.value = true
      instance.resizeDrawingSurfaceToCanvas()
      if (!compositorStarted) {
        compositorStarted = true
        startGpuCompositor()
      }
    },
  })
  rive = instance
}

const playAnimation = (name: BunnyAnimation) => loadAnimation(name)

const playBookMotion = () => {
  playAnimation('idle to Pose 1')
  poseTimer = setTimeout(() => {
    const shouldKeepReading = isCompanion.value
      ? props.mood === 'reading'
      : props.activeMenu === 'letter' || props.activeMenu === 'challenge'
    if (!hovered.value && shouldKeepReading) {
      playAnimation('Pose 1 loop')
    }
  }, 1400)
}

const startGpuCompositor = () => {
  const input = source.value
  const canvas = output.value
  const gl = canvas?.getContext('webgl', { alpha: true, premultipliedAlpha: false })
  if (!input || !canvas || !gl) return

  const compile = (type: number, code: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    return shader
  }
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `
    attribute vec2 position;
    varying vec2 uv;
    void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
  `))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D image;
    varying vec2 uv;
    void main() {
      vec2 sourceUv = vec2(mix(.28, .70, uv.x), mix(.07, .97, uv.y));
      vec4 color = texture2D(image, sourceUv);
      float low = min(color.r, min(color.g, color.b));
      float high = max(color.r, max(color.g, color.b));
      float white = smoothstep(.78, .94, low) * (1. - smoothstep(.08, .18, high - low));
      vec2 leftEyePoint = (uv - vec2(.405, .53)) / vec2(.055, .065);
      vec2 rightEyePoint = (uv - vec2(.655, .53)) / vec2(.055, .065);
      float leftEye = 1. - smoothstep(.82, 1., dot(leftEyePoint, leftEyePoint));
      float rightEye = 1. - smoothstep(.82, 1., dot(rightEyePoint, rightEyePoint));
      float eyeWhite = max(leftEye, rightEye) * white;
      color.rgb = mix(color.rgb, vec3(1.), eyeWhite);
      color.a = max(color.a * (1. - white), eyeWhite);
      float topNeutralArtifact = step(.70, uv.y)
        * (1. - smoothstep(.06, .18, high - low))
        * smoothstep(.42, .82, low)
        * (1. - eyeWhite);
      color.a *= 1. - topNeutralArtifact;
      bool fur = color.r > .62 && color.g > .33 && color.b < .58 && color.r > color.g;
      if (fur) {
        float shade = clamp((color.r + color.g + color.b) / 2.02, .58, 1.08);
        color.rgb = vec3(.95, .57, .74) * shade;
      }
      gl_FragColor = color;
    }
  `))
  gl.linkProgram(program)
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.viewport(0, 0, canvas.width, canvas.height)

  const draw = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    renderFrame = requestAnimationFrame(draw)
  }
  draw()
}

const playMenuMotion = () => {
  if (hovered.value) return
  if (isCompanion.value) {
    return props.mood === 'reading' ? playBookMotion() : playAnimation('Idle Loop')
  }
  if (props.activeMenu === 'growth' || props.activeMenu === 'game') return playAnimation('WALK')
  if (props.activeMenu === 'letter' || props.activeMenu === 'challenge') return playBookMotion()
  playAnimation('Idle Loop')
}

const replayWave = () => {
  if (!rive || !hovered.value) return
  clearTimeout(waveResetTimer)
  playAnimation('01 Wave 2')
  waveResetTimer = setTimeout(() => {
    if (hovered.value) playAnimation('Idle Loop')
  }, 1250)
}

const enter = () => {
  hovered.value = true
  clearInterval(waveTimer)
  replayWave()
  waveTimer = setInterval(replayWave, 2200)
}

const leave = () => {
  hovered.value = false
  clearInterval(waveTimer)
  clearTimeout(waveResetTimer)
  playMenuMotion()
}

watch(() => props.activeMenu, playMenuMotion)

watch(
  () => props.message,
  (message) => {
    if (!props.speakMessage || !message?.trim()) return
    void audio.replay(message.replace(/\n/g, ' '), 0.84)
  },
  { immediate: true },
)

// 컴패니언 상태에 따라 책 읽기, 대기, 환호 모션을 전환합니다.
watch(
  () => props.mood,
  (m) => {
    if (!isCompanion.value || hovered.value) return
    clearTimeout(poseTimer)
    if (m === 'cheer') {
      playAnimation('01 Wave 2')
      poseTimer = setTimeout(() => {
        if (!hovered.value) playAnimation('Idle Loop')
      }, 1500)
    } else if (m === 'reading') {
      playBookMotion()
    } else {
      playAnimation('Idle Loop')
    }
  },
)

onMounted(() => {
  playMenuMotion()
})

onBeforeUnmount(() => {
  if (props.speakMessage) audio.stop()
  cancelAnimationFrame(renderFrame)
  clearInterval(waveTimer)
  clearTimeout(waveResetTimer)
  clearTimeout(poseTimer)
  rive?.cleanup()
})
</script>

<template>
  <div class="guide" :class="{ ready }">
    <div
      v-if="showBubble"
      class="bubble"
      :role="isCompanion ? 'status' : undefined"
      :aria-live="isCompanion ? 'polite' : undefined"
    >{{ bubbleMessage }}</div>
    <canvas ref="source" class="source" width="620" height="570"></canvas>
    <canvas ref="output" class="bunny" width="620" height="570"></canvas>
    <button class="bunny-hit" type="button" aria-label="기리 토끼에게 인사하기" @pointerenter="enter" @pointerleave="leave" @focus="enter" @blur="leave"></button>
  </div>
</template>

<style scoped src="@/styles/common/RiveGuideCharacter.css"></style>
