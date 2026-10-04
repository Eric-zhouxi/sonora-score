# 制谱软件交互调研与 Sonora 取舍

## 调研来源

- [MuseScore Studio：创建新乐谱](https://musescore.org/en/handbook/3/create-new-score)：从 Start Center 进入 New Score Wizard，先确定标题、乐器与基础谱面设置。
- [MuseScore Studio：编辑音符与休止符](https://handbook.musescore.org/basics/editing-notes-and-rests)：区分普通选择/编辑与音符输入；选中音符后可改音高、时值和升降号，延音线用单独命令处理。
- [Dorico Elements：工作模式](https://www.steinberg.help/r/dorico-elements/6.2/en/dorico/topics/program_concepts/program_concepts_modes_c.html)：用 Setup、Write、Play 等模式分开管理乐器/演奏者、记谱编辑和播放，而不是把所有操作压在一张谱面上。

## 应用到 Sonora 的原则

1. **先管理作品，再编辑谱面。** 启动页是作品库；样例和用户空白作品严格分开。
2. **总谱与分谱分层。** 总谱负责声部顺序和全局结构，双击声部进入分谱，减少同时显示过多控件。
3. **选择后编辑。** 谱面音符可选择；时值、升降号、延音线、延音记号、移调和删除都针对当前选择。
4. **输入状态必须可见。** 八度、时值和升/降记法放在琴键附近；切换降号调时键名同步显示为 D♭、E♭ 等。
5. **乐器与声部角色分开。** 同一乐器可以出现多个声部，前两个小提琴默认命名为第一、第二小提琴，名称仍可自由修改。
6. **结构符号自动生成。** 小节线与小节号由音符时值、拍号计算，避免用户手动维护导致拍数失效。

## 当前范围

这一版支持秒时间轴、多个独立片段、自动休止符和保留独立调号/拍号的合谱。每条音轨共享四分音符的速度基准，按自己的拍号形成小节，使用独立谱表保持实际时间一致。

[MuseScore 的局部拍号文档](https://handbook.musescore.org/notation/rhythm-meter-and-measures/time-signatures)说明其局部拍号采用与全局等长的小节。Sonora 按本项目需求保留共同的实际时间与各声部自己的小节边界，属于不同的实现取舍。

多声部同一谱表的专业排版、力度与表情术语、连音组、反复与歌词仍属于后续记谱增强项；智能扒谱则是独立的下一阶段。
