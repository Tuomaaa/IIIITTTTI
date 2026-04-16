// Trait axes:
// hw: hardware affinity
// sw: software affinity  
// perf: perfectionism
// ai: AI reliance
// proc: procrastination
// solo: lone wolf tendency
// doom: existential dread
// grind: work ethic
// chaos: chaos tolerance
// debug: debug patience

export const questions = [
  {
    id: 1,
    text: `只能保留一个，你选？`,
    options: [
      { text: `Stack Overflow`, scores: { sw: 2, solo: 1, debug: 1 } },
      { text: `ChatGPT`, scores: { ai: 3, chaos: 1 } },
      { text: `官方文档`, scores: { perf: 2, debug: 2 } },
      { text: `学长/学姐的网盘`, scores: { proc: 1, chaos: 1, grind: -1 } },
    ],
  },
  {
    id: 2,
    text: `世界末日了，你从实验室只能带走一样东西：`,
    options: [
      { text: `我的焊台`, scores: { hw: 3, grind: 1 } },
      { text: `我的笔记本电脑`, scores: { sw: 2, solo: 1 } },
      { text: `那卷万能的电工胶带`, scores: { hw: 1, chaos: 2 } },
      { text: `实验室的空调遥控器`, scores: { proc: 2, chaos: 1, doom: 1 } },
    ],
  },
  {
    id: 3,
    text: `如果你的教授变成了一个电子元件，ta是？`,
    options: [
      { text: `电容——平时不说话，考试突然放电`, scores: { doom: 2, hw: 1 } },
      { text: `二极管——只允许单方向沟通`, scores: { solo: 1, doom: 1 } },
      { text: `熔断器——烧一次就摆烂了`, scores: { chaos: 2, proc: 1 } },
      { text: `高频振荡器——你永远不知道ta下一秒要说什么`, scores: { chaos: 2, doom: 1 } },
    ],
  },
  {
    id: 4,
    text: `你最近一次通宵是因为？`,
    options: [
      { text: `赶due，不通宵会死的那种`, scores: { proc: 2, grind: 1 } },
      { text: `个人项目太上头停不下来`, scores: { grind: 3, solo: 1 } },
      { text: `我不通宵，熬夜伤身体`, scores: { perf: 1, proc: -1 } },
      { text: `不记得了，因为一直在通宵`, scores: { grind: 2, doom: 2 } },
    ],
  },
  {
    id: 5,
    text: `接下来一辈子不能用其中一个，你放弃哪个？`,
    options: [
      { text: `复制粘贴`, scores: { perf: 2, grind: 1 } },
      { text: `撤销键`, scores: { chaos: 3, perf: -1 } },
      { text: `AI`, scores: { perf: 2, ai: -2, debug: 2 } },
      { text: `自动补全`, scores: { chaos: 1, sw: 1 } },
    ],
  },
  {
    id: 6,
    text: `你做梦会梦见什么？`,
    options: [
      { text: `交了作业发现文件是空的`, scores: { doom: 2, proc: 1 } },
      { text: `东西突然着火/冒烟了`, scores: { hw: 2, doom: 1 } },
      { text: `deadline是昨天`, scores: { proc: 3, doom: 1 } },
      { text: `我不做梦，倒头就睡`, scores: { chaos: 1, grind: 1 } },
    ],
  },
  {
    id: 7,
    text: `朋友找你帮忙修电脑，你？`,
    options: [
      { text: `先重启试试`, scores: { chaos: 2, debug: -1 } },
      { text: `开始问一堆技术问题把人问懵`, scores: { perf: 2, debug: 2 } },
      { text: `"我又不是修电脑的"`, scores: { solo: 2, doom: 1 } },
      { text: `直接接过来，边修边叹气`, scores: { grind: 2, debug: 1 } },
    ],
  },
  {
    id: 8,
    text: `group project里队友消失了，你会？`,
    options: [
      { text: `算了自己写完，习惯了`, scores: { grind: 3, solo: 2 } },
      { text: `群里at三遍，再不回就告教授`, scores: { perf: 2, solo: -1 } },
      { text: `我就是那个消失的队友`, scores: { proc: 3, chaos: 1 } },
      { text: `无所谓，反正最后都是通宵拼出来的`, scores: { chaos: 2, doom: 1 } },
    ],
  },
  {
    id: 9,
    text: `你的桌面现在是什么状态？`,
    options: [
      { text: `混战区，但我知道每样东西在哪`, scores: { chaos: 2, hw: 1 } },
      { text: `只有电脑和一杯续命液`, scores: { sw: 1, solo: 1 } },
      { text: `干净得像没人用过`, scores: { perf: 2, proc: 1 } },
      { text: `我已经很久没看见桌面了`, scores: { grind: 1, doom: 2 } },
    ],
  },
  {
    id: 10,
    text: `如果debug是一种运动，你属于哪种选手？`,
    options: [
      { text: `短跑型——三分钟定位，快准狠`, scores: { debug: 3, sw: 1 } },
      { text: `马拉松型——一个问题追三天，不解决不睡觉`, scores: { debug: 3, grind: 2, perf: 1 } },
      { text: `观众型——等别人搞完我直接用`, scores: { proc: 2, ai: 1, solo: -1 } },
      { text: `格斗型——对着屏幕骂，骂完就好了`, scores: { chaos: 2, doom: 1 } },
    ],
  },
  {
    id: 11,
    text: `选一个当你的墓志铭：`,
    options: [
      { text: '"Segmentation fault (core dumped)"', scores: { sw: 2, doom: 1 } },
      { text: '"It works on my machine"', scores: { chaos: 2, sw: 1 } },
      { text: '"TODO: fix later"', scores: { proc: 3 } },
      { text: '"Not my fault"', scores: { solo: 1, chaos: 1, doom: 1 } },
    ],
  },
  {
    id: 12,
    text: `有人在你面前疯狂夸Python好用，你？`,
    options: [
      { text: `点头微笑，心里在想别的`, scores: { hw: 2, solo: 1 } },
      { text: `确实好用啊有什么问题吗`, scores: { sw: 1, ai: 1 } },
      { text: `开始一段长达40分钟的反驳`, scores: { perf: 2, hw: 1, sw: 1 } },
      { text: `"你开心就好"`, scores: { doom: 2, chaos: 1 } },
    ],
  },
  {
    id: 13,
    text: `如果你的作业有味道，它闻起来像？`,
    options: [
      { text: `松香味——烙铁旁边熏出来的`, scores: { hw: 3 } },
      { text: `咖啡味——熬夜熬出来的`, scores: { grind: 2, doom: 1 } },
      { text: `没有味道——AI生成的没有灵魂`, scores: { ai: 3 } },
      { text: `火药味——deadline前的绝望`, scores: { proc: 2, doom: 1 } },
    ],
  },
  {
    id: 14,
    text: `你保存文件的习惯是？`,
    options: [
      { text: '"fix"、"update"、"asdf"', scores: { chaos: 2, proc: 1 } },
      { text: `规规矩矩写清楚改了什么`, scores: { perf: 3 } },
      { text: `final_final_v3_真的最终版.zip`, scores: { chaos: 2, proc: 1, doom: 1 } },
      { text: `不保存，活在当下`, scores: { chaos: 3, doom: 1 } },
    ],
  },
  {
    id: 15,
    text: `电脑突然死机了，你的第一反应是？`,
    options: [
      { text: `拍照发群里，"又来了"`, scores: { chaos: 1, doom: 1, solo: -1 } },
      { text: `思考刚才到底哪一步搞的`, scores: { debug: 2, perf: 1 } },
      { text: `重启，不深究，能用就行`, scores: { chaos: 2, proc: 1 } },
      { text: `盯着黑屏怀疑人生30秒`, scores: { doom: 3 } },
    ],
  },
  {
    id: 16,
    text: `选一个动物代表你的工作风格：`,
    options: [
      { text: `仓鼠`, scores: { grind: 1, chaos: 1, hw: 1 } },
      { text: `猫`, scores: { chaos: 2, solo: 2 } },
      { text: `蜜蜂`, scores: { grind: 3, perf: 1 } },
      { text: `树懒`, scores: { proc: 3, doom: 1 } },
    ],
  },
  {
    id: 17,
    text: `你网购最多的东西是？`,
    options: [
      { text: `各种小零件和板子，家里快成仓库了`, scores: { hw: 3, grind: 1 } },
      { text: `键盘/外设，工具决定效率`, scores: { sw: 1, perf: 2 } },
      { text: `咖啡/零食，生产力的真正来源`, scores: { grind: 1, doom: 1 } },
      { text: `我不怎么网购`, scores: { solo: 1 } },
    ],
  },
  {
    id: 18,
    text: `deadline前48小时，你通常在干什么？`,
    options: [
      { text: `刚开始看题目`, scores: { proc: 3, chaos: 1 } },
      { text: `在做最后的优化和润色`, scores: { perf: 2, grind: 1 } },
      { text: `早就交了，在帮别人`, scores: { grind: 2, perf: 1, solo: -1 } },
      { text: `在考虑要不要直接放弃这次`, scores: { doom: 3, proc: 1 } },
    ],
  },
  {
    id: 19,
    text: `如果你是一个进程，你的状态是？`,
    options: [
      { text: `ZOMBIE`, scores: { doom: 3, proc: 1 } },
      { text: `RUNNING`, scores: { grind: 3 } },
      { text: `SLEEPING`, scores: { proc: 2, chaos: 1 } },
      { text: `BLOCKED`, scores: { doom: 1, debug: 1, solo: 1 } },
    ],
  },
  {
    id: 20,
    text: `选一个最让你血压升高的场景：`,
    options: [
      { text: `东西跑了一个小时到99%然后失败了`, scores: { debug: 1, doom: 1, hw: 1 } },
      { text: `在自己电脑上好好的，交上去全错`, scores: { sw: 2, doom: 1 } },
      { text: `队友说"我这边是好的啊"`, scores: { solo: 2, grind: 1 } },
      { text: `以上全部，我现在血压就很高`, scores: { doom: 3 } },
    ],
  },
  {
    id: 21,
    text: `有人问你"你这个专业毕业能干嘛"，你？`,
    options: [
      { text: `微笑，然后内心开始怀疑人生`, scores: { doom: 3 } },
      { text: `掏出手机展示自己做的东西`, scores: { grind: 2, hw: 1, sw: 1 } },
      { text: `反问"你觉得你手机怎么工作的"`, scores: { perf: 1, hw: 1, sw: 1 } },
      { text: `"什么都能干，也什么都不能干"`, scores: { doom: 2, chaos: 1 } },
    ],
  },
  {
    id: 22,
    text: `你的理想退休生活是？`,
    options: [
      { text: `开一个小工作室，天天做自己的东西`, scores: { hw: 2, grind: 2, solo: 1 } },
      { text: `写点东西留给后人`, scores: { sw: 2, perf: 1 } },
      { text: `远离一切电子设备，种田去`, scores: { doom: 2, chaos: 1 } },
      { text: `不会退休的，我会死在项目里`, scores: { grind: 3, doom: 1 } },
    ],
  },
  {
    id: 23,
    text: `做选择题的时候你一般？`,
    options: [
      { text: `直觉秒选，懒得多想`, scores: { chaos: 2, proc: 1 } },
      { text: `把每个选项看完再决定`, scores: { perf: 2 } },
      { text: `纠结到最后一秒才选`, scores: { doom: 1, perf: 1 } },
      { text: `选完又想改`, scores: { doom: 2, perf: 1 } },
    ],
  },
  {
    id: 24,
    text: `做东西的时候你更倾向于？`,
    options: [
      { text: `先跑起来再说，能用就是胜利`, scores: { chaos: 3, ai: 1 } },
      { text: `差不多懂了就动手`, scores: { chaos: 1, grind: 1 } },
      { text: `不理解每一行在干什么我不动手`, scores: { perf: 3, debug: 2 } },
      { text: `我不自己做，我指挥别人做`, scores: { solo: -1, proc: 1, ai: 1 } },
    ],
  },
  {
    id: 25,
    text: `你的梦中情机（电脑）是？`,
    options: [
      { text: `满配工作站，跑什么都不卡`, scores: { hw: 2, grind: 1 } },
      { text: `轻薄本就行，够用就好`, scores: { sw: 1, chaos: 1 } },
      { text: `无所谓，反正我的东西在哪都能跑（才怪）`, scores: { chaos: 2, doom: 1 } },
      { text: `越多屏幕越好，我要同时看八个窗口`, scores: { grind: 2, perf: 1 } },
    ],
  },
];
