import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { BRAND } from '../../lib/brand'

const ONBOARD_KEY = 'shixi:onboarded'

const STEPS = [
  {
    ico: '📚',
    title: '知识点库',
    text: '把拍题、阅读、听讲中学到的知识点记录下来，按学科分类沉淀，附「引子—答案—关联」。',
  },
  {
    ico: '🎯',
    title: '间隔复习',
    text: 'FSRS 遗忘曲线算法替你算好复习时机，每天只复习该复习的几张卡，少而准。',
  },
  {
    ico: '💬',
    title: '苏格拉底式 AI',
    text: 'AI 不直接给答案，而是一步步提问带你从场景走到底层，想通了才算真懂。',
  },
  {
    ico: '⏱',
    title: '专注与日报',
    text: '一键专注打卡，自动汇总成学习日报——学了多久、学了什么，一目了然。',
  },
  {
    ico: '☁️',
    title: '跨设备同步',
    text: '用邮箱注册/登录，你的知识库与复习进度在多台设备间自动同步。',
  },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { account, booting } = useApp()
  const [step, setStep] = useState(0)

  // 已登录或有引导标记，则跳过
  useEffect(() => {
    if (!booting && account) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, booting])

  const finish = () => {
    localStorage.setItem(ONBOARD_KEY, '1')
    navigate('/login', { replace: true })
  }

  const skip = () => finish()

  const total = STEPS.length
  const cur = STEPS[step]

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">
        <div className="ob-top">
          <div className="brand-seal">时</div>
          <div className="ob-skip" onClick={skip}>
            跳过
          </div>
        </div>

        <div className="ob-body">
          <div className="ob-ico">{cur.ico}</div>
          <h1 className="ob-title serif">{BRAND.name} · {cur.title}</h1>
          <p className="ob-text">{cur.text}</p>
        </div>

        <div className="ob-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`ob-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="ob-actions">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)}>
              上一步
            </button>
          ) : (
            <span />
          )}
          {step < total - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              下一步
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish}>
              开始使用
            </button>
          )}
        </div>
      </div>
    </div>
  )
}