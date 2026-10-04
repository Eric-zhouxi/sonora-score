# Transcription service（M1 可运行基线）

这里承载与前端隔离的 Python 推理和训练环境。当前已经提供零额外服务框架依赖的 PCM WAV 分析 API：

```json
POST /v1/transcriptions
Content-Type: audio/wav

<raw WAV bytes>
```

响应返回音符事件、和弦时间轴及每项置信度。当前 `sonora-dsp-v0.1` 用 FFT 自相关估计单音音高，用 chroma 与 24 个大小调模板估计和弦。它的作用是建立可解释、可评测的端到端基线，不冒充最终模型。

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

## 后续模型后端

Spotify Basic Pitch 0.4.0 的官方环境列表截至目前仍为 Python 3.7–3.11。项目将为它保留独立的 Python 3.11 环境，并让它实现同一份 JSON 协议；浏览器无需知道底层是 DSP 基线还是神经网络。

模型训练按以下顺序推进：

1. 生成带标签的 MIDI 单音并渲染多个音色、力度、混响与噪声版本。
2. 加入真实钢琴逐音样本作域外评测，而不是混入训练后自我验证。
3. 从单音扩展到旋律，再扩展到同时发声的和弦。
4. 固定 train/validation/test 的“曲目级”切分，防止同一首曲子的片段泄漏。

不要在前端依赖中安装 TensorFlow，也不要把用户上传的音频默认写入训练集。
