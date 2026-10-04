# Transcription service（规划中的 M1）

这里将承载与前端隔离的 Python 推理和训练环境。首个接口契约：

```json
POST /v1/transcriptions
{
  "audio": "multipart file",
  "mode": "piano | single-instrument",
  "tempoHint": 96
}
```

响应返回音符事件、估计调性/速度、和弦时间轴及每项置信度。底层第一版采用 Spotify Basic Pitch；和弦基线采用 chroma 特征与大小调模板匹配。

模型训练按以下顺序推进：

1. 生成带标签的 MIDI 单音并渲染多个音色、力度、混响与噪声版本。
2. 加入真实钢琴逐音样本作域外评测，而不是混入训练后自我验证。
3. 从单音扩展到旋律，再扩展到同时发声的和弦。
4. 固定 train/validation/test 的“曲目级”切分，防止同一首曲子的片段泄漏。

Python 服务尚未锁定环境；不要在前端依赖中安装 TensorFlow。
