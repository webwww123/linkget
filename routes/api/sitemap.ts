/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";

// 定义Sitemap数据接口
interface SitemapData {
  id: string;
  userId: string;
  fileName: string;
  title: string;
  links: string[];
  xml: string;
  createdAt: number;
}

// 初始化KV数据库
const kv = await Deno.openKv();

// XML生成逻辑
function generateSitemapXML(links: string[]): string {
  // 过滤有效URL
  const validLinks = links.filter(link => {
    try {
      new URL(link);
      return true;
    } catch (e) {
      return false;
    }
  });

  // 开始XML文档
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // 添加每个URL条目
  validLinks.forEach(link => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXML(link)}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  });

  // 关闭XML文档
  xml += '</urlset>';
  return xml;
}

// 转义XML特殊字符
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const handler: Handlers = {
  // 根据传入的链接生成sitemap.xml并存储
  async POST(req) {
    try {
      const body = await req.json();
      const { userId, links, title } = body;

      if (!userId || !links || !Array.isArray(links) || links.length === 0) {
        return Response.json(
          { error: "用户ID和链接列表是必需的" },
          { status: 400 }
        );
      }

      // 生成sitemap XML
      const sitemapXML = generateSitemapXML(links);
      
      // 创建唯一ID
      const id = crypto.randomUUID();
      
      // 创建一个可识别的文件名
      let fileName = title ? `sitemap_${title.replace(/\W+/g, '_').toLowerCase()}` : `sitemap_${id}`;
      if (fileName.length > 50) {
        fileName = fileName.substring(0, 50);
      }
      fileName += '.xml';
      
      // 存储到KV数据库
      const sitemapData = {
        id,
        userId,
        fileName,
        title: title || "Sitemap",
        links,
        xml: sitemapXML,
        createdAt: Date.now(),
      };
      
      await kv.set(["sitemaps", userId, id], sitemapData);
      
      return Response.json({ 
        success: true, 
        sitemap: {
          id,
          fileName,
          title: sitemapData.title,
          createdAt: sitemapData.createdAt,
          links: links.length,
        } 
      });
    } catch (error) {
      console.error("生成Sitemap时出错:", error);
      return Response.json(
        { error: "生成Sitemap时出错" },
        { status: 500 }
      );
    }
  },

  // 获取用户的所有sitemap
  async GET(req) {
    try {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");
      const id = url.searchParams.get("id");
      
      if (!userId) {
        return Response.json(
          { error: "用户ID是必需的" },
          { status: 400 }
        );
      }
      
      // 获取特定的sitemap
      if (id) {
        const sitemapData = await kv.get<SitemapData>(["sitemaps", userId, id]);
        
        if (!sitemapData.value) {
          return Response.json(
            { error: "未找到指定的Sitemap" },
            { status: 404 }
          );
        }
        
        // 返回XML内容
        return new Response(sitemapData.value.xml, {
          headers: {
            "Content-Type": "application/xml",
            "Content-Disposition": `attachment; filename="${sitemapData.value.fileName}"`,
          },
        });
      }
      
      // 获取所有sitemap列表
      const sitemaps = [];
      const entries = kv.list<SitemapData>({ prefix: ["sitemaps", userId] });
      
      for await (const entry of entries) {
        const { id, fileName, title, createdAt, links } = entry.value;
        sitemaps.push({
          id,
          fileName,
          title,
          createdAt,
          links: links.length,
        });
      }
      
      return Response.json({ sitemaps });
    } catch (error) {
      console.error("获取Sitemap时出错:", error);
      return Response.json(
        { error: "获取Sitemap时出错" },
        { status: 500 }
      );
    }
  },
  
  // 处理CORS预检请求
  OPTIONS() {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}; 