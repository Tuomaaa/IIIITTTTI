// Each personality has a prototype trait vector
// Traits: hw, sw, perf, ai, proc, solo, doom, grind, chaos, debug
// Scores range roughly 0-10 after all questions

export const personalities = [
  // === EE流派 ===
  {
    code: "SOLDR",
    name: "焊神",
    emoji: "🔧",
    tagline: `手上的烫伤是勋章，松香味是香水`,
    desc: `你的双手比任何机器都精准。别人在写代码的时候你在焊0402，别人在debug的时候你在焊0201。你的手指已经对温度免疫了，烙铁尖是你身体的延伸。你可能不会写一行Python，但你能把任何电路板焊得像艺术品。实验室的焊台前永远有你的位置，因为你就住在那。`,
    proto: { hw: 10, sw: 1, perf: 6, ai: 0, proc: 2, solo: 5, doom: 2, grind: 7, chaos: 3, debug: 5 },
    color: "#D97706",
  },
  {
    code: "MOS-F",
    name: "烧管人",
    emoji: "💨",
    tagline: `这辈子烧过的MOSFET能装满一抽屉`,
    desc: `你和magic smoke有一种不可言说的缘分。每次通电都像开盲盒——有时候亮灯，有时候冒烟。你的元件消耗量是实验室之最，但你从不气馁，因为你坚信：烧管是通往真理的必经之路。你的淘宝订单里永远有MOSFET的补货。`,
    proto: { hw: 8, sw: 1, perf: 2, ai: 1, proc: 3, solo: 4, doom: 4, grind: 5, chaos: 8, debug: 3 },
    color: "#EF4444",
  },
  {
    code: "RAIL",
    name: "电源人",
    emoji: "⚡",
    tagline: `power rail炸了三次还在坚持`,
    desc: `你对电源有一种执着的信仰。每个项目你都从电源开始设计，LDO、DCDC、charge pump你如数家珍。你的PCB上电源部分永远是最漂亮的，虽然它也是最常炸的。你坚信：电源稳了，世界就稳了。然而世界好像并不想稳。`,
    proto: { hw: 9, sw: 0, perf: 7, ai: 0, proc: 2, solo: 6, doom: 3, grind: 8, chaos: 4, debug: 7 },
    color: "#FBBF24",
  },
  {
    code: "OSCI",
    name: "示波器战士",
    emoji: "📟",
    tagline: `一切问题先怪probe接触不良`,
    desc: `示波器是你的第三只眼。你看波形比看人脸还亲切，trigger设置比发型还讲究。任何bug在你眼里都是波形问题——信号完整性、地弹、串扰，你张口就来。唯一的问题是：你经常忘记自己在测什么。`,
    proto: { hw: 8, sw: 1, perf: 7, ai: 0, proc: 2, solo: 5, doom: 2, grind: 6, chaos: 3, debug: 9 },
    color: "#10B981",
  },
  {
    code: "EMI",
    name: "玄学者",
    emoji: "🌀",
    tagline: `一切bug都归因于电磁干扰`,
    desc: `在你的世界观里，所有无法解释的现象都是EMI。代码跑不通？EMI。板子发热？EMI。考试没考好？也是EMI。你是实验室里的神秘主义者，同学debug靠逻辑，你debug靠感觉。神奇的是，有时候你还真猜对了。`,
    proto: { hw: 7, sw: 1, perf: 3, ai: 1, proc: 4, solo: 5, doom: 4, grind: 4, chaos: 8, debug: 2 },
    color: "#8B5CF6",
  },
  {
    code: "BODE",
    name: "画图人",
    emoji: "📈",
    tagline: `看什么都想画Bode plot`,
    desc: `频域是你的母语。别人看世界是时域的，你看世界全是频谱。朋友说话你在心里做FFT，听音乐你在分析谐波。你的笔记本里全是Bode plot，画得比艺术生还好看。你可能社交能力一般，但你的相位裕度很充足。`,
    proto: { hw: 7, sw: 2, perf: 8, ai: 0, proc: 2, solo: 7, doom: 2, grind: 6, chaos: 1, debug: 6 },
    color: "#0EA5E9",
  },
  {
    code: "SMOKE",
    name: "冒烟者",
    emoji: "💥",
    tagline: `通电就炸，magic smoke释放了不下十次`,
    desc: `你是实验室里的爆破专家（非自愿）。每次你说"我接好了要通电了"，全实验室的人都会后退一步。你的项目log不是按版本号排序的，而是按冒烟次数排序的。但你有一个别人都没有的超能力：你对烟味已经免疫了。`,
    proto: { hw: 6, sw: 0, perf: 1, ai: 1, proc: 5, solo: 3, doom: 5, grind: 4, chaos: 10, debug: 1 },
    color: "#F97316",
  },

  // === CS流派 ===
  {
    code: "CTRL-C",
    name: "借鉴者",
    emoji: "📋",
    tagline: `项目代码90%来自GitHub`,
    desc: `你不是在写代码，你是在策展。GitHub是你的卢浮宫，Stack Overflow是你的图书馆。你的核心竞争力不是编程，而是搜索——你能在30秒内找到一段可以直接用的代码。别人叫这个抄袭，你叫它"站在巨人的肩膀上"。`,
    proto: { hw: 0, sw: 7, perf: 2, ai: 5, proc: 4, solo: 3, doom: 3, grind: 3, chaos: 5, debug: 2 },
    color: "#6366F1",
  },
  {
    code: "NULL",
    name: "空指针",
    emoji: "💀",
    tagline: `人格未初始化，运行即segfault`,
    desc: `你的人生就像一个未初始化的指针——指向哪里完全是随机的。你写的代码能跑是意外，crash才是常态。你和segfault的关系比和室友还亲密。但你有一种诡异的乐观：毕竟，NULL也是一种值嘛。`,
    proto: { hw: 1, sw: 6, perf: 1, ai: 3, proc: 5, solo: 4, doom: 6, grind: 2, chaos: 7, debug: 1 },
    color: "#475569",
  },
  {
    code: "MEMRY",
    name: "泄漏者",
    emoji: "🕳️",
    tagline: `malloc了从不free，人生也是`,
    desc: `你的代码就像你的人生——只进不出，内存只涨不跌。你malloc了从不free，new了从不delete。你的程序跑着跑着就把内存吃光了，就像你的精力跑着跑着就耗光了。Valgrind看了你的代码会直接退出。`,
    proto: { hw: 1, sw: 7, perf: 1, ai: 2, proc: 6, solo: 5, doom: 5, grind: 3, chaos: 6, debug: 2 },
    color: "#A855F7",
  },
  {
    code: "BUG-R",
    name: "造虫者",
    emoji: "🐛",
    tagline: `修一个bug造三个`,
    desc: `你是bug的创造者，代码界的潘多拉。每次你说"我修好了"，宇宙就会产生三个新bug来维持平衡。你的git log是一部恐怖小说，你的PR review是一场灾难片。但没有你，团队的测试工程师就要失业了，所以你也算有贡献。`,
    proto: { hw: 1, sw: 6, perf: 2, ai: 3, proc: 3, solo: 3, doom: 4, grind: 5, chaos: 8, debug: 3 },
    color: "#22C55E",
  },
  {
    code: "SUDO",
    name: "权限怪",
    emoji: "👑",
    tagline: `不管什么命令先加sudo`,
    desc: `在你的世界里，permission denied是不存在的。你的解决方案永远是加权限、开root、关防火墙。你的服务器安全性为零，但你的开发效率为正无穷。你可能是全校唯一一个把自己的电脑弄到需要重装系统的人，而且不止一次。`,
    proto: { hw: 1, sw: 6, perf: 1, ai: 2, proc: 3, solo: 6, doom: 2, grind: 4, chaos: 8, debug: 2 },
    color: "#DC2626",
  },
  {
    code: "STACK",
    name: "溢出者",
    emoji: "📚",
    tagline: `递归人生，没有base case`,
    desc: `你的人生是一个没有终止条件的递归——每个问题的解法都会引出新的问题，每个项目都嵌套着更多项目。你同时开着47个浏览器标签，每个都是某个rabbit hole的入口。你的stack随时会overflow，但你享受这种不断深入的过程。`,
    proto: { hw: 2, sw: 8, perf: 5, ai: 2, proc: 3, solo: 6, doom: 3, grind: 6, chaos: 5, debug: 5 },
    color: "#0891B2",
  },
  {
    code: "CSS-R",
    name: "前端美化师",
    emoji: "🎨",
    tagline: `花三小时调按钮圆角，功能没写`,
    desc: `你写代码不是为了功能，是为了美。按钮的圆角差1px你能看出来，颜色的色相偏2度你就睡不着。你的项目永远是全班最好看的，虽然后端是空的。你坚信：用户体验大于一切，哪怕这个"用户"只有你自己。`,
    proto: { hw: 0, sw: 7, perf: 8, ai: 3, proc: 5, solo: 4, doom: 2, grind: 4, chaos: 3, debug: 2 },
    color: "#EC4899",
  },

  // === CE流派 ===
  {
    code: "DEAD-LCK",
    name: "死锁者",
    emoji: "🔒",
    tagline: `永远在等综合跑完，等到怀疑人生`,
    desc: `你的人生有一半时间在等待——等综合、等仿真、等编译、等队友。你是等待的艺术家，刷手机的哲学家。进度条是你最亲密的伙伴，它走一步你的心就跳一下。你最怕的不是失败，而是进度条卡在99%不动了。`,
    proto: { hw: 5, sw: 5, perf: 4, ai: 2, proc: 4, solo: 4, doom: 6, grind: 4, chaos: 4, debug: 4 },
    color: "#64748B",
  },
  {
    code: "HACK-R",
    name: "缝合怪",
    emoji: "🧟",
    tagline: `硬件用杜邦线，软件用if-else`,
    desc: `你的作品是弗兰肯斯坦式的杰作——各种来源的代码和硬件缝合在一起，丑陋但somehow能用。你的PCB上有飞线，你的代码里有TODO，你的人生里有凑合。但你有一种本事：在deadline前把所有不可能的东西拼成一个勉强能demo的整体。`,
    proto: { hw: 5, sw: 5, perf: 1, ai: 3, proc: 4, solo: 3, doom: 3, grind: 5, chaos: 9, debug: 2 },
    color: "#84CC16",
  },
  {
    code: "DMA",
    name: "搬运工",
    emoji: "🚚",
    tagline: `自己不干活，专门调度别人干`,
    desc: `你是天生的项目经理——不写代码，不焊电路，但没有你整个团队就会瘫痪。你的核心技能是把任务从一个人搬到另一个人，把数据从一个地方搬到另一个地方。你可能什么都不精通，但你知道谁精通什么，这比什么都重要。`,
    proto: { hw: 3, sw: 3, perf: 4, ai: 2, proc: 3, solo: 0, doom: 2, grind: 5, chaos: 4, debug: 3 },
    color: "#F59E0B",
  },
  {
    code: "ISR",
    name: "中断人",
    emoji: "🔔",
    tagline: `做什么事都被打断，永远在context switch`,
    desc: `你的人生是一连串的中断请求。正在写代码——室友问你问题——中断。刚回来——手机响了——中断。终于静下来——教授发邮件——中断。你的context switch开销已经超过了实际工作时间。你不是效率低，你只是中断太多了。`,
    proto: { hw: 4, sw: 4, perf: 4, ai: 2, proc: 4, solo: 1, doom: 5, grind: 5, chaos: 5, debug: 3 },
    color: "#F43F5E",
  },
  {
    code: "BOOT",
    name: "启动者",
    emoji: "🔄",
    tagline: `项目永远在"初始化阶段"`,
    desc: `你有无数个项目，每个都在"刚开始"的阶段。你的GitHub里全是只有README的repo，你的抽屉里全是只焊了电源的PCB。你不是不想做完，你只是对"开始新项目"这件事上瘾了。每次setup一个新环境你都兴奋得不行，然后第二天就失去兴趣了。`,
    proto: { hw: 4, sw: 4, perf: 3, ai: 3, proc: 7, solo: 5, doom: 3, grind: 2, chaos: 5, debug: 2 },
    color: "#14B8A6",
  },
  {
    code: "PIPE",
    name: "流水线人",
    emoji: "🏭",
    tagline: `同时做五件事，每件都卡在stall`,
    desc: `你是多线程的化身——同时写着三门课的作业、一个个人项目和一份实习申请。你的浏览器有47个标签页，你的TODO list有200项。你的吞吐量很高但延迟也很高，因为你的pipeline永远处于半满状态。`,
    proto: { hw: 4, sw: 4, perf: 5, ai: 2, proc: 3, solo: 4, doom: 4, grind: 7, chaos: 5, debug: 4 },
    color: "#7C3AED",
  },

  // === 学术/社交流派 ===
  {
    code: "GPA-r",
    name: "卷王",
    emoji: "📖",
    tagline: `实验报告附录比正文长`,
    desc: `你的目标只有一个：满绩。你的实验报告有60页，附录里有完整的推导过程和误差分析。你的笔记比教材还详细，你的作业从不迟交。你是教授最爱的学生，也是同学最怕的曲线杀手。你可能没有社交生活，但你有漂亮的成绩单。`,
    proto: { hw: 3, sw: 3, perf: 10, ai: 1, proc: 0, solo: 5, doom: 3, grind: 9, chaos: 0, debug: 6 },
    color: "#059669",
  },
  {
    code: "GHOST",
    name: "鬼影者",
    emoji: "👻",
    tagline: `group project挂名，从不出现`,
    desc: `你是量子态的存在——不观测的时候你是否存在是未知的。group chat里你从不发言，meeting你永远在忙，但期末的时候你的名字神奇地出现在了报告上。你不是懒，你只是...存在形式比较独特。`,
    proto: { hw: 2, sw: 2, perf: 1, ai: 3, proc: 8, solo: 8, doom: 4, grind: 1, chaos: 4, debug: 1 },
    color: "#94A3B8",
  },
  {
    code: "HW-NG",
    name: "苦工",
    emoji: "⛏️",
    tagline: `组里唯一干活的那个人`,
    desc: `每个group project里都有一个你——默默扛起所有工作，帮队友debug，帮队友写报告，帮队友做PPT。你不是不会说不，你只是说完"不"之后还是会做。你的简历上应该写：擅长在不公平的环境中保持产出。`,
    proto: { hw: 4, sw: 4, perf: 5, ai: 1, proc: 1, solo: 2, doom: 5, grind: 10, chaos: 3, debug: 5 },
    color: "#B45309",
  },
  {
    code: "IDLE",
    name: "空转者",
    emoji: "♻️",
    tagline: `一学期都在while(1){}`,
    desc: `你每天都很忙，但你也不知道在忙什么。打开电脑——看看这个——刷刷那个——关上电脑——一天过去了。你的CPU占用率是100%但有效产出是0%。你不是摆烂，你是在进行一种非常高级的空转。`,
    proto: { hw: 2, sw: 2, perf: 2, ai: 3, proc: 8, solo: 5, doom: 6, grind: 0, chaos: 5, debug: 1 },
    color: "#78716C",
  },
  {
    code: "SLEEP",
    name: "睡神",
    emoji: "😴",
    tagline: `靠咖啡续命，课上秒睡`,
    desc: `你和床的关系是这个世界上最稳定的关系。上课秒睡，开会秒睡，甚至站着都能睡。你的作息是薛定谔的——同时处于熬夜和补觉的叠加态。你的身体每天都在问：为什么不让我睡觉？你的DDL每天都在回答：因为你昨天睡过了。`,
    proto: { hw: 2, sw: 2, perf: 1, ai: 2, proc: 7, solo: 4, doom: 4, grind: 1, chaos: 4, debug: 1 },
    color: "#6D28D9",
  },
  {
    code: "GOD-MD",
    name: "上帝模式",
    emoji: "✨",
    tagline: `不上课不交作业，期末A+`,
    desc: `你是传说中的存在——从不出现在课堂上，作业总是最后一秒交，但成绩永远是最高的那个。你让所有努力学习的人怀疑人生。你的秘密可能是天赋，可能是时间管理，也可能是你只是在别的地方偷偷卷但不告诉任何人。`,
    proto: { hw: 4, sw: 4, perf: 3, ai: 2, proc: 5, solo: 8, doom: 0, grind: 5, chaos: 6, debug: 7 },
    color: "#EAB308",
  },

  // === 隐藏/抽象流派 ===
  {
    code: "JAVA",
    name: "转码人",
    emoji: "🚪",
    tagline: `ECE念到大三决定转CS`,
    desc: `你曾经对硬件充满热情，直到你发现写代码的人工资更高。你的转变发生在某个深夜——当你第n次烧掉板子/等综合的时候，你打开了LeetCode。你的LinkedIn简介从"Passionate EE Student"变成了"Aspiring Software Engineer"。你还没有删掉实验室的门禁卡，但你已经很久没刷过了。`,
    proto: { hw: 2, sw: 6, perf: 4, ai: 4, proc: 4, solo: 4, doom: 7, grind: 4, chaos: 4, debug: 3 },
    color: "#EA580C",
  },
  {
    code: "PWM",
    name: "调光者",
    emoji: "💡",
    tagline: `情绪靠duty cycle调节，时高时低`,
    desc: `你的情绪不是模拟信号，是PWM——高和低之间快速切换，平均值看起来还行。周一觉得世界充满希望，周二觉得应该退学。你的朋友永远不知道今天遇到的你是高电平还是低电平。好消息是：你的平均duty cycle还是正的。`,
    proto: { hw: 4, sw: 3, perf: 4, ai: 2, proc: 4, solo: 4, doom: 7, grind: 4, chaos: 5, debug: 3 },
    color: "#E11D48",
  },
  {
    code: "VOID",
    name: "虚无者",
    emoji: "🕳️",
    tagline: `我为什么要学这个`,
    desc: `你是ECE/CS存在主义的代表。每天都在问自己：这一切有什么意义？编译通过了又怎样？板子亮了又怎样？你的精神状态就像你的函数返回值——void。你不是不聪明，你只是被虚无吞噬了。但至少你有很好的幽默感，因为笑不出来的时候你就写段子。`,
    proto: { hw: 3, sw: 3, perf: 2, ai: 3, proc: 5, solo: 6, doom: 10, grind: 2, chaos: 4, debug: 2 },
    color: "#1E293B",
  },
  {
    code: "FULL-STK",
    name: "全栈怪",
    emoji: "🎪",
    tagline: `从晶体管到前端都略懂，都不精`,
    desc: `你什么都会一点——焊电路会，写C会，搞前端也会，但每样都刚好会到能出bug的程度。你是团队里最versatile的人，也是最危险的人，因为没人知道你某个领域的知识到底有多浅。你的简历很好看，你的代码很好笑。`,
    proto: { hw: 5, sw: 5, perf: 3, ai: 3, proc: 3, solo: 3, doom: 3, grind: 5, chaos: 6, debug: 4 },
    color: "#2563EB",
  },
  {
    code: "VIBE",
    name: "vibecode大王",
    emoji: "🎵",
    tagline: `不看文档不读报错，感觉对了就是对了`,
    desc: `你写代码不靠逻辑，靠直觉。报错信息？不看。文档？不读。测试？不写。你的开发流程是：写→跑→不行→改一个字母→再跑→居然过了。你和代码之间的关系不是理解，是玄学共振。最可怕的是，有时候你的效率还真比别人高。`,
    proto: { hw: 2, sw: 5, perf: 0, ai: 5, proc: 3, solo: 4, doom: 2, grind: 3, chaos: 10, debug: 0 },
    color: "#D946EF",
  },
  {
    code: "AI-er",
    name: "AI依赖者",
    emoji: "🤖",
    tagline: `printf格式都要问ChatGPT，离开AI寸步难行`,
    desc: `你的开发环境不是VSCode，是ChatGPT的对话框。从"这行代码什么意思"到"帮我写完这个项目"，AI是你唯一的同事、导师和朋友。你的技能树上只点了一个技能：提问。好消息是：在AI时代这可能真的够用了。坏消息是：哪天AI挂了你就完了。`,
    proto: { hw: 1, sw: 4, perf: 1, ai: 10, proc: 4, solo: 3, doom: 3, grind: 2, chaos: 5, debug: 0 },
    color: "#06B6D4",
  },
];

// Manhattan distance matching
export function matchPersonality(traitScores) {
  let bestMatch = null;
  let bestDist = Infinity;

  for (const p of personalities) {
    let dist = 0;
    for (const key of Object.keys(p.proto)) {
      dist += Math.abs((traitScores[key] || 0) - p.proto[key]);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = p;
    }
  }
  return bestMatch;
}

// Calculate trait scores from answers
export function calculateTraits(answers) {
  const traits = { hw: 0, sw: 0, perf: 0, ai: 0, proc: 0, solo: 0, doom: 0, grind: 0, chaos: 0, debug: 0 };
  for (const answer of answers) {
    if (answer && answer.scores) {
      for (const [key, val] of Object.entries(answer.scores)) {
        traits[key] = (traits[key] || 0) + val;
      }
    }
  }
  return traits;
}

// Get top 3 traits for display
export function getTopTraits(traits) {
  const traitNames = {
    hw: "硬件亲和力", sw: "代码亲和力", perf: "完美主义",
    ai: "AI依赖度", proc: "拖延指数", solo: "独狼指数",
    doom: "存在危机", grind: "肝帝指数", chaos: "混沌能量", debug: "debug耐力"
  };
  return Object.entries(traits)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key, val]) => ({ key, name: traitNames[key], value: val }));
}
