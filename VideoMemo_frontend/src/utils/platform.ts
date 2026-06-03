/**
 * URL → 平台代码。镜像 backend/app/validators/video_url_validator.py。
 * 返回 null 表示不在支持列表里（或不是 URL）。本地文件路径走 'local'，不走此函数。
 */
export function detectPlatform(url: string): string | null {
  const u = (url || '').trim()
  if (!u) return null
  if (/(^|\.)b23\.tv\//.test(u) || /bilibili\.com/.test(u)) return 'bilibili'
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/douyin/.test(u)) return 'douyin'
  if (/kuaishou/.test(u)) return 'kuaishou'
  if (/xiaohongshu\.com|xhslink\.com/.test(u)) return 'xiaohongshu'
  // 兜底：检查用户在「下载配置」里登记的自定义平台
  for (const cp of customPlatforms) {
    if (cp.match && u.includes(cp.match)) return cp.key
  }
  return null
}

/**
 * 在原始视频链接上拼接「跳转到第 seconds 秒」的时间参数。
 * 只有 B 站 / YouTube 支持可靠的时间戳跳转；其它平台原样返回（仍可点击打开视频）。
 */
export function buildVideoTimestampUrl(
  url: string,
  platform: string | null | undefined,
  seconds: number,
): string {
  if (!url) return url
  const p = platform || detectPlatform(url) || ''
  try {
    const u = new URL(url)
    if (p === 'bilibili') {
      u.searchParams.set('t', String(Math.max(0, Math.floor(seconds))))
      return u.toString()
    }
    if (p === 'youtube') {
      u.searchParams.set('t', `${Math.max(0, Math.floor(seconds))}s`)
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

/** 自定义平台缓存（由 App 启动时通过 setCustomPlatforms 注入），用于客户端 URL→平台识别。 */
export interface CustomPlatform {
  key: string
  name: string
  match: string
}
let customPlatforms: CustomPlatform[] = []
export function setCustomPlatforms(list: CustomPlatform[]): void {
  customPlatforms = list || []
}
export function getCustomPlatforms(): CustomPlatform[] {
  return customPlatforms
}
