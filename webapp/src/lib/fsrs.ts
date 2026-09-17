// FSRS-4.5 间隔重复调度器（论文级算法，自评四档：忘了/困难/良好/简单 → 1/2/3/4）
// 默认权重为 FSRS-4.5 官方默认参数。

import type { Rating } from './types'

// FSRS-4.5 默认权重（w0..w16，共 17 个参数）
export const FSRS_WEIGHTS: number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
]

const W = FSRS_WEIGHTS
const FACTOR = 19 / 81
const DECAY = -0.5

const DAY_MS = 86400000

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

// 遗忘曲线：给定经过天数与稳定性，计算可提取率 R
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 1
  const t = Math.max(0, elapsedDays)
  return Math.pow(1 + (FACTOR * t) / stability, DECAY)
}

// 首次复习（New 状态）的初始稳定性
export function initStability(rating: Rating): number {
  return W[rating - 1]
}

// 首次复习的初始难度
export function initDifficulty(rating: Rating): number {
  const d = W[4] - Math.exp(W[5] * (rating - 1)) + 1
  return clamp(d, 1, 10)
}

const EASY_DIFFICULTY = W[4] - Math.exp(W[5] * 3) + 1 // initDifficulty(Easy)，用于均值回归

// 下次难度：线性项 + 向「Easy 难度」均值回归
export function nextDifficulty(difficulty: number, rating: Rating): number {
  const linear = difficulty - W[6] * (rating - 3)
  const mean = W[7] * EASY_DIFFICULTY + (1 - W[7]) * linear
  return clamp(mean, 1, 10)
}

// 下次稳定性：成功(困难/良好/简单)走「稳定性增长」，失败(忘了)走「遗忘后稳定性」
export function nextStability(
  difficulty: number,
  stability: number,
  recall: number,
  rating: Rating,
): number {
  if (rating === 1) {
    return (
      W[11] *
      Math.pow(difficulty, -W[12]) *
      (Math.pow(stability + 1, W[13]) - 1) *
      Math.exp(W[14] * (1 - recall))
    )
  }
  const hard = rating === 2 ? W[15] : 1
  const easy = rating === 4 ? W[16] : 1
  return (
    stability *
    (1 +
      Math.exp(W[8]) *
        (11 - difficulty) *
        Math.pow(stability, -W[9]) *
        (Math.exp(W[10] * (1 - recall)) - 1) *
        hard *
        easy)
  )
}

export interface FsrsSnapshot {
  state: 'review' | 'relearning'
  difficulty: number
  stability: number
  intervalDays: number
}

// 对一张已有卡应用一次复习评级，返回新的调度状态。
export function applyReview(
  current: { state: string; difficulty: number | null; stability: number | null; lastReview: number | null },
  rating: Rating,
  now: number,
): FsrsSnapshot {
  if (current.state === 'new') {
    // 首次复习：直接用初始稳定性/难度
    const stability = initStability(rating)
    const difficulty = initDifficulty(rating)
    const intervalDays = Math.max(1, Math.round(stability))
    return {
      state: rating === 1 ? 'relearning' : 'review',
      difficulty,
      stability,
      intervalDays,
    }
  }

  const elapsedDays =
    current.lastReview != null ? Math.max(0, (now - current.lastReview) / DAY_MS) : 0
  const recall = retrievability(elapsedDays, current.stability ?? 1)
  const difficulty = nextDifficulty(current.difficulty ?? 5, rating)
  const stability = nextStability(difficulty, current.stability ?? 1, recall, rating)
  const intervalDays = rating === 1 ? 1 : Math.max(1, Math.round(stability))

  return {
    state: rating === 1 ? 'relearning' : 'review',
    difficulty,
    stability,
    intervalDays,
  }
}
