import { useSignal } from "@preact/signals";
import { useState, useEffect } from "preact/hooks";

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

export default function LinkExtractor() {
  const url = useSignal("");
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>({});
  const [favoriteSaving, setFavoriteSaving] = useState<Record<string, boolean>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [linksHierarchy, setLinksHierarchy] = useState<any>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [copiedNodes, setCopiedNodes] = useState<Record<string, boolean>>({});
  const userId = typeof window !== 'undefined' ? getUserId() : "anonymous";

  const extractLinks = async (e: Event) => {
    e.preventDefault();
    setLinks([]);
    setError(null);
    setCopied(false);
    setLoading(true);
    setFavoriteStatus({});
    setLinksHierarchy({});

    try {
      if (!url.value) {
        setError("请输入URL");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("url", url.value);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "提取链接时出错");
      } else {
        const extractedLinks = data.links || [];
        setLinks(extractedLinks);
        // 组织链接为层级结构
        if (extractedLinks.length > 0) {
          const hierarchy = organizeLinksHierarchically(extractedLinks);
          setLinksHierarchy(hierarchy);
        }
      }
    } catch (err) {
      setError(`发生错误: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (links.length > 0) {
      const text = links.join("\n");
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          setError(`复制失败: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
  };
  
  // 收藏链接
  const toggleFavorite = async (link: string) => {
    try {
      // 避免重复点击
      if (favoriteSaving[link]) return;
      
      // 设置保存状态
      setFavoriteSaving(prev => ({ ...prev, [link]: true }));
      
      if (favoriteStatus[link]) {
        // 查找该链接的ID并删除
        const response = await fetch(`/api/favorites?userId=${userId}`, {
          method: "GET",
        });
        
        if (response.ok) {
          const data = await response.json();
          const favorite = data.favorites.find((f: any) => f.links && f.links.includes(link));
          
          if (favorite) {
            await fetch(`/api/favorites?userId=${userId}&linkId=${favorite.id}`, {
              method: "DELETE",
            });
            
            setFavoriteStatus(prev => ({ ...prev, [link]: false }));
          }
        }
      } else {
        // 添加到收藏
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            url: link,
            title: link,
          }),
        });
        
        if (response.ok) {
          setFavoriteStatus(prev => ({ ...prev, [link]: true }));
        }
      }
    } catch (err) {
      setError(`收藏操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFavoriteSaving(prev => ({ ...prev, [link]: false }));
    }
  };
  
  // 批量保存所有链接
  const saveAllLinks = async () => {
    if (links.length === 0) return;
    
    try {
      setSavingBulk(true);
      
      // 用域名作为标题
      let title = "链接集合";
      try {
        if (url.value) {
          const urlObj = new URL(url.value);
          title = urlObj.hostname;
        } else if (links.length > 0) {
          const urlObj = new URL(links[0]);
          title = urlObj.hostname;
        }
      } catch (e) {
        // 忽略解析错误，使用默认标题
      }
      
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          title,
          links,
        }),
      });
      
      if (response.ok) {
        setError(null);
        // 设置所有链接为已收藏状态
        const newStatus: Record<string, boolean> = {};
        links.forEach(link => {
          newStatus[link] = true;
        });
        setFavoriteStatus(newStatus);
        
        // 显示成功消息
        setError(`已成功将所有 ${links.length} 个链接保存为层级收藏!`);
        setTimeout(() => setError(null), 3000);
      } else {
        const data = await response.json();
        throw new Error(data.error || "保存所有链接失败");
      }
    } catch (err) {
      setError(`批量保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingBulk(false);
    }
  };

  // 切换展开/折叠状态
  const toggleExpanded = (path: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
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
                <div class="leaf-actions">
                  <button 
                    onClick={() => copyNodeLinks([link], `${path}-single-${i}`)}
                    class={`copy-single-btn ${copiedNodes[`${path}-single-${i}`] ? 'bg-green-100 text-green-800' : ''}`}
                    title="复制链接"
                  >
                    {copiedNodes[`${path}-single-${i}`] ? '已复制' : '复制'}
                  </button>
                  <button
                    onClick={() => toggleFavorite(link)}
                    disabled={favoriteSaving[link]}
                    class="favorite-btn"
                    title={favoriteStatus[link] ? "取消收藏" : "收藏链接"}
                  >
                    {favoriteStatus[link] ? "★" : "☆"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div class="w-full max-w-4xl mx-auto p-4">
      <h1 class="text-3xl font-bold mb-6 text-center text-gray-800">链接提取器</h1>
      
      <form onSubmit={extractLinks} class="mb-8">
        <div class="flex flex-col md:flex-row gap-4">
          <input
            type="url"
            placeholder="输入网页URL (例如: https://example.com)"
            value={url.value}
            onChange={(e) => url.value = (e.target as HTMLInputElement).value}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "提取中..." : "提取链接"}
          </button>
        </div>
      </form>

      {error && (
        <div class={`p-4 mb-6 ${error.includes('成功') ? 'bg-green-100 border-l-4 border-green-500 text-green-700' : 'bg-red-100 border-l-4 border-red-500 text-red-700'} transition-opacity duration-300`}>
          <p>{error}</p>
        </div>
      )}

      {links.length > 0 && (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
          <div class="flex justify-between items-center p-4 border-b">
            <h2 class="text-lg font-medium">提取到 {links.length} 个链接</h2>
            <div class="flex gap-2">
              <button
                onClick={saveAllLinks}
                disabled={savingBulk}
                class="px-4 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {savingBulk ? "保存中..." : "层级收藏全部"}
              </button>
              <button
                onClick={copyToClipboard}
                class="px-4 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {copied ? "已复制!" : "全部复制"}
              </button>
            </div>
          </div>
          
          {/* 层级化显示链接 */}
          <div class="p-4 max-h-96 overflow-y-auto hierarchical-links">
            {Object.keys(linksHierarchy).length > 0 ? (
              <ul class="hierarchy-root">
                {Object.keys(linksHierarchy).filter(k => !k.startsWith('_')).map(key => 
                  renderHierarchy(linksHierarchy[key], key, key, 0)
                )}
              </ul>
            ) : (
              <div class="text-center text-gray-500 py-4">
                没有找到可组织的链接
              </div>
            )}
          </div>
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
          justify-content: space-between;
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
        
        .hierarchical-links .leaf-actions {
          display: flex;
          gap: 4px;
        }
        
        .hierarchical-links .copy-single-btn, .hierarchical-links .favorite-btn {
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
        
        .hierarchical-links .favorite-btn {
          color: #f59e0b;
        }
        
        .hierarchical-links .level-0 > .node-header {
          font-weight: bold;
          background-color: #f9fafb;
        }
        
        .hierarchical-links .level-1 > .node-header {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
} 