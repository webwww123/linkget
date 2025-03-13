import { useEffect, useState } from "preact/hooks";
import { useSignal } from "@preact/signals";

// 生成一个持久的用户ID
function getUserId() {
  if (typeof localStorage !== 'undefined') {
    let userId = localStorage.getItem("linkExtractor_userId");
    
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("linkExtractor_userId", userId);
    }
    
    return userId;
  }
  return "anonymous";
}

// 将链接转换为层级结构
function organizeLinksHierarchically(links: string[]) {
  const hierarchy: any = {};
  
  links.forEach(link => {
    try {
      // 解析URL
      const url = new URL(link);
      const hostPath = url.hostname + url.pathname;
      // 按路径分割
      const parts = hostPath.split('/').filter(p => p);
      
      // 递归构建层级树
      let current = hierarchy;
      let currentPath = '';
      
      // 先添加域名作为第一级
      const domain = parts[0];
      if (!current[domain]) {
        current[domain] = {
          _links: [],
          _fullPath: domain,
          _isExpanded: true,
          _originalUrl: `${url.protocol}//${domain}`
        };
      }
      current[domain]._links.push(link);
      current = current[domain];
      currentPath = domain;
      
      // 添加剩余路径
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!current[part]) {
          current[part] = {
            _links: [],
            _fullPath: currentPath,
            _isExpanded: i < 3, // 默认展开前三级
            _originalUrl: link.substring(0, link.indexOf(currentPath) + currentPath.length)
          };
        }
        
        current[part]._links.push(link);
        current = current[part];
      }
    } catch (e) {
      console.error("无法解析URL:", link, e);
    }
  });
  
  return hierarchy;
}

interface HierarchyNode {
  _links: string[];
  _fullPath: string;
  _isExpanded: boolean;
  _originalUrl?: string;
  [key: string]: any;
}

interface HierarchicalFavorite {
  id: string;
  userId: string;
  rootUrl: string;
  hierarchy: HierarchyNode;
  extractedAt: number;
  title: string;
  links?: string[];
}

export default function HierarchicalLinks() {
  const [favorites, setFavorites] = useState<HierarchicalFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [copiedNodes, setCopiedNodes] = useState<Record<string, boolean>>({});
  const userId = typeof window !== 'undefined' ? getUserId() : "anonymous";
  
  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFavorite, setSelectedFavorite] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<{
    favoriteId: string;
    title: string;
    links: string[];
  }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 加载收藏的链接
  useEffect(() => {
    fetchFavorites();
  }, []);
  
  // 获取收藏的链接
  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/favorites?userId=${userId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取收藏失败");
      }
      
      const data = await response.json();
      setFavorites(data.favorites || []);
    } catch (err) {
      setError(`加载收藏时出错: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 移除收藏
  const removeFavorite = async (id: string) => {
    try {
      const response = await fetch(`/api/favorites?userId=${userId}&linkId=${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除收藏失败");
      }
      
      // 更新收藏列表
      setFavorites(favorites.filter(fav => fav.id !== id));
    } catch (err) {
      setError(`删除收藏时出错: ${err.message}`);
    }
  };
  
  // 复制节点下的链接到剪贴板
  const copyNodeLinks = async (links: string[], path: string) => {
    try {
      const text = links.join('\n');
      await navigator.clipboard.writeText(text);
      
      // 设置复制状态
      setCopiedNodes(prev => ({ ...prev, [path]: true }));
      
      // 显示成功提示
      setError(`已成功复制 ${links.length} 个链接！`);
      
      // 2秒后重置复制状态和提示
      setTimeout(() => {
        setCopiedNodes(prev => ({ ...prev, [path]: false }));
        setError(null);
      }, 2000);
    } catch (err) {
      setError(`复制到剪贴板时出错: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // 切换展开/折叠状态
  const toggleExpanded = (path: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };
  
  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 递归渲染层级节点
  const renderHierarchy = (node: HierarchyNode, nodeName: string, path: string, level: number) => {
    const isExpanded = expandedNodes[path] !== undefined ? expandedNodes[path] : node._isExpanded;
    const childKeys = Object.keys(node).filter(k => !k.startsWith('_'));
    const hasChildren = childKeys.length > 0;
    
    return (
      <li key={path} class={`hierarchy-node level-${level}`}>
        <div class={`node-header ${hasChildren ? 'has-children' : ''}`}>
          {hasChildren && (
            <button 
              onClick={() => toggleExpanded(path)}
              class="toggle-btn"
              aria-label={isExpanded ? '折叠' : '展开'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          <span class="node-name">
            {nodeName}
            {node._links && (
              <span class="link-count">({node._links.length})</span>
            )}
          </span>
          
          <div class="node-actions">
            {node._links && node._links.length > 0 && (
              <button 
                onClick={() => copyNodeLinks(node._links, path)}
                class={`action-btn copy-btn ${copiedNodes[path] ? 'bg-green-100 text-green-800' : ''}`}
                title="复制全部链接"
              >
                {copiedNodes[path] ? '已复制!' : '复制链接'}
              </button>
            )}
            
            {node._originalUrl && (
              <a 
                href={node._originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                class="action-btn visit-btn"
                title="访问链接"
              >
                访问
              </a>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <ul class={`hierarchy-level level-${level + 1}`}>
            {childKeys.map(key => renderHierarchy(node[key], key, `${path}/${key}`, level + 1))}
          </ul>
        )}
        
        {isExpanded && node._links && node._links.length > 0 && level > 2 && (
          <ul class="leaf-links">
            {node._links.map((link, i) => (
              <li key={`${link}-${i}`} class="leaf-link">
                <a href={link} target="_blank" rel="noopener noreferrer" class="link-url">
                  {new URL(link).pathname.split('/').pop() || link}
                </a>
                <button 
                  onClick={() => copyNodeLinks([link], `${path}-single-${i}`)}
                  class={`copy-single-btn ${copiedNodes[`${path}-single-${i}`] ? 'bg-green-100 text-green-800' : ''}`}
                  title="复制链接"
                >
                  {copiedNodes[`${path}-single-${i}`] ? '已复制' : '复制'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  // 计算字符串相似度 (Levenshtein距离的简化版本)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // 完全匹配
    if (s1 === s2) return 1;
    
    // 包含关系
    if (s1.includes(s2) || s2.includes(s1)) {
      const longerLength = Math.max(s1.length, s2.length);
      const shorterLength = Math.min(s1.length, s2.length);
      return shorterLength / longerLength;
    }
    
    // 字符重叠检查
    let matches = 0;
    for (let i = 0; i < s1.length; i++) {
      if (s2.includes(s1[i])) matches++;
    }
    return matches / Math.max(s1.length, s2.length);
  };

  // 执行搜索
  const performSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      const results: {
        favoriteId: string;
        title: string;
        links: string[];
      }[] = [];
      
      const searchTermLower = searchTerm.trim().toLowerCase();
      // 短关键词使用更低的阈值
      const similarityThreshold = searchTermLower.length <= 3 ? 0.2 : 0.3;
      
      favorites.forEach(favorite => {
        // 如果选择了特定收藏，只在该收藏中搜索
        if (selectedFavorite !== 'all' && favorite.id !== selectedFavorite) {
          return;
        }
        
        const matchedLinks: string[] = [];
        
        // 递归搜索链接
        const searchInHierarchy = (node: HierarchyNode) => {
          if (node._links) {
            node._links.forEach(link => {
              try {
                const url = new URL(link);
                // 同时检查域名和路径
                const hostname = url.hostname.toLowerCase();
                const pathname = url.pathname.toLowerCase();
                const fullUrlLower = link.toLowerCase();
                
                // 精确匹配：如果URL的任何部分包含搜索词，直接匹配
                if (hostname.includes(searchTermLower) || 
                    pathname.includes(searchTermLower) || 
                    fullUrlLower.includes(searchTermLower)) {
                  matchedLinks.push(link);
                  return; // 已找到匹配，跳过相似度检查
                }
                
                // 如果没有直接包含，再尝试相似度匹配
                // 对域名检查相似度
                const hostnameSimilarity = calculateSimilarity(searchTermLower, hostname);
                if (hostnameSimilarity > similarityThreshold) {
                  matchedLinks.push(link);
                  return;
                }
                
                // 对路径检查相似度
                const pathSimilarity = calculateSimilarity(searchTermLower, pathname);
                if (pathSimilarity > similarityThreshold) {
                  matchedLinks.push(link);
                  return;
                }
                
                // 检查路径的各个部分
                const pathParts = pathname.split('/').filter(p => p);
                for (const part of pathParts) {
                  if (part.includes(searchTermLower) || 
                      calculateSimilarity(searchTermLower, part) > similarityThreshold) {
                    matchedLinks.push(link);
                    return;
                  }
                }
              } catch (e) {
                // 忽略无效URL
              }
            });
          }
          
          // 递归搜索子节点
          Object.keys(node).filter(k => !k.startsWith('_')).forEach(key => {
            searchInHierarchy(node[key]);
          });
        };
        
        const hierarchy = favorite.hierarchy || organizeLinksHierarchically(favorite.links || []);
        Object.keys(hierarchy).filter(k => !k.startsWith('_')).forEach(key => {
          searchInHierarchy(hierarchy[key]);
        });
        
        if (matchedLinks.length > 0) {
          results.push({
            favoriteId: favorite.id,
            title: favorite.title || favorite.rootUrl,
            links: matchedLinks
          });
        }
      });
      
      setSearchResults(results);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`搜索时出错: ${errorMessage}`);
    } finally {
      setIsSearching(false);
    }
  };
  
  // 当搜索词或选定的收藏变化时执行搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length > 0) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300); // 添加延迟以减少频繁搜索
    
    return () => clearTimeout(timer);
  }, [searchTerm, selectedFavorite, favorites]);

  return (
    <div class="w-full max-w-4xl mx-auto p-4 hierarchical-links">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">层级链接管理</h2>
        
        <button
          onClick={fetchFavorites}
          class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
      
      {/* 搜索区域 */}
      {favorites.length > 0 && (
        <div class="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 class="text-lg font-medium mb-3">搜索收藏链接</h3>
          <div class="flex flex-col sm:flex-row gap-3">
            <select 
              class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1 sm:max-w-xs"
              value={selectedFavorite}
              onChange={(e) => setSelectedFavorite((e.target as HTMLSelectElement).value)}
            >
              <option value="all">所有收藏</option>
              {favorites.map(fav => (
                <option key={fav.id} value={fav.id}>
                  {fav.title || fav.rootUrl}
                </option>
              ))}
            </select>
            
            <div class="flex flex-1 relative">
              <input 
                type="text" 
                placeholder="输入搜索关键词 (支持模糊搜索)" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
              />
              {searchTerm && (
                <button 
                  class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchTerm('')}
                  aria-label="清除搜索"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* 搜索结果区域 */}
          {isSearching ? (
            <div class="flex justify-center items-center p-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : searchTerm.trim() && searchResults.length === 0 ? (
            <div class="p-4 text-center text-gray-500">
              未找到与"{searchTerm}"相关的链接
            </div>
          ) : searchResults.length > 0 && (
            <div class="mt-4 border-t pt-4">
              <h4 class="font-medium mb-2">搜索结果: {searchResults.reduce((acc, curr) => acc + curr.links.length, 0)} 个链接</h4>
              <div class="space-y-4">
                {searchResults.map(result => (
                  <div key={result.favoriteId} class="p-3 bg-gray-50 rounded-lg">
                    <h5 class="font-medium mb-2 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {result.title}
                    </h5>
                    <ul class="space-y-1">
                      {result.links.map((link, i) => (
                        <li key={`${result.favoriteId}-${i}`} class="flex items-center py-1 px-2 hover:bg-gray-100 rounded">
                          <a href={link} target="_blank" rel="noopener noreferrer" class="flex-1 overflow-hidden text-overflow-ellipsis text-blue-600 hover:underline">
                            {new URL(link).pathname}
                          </a>
                          <button 
                            onClick={() => copyNodeLinks([link], `search-${result.favoriteId}-${i}`)}
                            class={`px-2 py-1 text-xs ${copiedNodes[`search-${result.favoriteId}-${i}`] ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-200'} rounded`}
                          >
                            {copiedNodes[`search-${result.favoriteId}-${i}`] ? '已复制' : '复制'}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {result.links.length > 1 && (
                      <div class="mt-2 flex justify-end">
                        <button 
                          onClick={() => copyNodeLinks(result.links, `search-all-${result.favoriteId}`)}
                          class={`px-3 py-1 text-sm ${copiedNodes[`search-all-${result.favoriteId}`] ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} rounded-lg flex items-center gap-1`}
                        >
                          {copiedNodes[`search-all-${result.favoriteId}`] ? '已复制全部!' : '复制全部链接'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div class={`p-4 mb-6 ${error.includes('成功') ? 'bg-green-100 border-l-4 border-green-500 text-green-700' : 'bg-red-100 border-l-4 border-red-500 text-red-700'} transition-opacity duration-300`}>
          <p>{error}</p>
        </div>
      )}
      
      {loading ? (
        <div class="flex justify-center items-center p-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : favorites.length === 0 ? (
        <div class="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
          <p>您还没有收藏任何链接</p>
          <p class="mt-2 text-sm">当您浏览并提取网页链接时，可以点击星标图标添加收藏</p>
        </div>
      ) : (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
          {favorites.map(favorite => {
            // 构造层级结构
            const hierarchy = favorite.hierarchy || organizeLinksHierarchically(favorite.links || []);
            
            return (
              <div key={favorite.id} class="favorite-group mb-6 border-b pb-6">
                <div class="favorite-header flex justify-between items-center p-4">
                  <h3 class="text-lg font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {favorite.title || favorite.rootUrl}
                  </h3>
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500">
                      {formatDate(favorite.extractedAt)}
                    </span>
                    <button
                      onClick={() => removeFavorite(favorite.id)}
                      class="p-1.5 text-gray-400 hover:text-red-500 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300"
                      title="删除收藏"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="hierarchy-container p-4">
                  <ul class="hierarchy-root">
                    {Object.keys(hierarchy).filter(k => !k.startsWith('_')).map(key => 
                      renderHierarchy(hierarchy[key], key, key, 0)
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <style>{`
        .hierarchical-links .hierarchy-node {
          list-style: none;
          margin-bottom: 2px;
        }
        
        .hierarchical-links .node-header {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .hierarchical-links .node-header:hover {
          background-color: #f3f4f6;
        }
        
        .hierarchical-links .has-children {
          font-weight: 500;
        }
        
        .hierarchical-links .toggle-btn {
          background: none;
          border: none;
          width: 24px;
          height: 24px;
          font-size: 10px;
          cursor: pointer;
          color: #6b7280;
          margin-right: 4px;
        }
        
        .hierarchical-links .node-name {
          flex: 1;
          word-break: break-word;
        }
        
        .hierarchical-links .link-count {
          font-size: 0.85em;
          color: #6b7280;
          margin-left: 4px;
        }
        
        .hierarchical-links .node-actions {
          display: flex;
          gap: 8px;
        }
        
        .hierarchical-links .action-btn {
          border: none;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          cursor: pointer;
          background-color: #f3f4f6;
          color: #1f2937;
          text-decoration: none;
        }
        
        .hierarchical-links .copy-btn:hover {
          background-color: #e5e7eb;
        }
        
        .hierarchical-links .visit-btn {
          background-color: #dbeafe;
          color: #1e40af;
        }
        
        .hierarchical-links .visit-btn:hover {
          background-color: #bfdbfe;
        }
        
        .hierarchical-links .hierarchy-level {
          margin-left: 20px;
          padding-left: 0;
        }
        
        .hierarchical-links .leaf-links {
          margin-left: 20px;
          padding-left: 0;
          border-left: 1px dashed #e5e7eb;
        }
        
        .hierarchical-links .leaf-link {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          font-size: 0.9em;
          list-style: none;
        }
        
        .hierarchical-links .leaf-link:hover {
          background-color: #f9fafb;
        }
        
        .hierarchical-links .link-url {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #2563eb;
          text-decoration: none;
        }
        
        .hierarchical-links .link-url:hover {
          text-decoration: underline;
        }
        
        .hierarchical-links .copy-single-btn {
          background: none;
          border: none;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          color: #6b7280;
          cursor: pointer;
        }
        
        .hierarchical-links .copy-single-btn:hover {
          background-color: #f3f4f6;
          color: #1f2937;
        }
        
        .hierarchical-links .level-0 > .node-header {
          font-weight: bold;
          background-color: #f9fafb;
        }
        
        .hierarchical-links .level-1 > .node-header {
          font-weight: 500;
        }
        
        .hierarchical-links .favorite-group:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
      `}</style>
    </div>
  );
} 