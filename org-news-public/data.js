window.ORG_DATA = {
  curatedAt: "2026-11-03",
  categories: ["全部", "组织架构", "组织形态", "人才结构", "人才标准", "运营模式", "技术创新", "组织文化"],
  companies: [
    {name:"Microsoft",initial:"M",region:"美国",focus:"人机协作 · 工作方式 · AI 平台",url:"https://blogs.microsoft.com/",feed:"microsoft"},
    {name:"Anthropic",initial:"A",region:"美国",focus:"人才培养 · AI 原生工作 · 安全研究",url:"https://www.anthropic.com/news"},
    {name:"Amazon",initial:"a",region:"美国",focus:"组织层级 · 人才结构 · 经营文化",url:"https://www.aboutamazon.com/"},
    {name:"阿里巴巴",initial:"阿",region:"中国",focus:"AI 组织整合 · 云与模型 · 企业应用",url:"https://www.alibabacloud.com/en/press-room"},
    {name:"腾讯",initial:"腾",region:"中国",focus:"项目组织 · 业务协作 · 人才发展",url:"https://www.tencent.com/zh-cn/articles.html"},
    {name:"Google",initial:"G",region:"美国",focus:"技术创新 · AI 研究 · 产品协同",url:"https://blog.google/",feed:"google"},
    {name:"OpenAI",initial:"O",region:"美国",focus:"模型研究 · 企业应用 · AI 治理",url:"https://openai.com/news/",feed:"openai"},
    {name:"Meta",initial:"m",region:"美国",focus:"AI 研发 · 开源生态 · 产品创新",url:"https://about.fb.com/news/",feed:"meta"}
  ],
  collections: [
    {id:"human-ai",title:"当 AI 成为同事",description:"从工程师的真实工作变化，到企业人才培养与人机分工，理解 AI 如何进入组织。",ids:["anthropic-academy-2026","ms-wti-2026","anthropic-work-2025"]},
    {id:"org-design",title:"组织为什么重新划界",description:"比较模型、产品、平台团队的组织方式，观察协作边界与决策权的变化。",ids:["ms-copilot-2026","alibaba-ath-2026","tencent-project-2026"]},
    {id:"culture-action",title:"从文化口号到管理动作",description:"把 CEO 的公开表述与后续组织行动放在一起，追踪人才结构与经营方式。",ids:["amazon-ai-2025","amazon-workforce-2025","ms-frontier-2026"]}
  ],
  articles: [
    {
      id:"ms-frontier-2026",company:"Microsoft",date:"2026-10-27",eventDate:"2026-10-27",type:"官方观点",categories:["运营模式","技术创新"],title:"微软：AI 转型应从业务结果出发，连接人、组织知识与智能体治理",
      summary:"微软商业业务负责人提出以业务结果为起点的转型路径，将 Copilot、组织知识平台与智能体治理连接起来，并介绍企业应用案例。",
      points:["将 human ambition、intelligence 与 trust 作为转型的三个支撑要素。","把 AI 嵌入业务流程，同时强调对智能体的管理、可观察性与安全控制。","文章以企业客户案例说明应用方向，属于厂商对自身平台与客户实践的介绍。"],
      takeaway:"可以沿着“希望改善什么结果—需要什么上下文—谁负责验收”阅读案例，把工具能力与工作方式分开分析。",
      question:"我们正在采用的 AI 工具，改变了哪个具体工作环节？如何判断它真正创造了价值？",
      caveat:"这是微软的观点与客户案例汇总。案例中的成效不应直接外推到所有企业，也不代表独立因果评估。",
      source:"Microsoft 官方博客",sourceTitle:"The platform approach to becoming Frontier",url:"https://blogs.microsoft.com/blog/2026/10/27/the-platform-approach-to-becoming-frontier/"
    },
    {
      id:"anthropic-academy-2026",company:"Anthropic",date:"2026-10-02",eventDate:"2026-10-02",type:"官方公告",categories:["人才标准","人才结构"],title:"Anthropic 推出 Frontier Academy：围绕真实业务项目培养 AI 工程人才",
      summary:"Anthropic 宣布投入 1 亿美元，计划到 2027 年底培养 1 万名 Frontier Deployed Engineers。培训围绕真实企业项目和实践考核展开。",
      points:["候选者需具备软件工程基础、LLM 实践、帮助他人采用 AI 的经验，以及解决业务问题的主动性。","计划将集中训练、模拟企业部署与 12 周的真实项目实践连接起来。","通过实践考核后授予相应认证，参与方式为组织提名。"],
      takeaway:"人才标准正在把技术基础、业务理解与落地能力放在同一张评价表里。学习设计也可以围绕真实项目与可检验结果展开。",
      question:"团队培养 AI 能力时，是否每个人都带着一个真实问题，并有清晰的成果验收方式？",
      caveat:"培训投入与人数是公告中的承诺和目标，不能视作已经完成的结果；认证也不等同于组织转型成效。",
      source:"Anthropic 官方",sourceTitle:"Anthropic invests $100 million to train 10,000 engineers and tackle the enterprise AI talent gap",url:"https://www.anthropic.com/news/claude-frontier-academy"
    },
    {
      id:"alibaba-ath-2026",company:"阿里巴巴",date:"2026-06-30",eventDate:"2026-03",type:"官方披露",categories:["组织架构","技术创新"],title:"阿里巴巴披露 ATH 事业群整合：将核心 AI 团队与产品纳入统一组织",
      summary:"阿里云在半年进展公告中回顾：阿里巴巴于 3 月成立由 CEO 吴泳铭领导的 Alibaba Token Hub 事业群，整合通义实验室、MaaS、千问、悟空与 AI 创新业务。",
      points:["组织整合围绕创造、交付和应用 token 的共同任务展开。","基础模型、模型服务与应用团队被放在同一事业群之下。","该信息来自 6 月 30 日发布的阶段回顾，相关组织事件发生于 3 月。"],
      takeaway:"可以观察基础能力与业务应用如何共享目标，以及组织整合是否进一步改变产品协作和资源分配。",
      question:"把相关团队放进同一组织后，哪些跨团队决策应当变得更清晰？",
      caveat:"公告确认组织整合的公开表述，但未单独量化组织调整带来的效率变化。",
      source:"阿里云新闻中心",sourceTitle:"Alibaba Positions for Accelerated AI Growth in Second Half of 2026",url:"https://www.alibabacloud.com/en/press-room/alibaba-positions-for-accelerated-ai-growth-in-sec"
    },
    {
      id:"tencent-project-2026",company:"腾讯",date:"2026-05-22",eventDate:"2026-05",type:"媒体报道",categories:["组织形态","组织架构"],title:"媒体观察：腾讯部分团队试行项目负责制，管理角色随业务任务调整",
      summary:"《中国企业家》报道，腾讯微信事业群部分部门正在试行项目负责制，将固定分组与管理头衔转向围绕项目组织工作。报道也呈现了员工对实际变化的不同看法。",
      points:["报道引述多位在职、离职员工，描述部分部门的项目组织尝试。","讨论重点包括项目责任、汇报层级与结果导向。","报道同时记录了“头衔变化是否等于权力变化”的质疑，尚不能据此判断全公司范围的效果。"],
      takeaway:"读组织调整时，不只看组织图和岗位名称，还要追问授权、资源与责任是否一起变化。",
      question:"如果把组长改称项目负责人，哪些决策权必须同步调整才有意义？",
      caveat:"单一媒体报道，经中国经济网转载；不是腾讯官方确认，不应泛化为全集团已统一执行。",
      source:"中国企业家／中国经济网转载",sourceTitle:"腾讯正在“消灭”小组长",url:"https://www.ce.cn/xwzx/gnsz/gdxw/202605/t20260522_2982969.shtml"
    },
    {
      id:"ms-wti-2026",company:"Microsoft",date:"2026-05-05",eventDate:"2026-05-05",type:"研究报告",categories:["运营模式","组织文化","人才标准"],title:"2026 工作趋势报告：员工的 AI 能力，需要组织制度接得住",
      summary:"微软 Work Trend Index 将关注点放在个人 AI 能力与组织准备度之间的差距，强调管理支持、评价方式、激励机制与持续学习的重要性。",
      points:["报告讨论员工能力与组织支持之间的不匹配，提出重新设计工作方式。","把人类判断、质量控制和目标设定视为人机协作的重要能力。","提出将实践中的反馈沉淀成组织知识，让企业形成持续学习的系统。"],
      takeaway:"团队的 AI 学习可以同时检查工具使用、经理示范、质量标准和激励，而非只看培训参与情况。",
      question:"团队成员学会使用 AI 后，现有目标、权限或流程是否允许他们真正改变工作？",
      caveat:"报告包含厂商研究与自报问卷，相关性不能直接证明因果；其中部分样本限定为已经在工作中使用 AI 的人。",
      source:"Microsoft WorkLab",sourceTitle:"Agents, human agency, and the opportunity for every organization",url:"https://www.microsoft.com/en-us/worklab/work-trend-index/agents-human-agency-and-the-opportunity-for-every-organization"
    },
    {
      id:"ms-copilot-2026",company:"Microsoft",date:"2026-03-17",eventDate:"2026-03-17",type:"官方公告",categories:["组织架构","组织形态"],title:"微软统一消费与商业 Copilot 组织，强化产品、平台与模型协同",
      summary:"微软公布 Copilot 领导与组织调整，将消费端和商业端 Copilot 作为统一工作推进；Jacob Andreou 负责体验，Mustafa Suleyman 聚焦超级智能与模型工作。",
      points:["统一工作覆盖 Copilot 体验、平台、Microsoft 365 应用与 AI 模型。","Jacob Andreou 负责设计、产品、增长与工程，向 Satya Nadella 汇报。","通过 Copilot 领导团队协调模型、产品和基础设施，组织边界与产品系统形态相对应。"],
      takeaway:"观察组织设计如何映射产品体系：哪些能力统一建设，哪些职责需要明确分工。",
      question:"我们的组织边界是在支持完整的用户体验，还是制造了额外的交接？",
      caveat:"公告能确认调整方案与职责表述，实际协同效果需后续证据验证。",
      source:"Microsoft 官方博客",sourceTitle:"Announcing Copilot leadership update",url:"https://blogs.microsoft.com/blog/2026/03/17/announcing-copilot-leadership-update/"
    },
    {
      id:"anthropic-work-2025",company:"Anthropic",date:"2025-12-02",eventDate:"2025-08",type:"内部研究",categories:["组织形态","人才标准","组织文化"],title:"Anthropic 内部研究：工程师能力边界扩大，也开始担心技能与协作流失",
      summary:"Anthropic 对内部工程师和研究人员的调查与访谈发现，AI 帮助员工跨越原有专业边界，同时带来了技术深度、指导关系与同事协作的挑战。",
      points:["研究包含 132 名工程师和研究人员的调查、53 次深入访谈，以及 Claude Code 使用数据。","一些员工能承担原本不熟悉的工作，但担心缺少练习会削弱深入判断能力。","部分受访者表示，过去向同事请教的问题现在先交给 AI，可能减少指导和交流机会。"],
      takeaway:"提效之外，团队还需要主动保留知识传递、同行讨论和独立判断的机会。",
      question:"哪些工作可以交给 AI？哪些练习、交流与复盘值得刻意保留下来？",
      caveat:"2025 年的单公司内部研究，自报结果存在偏差；不能当作当下所有岗位的普遍效果。",
      source:"Anthropic 研究团队",sourceTitle:"How AI is transforming work at Anthropic",url:"https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic"
    },
    {
      id:"amazon-workforce-2025",company:"Amazon",date:"2025-10-28",eventDate:"2025-10-28",type:"官方公告",categories:["人才结构","组织架构","组织文化"],title:"亚马逊公布企业岗位调整，将减少层级与增加责任归属列为方向",
      summary:"亚马逊公开员工信称，企业岗位将净减少约 1.4 万个，同时继续在战略领域招聘；公司将其解释为减少官僚流程、压缩层级和重新配置资源。",
      points:["调整包含部分领域缩减与其他领域招聘，不能简单等同于停止招聘。","公司将速度、责任归属与更精简的组织结构作为主要解释。","公告同时说明内部转岗与离职支持安排，影响因岗位和地区而异。"],
      takeaway:"分析人才变化时，同时观察减少了哪些岗位、增加了哪些能力，以及组织的责任边界是否变化。",
      question:"组织精简时，是否同步明确了保留团队的授权、工作负荷与结果责任？",
      caveat:"历史案例；人数为当时公告口径。官方对原因与效果的描述不等同于独立验证，也不能全部归因于 AI。",
      source:"About Amazon",sourceTitle:"Staying nimble and continuing to strengthen our organizations",url:"https://www.aboutamazon.com/news/company-news/amazon-workforce-reduction"
    },
    {
      id:"amazon-ai-2025",company:"Amazon",date:"2025-06-17",eventDate:"2025-06-17",type:"CEO 公开信",categories:["人才结构","组织文化","运营模式"],title:"Andy Jassy 谈生成式 AI：岗位组合将变化，员工应主动学习与实验",
      summary:"亚马逊 CEO 在公开员工信中讨论生成式 AI 与智能体，预期部分岗位需求减少、其他岗位需求增加，并鼓励员工学习工具、参加培训和重思工作方式。",
      points:["将智能体视为可在不同工作阶段协作的软件系统。","信中预计广泛使用 AI 会在未来几年改变企业员工规模与岗位组合。","对员工的要求包括保持好奇、学习、实验，以及围绕客户需求重新设计工作。"],
      takeaway:"把管理层对未来的判断与实际发生的变化分开记录，再持续跟踪后续组织动作。",
      question:"我们是否为员工的 AI 学习提供了时间、真实任务和反馈，而不只是提出要求？",
      caveat:"2025 年公开信中的前瞻判断，不是已实现结果；应结合后续事实持续复核。",
      source:"About Amazon",sourceTitle:"Message from CEO Andy Jassy: Some thoughts on Generative AI",url:"https://www.aboutamazon.com/news/company-news/amazon-ceo-andy-jassy-on-generative-ai"
    }
  ]
};
