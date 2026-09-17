import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/appContext'

// 数据加载 Hook：依赖全局 dataVersion + 本地 tick + 传入的原始依赖（元素需为原始值）。
export function useData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
): { data: T | null; loading: boolean; reload: () => void } {
  const { dataVersion } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loaderRef
      .current()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, tick, ...deps])

  return { data, loading, reload: () => setTick((t) => t + 1) }
}
