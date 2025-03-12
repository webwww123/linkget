import { useSignal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";

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

interface Favorite {
  id: string;
  userId: string;
  url: string;
  title: string;
  createdAt: number;
}

export default function FavoriteLinks() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [allCopied, setAllCopied] = useState(false);
  const userId = typeof window !== 'undefined' ? getUserId() : "anonymous";
  
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
  
  // 复制链接到剪贴板
  const copyToClipboard = async (favorite: Favorite) => {
    try {
      await navigator.clipboard.writeText(favorite.url);
      setCopied(prev => ({ ...prev, [favorite.id]: true }));
      
      // 2秒后重置复制状态
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [favorite.id]: false }));
      }, 2000);
    } catch (err) {
      setError(`复制到剪贴板时出错: ${err.message}`);
    }
  };
  
  // 复制所有链接到剪贴板
  const copyAllToClipboard = async () => {
    try {
      if (favorites.length === 0) return;
      
      const text = favorites.map(fav => fav.url).join('\n');
      await navigator.clipboard.writeText(text);
      
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    } catch (err) {
      setError(`复制所有链接时出错: ${err.message}`);
    }
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

  return (
    <div class="w-full max-w-4xl mx-auto p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">我的收藏</h2>
        
        {favorites.length > 0 && (
          <button
            onClick={copyAllToClipboard}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {allCopied ? "已复制所有链接!" : "复制所有链接"}
          </button>
        )}
      </div>
      
      {error && (
        <div class="p-4 mb-4 bg-red-100 border-l-4 border-red-500 text-red-700">
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
          <ul class="divide-y divide-gray-200">
            {favorites.map((favorite) => (
              <li key={favorite.id} class="p-4 hover:bg-gray-50">
                <div class="flex justify-between items-start">
                  <div class="flex-1 mr-4">
                    <a 
                      href={favorite.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="text-blue-600 hover:underline font-medium break-all"
                    >
                      {favorite.title}
                    </a>
                    <p class="text-sm text-gray-500 mt-1">{formatDate(favorite.createdAt)}</p>
                  </div>
                  <div class="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(favorite)}
                      class="p-1.5 text-gray-400 hover:text-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300"
                      title="复制链接"
                    >
                      {copied[favorite.id] ? (
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      )}
                    </button>
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 