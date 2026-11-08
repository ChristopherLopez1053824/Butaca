import {
  FACE_EXPRESSION_TO_EMOTION,
  type Emotion,
  type FaceExpression,
} from '../lib/emotions'

const MODEL_URL = `${import.meta.env.BASE_URL}models`
const DETECTION_INPUT_SIZE = 224
const DETECTION_SCORE_THRESHOLD = 0.5

type FaceApi = typeof import('@vladmandic/face-api')

let faceApiPromise: Promise<FaceApi> | null = null
let modelsPromise: Promise<void> | null = null

function loadFaceApi(): Promise<FaceApi> {
  if (!faceApiPromise) {
    faceApiPromise = import('@vladmandic/face-api')
  }

  return faceApiPromise
}

export function loadEmotionModels(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const faceapi = await loadFaceApi()
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    })()

    modelsPromise.catch(() => {
      modelsPromise = null
    })
  }

  return modelsPromise
}

export interface DetectedEmotion {
  emotion: Emotion
  expression: FaceExpression
  confidence: number
}

export async function detectEmotion(
  video: HTMLVideoElement,
): Promise<DetectedEmotion | null> {
  const faceapi = await loadFaceApi()

  const result = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: DETECTION_INPUT_SIZE,
        scoreThreshold: DETECTION_SCORE_THRESHOLD,
      }),
    )
    .withFaceExpressions()

  if (!result) {
    return null
  }

  const [topExpression] = result.expressions.asSortedArray()

  if (!topExpression) {
    return null
  }

  return {
    emotion: FACE_EXPRESSION_TO_EMOTION[topExpression.expression],
    expression: topExpression.expression,
    confidence: topExpression.probability,
  }
}
