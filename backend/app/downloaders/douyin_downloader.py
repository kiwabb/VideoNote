"""抖音下载器：基于 yt-dlp 内置 Douyin extractor。

历史上这里是手搓的签名 API（a_bogus + msToken），抖音一更新风控就失效（空响应 →
解析失败）。改用 yt-dlp 的 Douyin extractor，由其维护签名/取流逻辑，并支持
cookiesfrombrowser / cookiefile；分享文案整段粘贴也能用（clean_url 提取链接）。

URL 模式：
  - https://www.douyin.com/video/{aweme_id}
  - 短链 v.douyin.com/xxx（yt-dlp 自行跟随重定向）
  - 抖音「复制打开抖音」分享文案（自动提取其中的链接）
"""
import os
import logging
import tempfile
from abc import ABC
from typing import Union, Optional

import yt_dlp

from app.downloaders.base import Downloader, DownloadQuality
from app.models.notes_model import AudioDownloadResult
from app.services.cookie_manager import CookieConfigManager
from app.utils.path_helper import get_data_dir
from app.utils.url_parser import extract_video_id, clean_url

logger = logging.getLogger(__name__)


class DouyinDownloader(Downloader, ABC):
    def __init__(self, cookie=None):
        super().__init__()
        self._cookie_mgr = CookieConfigManager()
        self._cookie = self._cookie_mgr.get('douyin')
        self._browser = self._cookie_mgr.get_browser('douyin')
        self._cookiefile = None if self._browser else self._write_netscape_cookie_file()

    def _write_netscape_cookie_file(self) -> Optional[str]:
        if not self._cookie:
            logger.warning("抖音 Cookie 未配置，部分内容可能下载失败")
            return None
        lines = ["# Netscape HTTP Cookie File\n"]
        for pair in self._cookie.split("; "):
            if "=" in pair:
                key, value = pair.split("=", 1)
                lines.append(f".douyin.com\tTRUE\t/\tFALSE\t0\t{key}\t{value}\n")
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
        tmp.writelines(lines)
        tmp.close()
        logger.info("已生成抖音 Netscape Cookie 文件: %s (条目: %d)", tmp.name, len(lines) - 1)
        return tmp.name

    def _apply_cookie(self, ydl_opts: dict) -> None:
        if self._browser:
            ydl_opts['cookiesfrombrowser'] = (self._browser,)
            logger.info(f"抖音使用 cookies-from-browser: {self._browser}")
        elif self._cookiefile:
            ydl_opts['cookiefile'] = self._cookiefile

    def download(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
        quality: DownloadQuality = "fast",
        need_video: Optional[bool] = False,
        skip_download: bool = False,
    ) -> AudioDownloadResult:
        video_url = clean_url(video_url)
        if output_dir is None:
            output_dir = get_data_dir()
        if not output_dir:
            output_dir = self.cache_data
        os.makedirs(output_dir, exist_ok=True)

        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
        }
        if skip_download:
            ydl_opts['skip_download'] = True
        self._apply_cookie(ydl_opts)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=not skip_download)
            video_id = info.get("id")
            title = info.get("title")
            duration = info.get("duration", 0)
            cover_url = info.get("thumbnail")
            ext = info.get("ext", "mp3")
            audio_path = os.path.join(output_dir, f"{video_id}.{ext}")

        return AudioDownloadResult(
            file_path=audio_path,
            title=title,
            duration=duration,
            cover_url=cover_url,
            platform="douyin",
            video_id=video_id,
            raw_info={'tags': info.get('tags')},
            video_path=None,
        )

    def download_video(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
    ) -> str:
        video_url = clean_url(video_url)
        if output_dir is None:
            output_dir = get_data_dir()
        video_id = extract_video_id(video_url, "douyin")
        if video_id:
            existing = os.path.join(output_dir, f"{video_id}.mp4")
            if os.path.exists(existing):
                return existing
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")
        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'merge_output_format': 'mp4',
        }
        self._apply_cookie(ydl_opts)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get("id")
            video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件未找到: {video_path}")
        return video_path
