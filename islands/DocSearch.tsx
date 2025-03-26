import { useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";

// 获取持久的用户ID
function getUserId() {
  if (typeof localStorage !== "undefined") {
    let userId = localStorage.getItem("linkExtractor_userId");
    
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("linkExtractor_userId", userId);
    }
    
    return userId;
  }
  return "anonymous";
}

interface DocSearchResult {
  keyword: string;
  docSites: string[];
  mainDocUrl: string | null;
  sublinks: string[];
  timestamp: number;
}

export default function DocSearch() {
  const keyword = useSignal("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<DocSearchResult | null>(null);
  const [historicalSearches, setHistoricalSearches] = useState<{keyword: string, timestamp: number}[]>([]);
  const userId = typeof window !== "undefined" ? getUserId() : "anonymous";
  
  // 加载历史搜索记录
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const history = localStorage.getItem(`docSearchHistory_${userId}`);
        if (history) {
          setHistoricalSearches(JSON.parse(history));
        }
      } catch (e) {
        console.error("加载搜索历史记录失败:", e);
      }
    }
  }, [userId]);
  
  // 保存历史搜索记录
  const saveSearchToHistory = (keyword: string) => {
    if (typeof localStorage !== "undefined") {
      try {
        // 获取现有历史记录
        const existingHistory = [...historicalSearches];
        
        // 移除可能存在的相同关键词记录
        const filteredHistory = existingHistory.filter(
          item => item.keyword.toLowerCase() !== keyword.toLowerCase()
        );
        
        // 添加新记录
        const newHistory = [
          { keyword, timestamp: Date.now() },
          ...filteredHistory
        ].slice(0, 10); // 只保留最近10条记录
        
        // 更新状态
        setHistoricalSearches(newHistory);
        
        // 保存到localStorage
        localStorage.setItem(`docSearchHistory_${userId}`, JSON.stringify(newHistory));
      } catch (e) {
        console.error("保存搜索历史记录失败:", e);
      }
    }
  };
  
  // 搜索文档
  const searchDocs = async (e: Event) => {
    e.preventDefault();
    
    if (!keyword.value.trim()) {
      setError("请输入搜索关键词");
      return;
    }
    
    setError(null);
    setSearching(true);
    
    try {
      const response = await fetch("/api/docsearch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: keyword.value.trim(),
          userId,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "搜索文档失败");
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResult(data);
        // 保存到历史记录
        saveSearchToHistory(keyword.value.trim());
      } else {
        throw new Error(data.error || "搜索文档失败");
      }
    } catch (err) {
      setError(`搜索失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSearching(false);
    }
  };
  
  // 加载历史搜索
  const loadHistoricalSearch = (historicalKeyword: string) => {
    keyword.value = historicalKeyword;
    // 立即执行搜索
    searchDocs(new Event("submit") as Event);
  };
  
  // 提取域名
  const extractDomain = (url: string) => {
    try {
      const domainMatch = url.match(/https?:\/\/([^/]+)/i);
      return domainMatch ? domainMatch[1] : url;
    } catch (e) {
      return url;
    }
  };
  
  // 格式化URL显示
  const formatUrl = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      if (path.length <= 20) return url;
      
      // 截断中间的路径部分
      const pathSegments = path.split('/');
      if (pathSegments.length > 4) {
        const start = pathSegments.slice(0, 2).join('/');
        const end = pathSegments.slice(-2).join('/');
        const formattedPath = `${start}/.../${end}`;
        return `${urlObj.protocol}//${urlObj.host}${formattedPath}${urlObj.search}`;
      }
      
      return url;
    } catch (e) {
      // 如果解析失败，简单截断
      return url.substring(0, maxLength - 3) + "...";
    }
  };
  
  // 格式化时间戳
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
  return (
    <div class="max-w-screen-lg mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">文档智能搜索 <span class="text-xs bg-blue-100 text-blue-800 rounded px-2 py-1">Beta</span></h1>
      <p class="text-gray-600 mb-4">输入关键词（如公司或产品名称），自动查找相关文档站点</p>
      
      <div class="flex flex-wrap gap-4">
        <div class="w-full lg:w-1/3">
          {/* 搜索表单 */}
          <form onSubmit={searchDocs} class="mb-6 bg-white rounded-lg shadow-sm p-4">
            <div class="flex flex-col">
              <input
                type="text"
                value={keyword.value}
                onChange={(e) => keyword.value = (e.target as HTMLInputElement).value}
                placeholder="输入关键词 (例如: vercel, react, deno)"
                class="py-2 px-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <button
                type="submit"
                class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                disabled={searching}
              >
                {searching ? "搜索中..." : "搜索文档"}
              </button>
            </div>
          </form>
          
          {/* 历史搜索记录 */}
          {historicalSearches.length > 0 && (
            <div class="mb-6 bg-white rounded-lg shadow-sm p-4">
              <h2 class="text-lg font-semibold mb-2">历史搜索</h2>
              <ul class="space-y-1">
                {historicalSearches.map((item) => (
                  <li key={item.keyword} class="flex justify-between items-center">
                    <button
                      onClick={() => loadHistoricalSearch(item.keyword)}
                      class="text-blue-600 hover:underline text-left flex-grow truncate"
                    >
                      {item.keyword}
                    </button>
                    <span class="text-xs text-gray-500">{formatDate(item.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div class="w-full lg:w-3/5">
          {/* 错误提示 */}
          {error && (
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {/* 搜索结果 */}
          {searchResult && (
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="mb-4">
                <h2 class="text-xl font-semibold">
                  搜索结果: {searchResult.keyword}
                </h2>
                <p class="text-sm text-gray-500">
                  找到 {searchResult.docSites.length} 个文档站点
                  {searchResult.timestamp && ` • ${formatDate(searchResult.timestamp)}`}
                </p>
              </div>
              
              {/* 主文档URL */}
              {searchResult.mainDocUrl && (
                <div class="mb-4">
                  <h3 class="font-medium text-lg mb-1">推荐文档站点</h3>
                  <a 
                    href={searchResult.mainDocUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:underline block mb-2 bg-blue-50 p-2 rounded border-l-4 border-blue-500"
                  >
                    {searchResult.mainDocUrl}
                  </a>
                </div>
              )}
              
              {/* 子链接 */}
              {searchResult.sublinks && searchResult.sublinks.length > 0 && (
                <div class="mb-4">
                  <h3 class="font-medium text-lg mb-1">相关文档页面</h3>
                  <ul class="space-y-2 border rounded-lg p-2 bg-gray-50">
                    {searchResult.sublinks.map((link, index) => (
                      <li key={index} class="border-b last:border-b-0 pb-2 last:pb-0">
                        <a 
                          href={link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:underline text-sm block"
                        >
                          {formatUrl(link)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 所有找到的文档站点 */}
              {searchResult.docSites && searchResult.docSites.length > 0 && (
                <div>
                  <h3 class="font-medium text-lg mb-1">所有找到的文档站点</h3>
                  <ul class="space-y-1">
                    {searchResult.docSites.map((site, index) => (
                      <li key={index}>
                        <a 
                          href={site} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:underline text-sm"
                        >
                          {extractDomain(site)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 