import { FC, JSX, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: JSX.Element
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  // 有 children 时该项作为子菜单入口（hover 右侧展开），onClick 可省略
  children?: ContextMenuItem[]
}

interface IProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const itemClass = (item: ContextMenuItem) =>
  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ' +
  (item.disabled
    ? 'cursor-default text-gray-300'
    : 'hover:bg-neutral-100 ' + (item.danger ? 'text-red-600' : 'text-gray-700'))

const ContextMenu: FC<IProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: y, left: x })
  const [openSub, setOpenSub] = useState<string | null>(null)
  // hover 意图延时：父项 ↔ 子菜单之间移动时不立刻关闭，避免「移过去就消失」
  const subTimer = useRef<number | null>(null)
  const openSubmenu = (key: string) => {
    if (subTimer.current) window.clearTimeout(subTimer.current)
    setOpenSub(key)
  }
  const scheduleCloseSub = () => {
    if (subTimer.current) window.clearTimeout(subTimer.current)
    subTimer.current = window.setTimeout(() => setOpenSub(null), 180)
  }
  useEffect(() => () => {
    if (subTimer.current) window.clearTimeout(subTimer.current)
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handle)
    window.addEventListener('contextmenu', handle)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', handle)
      window.removeEventListener('contextmenu', handle)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // 菜单出现后做一次边界自适应：超出视口右/下边界时反向贴边，避免被遮罩。
  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x
    let top = y
    if (left + rect.width > vw - 8) left = Math.max(8, vw - rect.width - 8)
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8)
    if (left !== pos.left || top !== pos.top) setPos({ top, left })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y])

  // 用 portal 把菜单挂到 body，避免任何祖先的 transform / overflow / contain
  // 把 `position: fixed` 解释成相对 ancestor 而不是 viewport，导致定位偏移。
  // 子菜单是否往左侧展开（贴近视口右边界时翻转），避免溢出被裁切
  const subOnLeft = pos.left + 320 > (typeof window !== 'undefined' ? window.innerWidth : 9999)

  const node = (
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[100] min-w-[150px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
    >
      {items.map(item => {
        if (item.children?.length) {
          return (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => openSubmenu(item.key)}
              onMouseLeave={scheduleCloseSub}
            >
              <button className={itemClass(item)}>
                <span className="flex items-center gap-2">
                  {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
              {openSub === item.key && (
                <div
                  onMouseEnter={() => openSubmenu(item.key)}
                  onMouseLeave={scheduleCloseSub}
                  className={
                    'vm-ctx-scroll absolute top-0 z-[101] max-h-[280px] min-w-[150px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ' +
                    // 无间隙紧贴父项，避免鼠标移过空隙时丢失 hover
                    (subOnLeft ? 'right-full' : 'left-full')
                  }
                >
                  {item.children.map(sub => (
                    <button
                      key={sub.key}
                      disabled={sub.disabled}
                      onClick={() => {
                        if (sub.disabled) return
                        sub.onClick?.()
                        onClose()
                      }}
                      className={itemClass(sub)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {sub.icon && <span className="h-4 w-4">{sub.icon}</span>}
                        <span className="truncate">{sub.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <button
            key={item.key}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
            className={itemClass(item)}
          >
            <span className="flex items-center gap-2">
              {item.icon && <span className="h-4 w-4">{item.icon}</span>}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

export default ContextMenu
