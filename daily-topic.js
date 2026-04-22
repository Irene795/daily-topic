const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 创建保存目录
const saveDir = './reports';
if (!fs.existsSync(saveDir)) {
  fs.mkdirSync(saveDir, { recursive: true });
}

// 获取今天日期
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const fileName = `选题-${dateStr}.txt`;
const filePath = path.join(saveDir, fileName);

async function scrapeWeiboHot() {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let hotList = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('访问微博热搜页面...');
    await page.goto('https://s.weibo.com/top/summary', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('等待页面加载...');
    await page.waitForSelector('#pl_top_realtimehot', { timeout: 15000 }).catch(() => {});

    hotList = await page.evaluate(() => {
      const selectors = [
        '#pl_top_realtimehot table tbody tr',
        '.list-a table tbody tr',
        '#pl_top_realtimehot .td-02 a',
        '.data table tbody tr'
      ];

      let items = [];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, index) => {
            const link = el.querySelector('a');
            const rankEl = el.querySelector('.td-01');
            const hotEl = el.querySelector('.td-02 span') || el.querySelector('span');

            if (link && link.textContent.trim()) {
              const title = link.textContent.trim();
              const href = link.href;
              const rank = rankEl ? rankEl.textContent.trim() : (index + 1).toString();
              const hot = hotEl ? hotEl.textContent.trim() : '';

              if (title && !title.includes('首页') && rank !== '•') {
                items.push({
                  rank: parseInt(rank) || index + 1,
                  title: title,
                  hot: hot,
                  url: href
                });
              }
            }
          });
          break;
        }
      }

      return items.filter(item => item.rank > 0).sort((a, b) => a.rank - b.rank);
    });

  } catch (error) {
    console.error('抓取错误:', error.message);
  } finally {
    await browser.close();
  }

  return hotList;
}

function analyzeTopicValue(hotList) {
  const highValueKeywords = [
    '心理', '认知', '偏见', '效应', '行为', '决策', '信任', '焦虑',
    '恐惧', '压力', '习惯', '动机', '人性', '人际', '沟通', '关系',
    '孤独', '抑郁', '情绪', '思维', '惯性', '投射', '共情', '镜像',
    '损失厌恶', '沉没成本', '锚定', '破窗', '鸟笼', '巴纳姆', '习得性',
    '选择', '后悔', '预期', '满足', '幸福'
  ];

  const socialKeywords = [
    '老龄化', '独居', '婚姻', '家庭', '子女', '教育', '就业', '职业', '退休',
    '健康', '医疗', '养老', '理财', '消费', '投资', '房产', '经济', '收入',
    '中年', '青年', '老年', '父母', '孩子', '传承', '遗产', '保障',
    '储蓄', '负债', '财务', '风险', '安全感'
  ];

  const newsValueKeywords = [
    '研究', '调查', '报告', '数据', '发现', '趋势', '分析',
    '政策', '新规', '改革', '调整', '专家', '学者'
  ];

  const alreadyWrittenKeywords = [
    '同理心', '共情', '情感账户', '心理投射', '乐观偏差', '破窗效应',
    '鸟笼效应', '巴纳姆效应', '损失厌恶', '损失', '收益',
    '取舍', '选择越多', '说服力', '人格魅力', '框架效应',
    '独居', '孤独经济', '数字游民', '财务斩杀线',
    '耐心资本', '情价比', '正念', '情绪绑架', '信息差',
    '客户画像', '读空气', '沟通最高境界', '语言', '输出',
    '输入', '慢下来', '烟火气', '爱在当下', '3秒停顿',
    '张雪峰', '明星配音', '山姆', '外卖商战'
  ];

  const excludeKeywords = [
    '明星', '恋情', '分手', '绯闻', '综艺', '偶像', '粉丝', '追星',
    '出轨', '丑闻', '八卦', '吃瓜', '塌房', '翻车', '吐槽', '骂',
    '结婚', '离婚', '官宣', '恋爱', '男友', '女友', '老公', '老婆',
    '演员', '歌手', '艺人', '导演', '主持人', '网红', '博主',
    '剧集', '电影', '综艺', '演出', '演唱会', '首映', '开机', '杀青',
    '肖战', '李现', '杨紫', '沈月', '边伯贤', '谢娜', '张杰', '孟子义',
    '浪姐', '十日终焉', '种地吧', '楚乔传', '胡先煦', '毛晓慧', '李晟',
    '金子涵', '马頔', '李纯', '樊振东', '黄子韬', '罗永浩', '张维伊',
    '造型', '照片', '拍立得', '大波浪', '红唇', '化妆', '穿搭',
    '体重', '减肥', '健身', '身材', '颜值',
    '习近平', '会见', '外交', '蓝皮书', '降级', '中方回应', '伊朗',
    '巴基斯坦', '美国男子', '美方', '迫害', '学生学者', '最高领袖', '声明',
    '泄密', '闭门', '沟通会', '销量', '华为', '苹果', '奥迪', '奔驰',
    '小米', '冰激凌', '冰淇淋', '食堂',
    '男子', '女子', '丈夫', '妻子', '杀害', '骗保', '溺水',
    '举报', '涉黄', '浴场', '技师', '猥亵', '眼科', '院长'
  ];

  const analysis = {
    hotTopics: [],
    highValueTopics: [],
    socialTopics: [],
    newsTopics: [],
    recommended: []
  };

  hotList.forEach(item => {
    const title = item.title;
    const shouldExclude = excludeKeywords.some(k => title.includes(k));
    const alreadyWritten = alreadyWrittenKeywords.some(k => title.includes(k));

    if (shouldExclude) return;
    if (alreadyWritten) return;

    const hasHighValue = highValueKeywords.some(k => title.includes(k));
    const hasSocial = socialKeywords.some(k => title.includes(k));
    const hasNewsValue = newsValueKeywords.some(k => title.includes(k));

    if (hasHighValue) {
      analysis.highValueTopics.push(item);
    }
    if (hasSocial && !hasHighValue) {
      analysis.socialTopics.push(item);
    }
    if (hasNewsValue && item.hot && parseInt(item.hot) > 50000) {
      analysis.newsTopics.push(item);
    }
    if (item.rank <= 30 && !shouldExclude && !alreadyWritten) {
      analysis.hotTopics.push(item);
    }
  });

  analysis.recommended = [
    ...analysis.highValueTopics.slice(0, 4),
    ...analysis.socialTopics.slice(0, 3),
    ...analysis.newsTopics.slice(0, 2)
  ].slice(0, 6);

  return analysis;
}

function generateReport(hotList, analysis) {
  const report = [];

  report.push('='.repeat(60));
  report.push(`高研新知每日选题报告 - ${dateStr}`);
  report.push('='.repeat(60));
  report.push('');

  report.push('【今日推荐选题】（有新知解读价值）');
  report.push('-'.repeat(40));
  if (analysis.recommended.length > 0) {
    analysis.recommended.forEach((item, i) => {
      report.push(`${i + 1}. ${item.title}`);
      report.push(`   热度: ${item.hot || '未知'} | 排名: ${item.rank}`);
      report.push(`   链接: ${item.url}`);
      report.push('');
    });
  } else {
    report.push('今日热搜无合适选题，建议使用备选选题库');
    report.push('');
  }

  report.push('【心理学/认知科学选题】');
  report.push('-'.repeat(40));
  if (analysis.highValueTopics.length > 0) {
    analysis.highValueTopics.forEach(item => {
      report.push(`• ${item.title} (${item.hot || '未知'})`);
    });
  } else {
    report.push('今日热搜暂无相关选题');
  }
  report.push('');

  report.push('【社会现象/家庭选题】');
  report.push('-'.repeat(40));
  if (analysis.socialTopics.length > 0) {
    analysis.socialTopics.forEach(item => {
      report.push(`• ${item.title} (${item.hot || '未知'})`);
    });
  } else {
    report.push('今日热搜暂无相关选题');
  }
  report.push('');

  report.push('【有解读价值的新闻】');
  report.push('-'.repeat(40));
  if (analysis.newsTopics.length > 0) {
    analysis.newsTopics.forEach(item => {
      report.push(`• ${item.title} (${item.hot || '未知'})`);
    });
  } else {
    report.push('今日热搜暂无相关选题');
  }
  report.push('');

  report.push('【微博热搜榜单】（已过滤娱乐八卦）');
  report.push('-'.repeat(40));
  const filteredHotList = hotList.filter(item => {
    const excludeKeywords = ['明星', '剧集', '电影', '综艺', '演出', '演唱会'];
    return !excludeKeywords.some(k => item.title.includes(k));
  });
  filteredHotList.slice(0, 30).forEach(item => {
    report.push(`${item.rank}. ${item.title} ${item.hot ? `(${item.hot})` : ''}`);
  });
  report.push('');

  // 轮换备选选题
  const psychologyPool = [
    '习得性无助：客户"放弃抵抗"的背后，如何帮他重建信心？',
    '锚定效应：报价技巧——让客户觉得"划算"的心理学',
    '确认偏误：客户只看支持自己观点的信息，如何破局？',
    '沉没成本：客户"不舍得"退掉不好的产品怎么办？',
    '镜像神经元：同理心是天赋还是可以练习的能力？',
    '熵增定律：为什么客户的生活越来越乱，保障越来越重要？',
    '认知失调：客户买了之后为什么会有"后悔感"？',
    '互惠原理：为什么"先付出"能换来信任？',
    '社会认同：客户为什么更容易相信"别人也买了"？',
    '权威效应：如何用专业身份建立信任？',
    '稀缺性原理：为什么"限时"能推动决策？',
    '后悔预期：客户为什么迟迟不签单？',
    '峰终定律：客户对服务的印象，取决于"峰值"和"终点"',
    '首因效应：第一次见面，如何让客户记住你？',
    '近因效应：最后一次沟通，决定了客户的印象',
    '自我参照效应：为什么客户更关心"跟我有关"的事？',
    '启发式判断：客户为什么凭"直觉"做决定？',
    '心理账户：客户为什么对不同钱有不同态度？',
    '参照点效应：客户的"心理价位"从哪来？'
  ];

  const socialPool = [
    '老龄化焦虑：如何和客户聊"养老"而不让他抗拒？',
    '中年危机：40岁客户的真实担忧是什么？',
    '教育焦虑：父母为孩子买保险背后的心理',
    '二孩家庭：多子女家庭的保障优先级怎么排？',
    '离婚率上升：婚姻变动后的保障如何调整？',
    '财务焦虑：中产家庭的隐形压力',
    '代际养老：独生子女的养老困境',
    '职场焦虑：不稳定工作带来的保障需求',
    '房产焦虑：房贷压力下的保障缺口',
    '健康焦虑：体检报告引发的保险意识',
    '婚姻焦虑：婚前保障规划怎么聊？',
    '育儿焦虑：新手父母的安全感需求'
  ];

  const careerPool = [
    '复盘能力：如何从每次面谈中学到东西？',
    '抗挫折力：业绩低谷时如何调整心态？',
    '时间管理：高效顾问的一天怎么安排？',
    '学习曲线：新顾问如何快速成长？',
    '人脉经营：转介绍从哪里来？',
    '自我激励：如何保持长期热情？',
    '专注力：如何在一个领域深耕？',
    '执行力：想法到行动的距离怎么缩短？',
    '谈判能力：如何在僵局中找到突破口？',
    '提问能力：好问题比好答案更重要',
    '倾听能力：真正听见客户说什么',
    '故事力：如何用故事打动客户？'
  ];

  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const psyStart = (dayOfYear * 4) % psychologyPool.length;
  const socialStart = (dayOfYear * 3) % socialPool.length;
  const careerStart = (dayOfYear * 3) % careerPool.length;

  const todayPsychology = [];
  for (let i = 0; i < 4; i++) {
    todayPsychology.push(psychologyPool[(psyStart + i) % psychologyPool.length]);
  }
  const todaySocial = [];
  for (let i = 0; i < 3; i++) {
    todaySocial.push(socialPool[(socialStart + i) % socialPool.length]);
  }
  const todayCareer = [];
  for (let i = 0; i < 3; i++) {
    todayCareer.push(careerPool[(careerStart + i) % careerPool.length]);
  }

  report.push('');
  report.push('【备选选题库】（尚未写过，每天轮换推荐）');
  report.push('-'.repeat(40));
  report.push('');
  report.push(`>>> 今日心理学选题推荐（第${Math.ceil(dayOfYear / 5) + 1}轮）：`);
  report.push('');
  todayPsychology.forEach(item => report.push(`• ${item}`));
  report.push('');
  report.push('>>> 今日社会现象推荐：');
  report.push('');
  todaySocial.forEach(item => report.push(`• ${item}`));
  report.push('');
  report.push('>>> 今日职业成长推荐：');
  report.push('');
  todayCareer.forEach(item => report.push(`• ${item}`));
  report.push('');
  report.push('>>> 已写过的选题（勿重复）：');
  report.push('');
  report.push('• 同理心/共情、情感账户、心理投射、乐观偏差');
  report.push('• 破窗效应、鸟笼效应、巴纳姆效应、损失厌恶、框架效应');
  report.push('• 独居经济、孤独经济、数字游民、财务斩杀线');
  report.push('• 耐心资本、信息差、正念、情价比');
  report.push('• 选择能力、沟通境界、输出力、张雪峰事件');
  report.push('');

  report.push('='.repeat(60));
  report.push('报告生成时间: ' + today.toLocaleString('zh-CN'));
  report.push('='.repeat(60));

  return report.join('\n');
}

function generateFailureReport(error) {
  const report = [];

  report.push('='.repeat(60));
  report.push(`高研新知每日选题报告 - ${dateStr}`);
  report.push('='.repeat(60));
  report.push('');
  report.push('【执行状态】❌ 失败');
  report.push('');
  report.push('【失败原因】');
  report.push(error.message);
  report.push('');
  report.push('【错误详情】');
  report.push(`错误类型: ${error.name}`);
  report.push(`错误代码: ${error.code || '无'}`);
  report.push('');
  report.push('【备选选题库】建议使用备选选题库中的选题');
  report.push('');
  report.push('='.repeat(60));
  report.push('报告生成时间: ' + today.toLocaleString('zh-CN'));
  report.push('='.repeat(60));

  return report.join('\n');
}

async function main() {
  try {
    console.log(`开始抓取 ${dateStr} 的选题数据...`);
    console.log('启动浏览器...');

    const hotList = await scrapeWeiboHot();

    if (hotList.length > 0) {
      console.log(`抓取到 ${hotList.length} 条热搜`);

      const analysis = analyzeTopicValue(hotList);
      const report = generateReport(hotList, analysis);

      fs.writeFileSync(filePath, report, 'utf8');
      console.log(`\n报告已保存到: ${filePath}`);

      console.log('\n' + '='.repeat(40));
      console.log('今日推荐选题：');
      console.log('-'.repeat(40));
      analysis.recommended.forEach((item, i) => {
        console.log(`${i + 1}. ${item.title} (${item.hot || '未知'})`);
      });
      if (analysis.recommended.length === 0) {
        console.log('建议使用备选选题库中的选题');
      }

    } else {
      console.log('抓取失败，未获取到热搜数据');

      const report = generateReport([], {
        hotTopics: [],
        highValueTopics: [],
        socialTopics: [],
        newsTopics: [],
        recommended: []
      });
      fs.writeFileSync(filePath, report, 'utf8');
      console.log(`\n备选选题报告已保存到: ${filePath}`);
    }

  } catch (error) {
    console.error('执行失败:', error.message);

    const failFilePath = path.join(saveDir, `选题-${dateStr}-失败.txt`);
    const failReport = generateFailureReport(error);

    fs.writeFileSync(failFilePath, failReport, 'utf8');
    console.log(`\n失败报告已保存到: ${failFilePath}`);
  }
}

main();