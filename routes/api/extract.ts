import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const formData = await req.formData();
      const url = formData.get("url")?.toString();
      
      if (!url) {
        return new Response(JSON.stringify({ error: "URL is required" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // 验证URL格式
      let targetUrl;
      try {
        targetUrl = new URL(url);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid URL format" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // 获取页面内容
      let response;
      try {
        response = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          },
          redirect: "follow"
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: `Network error: ${error.message}` }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // 检查内容类型
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        return new Response(JSON.stringify({ error: "The URL does not point to an HTML page" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      const html = await response.text();
      
      // 使用正则表达式提取链接
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      const links = [];
      let match;
      
      while ((match = linkRegex.exec(html)) !== null) {
        try {
          // 提取链接并转为绝对URL
          const link = new URL(match[1], targetUrl.toString()).href;
          
          // 只保留链接的前部分，去除空格后面的内容
          const cleanLink = link.split(/\s+/)[0];
          
          if (cleanLink && !links.includes(cleanLink)) {
            links.push(cleanLink);
          }
        } catch (e) {
          // 忽略无效的URL
          console.warn("Invalid URL found:", match[1]);
        }
      }

      return new Response(JSON.stringify({ 
        links,
        originalUrl: targetUrl.toString(),
        totalLinks: links.length 
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error) {
      console.error("Error extracting links:", error);
      return new Response(JSON.stringify({ error: `Error extracting links: ${error.message}` }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  },

  OPTIONS(req) {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
}; 