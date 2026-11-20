# 播客字幕

在“字幕”标签中优先读取 RSS 的公开 SRT/VTT；没有公开字幕时，通过本机 Faster Whisper small 模型转写公开音频。播放开始时自动切换字幕，手动切换也会回到当前播放位置。识别结果可能存在人名、术语等错误，界面会注明“自动字幕”。

转写在后台逐段保存，前端每 3 秒读取结果。最多同时转写两集，其他节目排队，离开弹窗仍继续。完成后保留带真实时间轴的字幕，删除缓存音频；中断时保留已有字幕，下次请求从最后一段结束位置继续。字幕与模型都位于已被 Git 忽略的 `data/podcast-asr/`。

音频按最多 10 分钟的片段解码和识别，再换算回原始播放时间，避免数小时节目在整段特征计算时耗尽内存。

本机已经配置 Python 虚拟环境 `data/podcast-asr/runtime` 和模型 `data/podcast-asr/model`。迁移到另一台机器时需重新准备：

```sh
python3 -m venv data/podcast-asr/runtime
data/podcast-asr/runtime/bin/python -m pip install -r scripts/podcast-asr-requirements.txt
```

模型使用 `Systran/faster-whisper-small` 的 `config.json`、`model.bin`、`tokenizer.json`、`vocabulary.txt`，放入 `data/podcast-asr/model/`。本机从 ModelScope 同名公开模型下载，SHA-256 校验通过：

| 文件 | SHA-256 |
| --- | --- |
| model.bin | 3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671 |
| config.json | b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828 |
| tokenizer.json | fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab |
| vocabulary.txt | 34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913 |

无需付费模型或第三方转写账号。首次生成耗时取决于音频长度和本机性能，字幕生成区域会显示进度；不将节目简介拼接为逐字字幕。晨间 7:45 定时任务更新节目列表，字幕在实际收听时按需生成。
