import { Handlers } from "$fresh/server.ts";

// 初始化KV数据库
const kv = await Deno.openKv();

interface Favorite {
  id: string;
  userId: string;
  url: string;
  title: string;
  createdAt: number;
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
      const { userId, url, title } = body;
      
      if (!userId || !url) {
        return Response.json(
          { error: "用户ID和URL是必需的" },
          { status: 400 }
        );
      }
      
      // 创建一个唯一ID
      const id = crypto.randomUUID();
      const favorite: Favorite = {
        id,
        userId,
        url,
        title: title || url,
        createdAt: Date.now(),
      };
      
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