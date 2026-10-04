# 声源与转录调研记录

## 首选声源

- University of Iowa Musical Instrument Samples：覆盖钢琴、小提琴、管弦与打击乐；官方页面说明可无条件用于项目。接入前仍需保留逐文件来源记录。
- 浏览器 MVP：Tone.js `Sampler` 支持用少量定音样本补齐音域；当前先用合成音色，避免把未审查许可的大文件提交到仓库。

首批域外评测覆盖 C4/E4/G4/A4：Steinway Model B 的 mf 钢琴与 2012 小提琴 arco sul G 各四条。八条样本的 URL、字节数和 SHA-256 已写入 `assets/samples/manifest.json`，原始文件只进入忽略的缓存；其中 A4 被转换为浏览器回放音色。

## 转录基线

- Spotify Basic Pitch：Apache-2.0/GPL 双许可的轻量级、乐器无关复音转录模型，输入音频后可输出 MIDI 与音符事件。它更适合单一乐器，因此完整歌曲需要先做源分离。
- Magenta Onsets and Frames：把 onset 检测与持续帧检测拆开，适合作为后续钢琴专用训练架构参考。

## 数据治理

- 只使用明确允许研究/再分发的音频；“网上能下载”不等于能训练或再发布。
- 原始歌曲默认只在用户设备或临时任务中处理，不进入训练集。
- 每个数据集记录：来源 URL、许可证版本、用途限制、下载时间、SHA-256、切分策略。
- 合成训练与 Iowa 真实样本必须分开报告，禁止把八条 smoke 样本描述为完整测试集。
