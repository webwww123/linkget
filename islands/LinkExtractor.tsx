import { useSignal } from "@preact/signals";
import { useState } from "preact/hooks";

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

export default function LinkExtractor() {
  const url = useSignal("");
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>({});
  const [favoriteSaving, setFavoriteSaving] = useState<Record<string, boolean>>({});
  const userId = typeof window !== 'undefined' ? getUserId() : "anonymous";

  const extractLinks = async (e: Event) => {
    e.preventDefault();
    setLinks([]);
    setError(null);
    setCopied(false);
    setLoading(true);
    setFavoriteStatus({});

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
        setLinks(data.links || []);
      }
    } catch (err) {
      setError(`发生错误: ${err.message}`);
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
          setError(`复制失败: ${err.message}`);
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
          const favorite = data.favorites.find(f => f.url === link);
          
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
      setError(`收藏操作失败: ${err.message}`);
    } finally {
      setFavoriteSaving(prev => ({ ...prev, [link]: false }));
    }
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
        <div class="p-4 mb-6 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}

      {links.length > 0 && (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div class="flex justify-between items-center p-4 border-b">
            <h2 class="text-lg font-medium">提取到 {links.length} 个链接</h2>
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
          <div class="p-4 max-h-96 overflow-y-auto">
            <ul class="space-y-2">
              {links.map((link, index) => (
                <li key={index} class="break-all hover:bg-gray-50 p-2 rounded flex justify-between items-start group">
                  <a href={link} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline flex-1">
                    {link}
                  </a>
                  <button
                    onClick={() => toggleFavorite(link)}
                    disabled={favoriteSaving[link]}
                    class="ml-2 p-1.5 text-gray-400 group-hover:text-gray-500 hover:text-yellow-500 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    title={favoriteStatus[link] ? "取消收藏" : "收藏链接"}
                  >
                    {favoriteStatus[link] ? (
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 