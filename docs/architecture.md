# 技术架构与里程碑

## 产品闭环

```text
音频上传 → 预处理/分离 → 音高与起音检测 → MIDI 事件
                                           ↓
谱面编辑 ← 五线谱/简谱渲染 ← 节拍量化/和弦标注
   ↓
采样器或合成器回放 → 用户修订 → 经授权的数据闭环
```

`NoteEvent` 是系统核心中间格式，当前包含 MIDI 音高、时值和力度。后续会增加 onset、offset、置信度、bend、source instrument 和 provenance。

## 为什么不立即从零训练

首要风险不是“模型能否跑”，而是混音里的源分离、节拍量化、同类弦乐声部归属，以及能否让用户高效修正。因此第一版以现成、许可清楚的 Basic Pitch 建立转录基线，把研发投入放在可编辑结果和评测集上。数据积累后，再用 Onsets and Frames 类架构微调钢琴专用模型。

## 里程碑

### M0：创作台（当前）

- [x] 音符、五线谱、简谱统一映射
- [x] 钢琴/小提琴双音轨与合成回放
- [x] 基础节拍与音符时值
- [x] MIDI 导入导出
- [x] 本地工程持久化
- [x] 接入 Iowa 钢琴/小提琴采样音色并记录来源、校验和与声明

### M1：钢琴单音与旋律

- [x] 音频上传和波形预览
- [x] 可运行的单音/和弦 DSP 基线 API
- [x] C4–B4 钢琴/小提琴单音 smoke 模型与可复现训练
- [x] 八条 Iowa 真实录音的最小域外评测
- Basic Pitch 推理 API，返回标准化 NoteEvent
- 扩展 University of Iowa 真实评测覆盖音域、力度和演奏法
- 指标：pitch accuracy、instrument macro-F1、onset F1、note-with-offset F1

### M2：和弦与钢琴复音

- 12 维 chroma 基线和 24 个大小调三和弦模板
- Basic Pitch 多音高事件聚类成和弦标签
- MAESTRO/MAPS 等数据集的许可审查与离线评测

### M3：多乐器歌曲

- Demucs 类源分离作为独立可替换服务
- 乐器分类 + 分 stem 转录
- 对同类弦乐声部保留“不确定/待人工分配”，不伪造确定性

## 服务边界

- `src/`：浏览器创作台与后续审谱界面。
- `transcription/`：Python 推理/训练环境，不与前端 Node 依赖混装。
- `assets/samples/`：只存 manifest 和小型、许可允许的资源；大样本用下载脚本与缓存。
