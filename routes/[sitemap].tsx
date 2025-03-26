/// <reference lib="deno.unstable" />
import { Handlers, PageProps } from "$fresh/server.ts";

// 初始化KV数据库
const kv = await Deno.openKv();

interface SitemapData {
  id: string;
  userId: string;
  fileName: string;
  title: string;
  links: string[];
  xml: string;
  createdAt: number;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    const slug = ctx.params.sitemap;
    
    // 检查是否是请求XML文件
    if (slug.endsWith(".xml")) {
      // 从文件名中提取ID - 例如：sitemap_example_com.xml
      const fileName = slug;
      
      // 查找匹配此文件名的所有sitemap
      const allSitemaps = [];
      const entries = kv.list<SitemapData>({ prefix: ["sitemaps"] });
      
      for await (const entry of entries) {
        if (entry.value.fileName === fileName) {
          allSitemaps.push(entry.value);
        }
      }
      
      // 如果找到匹配的sitemap，返回第一个
      if (allSitemaps.length > 0) {
        return new Response(allSitemaps[0].xml, {
          headers: {
            "Content-Type": "application/xml",
          },
        });
      }
    }
    
    // 如果没有找到匹配的sitemap，返回404
    return new Response("Not Found", { status: 404 });
  }
}; 