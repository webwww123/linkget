import { Handlers } from "$fresh/server.ts";

// 从环境变量获取KV访问令牌
// const KV_TOKEN = Deno.env.get("DENO_KV_ACCESS_TOKEN");

// 初始化KV数据库
// 在Deno Deploy环境中，不需要提供URL参数
// 在本地环境中，我们可以使用--unstable-kv标志启动
const kv = await Deno.openKv();

interface HierarchyNode {
  _links: string[];
  _fullPath: string;
  _isExpanded: boolean;
  _originalUrl?: string;
  [key: string]: any;
}

interface Favorite {
  id: string;
  userId: string;
  rootUrl: string;
  title: string;
  links?: string[];
  hierarchy?: HierarchyNode;
  extractedAt: number;
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

export const handler: Handlers = {
  // 获取所有收藏
  async GET(req) {
    try {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      
      if (!userId) {
        return Response.json(
          { error: "用户ID是必需的" },
          { status: 400 }
        );
      }
      
      // 从KV数据库中获取用户的所有收藏
      const favorites: Favorite[] = [];
      const entries = kv.list<Favorite>({ prefix: ["favorites", userId] });
      
      for await (const entry of entries) {
        favorites.push(entry.value);
      }
      
      return Response.json({ favorites });
    } catch (error) {
      console.error("获取收藏时出错:", error);
      return Response.json(
        { error: "获取收藏时出错" },
        { status: 500 }
      );
    }
  },

  // 添加新收藏
  async POST(req) {
    try {
      const body = await req.json();
      const { userId, url, title, links } = body;
      
      if (!userId || (!url && !links)) {
        return Response.json(
          { error: "用户ID和URL(或链接列表)是必需的" },
          { status: 400 }
        );
      }
      
      // 创建一个唯一ID
      const id = crypto.randomUUID();
      
      let favorite: Favorite;
      
      if (links && Array.isArray(links)) {
        // 如果提供了链接列表，则创建层级结构
        const hierarchy = organizeLinksHierarchically(links);
        // 从第一个链接获取根URL，或者使用title
        const rootUrl = links.length > 0 ? new URL(links[0]).hostname : title;
        
        favorite = {
          id,
          userId,
          rootUrl,
          title: title || rootUrl,
          links,
          hierarchy,
          extractedAt: Date.now(),
        };
      } else {
        // 如果只提供了单个URL，创建简单收藏
        favorite = {
          id,
          userId,
          rootUrl: new URL(url).hostname,
          title: title || url,
          links: [url],
          extractedAt: Date.now(),
        };
      }
      
      // 保存到KV数据库
      await kv.set(["favorites", userId, id], favorite);
      
      return Response.json({ success: true, favorite });
    } catch (error) {
      console.error("添加收藏时出错:", error);
      return Response.json(
        { error: "添加收藏时出错" },
        { status: 500 }
      );
    }
  },

  // 删除收藏
  async DELETE(req) {
    try {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      const linkId = url.searchParams.get("linkId");
      
      if (!userId || !linkId) {
        return Response.json(
          { error: "用户ID和链接ID是必需的" },
          { status: 400 }
        );
      }
      
      // 从KV数据库中删除
      await kv.delete(["favorites", userId, linkId]);
      
      return Response.json({ success: true });
    } catch (error) {
      console.error("删除收藏时出错:", error);
      return Response.json(
        { error: "删除收藏时出错" },
        { status: 500 }
      );
    }
  },

  // 处理CORS预检请求
  OPTIONS() {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}; 