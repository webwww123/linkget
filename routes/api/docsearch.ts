/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";

// 初始化KV数据库
const kv = await Deno.openKv();

interface DocSearchResult {
  keyword: string;
  docSites: string[];
  mainDocUrl: string | null;
  sublinks: string[];
  timestamp: number;
}

// 常见文档网站的模式
const DOC_PATTERNS = [
  { pattern: /docs?\./i, score: 10 },
  { pattern: /developer\./i, score: 8 },
  { pattern: /api\./i, score: 7 },
  { pattern: /\/docs\//i, score: 7 },
  { pattern: /\/documentation\//i, score: 7 },
  { pattern: /\/api\//i, score: 6 },
  { pattern: /\/reference\//i, score: 6 },
  { pattern: /\/guide\//i, score: 5 },
  { pattern: /\/manual\//i, score: 5 },
  { pattern: /support\./i, score: 4 },
  { pattern: /help\./i, score: 4 },
  { pattern: /wiki\./i, score: 3 },
  { pattern: /github\.io/i, score: 3 },
];

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      const { keyword, userId } = body;

      if (!keyword) {
        return Response.json(
          { error: "关键词是必需的" },
          { status: 400 }
        );
      }

      // 尝试从缓存获取
      if (userId) {
        const cachedResult = await kv.get<DocSearchResult>(["docsearch", userId, keyword]);
        if (cachedResult.value && 
            (Date.now() - cachedResult.value.timestamp < 24 * 60 * 60 * 1000)) { // 24小时缓存
          return Response.json({ success: true, ...cachedResult.value });
        }
      }

      // 开始搜索过程
      console.log(`开始搜索文档网站: ${keyword}`);
      
      // 1. 搜索可能的文档网站
      const possibleDocSites = await searchPossibleDocSites(keyword);
      
      // 2. 如果找到了可能的文档网站，选择最合适的一个
      let mainDocUrl = null;
      let sublinks: string[] = [];
      
      if (possibleDocSites.length > 0) {
        // 获取最可能是文档网站的URL
        mainDocUrl = await findBestDocSite(possibleDocSites);
        
        // 3. 如果找到主文档URL，获取其子链接
        if (mainDocUrl) {
          sublinks = await extractSublinks(mainDocUrl);
        }
      }
      
      // 构建结果
      const result: DocSearchResult = {
        keyword,
        docSites: possibleDocSites,
        mainDocUrl,
        sublinks,
        timestamp: Date.now()
      };
      
      // 缓存结果
      if (userId) {
        await kv.set(["docsearch", userId, keyword], result);
      }
      
      return Response.json({ 
        success: true,
        ...result
      });
    } catch (error) {
      console.error("文档搜索时出错:", error);
      return Response.json(
        { error: "文档搜索时出错" },
        { status: 500 }
      );
    }
  }
};

// 搜索可能的文档网站
async function searchPossibleDocSites(keyword: string): Promise<string[]> {
  try {
    // 构建搜索查询
    const searchQueries = [
      `${keyword} documentation`,
      `${keyword} docs`,
      `${keyword} developer`,
      `${keyword} api reference`
    ];
    
    const allResults = new Set<string>();
    
    // 对每个查询进行搜索
    for (const query of searchQueries) {
      try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          }
        });
        
        if (!response.ok) {
          console.warn(`搜索请求失败: ${query}, 状态码: ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        
        // 提取搜索结果中的URL
        // 简单方式：提取所有href属性
        const urlRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
        let match;
        
        while ((match = urlRegex.exec(html)) !== null) {
          const url = match[1];
          // 过滤掉不相关的搜索结果
          if (isRelevantDocSite(url, keyword)) {
            try {
              // 规范化URL
              const normalizedUrl = new URL(url).origin;
              allResults.add(normalizedUrl);
            } catch (e) {
              // 忽略无效的URL
            }
          }
        }
      } catch (e) {
        console.warn(`处理搜索查询时出错: ${query}`, e);
      }
    }
    
    // 如果通过google搜索没有找到结果，尝试直接猜测文档URL
    if (allResults.size === 0) {
      const guessedUrls = [
        `https://docs.${keyword}.com`,
        `https://${keyword}.dev`,
        `https://developer.${keyword}.com`,
        `https://docs.${keyword}.io`,
        `https://${keyword}.github.io`,
        `https://${keyword}.com/docs`
      ];
      
      for (const url of guessedUrls) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            allResults.add(url);
          }
        } catch (e) {
          // 忽略无法访问的URL
        }
      }
    }
    
    return Array.from(allResults);
  } catch (error) {
    console.error("搜索文档网站时出错:", error);
    return [];
  }
}

// 检查URL是否可能是相关的文档网站
function isRelevantDocSite(url: string, keyword: string): boolean {
  try {
    // 清理URL
    const cleanUrl = url.toLowerCase();
    
    // 首先检查URL是否包含关键词
    const keywordLower = keyword.toLowerCase();
    if (!cleanUrl.includes(keywordLower)) {
      return false;
    }
    
    // 检查URL是否匹配文档网站模式
    for (const { pattern } of DOC_PATTERNS) {
      if (pattern.test(cleanUrl)) {
        return true;
      }
    }
    
    // 排除明显的非文档网站
    const exclusionPatterns = [
      /youtube\.com/i,
      /facebook\.com/i,
      /twitter\.com/i,
      /instagram\.com/i,
      /linkedin\.com/i,
      /google\.com\/search/i,
      /amazon\.com/i
    ];
    
    for (const pattern of exclusionPatterns) {
      if (pattern.test(cleanUrl)) {
        return false;
      }
    }
    
    // 默认返回true，让其他函数进一步筛选
    return true;
  } catch (e) {
    return false;
  }
}

// 从候选URL中选择最佳的文档网站
async function findBestDocSite(candidates: string[]): Promise<string | null> {
  try {
    // 给每个候选评分
    const scoredCandidates = [];
    
    for (const url of candidates) {
      let score = 0;
      
      // 根据URL模式评分
      for (const { pattern, score: patternScore } of DOC_PATTERNS) {
        if (pattern.test(url)) {
          score += patternScore;
        }
      }
      
      try {
        // 尝试访问URL
        const response = await fetch(url);
        if (response.ok) {
          // 成功访问加分
          score += 5;
          
          // 检查页面内容
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            const html = await response.text();
            
            // 检查页面标题中是否包含文档关键词
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              const title = titleMatch[1].toLowerCase();
              if (/docs|documentation|reference|guide|manual|api/i.test(title)) {
                score += 5;
              }
            }
            
            // 检查页面中文档相关元素的数量
            const docElements = (html.match(/<(h[1-6]|section|article|code|pre)[^>]*>/gi) || []).length;
            score += Math.min(docElements / 10, 5); // 最多加5分
          }
        }
      } catch (e) {
        // 无法访问的URL得分降低
        score -= 10;
      }
      
      scoredCandidates.push({ url, score });
    }
    
    // 按得分排序
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // 返回得分最高的URL
    return scoredCandidates.length > 0 ? scoredCandidates[0].url : null;
  } catch (error) {
    console.error("查找最佳文档网站时出错:", error);
    return candidates.length > 0 ? candidates[0] : null;
  }
}

// 提取网站的子链接
async function extractSublinks(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    const sublinks = new Set<string>();
    
    // 提取所有链接
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    const baseUrl = new URL(url);
    
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        let link = match[1];
        
        // 跳过锚点链接
        if (link.startsWith('#')) {
          continue;
        }
        
        // 跳过JavaScript链接
        if (link.startsWith('javascript:')) {
          continue;
        }
        
        // 转换相对路径为绝对路径
        if (!link.startsWith('http')) {
          if (link.startsWith('/')) {
            link = `${baseUrl.protocol}//${baseUrl.host}${link}`;
          } else {
            link = `${baseUrl.protocol}//${baseUrl.host}/${link}`;
          }
        }
        
        // 确保链接来自同一网站
        const linkUrl = new URL(link);
        if (linkUrl.host === baseUrl.host) {
          // 过滤明显不是文档页面的链接
          if (isDocLink(link)) {
            sublinks.add(link);
          }
        }
      } catch (e) {
        // 忽略无效的URL
      }
    }
    
    // 将集合转换为数组并限制数量
    return Array.from(sublinks).slice(0, 20);
  } catch (error) {
    console.error("提取子链接时出错:", error);
    return [];
  }
}

// 判断链接是否可能是文档页面
function isDocLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // 检查路径中是否包含文档相关关键词
    const docKeywords = [
      'doc', 'docs', 'documentation', 'reference', 'guide', 'tutorial', 
      'manual', 'api', 'help', 'learn', 'howto', 'faq', 'example', 'quickstart'
    ];
    
    for (const keyword of docKeywords) {
      if (path.includes(keyword)) {
        return true;
      }
    }
    
    // 检查是否以.html或.md结尾
    if (path.endsWith('.html') || path.endsWith('.md')) {
      return true;
    }
    
    // 检查是否有很深的路径结构（可能是文档）
    const pathSegments = path.split('/').filter(p => p);
    if (pathSegments.length >= 2) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
} 