# Transcription service（M1 可运行基线）

这里承载与前端隔离的 Python 推理和训练环境。当前已经提供零额外服务框架依赖的 PCM WAV 分析 API：

```json
POST /v1/transcriptions
Content-Type: audio/wav

<raw WAV bytes>
```

响应返回音符事件、和弦时间轴及每项置信度。当前 `sonora-dsp-v0.2` 用 FFT 自相关估计单音音高，用 chroma 与 24 个大小调模板估计和弦。它的作用是建立可解释、可评测的端到端基线，不冒充最终模型。

若 `transcription/models/timbre-pitch-v0.1.npz` 存在，API 还会返回钢琴/小提琴主乐器类别及置信度。

## 启动

建议创建 Python 3.11 或 3.12 虚拟环境：

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e transcription
.venv/Scripts/python -m sonora_analysis.server
```

随后另开终端运行前端：

```bash
npm run dev
```

Vite 会把 `/api` 请求代理到 `127.0.0.1:8765`。也可以直接运行 CLI：

```bash
python -m sonora_analysis song.wav --pretty
```

测试：

```bash
python -m unittest discover -s transcription/tests
```

## 单音模型训练与真实样本评测

下载经过审核的八条 Iowa 样本（钢琴/小提琴各四条，C4/E4/G4/A4）。音频进入忽略的本地缓存，仓库只保留 URL、标签、大小和 SHA-256：

```bash
python -m sonora_analysis.samples
```

把原始 AIFF 转为浏览器使用的 22.05 kHz/16-bit 单声道 WAV：

```bash
python -m sonora_analysis.prepare_web_samples
```

重新生成 C4–B4、钢琴/小提琴双任务模型：

```bash
python -m sonora_analysis.train
```

在真实样本上执行域外 smoke test：

```bash
python -m sonora_analysis.evaluate --output transcription/reports/uiowa-smoke-v0.1.json
```

已提交的 v0.1 结果：

- 合成测试：96 条未见变体，乐器 accuracy / macro-F1 / 音高 accuracy 均为 1.0。
- Iowa 测试：8 条真实钢琴/小提琴样本，乐器 accuracy 0.875、macro-F1 0.873，音高 accuracy 1.0。小提琴 G4 被误判为钢琴。

第二项仍是单一来源、小规模 smoke test，只证明真实数据链路打通，不能用于声称模型已经泛化。限制和适用范围见 [`models/MODEL_CARD.md`](models/MODEL_CARD.md)。

## 连续旋律与和弦基准

```bash
python -m sonora_analysis.benchmark
```

`sequence-chord-baseline-v0.2.json` 当前覆盖：

- 钢琴/小提琴各 16 条连续旋律，共 256 个音符；
- pitch+onset F1 0.9942，note-with-offset F1 0.9903；
- 平均起音误差 27.2ms，平均结束误差 43.8ms；
- 24 类大小三和弦、72 个独立样本准确率 1.0；
- 6 条和弦进行、48 个和弦节点准确率 1.0。

这些仍是代码生成的受控数据，主要用于阻止计时、半音分段和颤音处理回归。下一步必须加入真实旋律与真实和弦录音。

此外，评测脚本会用八条 Iowa 单音录音拼接 12 条未见连续旋律（96 个音符）。当前真实拼接 smoke 的 pitch+onset F1 和 note-with-offset F1 均为 0.9688；钢琴为 1.0，小提琴为 0.9375。它比纯合成序列更接近真实音色，但仍不等价于自然演奏录音。

## 后续模型后端

Spotify Basic Pitch 0.4.0 的官方环境列表截至目前仍为 Python 3.7–3.11。项目将为它保留独立的 Python 3.11 环境，并让它实现同一份 JSON 协议；浏览器无需知道底层是 DSP 基线还是神经网络。

模型训练按以下顺序推进：

1. 生成带标签的 MIDI 单音并渲染多个音色、力度、混响与噪声版本。
2. 加入真实钢琴逐音样本作域外评测，而不是混入训练后自我验证。
3. 从单音扩展到旋律，再扩展到同时发声的和弦。
4. 固定 train/validation/test 的“曲目级”切分，防止同一首曲子的片段泄漏。

不要在前端依赖中安装 TensorFlow，也不要把用户上传的音频默认写入训练集。
